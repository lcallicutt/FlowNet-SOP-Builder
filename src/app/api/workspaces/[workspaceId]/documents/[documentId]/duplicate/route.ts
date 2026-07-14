import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  checklistItems,
  documentSections,
  procedureSteps,
  quickGuides,
  sopDocuments,
  trainingGuides,
  workspaces,
} from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { ApiError, handleRouteError } from "@/lib/api";
import { formatSopNumber } from "@/lib/documents";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ workspaceId: string; documentId: string }> };

/** Duplicate an SOP (new SOP number, fresh draft). */
export async function POST(_req: NextRequest, { params }: Params) {
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

    const [ws] = await db
      .update(workspaces)
      .set({ sopCounter: sql`${workspaces.sopCounter} + 1` })
      .where(eq(workspaces.id, workspaceId))
      .returning({ counter: workspaces.sopCounter });

    const [copy] = await db
      .insert(sopDocuments)
      .values({
        workspaceId,
        projectId: doc.projectId,
        sopNumber: formatSopNumber(ws.counter),
        title: `${doc.title} (Copy)`,
        status: "draft",
        versionNumber: 1,
        department: doc.department,
        processCategory: doc.processCategory,
        processOwner: doc.processOwner,
        intendedAudience: doc.intendedAudience,
        tags: doc.tags,
        reviewDate: doc.reviewDate,
        createdByUserId: ctx.user.id,
      })
      .returning();

    const [sections, steps, items, quickGuide, trainingGuide] = await Promise.all([
      db.query.documentSections.findMany({
        where: eq(documentSections.sopDocumentId, documentId),
      }),
      db.query.procedureSteps.findMany({
        where: eq(procedureSteps.sopDocumentId, documentId),
      }),
      db.query.checklistItems.findMany({
        where: eq(checklistItems.sopDocumentId, documentId),
      }),
      db.query.quickGuides.findFirst({
        where: eq(quickGuides.sopDocumentId, documentId),
      }),
      db.query.trainingGuides.findFirst({
        where: eq(trainingGuides.sopDocumentId, documentId),
      }),
    ]);

    if (sections.length > 0) {
      await db.insert(documentSections).values(
        sections.map(({ id: _id, createdAt: _c, updatedAt: _u, ...s }) => ({
          ...s,
          sopDocumentId: copy.id,
        })),
      );
    }
    if (steps.length > 0) {
      await db.insert(procedureSteps).values(
        steps.map(({ id: _id, createdAt: _c, updatedAt: _u, ...s }) => ({
          ...s,
          sopDocumentId: copy.id,
        })),
      );
    }
    if (items.length > 0) {
      await db.insert(checklistItems).values(
        items.map(({ id: _id, createdAt: _c, updatedAt: _u, ...s }) => ({
          ...s,
          sopDocumentId: copy.id,
          isChecked: false,
        })),
      );
    }
    if (quickGuide) {
      await db.insert(quickGuides).values({
        workspaceId,
        sopDocumentId: copy.id,
        content: quickGuide.content,
      });
    }
    if (trainingGuide) {
      await db.insert(trainingGuides).values({
        workspaceId,
        sopDocumentId: copy.id,
        content: trainingGuide.content,
      });
    }

    await recordAudit({
      workspaceId,
      actorUserId: ctx.user.id,
      action: "document.duplicate",
      entityType: "sop_document",
      entityId: copy.id,
      metadata: { sourceDocumentId: documentId },
    });

    return NextResponse.json(
      { documentId: copy.id, sopNumber: copy.sopNumber },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
