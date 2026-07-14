import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { sopDocuments } from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { ApiError, handleRouteError } from "@/lib/api";
import { loadDocumentPackage } from "@/lib/documents";
import { recordAudit } from "@/lib/audit";
import { PLANS } from "@/lib/plans";

type Params = { params: Promise<{ workspaceId: string; documentId: string }> };

async function getOwnedDocument(workspaceId: string, documentId: string) {
  const doc = await db.query.sopDocuments.findFirst({
    where: and(
      eq(sopDocuments.id, documentId),
      eq(sopDocuments.workspaceId, workspaceId),
    ),
  });
  if (!doc || doc.deletedAt) throw new ApiError(404, "Document not found.");
  return doc;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, documentId } = await params;
    await requireWorkspace(workspaceId, "viewer");
    await getOwnedDocument(workspaceId, documentId);
    const pkg = await loadDocumentPackage(documentId);
    if (!pkg) throw new ApiError(404, "Document not found.");
    return NextResponse.json({ package: pkg });
  } catch (error) {
    return handleRouteError(error);
  }
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  department: z.string().trim().max(120).nullable().optional(),
  processCategory: z.string().trim().max(120).nullable().optional(),
  processOwner: z.string().trim().max(120).nullable().optional(),
  intendedAudience: z.string().trim().max(200).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  reviewDate: z.string().datetime().nullable().optional(),
  status: z
    .enum(["draft", "in_review", "approved", "published", "archived"])
    .optional(),
});

/** Update document metadata / status (editor+). */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, documentId } = await params;
    const ctx = await requireWorkspace(workspaceId, "editor");
    const doc = await getOwnedDocument(workspaceId, documentId);
    const patch = patchSchema.parse(await req.json());

    if (patch.status) {
      // Publishing approved docs is the approval workflow's job on Business;
      // on lower plans direct publish is allowed.
      const approvalRequired = PLANS[ctx.plan].features.approvalWorkflow;
      if (
        patch.status === "published" &&
        approvalRequired &&
        doc.status !== "approved"
      ) {
        throw new ApiError(
          409,
          "This workspace requires approval before publishing. Request approval first.",
        );
      }
    }

    const { reviewDate, ...rest } = patch;
    const [updated] = await db
      .update(sopDocuments)
      .set({
        ...rest,
        ...(reviewDate !== undefined
          ? { reviewDate: reviewDate ? new Date(reviewDate) : null }
          : {}),
      })
      .where(eq(sopDocuments.id, documentId))
      .returning();

    await recordAudit({
      workspaceId,
      actorUserId: ctx.user.id,
      action: patch.status ? `document.status.${patch.status}` : "document.update",
      entityType: "sop_document",
      entityId: documentId,
      metadata: patch as Record<string, unknown>,
    });

    return NextResponse.json({ document: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Soft-delete a document (admin+). */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, documentId } = await params;
    const ctx = await requireWorkspace(workspaceId, "admin");
    await getOwnedDocument(workspaceId, documentId);

    await db
      .update(sopDocuments)
      .set({ deletedAt: new Date() })
      .where(eq(sopDocuments.id, documentId));

    await recordAudit({
      workspaceId,
      actorUserId: ctx.user.id,
      action: "document.delete",
      entityType: "sop_document",
      entityId: documentId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
