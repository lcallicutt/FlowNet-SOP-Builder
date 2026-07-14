import { NonRetriableError } from "inngest";
import { asc, eq } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import {
  processingJobs,
  projects,
  transcriptSegments,
  transcripts,
} from "@/db/schema";
import { AiValidationError } from "@/lib/ai/structured";
import { extractProcess } from "@/lib/ai/process-extraction";
import { generateSop } from "@/lib/ai/sop-generation";
import { generateChecklist } from "@/lib/ai/checklist-generation";
import { generateQuickGuide } from "@/lib/ai/quick-guide-generation";
import { generateTrainingGuide } from "@/lib/ai/training-guide-generation";
import { persistSopPackage } from "@/lib/sop-persist";
import type { ProjectContext } from "@/lib/ai/prompts";

/**
 * Pipeline: reviewed transcript → process analysis → SOP package.
 *
 * Every AI call validates its structured output (with one repair attempt in
 * lib/ai/structured.ts). On unrecoverable validation failure the transcript
 * is preserved, the failure is logged, the project returns to
 * transcript_ready, and nothing malformed is ever saved as a document.
 */
export const generateDocuments = inngest.createFunction(
  {
    id: "generate-documents",
    retries: 1,
    onFailure: async ({ event }) => {
      const { projectId } = event.data.event.data;
      await db
        .update(projects)
        .set({
          status: "transcript_ready",
          progressPercent: 100,
          errorMessage:
            "AI document generation failed. Your transcript is safe — review it and try Generate SOP Package again.",
        })
        .where(eq(projects.id, projectId));
    },
  },
  { event: "project/generate" },
  async ({ event, step, runId }) => {
    const { projectId, workspaceId, transcriptId, requestedByUserId } =
      event.data;

    const wrapAiErrors = async <T>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (error) {
        if (error instanceof AiValidationError) {
          console.error("[generate-documents] schema validation failed", {
            projectId,
            issues: error.issues,
          });
          // One structured repair already happened inside callStructured.
          // Don't burn retries re-running a content-level failure.
          throw new NonRetriableError(
            `AI output failed validation: ${error.issues.slice(0, 5).join("; ")}`,
          );
        }
        throw error;
      }
    };

    /* ---------------- Analyze process ---------------- */
    const analysis = await step.run("analyze-process", async () => {
      const [jobRow] = await db
        .insert(processingJobs)
        .values({
          workspaceId,
          projectId,
          type: "analyze_process",
          status: "running",
          attempts: 1,
          externalRunId: runId,
          startedAt: new Date(),
        })
        .returning();

      try {
        await db
          .update(projects)
          .set({
            status: "analyzing_process",
            progressPercent: 15,
            errorMessage: null,
          })
          .where(eq(projects.id, projectId));

        const project = await db.query.projects.findFirst({
          where: eq(projects.id, projectId),
        });
        const transcript = await db.query.transcripts.findFirst({
          where: eq(transcripts.id, transcriptId),
        });
        if (!project || !transcript) {
          throw new NonRetriableError("Project or transcript no longer exists.");
        }
        const segments = await db.query.transcriptSegments.findMany({
          where: eq(transcriptSegments.transcriptId, transcriptId),
          orderBy: [asc(transcriptSegments.segmentIndex)],
        });
        if (segments.length === 0) {
          throw new NonRetriableError("Transcript has no segments.");
        }

        const context: ProjectContext = {
          title: project.title,
          department: project.department,
          processCategory: project.processCategory,
          processOwner: project.processOwner,
          intendedAudience: project.intendedAudience,
          description: project.description,
          companyTerminology: project.companyTerminology,
          detailLevel: project.detailLevel,
          language: project.language,
        };

        const result = await wrapAiErrors(() =>
          extractProcess({ context, segments }),
        );

        await db
          .update(processingJobs)
          .set({ status: "completed", completedAt: new Date() })
          .where(eq(processingJobs.id, jobRow.id));

        return { analysis: result, context };
      } catch (error) {
        await db
          .update(processingJobs)
          .set({
            status: "failed",
            completedAt: new Date(),
            errorDetail: (error as Error).message,
          })
          .where(eq(processingJobs.id, jobRow.id));
        throw error;
      }
    });

    /* ---------------- Generate documents ---------------- */
    await step.run("mark-generating", async () => {
      await db
        .update(projects)
        .set({ status: "generating_documentation", progressPercent: 45 })
        .where(eq(projects.id, projectId));
    });

    const sop = await step.run("generate-sop", () =>
      wrapAiErrors(() =>
        generateSop({ context: analysis.context, analysis: analysis.analysis }),
      ),
    );

    const checklist = await step.run("generate-checklist", () =>
      wrapAiErrors(() => generateChecklist({ sop })),
    );

    const quickGuide = await step.run("generate-quick-guide", () =>
      wrapAiErrors(() => generateQuickGuide({ sop })),
    );

    const trainingGuide = await step.run("generate-training-guide", () =>
      wrapAiErrors(() => generateTrainingGuide({ sop, analysis: analysis.analysis })),
    );

    /* ---------------- Persist ---------------- */
    const persisted = await step.run("persist-package", async () => {
      const [jobRow] = await db
        .insert(processingJobs)
        .values({
          workspaceId,
          projectId,
          type: "generate_documents",
          status: "running",
          attempts: 1,
          externalRunId: runId,
          startedAt: new Date(),
        })
        .returning();

      try {
        const project = await db.query.projects.findFirst({
          where: eq(projects.id, projectId),
        });
        const result = await persistSopPackage({
          workspaceId,
          projectId,
          createdByUserId: requestedByUserId,
          pkg: {
            analysis: analysis.analysis,
            sop,
            checklist,
            quickGuide,
            trainingGuide,
          },
          projectMeta: {
            department: project?.department,
            processCategory: project?.processCategory,
            processOwner: project?.processOwner,
            intendedAudience: project?.intendedAudience,
          },
        });
        await db
          .update(processingJobs)
          .set({ status: "completed", completedAt: new Date() })
          .where(eq(processingJobs.id, jobRow.id));
        return result;
      } catch (error) {
        await db
          .update(processingJobs)
          .set({
            status: "failed",
            completedAt: new Date(),
            errorDetail: (error as Error).message,
          })
          .where(eq(processingJobs.id, jobRow.id));
        throw error;
      }
    });

    return persisted;
  },
);
