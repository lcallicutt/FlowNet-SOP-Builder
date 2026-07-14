import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documentSections, procedureSteps, sopDocuments } from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { ApiError, handleRouteError, jsonError } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { reviseText } from "@/lib/ai/document-revision";
import { AiValidationError } from "@/lib/ai/structured";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ workspaceId: string; documentId: string }> };

const schema = z.object({
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("section"), sectionId: z.string().uuid() }),
    z.object({ kind: z.literal("step"), stepId: z.string().uuid() }),
  ]),
  instruction: z.string().trim().min(3).max(2000),
});

/** AI-assisted revision of one section or step. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, documentId } = await params;
    const ctx = await requireWorkspace(workspaceId, "editor");
    const { target, instruction } = schema.parse(await req.json());

    const limited = rateLimit({
      key: `revise:${ctx.user.id}`,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    });
    if (!limited.ok) {
      return jsonError(429, "Too many AI revisions in the last hour. Try again soon.");
    }

    const doc = await db.query.sopDocuments.findFirst({
      where: and(
        eq(sopDocuments.id, documentId),
        eq(sopDocuments.workspaceId, workspaceId),
      ),
    });
    if (!doc || doc.deletedAt) throw new ApiError(404, "Document not found.");

    let currentText: string;
    if (target.kind === "section") {
      const section = await db.query.documentSections.findFirst({
        where: and(
          eq(documentSections.id, target.sectionId),
          eq(documentSections.sopDocumentId, documentId),
        ),
      });
      if (!section) throw new ApiError(404, "Section not found.");
      currentText = section.content;
    } else {
      const step = await db.query.procedureSteps.findFirst({
        where: and(
          eq(procedureSteps.id, target.stepId),
          eq(procedureSteps.sopDocumentId, documentId),
        ),
      });
      if (!step) throw new ApiError(404, "Step not found.");
      currentText = step.instruction;
    }

    let revision;
    try {
      revision = await reviseText({
        kind: target.kind === "section" ? "section" : "step_instruction",
        currentText,
        instruction,
        documentTitle: doc.title,
      });
    } catch (error) {
      if (error instanceof AiValidationError) {
        console.error("[revise] validation failed", error.issues);
        return jsonError(
          502,
          "The AI couldn't produce a usable revision. Your text is unchanged — try rephrasing the instruction.",
          "ai_generation_failed",
        );
      }
      throw error;
    }

    if (target.kind === "section") {
      await db
        .update(documentSections)
        .set({ content: revision.revised })
        .where(eq(documentSections.id, target.sectionId));
    } else {
      await db
        .update(procedureSteps)
        .set({ instruction: revision.revised })
        .where(eq(procedureSteps.id, target.stepId));
    }

    await recordAudit({
      workspaceId,
      actorUserId: ctx.user.id,
      action: "document.ai_revise",
      entityType: "sop_document",
      entityId: documentId,
      metadata: { target, changeSummary: revision.changeSummary },
    });

    return NextResponse.json({
      revised: revision.revised,
      changeSummary: revision.changeSummary,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
