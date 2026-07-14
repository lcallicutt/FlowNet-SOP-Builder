import { NonRetriableError } from "inngest";
import { and, eq } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import {
  processingJobs,
  projects,
  subscriptions,
  transcriptSegments,
  transcripts,
  uploadedFiles,
} from "@/db/schema";
import { PLANS, type PlanId } from "@/lib/plans";
import {
  bufferToTempFile,
  extractAudio,
  ffmpegAvailable,
  probeDurationSeconds,
  splitAudio,
  withTempDir,
} from "@/lib/media";
import { isAudioFile } from "@/lib/upload-validation";
import {
  createSignedDownloadUrl,
  buildStorageKey,
  putObject,
} from "@/lib/storage";
import {
  mergeTranscriptions,
  transcribeAudioChunk,
  type TranscriptionResult,
} from "@/lib/transcription";
import { recordTranscriptionUsage } from "@/lib/usage";

/**
 * Pipeline: uploaded recording → extracted audio → transcript.
 *
 * Runs on the worker deployment (ffmpeg required). Each step is durable and
 * independently retried by Inngest.
 */

async function startJob(
  projectId: string,
  workspaceId: string,
  type: (typeof processingJobs.$inferInsert)["type"],
  externalRunId: string,
) {
  const [job] = await db
    .insert(processingJobs)
    .values({
      workspaceId,
      projectId,
      type,
      status: "running",
      attempts: 1,
      externalRunId,
      startedAt: new Date(),
    })
    .returning();
  return job.id;
}

async function finishJob(jobId: string, ok: boolean, errorDetail?: string) {
  await db
    .update(processingJobs)
    .set({
      status: ok ? "completed" : "failed",
      completedAt: new Date(),
      ...(errorDetail ? { errorDetail } : {}),
    })
    .where(eq(processingJobs.id, jobId));
}

async function failProject(projectId: string, userMessage: string) {
  await db
    .update(projects)
    .set({ status: "failed", errorMessage: userMessage })
    .where(eq(projects.id, projectId));
}

