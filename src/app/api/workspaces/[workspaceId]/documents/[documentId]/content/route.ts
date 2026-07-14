import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  checklistItems,
  documentSections,
  procedureSteps,
  quickGuides,
  sopDocuments,
  trainingGuides,
  REVIEW_FLAGS,
} from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { ApiError, handleRouteError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ workspaceId: string; documentId: string }> };

/**
 * Editor content operations. One endpoint, a discriminated union of
 * operations — this is what the block editor's autosave calls.
 */

const sectionTypes = [
  "purpose",
  "scope",
  "intended_audience",
  "definitions",
  "required_tools",
  "required_access",
  "prerequisites",
  "roles_responsibilities",
  "decision_points",
  "quality_control",
  "troubleshooting",
  "risks_warnings",
  "completion_criteria",
  "related_documents",
  "custom",
] as const;

const checklistCategories = [
  "pre_process",
  "action",
  "decision",
  "quality",
  "completion",
  "sign_off",
] as const;

const quickGuideSchema = z.object({
  objective: z.string(),
  requiredTools: z.array(z.string()),
  keySteps: z.array(z.object({ title: z.string(), summary: z.string() })),
  warnings: z.array(z.string()),
  commonErrors: z.array(z.string()),
  escalationContact: z.string(),
  completionConfirmation: z.string(),
});

const trainingGuideSchema = z.object({
  learningObjective: z.string(),
  processOverview: z.string(),
  keyTerminology: z.array(z.object({ term: z.string(), definition: z.string() })),
  walkthrough: z.array(
    z.object({ step: z.string(), detail: z.string(), whyItMatters: z.string() }),
  ),
  practiceExercise: z.string(),
  knowledgeChecks: z.array(z.object({ question: z.string(), answer: z.string() })),
  commonMistakes: z.array(z.string()),
  supervisorReview: z.string(),
});

const operationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("update_section"),
    sectionId: z.string().uuid(),
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().max(50000).optional(),
  }),
  z.object({
    op: z.literal("add_section"),
    type: z.enum(sectionTypes).default("custom"),
    title: z.string().trim().min(1).max(200),
    content: z.string().max(50000).default(""),
  }),
  z.object({ op: z.literal("delete_section"), sectionId: z.string().uuid() }),
  z.object({
    op: z.literal("reorder_sections"),
    orderedIds: z.array(z.string().uuid()).min(1).max(200),
  }),
  z.object({
    op: z.literal("resolve_section_flags"),
    sectionId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("update_step"),
    stepId: z.string().uuid(),
    title: z.string().trim().min(1).max(200).optional(),
    instruction: z.string().max(20000).optional(),
    expectedResult: z.string().max(5000).nullable().optional(),
    warning: z.string().max(5000).nullable().optional(),
    note: z.string().max(5000).nullable().optional(),
    qualityCheckpoint: z.string().max(5000).nullable().optional(),
    videoTimestampSeconds: z.number().min(0).nullable().optional(),
  }),
  z.object({
    op: z.literal("add_step"),
    afterStepId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(200),
    instruction: z.string().max(20000).default(""),
  }),
  z.object({ op: z.literal("delete_step"), stepId: z.string().uuid() }),
  z.object({
    op: z.literal("reorder_steps"),
    orderedIds: z.array(z.string().uuid()).min(1).max(500),
  }),
  z.object({ op: z.literal("resolve_step_flags"), stepId: z.string().uuid() }),
  z.object({
    op: z.literal("update_checklist_item"),
    itemId: z.string().uuid(),
    text: z.string().trim().min(1).max(2000).optional(),
    category: z.enum(checklistCategories).optional(),
    isChecked: z.boolean().optional(),
  }),
  z.object({
    op: z.literal("add_checklist_item"),
    category: z.enum(checklistCategories),
    text: z.string().trim().min(1).max(2000),
  }),
  z.object({
    op: z.literal("delete_checklist_item"),
    itemId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("reorder_checklist"),
    orderedIds: z.array(z.string().uuid()).min(1).max(500),
  }),
  z.object({ op: z.literal("update_quick_guide"), content: quickGuideSchema }),
  z.object({
    op: z.literal("update_training_guide"),
    content: trainingGuideSchema,
  }),
]);

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, documentId } = await params;
    const ctx = await requireWorkspace(workspaceId, "editor");

    const doc = await db.query.sopDocuments.findFirst({
      where: and(
        eq(sopDocuments.id, documentId),
        eq(sopDocuments.workspaceId, workspaceId),
      ),
    });
    if (!doc || doc.deletedAt) throw new ApiError(404, "Document not found.");

    const body = await req.json();
    const operations = z.array(operationSchema).min(1).max(50).parse(
      Array.isArray(body?.operations) ? body.operations : [body],
    );

    for (const operation of operations) {
      await applyOperation(workspaceId, documentId, operation);
    }

    // Touch the document so updatedAt reflects the edit (autosave).
    await db
      .update(sopDocuments)
      .set({ updatedAt: new Date() })
      .where(eq(sopDocuments.id, documentId));

    await recordAudit({
      workspaceId,
      actorUserId: ctx.user.id,
      action: "document.edit",
      entityType: "sop_document",
      entityId: documentId,
      metadata: { operations: operations.map((o) => o.op) },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

type Operation = z.infer<typeof operationSchema>;

async function applyOperation(
  workspaceId: string,
  documentId: string,
  op: Operation,
) {
  const sectionScope = (id: string) =>
    and(
      eq(documentSections.id, id),
      eq(documentSections.sopDocumentId, documentId),
      eq(documentSections.workspaceId, workspaceId),
    );
  const stepScope = (id: string) =>
    and(
      eq(procedureSteps.id, id),
      eq(procedureSteps.sopDocumentId, documentId),
      eq(procedureSteps.workspaceId, workspaceId),
    );
  const itemScope = (id: string) =>
    and(
      eq(checklistItems.id, id),
      eq(checklistItems.sopDocumentId, documentId),
      eq(checklistItems.workspaceId, workspaceId),
    );

  switch (op.op) {
    case "update_section": {
      const { sectionId, op: _op, ...fields } = op;
      if (Object.keys(fields).length === 0) return;
      await db.update(documentSections).set(fields).where(sectionScope(sectionId));
      return;
    }
    case "add_section": {
      const [max] = await db
        .select({ max: sql<number>`coalesce(max(${documentSections.position}), -1)` })
        .from(documentSections)
        .where(eq(documentSections.sopDocumentId, documentId));
      await db.insert(documentSections).values({
        workspaceId,
        sopDocumentId: documentId,
        type: op.type,
        title: op.title,
        content: op.content,
        position: (max?.max ?? -1) + 1,
      });
      return;
    }
    case "delete_section":
      await db.delete(documentSections).where(sectionScope(op.sectionId));
      return;
    case "reorder_sections":
      for (let i = 0; i < op.orderedIds.length; i++) {
        await db
          .update(documentSections)
          .set({ position: i })
          .where(sectionScope(op.orderedIds[i]));
      }
      return;
    case "resolve_section_flags":
      await db
        .update(documentSections)
        .set({ reviewFlags: [], flagsResolvedAt: new Date() })
        .where(sectionScope(op.sectionId));
      return;
    case "update_step": {
      const { stepId, op: _op, ...fields } = op;
      if (Object.keys(fields).length === 0) return;
      await db.update(procedureSteps).set(fields).where(stepScope(stepId));
      return;
    }
    case "add_step": {
      const steps = await db.query.procedureSteps.findMany({
        where: eq(procedureSteps.sopDocumentId, documentId),
        orderBy: (t, { asc }) => [asc(t.position)],
      });
      const insertAt = op.afterStepId
        ? steps.findIndex((s) => s.id === op.afterStepId) + 1
        : steps.length;
      // Shift positions of later steps, insert, then renumber.
      for (let i = steps.length - 1; i >= insertAt; i--) {
        await db
          .update(procedureSteps)
          .set({ position: i + 1, stepNumber: i + 2 })
          .where(stepScope(steps[i].id));
      }
      await db.insert(procedureSteps).values({
        workspaceId,
        sopDocumentId: documentId,
        stepNumber: insertAt + 1,
        title: op.title,
        instruction: op.instruction,
        position: insertAt,
      });
      return;
    }
    case "delete_step": {
      await db.delete(procedureSteps).where(stepScope(op.stepId));
      await renumberSteps(documentId);
      return;
    }
    case "reorder_steps": {
      for (let i = 0; i < op.orderedIds.length; i++) {
        await db
          .update(procedureSteps)
          .set({ position: i, stepNumber: i + 1 })
          .where(stepScope(op.orderedIds[i]));
      }
      return;
    }
    case "resolve_step_flags":
      await db
        .update(procedureSteps)
        .set({ reviewFlags: [], flagsResolvedAt: new Date() })
        .where(stepScope(op.stepId));
      return;
    case "update_checklist_item": {
      const { itemId, op: _op, ...fields } = op;
      if (Object.keys(fields).length === 0) return;
      await db.update(checklistItems).set(fields).where(itemScope(itemId));
      return;
    }
    case "add_checklist_item": {
      const [max] = await db
        .select({ max: sql<number>`coalesce(max(${checklistItems.position}), -1)` })
        .from(checklistItems)
        .where(eq(checklistItems.sopDocumentId, documentId));
      await db.insert(checklistItems).values({
        workspaceId,
        sopDocumentId: documentId,
        category: op.category,
        text: op.text,
        position: (max?.max ?? -1) + 1,
      });
      return;
    }
    case "delete_checklist_item":
      await db.delete(checklistItems).where(itemScope(op.itemId));
      return;
    case "reorder_checklist":
      for (let i = 0; i < op.orderedIds.length; i++) {
        await db
          .update(checklistItems)
          .set({ position: i })
          .where(itemScope(op.orderedIds[i]));
      }
      return;
    case "update_quick_guide":
      await db
        .update(quickGuides)
        .set({ content: op.content })
        .where(
          and(
            eq(quickGuides.sopDocumentId, documentId),
            eq(quickGuides.workspaceId, workspaceId),
          ),
        );
      return;
    case "update_training_guide":
      await db
        .update(trainingGuides)
        .set({ content: op.content })
        .where(
          and(
            eq(trainingGuides.sopDocumentId, documentId),
            eq(trainingGuides.workspaceId, workspaceId),
          ),
        );
      return;
  }
}

async function renumberSteps(documentId: string) {
  const steps = await db.query.procedureSteps.findMany({
    where: eq(procedureSteps.sopDocumentId, documentId),
    orderBy: (t, { asc }) => [asc(t.position)],
  });
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].position !== i || steps[i].stepNumber !== i + 1) {
      await db
        .update(procedureSteps)
        .set({ position: i, stepNumber: i + 1 })
        .where(eq(procedureSteps.id, steps[i].id));
    }
  }
}

// Referenced so the schema's flag list stays imported alongside editor ops.
void REVIEW_FLAGS;
