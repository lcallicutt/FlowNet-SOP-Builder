import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { transcriptSegments, transcripts } from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { ApiError, handleRouteError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ workspaceId: string; projectId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId } = await params;
    await requireWorkspace(workspaceId, "viewer");

    const transcript = await db.query.transcripts.findFirst({
      where: and(
        eq(transcripts.projectId, projectId),
        eq(transcripts.workspaceId, workspaceId),
      ),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    if (!transcript) throw new ApiError(404, "No transcript yet for this project.");

    const segments = await db.query.transcriptSegments.findMany({
      where: eq(transcriptSegments.transcriptId, transcript.id),
      orderBy: [asc(transcriptSegments.segmentIndex)],
    });

    return NextResponse.json({
      transcript: {
        id: transcript.id,
        status: transcript.status,
        language: transcript.language,
        durationSeconds: transcript.durationSeconds,
        wordCount: transcript.wordCount,
      },
      segments: segments.map((s) => ({
        id: s.id,
        index: s.segmentIndex,
        startSeconds: s.startSeconds,
        endSeconds: s.endSeconds,
        speaker: s.speaker,
        text: s.text,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

const patchSchema = z.object({
  transcriptId: z.string().uuid(),
  edits: z
    .array(
      z.object({
        segmentId: z.string().uuid(),
        text: z.string().min(1).max(10000),
        speaker: z.string().max(80).nullable().optional(),
      }),
    )
    .min(1)
    .max(500),
});

/** Save user edits to transcript segments before generation. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId } = await params;
    const ctx = await requireWorkspace(workspaceId, "editor");
    const { transcriptId, edits } = patchSchema.parse(await req.json());

    const transcript = await db.query.transcripts.findFirst({
      where: and(
        eq(transcripts.id, transcriptId),
        eq(transcripts.projectId, projectId),
        eq(transcripts.workspaceId, workspaceId),
      ),
    });
    if (!transcript) throw new ApiError(404, "Transcript not found.");

    for (const edit of edits) {
      await db
        .update(transcriptSegments)
        .set({
          text: edit.text,
          ...(edit.speaker !== undefined ? { speaker: edit.speaker } : {}),
        })
        .where(
          and(
            eq(transcriptSegments.id, edit.segmentId),
            eq(transcriptSegments.transcriptId, transcriptId),
          ),
        );
    }

    // Refresh the denormalized full text.
    const segments = await db.query.transcriptSegments.findMany({
      where: eq(transcriptSegments.transcriptId, transcriptId),
      orderBy: [asc(transcriptSegments.segmentIndex)],
    });
    const fullText = segments.map((s) => s.text).join(" ");
    await db
      .update(transcripts)
      .set({
        status: "edited",
        fullText,
        wordCount: fullText.split(/\s+/).filter(Boolean).length,
      })
      .where(eq(transcripts.id, transcriptId));

    await recordAudit({
      workspaceId,
      actorUserId: ctx.user.id,
      action: "transcript.edit",
      entityType: "transcript",
      entityId: transcriptId,
      metadata: { editedSegments: edits.length },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