async function fetchToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed with HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export const processVideo = inngest.createFunction(
  {
    id: "process-video",
    retries: 2,
    onFailure: async ({ event }) => {
      const { projectId } = event.data.event.data;
      await failProject(
        projectId,
        "We couldn't process this recording. The file may be corrupted or in an unsupported encoding — try re-exporting it as MP4 and uploading again.",
      );
    },
  },
  { event: "project/uploaded" },
  async ({ event, step, runId }) => {
    const { projectId, workspaceId, uploadedFileId } = event.data;

    /* ---------------- Extract audio ---------------- */
    const extraction = await step.run("extract-audio", async () => {
      if (!(await ffmpegAvailable())) {
        throw new NonRetriableError(
          "ffmpeg is not installed on this worker. Media processing must run on the worker service (see worker/README.md).",
        );
      }

      const jobId = await startJob(projectId, workspaceId, "extract_audio", runId);
      try {
        await db
          .update(projects)
          .set({ status: "extracting_audio", progressPercent: 10, errorMessage: null })
          .where(eq(projects.id, projectId));

        const file = await db.query.uploadedFiles.findFirst({
          where: and(
            eq(uploadedFiles.id, uploadedFileId),
            eq(uploadedFiles.workspaceId, workspaceId),
          ),
        });
        if (!file || file.status !== "uploaded") {
          throw new NonRetriableError("Source file is missing or was deleted.");
        }

        const result = await withTempDir(async (dir) => {
          const sourceUrl = await createSignedDownloadUrl(file.storageKey);
          const sourceBuffer = await fetchToBuffer(sourceUrl);
          const sourcePath = await bufferToTempFile(dir, file.fileName, sourceBuffer);

          const durationSeconds = await probeDurationSeconds(sourcePath);

          // Enforce the plan's recording-duration limit with the true duration.
          const sub = await db.query.subscriptions.findFirst({
            where: eq(subscriptions.workspaceId, workspaceId),
          });
          const plan = (sub?.plan ?? "starter") as PlanId;
          const maxSeconds = PLANS[plan].features.maxRecordingMinutes * 60;
          if (durationSeconds > maxSeconds) {
            throw new NonRetriableError(
              `duration_limit:This recording is ${Math.round(durationSeconds / 60)} minutes; your plan allows up to ${PLANS[plan].features.maxRecordingMinutes} minutes per recording.`,
            );
          }

          const audioPath = `${sourcePath}.audio.mp3`;
          // Audio uploads are still normalized (mono/16kHz) for transcription.
          await extractAudio(sourcePath, audioPath);

          const audioKey = buildStorageKey({
            workspaceId,
            projectId,
            kind: "extracted_audio",
            fileName: "audio.mp3",
          });
          const { readFile } = await import("node:fs/promises");
          const audioBuffer = await readFile(audioPath);
          await putObject({
            storageKey: audioKey,
            body: audioBuffer,
            contentType: "audio/mpeg",
          });

          await db.insert(uploadedFiles).values({
            workspaceId,
            projectId,
            kind: "extracted_audio",
            status: "uploaded",
            storageKey: audioKey,
            fileName: "audio.mp3",
            contentType: "audio/mpeg",
            sizeBytes: audioBuffer.length,
            durationSeconds,
          });

          await db
            .update(uploadedFiles)
            .set({ durationSeconds })
            .where(eq(uploadedFiles.id, uploadedFileId));

          return { audioKey, durationSeconds, wasAudioSource: isAudioFile(file.fileName, file.contentType) };
        });

        await finishJob(jobId, true);
        return result;
      } catch (error) {
        await finishJob(jobId, false, (error as Error).message);
        const msg = (error as Error).message;
        if (msg.startsWith("duration_limit:")) {
          await failProject(projectId, msg.slice("duration_limit:".length));
          throw new NonRetriableError(msg);
        }
        throw error;
      }
    });

    /* ---------------- Transcribe ---------------- */
    const transcriptId = await step.run("transcribe", async () => {
      const jobId = await startJob(projectId, workspaceId, "transcribe", runId);
      try {
        await db
          .update(projects)
          .set({ status: "transcribing", progressPercent: 40 })
          .where(eq(projects.id, projectId));

        const project = await db.query.projects.findFirst({
          where: eq(projects.id, projectId),
        });

        const merged: TranscriptionResult = await withTempDir(async (dir) => {
          const audioUrl = await createSignedDownloadUrl(extraction.audioKey);
          const audioBuffer = await fetchToBuffer(audioUrl);
          const audioPath = await bufferToTempFile(dir, "audio.mp3", audioBuffer);

          // The transcription API caps uploads at ~25 MB; split long audio
          // into 10-minute chunks and transcribe in order.
          const chunks =
            audioBuffer.length > 20 * 1024 * 1024
              ? await splitAudio(audioPath, dir)
              : [{ path: audioPath, offsetSeconds: 0 }];

          const { readFile } = await import("node:fs/promises");
          const results: TranscriptionResult[] = [];
          for (const chunk of chunks) {
            const chunkBuffer = await readFile(chunk.path);
            results.push(
              await transcribeAudioChunk({
                audio: chunkBuffer,
                fileName: "audio.mp3",
                language: project?.language,
                offsetSeconds: chunk.offsetSeconds,
              }),
            );
          }
          return mergeTranscriptions(results);
        });

        if (merged.segments.length === 0) {
          throw new NonRetriableError(
            "no_speech:We couldn't find any speech in this recording. Check that the video has narration and try again.",
          );
        }

        // Replace any previous transcript for this project (retranscribe).
        await db
          .delete(transcripts)
          .where(eq(transcripts.projectId, projectId));

        const fullText = merged.segments.map((s) => s.text).join(" ");
        const [transcript] = await db
          .insert(transcripts)
          .values({
            workspaceId,
            projectId,
            status: "ready",
            language: merged.language,
            fullText,
            wordCount: fullText.split(/\s+/).filter(Boolean).length,
            durationSeconds: extraction.durationSeconds,
          })
          .returning();

        await db.insert(transcriptSegments).values(
          merged.segments.map((s, i) => ({
            workspaceId,
            transcriptId: transcript.id,
            segmentIndex: i,
            startSeconds: s.startSeconds,
            endSeconds: s.endSeconds,
            text: s.text,
          })),
        );

        await recordTranscriptionUsage({
          workspaceId,
          projectId,
          seconds: extraction.durationSeconds,
        });

        await db
          .update(projects)
          .set({ status: "transcript_ready", progressPercent: 100 })
          .where(eq(projects.id, projectId));

        await finishJob(jobId, true);
        return transcript.id;
      } catch (error) {
        await finishJob(jobId, false, (error as Error).message);
        const msg = (error as Error).message;
        if (msg.startsWith("no_speech:")) {
          await failProject(projectId, msg.slice("no_speech:".length));
          throw new NonRetriableError(msg);
        }
        throw error;
      }
    });

    return { transcriptId };
  },
);

/** Re-run transcription for a project that already has extracted audio. */
export const retranscribe = inngest.createFunction(
  {
    id: "retranscribe",
    retries: 1,
    onFailure: async ({ event }) => {
      const { projectId } = event.data.event.data;
      await db
        .update(projects)
        .set({
          status: "transcript_ready",
          errorMessage:
            "Re-transcription failed. Your previous transcript is unchanged — you can try again.",
        })
        .where(eq(projects.id, projectId));
    },
  },
  { event: "project/retranscribe" },
  async ({ event, step }) => {
    const { projectId, workspaceId } = event.data;

    const sourceFile = await step.run("find-source", async () => {
      const file = await db.query.uploadedFiles.findFirst({
        where: and(
          eq(uploadedFiles.projectId, projectId),
          eq(uploadedFiles.workspaceId, workspaceId),
          eq(uploadedFiles.status, "uploaded"),
        ),
      });
      if (!file) throw new NonRetriableError("Source file unavailable.");
      return file.id;
    });

    await step.sendEvent("restart-pipeline", {
      name: "project/uploaded",
      data: { projectId, workspaceId, uploadedFileId: sourceFile },
    });
    return { restarted: true };
  },
);
