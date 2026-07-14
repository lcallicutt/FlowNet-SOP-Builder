import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  checklistItems,
  documentSections,
  documentVersions,
  procedureSteps,
  quickGuides,
  sopDocuments,
  trainingGuides,
} from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { ApiError, handleRouteError } from "@/lib/api";
import { PLANS } from "@/lib/plans";
import {
  createDocumentVersion,
  type DocumentPackage,
} from "@/lib/documents";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ workspaceId: string; documentId: string }> };

async function requireVersionHistory(workspaceId: string, minRole: "viewer" | "editor") {
  const ctx = await requireWorkspace(workspaceId, minRole);
  if (!PLANS[ctx.plan].features.versionHistory) {
    throw new ApiError(
      403,
      "Version history is available on the Professional and Business plans.",
      "plan_upgrade_required",
    );
  }
  return ctx;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, documentId } = await params;
    await requireVersionHistory(workspaceId, "viewer");

    const versions = await db.query.documentVersions.findMany({
      where: and(
        eq(documentVersions.sopDocumentId, documentId),
        eq(documentVersions.workspaceId, workspaceId),
      ),
      orderBy: [desc(documentVersions.versionNumber)],
      with: { createdBy: true },
    });

    return NextResponse.json({
      versions: versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        revisionNotes: v.revisionNotes,
        createdAt: v.createdAt,
        createdBy: v.createdBy?.name ?? v.createdBy?.email ?? "Unknown",
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

const createSchema = z.object({
  revisionNotes: z.string().trim().max(2000).optional(),
});

/** Snapshot the current state as a new version. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, documentId } = await params;
    const ctx = await requireVersionHistory(workspaceId, "editor");
    const { revisionNotes } = createSchema.parse(await req.json().catch(() => ({})));

    const doc = await db.query.sopDocuments.findFirst({
      where: and(
        eq(sopDocuments.id, documentId),
        eq(sopDocuments.workspaceId, workspaceId),
      ),
    });
    if (!doc || doc.deletedAt) throw new ApiError(404, "Document not found.");

    const result = await createDocumentVersion({
      sopDocumentId: documentId,
      workspaceId,
      createdByUserId: ctx.user.id,
      revisionNotes,
    });
    if (!result) throw new ApiError(404, "Document not found.");

    await recordAudit({
      workspaceId,
      actorUserId: ctx.user.id,
      action: "document.version_create",
      entityType: "sop_document",
      entityId: documentId,
      metadata: { newVersion: result.versionNumber, revisionNotes },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

const restoreSchema = z.object({
  versionId: z.string().uuid(),
});

/**
 * Restore a prior version: the current state is snapshotted first, then the
 * stored snapshot's content replaces the working copy.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, documentId } = await params;
    const ctx = await requireVersionHistory(workspaceId, "editor");
    const { versionId } = restoreSchema.parse(await req.json());

    const version = await db.query.documentVersions.findFirst({
      where: and(
        eq(documentVersions.id, versionId),
        eq(documentVersions.sopDocumentId, documentId),
        eq(documentVersions.workspaceId, workspaceId),
      ),
    });
    if (!version) throw new ApiError(404, "Version not found.");

    // Preserve the current state before overwriting it.
    await createDocumentVersion({
      sopDocumentId: documentId,
      workspaceId,
      createdByUserId: ctx.user.id,
      revisionNotes: `Auto-snapshot before restoring version ${version.versionNumber}`,
    });

    const snapshot = version.snapshot as unknown as DocumentPackage;

    // Replace content tables from the snapshot.
    await db
      .delete(documentSections)
      .where(eq(documentSections.sopDocumentId, documentId));
    await db
      .delete(procedureSteps)
      .where(eq(procedureSteps.sopDocumentId, documentId));
    await db
      .delete(checklistItems)
      .where(eq(checklistItems.sopDocumentId, documentId));

    if (snapshot.sections.length > 0) {
      await db.insert(documentSections).values(
        snapshot.sections.map((s) => ({
          workspaceId,
          sopDocumentId: documentId,
          type: s.type as (typeof documentSections.$inferInsert)["type"],
          title: s.title,
          content: s.content,
          position: s.position,
          reviewFlags: s.reviewFlags as (typeof documentSections.$inferInsert)["reviewFlags"],
        })),
      );
    }
    if (snapshot.steps.length > 0) {
      await db.insert(procedureSteps).values(
        snapshot.steps.map((s) => ({
          workspaceId,
          sopDocumentId: documentId,
          stepNumber: s.stepNumber,
          title: s.title,
          instruction: s.instruction,
          expectedResult: s.expectedResult,
          warning: s.warning,
          note: s.note,
          qualityCheckpoint: s.qualityCheckpoint,
          videoTimestampSeconds: s.videoTimestampSeconds,
          reviewFlags: s.reviewFlags as (typeof procedureSteps.$inferInsert)["reviewFlags"],
          position: s.position,
        })),
      );
    }
    if (snapshot.checklist.length > 0) {
      await db.insert(checklistItems).values(
        snapshot.checklist.map((c) => ({
          workspaceId,
          sopDocumentId: documentId,
          category: c.category as (typeof checklistItems.$inferInsert)["category"],
          text: c.text,
          isChecked: c.isChecked,
          position: c.position,
        })),
      );
    }
    if (snapshot.quickGuide) {
      await db
        .update(quickGuides)
        .set({ content: snapshot.quickGuide })
        .where(eq(quickGuides.sopDocumentId, documentId));
    }
    if (snapshot.trainingGuide) {
      await db
        .update(trainingGuides)
        .set({ content: snapshot.trainingGuide })
        .where(eq(trainingGuides.sopDocumentId, documentId));
    }

    await db
      .update(sopDocuments)
      .set({ title: snapshot.document.title })
      .where(eq(sopDocuments.id, documentId));

    await recordAudit({
      workspaceId,
      actorUserId: ctx.user.id,
      action: "document.version_restore",
      entityType: "sop_document",
      entityId: documentId,
      metadata: { restoredVersion: version.versionNumber },
    });

    return NextResponse.json({ ok: true, restoredVersion: version.versionNumber });
  } catch (error) {
    return handleRouteError(error);
  }
}
