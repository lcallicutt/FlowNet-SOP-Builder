import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { approvals, sopDocuments, workspaceMembers } from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { ApiError, handleRouteError } from "@/lib/api";
import { PLANS } from "@/lib/plans";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ workspaceId: string; documentId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, documentId } = await params;
    await requireWorkspace(workspaceId, "viewer");
    const rows = await db.query.approvals.findMany({
      where: and(
        eq(approvals.sopDocumentId, documentId),
        eq(approvals.workspaceId, workspaceId),
      ),
      orderBy: [desc(approvals.createdAt)],
      with: { reviewer: true, requestedBy: true },
    });
    return NextResponse.json({
      approvals: rows.map((a) => ({
        id: a.id,
        status: a.status,
        comments: a.comments,
        reviewer: a.reviewer?.name ?? a.reviewer?.email ?? "Unknown",
        requestedBy: a.requestedBy?.name ?? a.requestedBy?.email ?? "Unknown",
        decidedAt: a.decidedAt,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

const requestSchema = z.object({
  reviewerUserId: z.string().uuid(),
});

/** Request approval from a reviewer (document moves to in_review). */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, documentId } = await params;
    const ctx = await requireWorkspace(workspaceId, "editor");
    if (!PLANS[ctx.plan].features.approvalWorkflow) {
      throw new ApiError(
        403,
        "Approval workflows are available on the Business plan.",
        "plan_upgrade_required",
      );
    }
    const { reviewerUserId } = requestSchema.parse(await req.json());

    const doc = await db.query.sopDocuments.findFirst({
      where: and(
        eq(sopDocuments.id, documentId),
        eq(sopDocuments.workspaceId, workspaceId),
      ),
    });
    if (!doc || doc.deletedAt) throw new ApiError(404, "Document not found.");

    // Reviewer must be an active member with editor+ permissions.
    const reviewer = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, reviewerUserId),
        eq(workspaceMembers.status, "active"),
      ),
    });
    if (!reviewer || reviewer.role === "viewer") {
      throw new ApiError(422, "Choose a reviewer with editor access or higher.");
    }
    if (reviewerUserId === ctx.user.id) {
      throw new ApiError(422, "You can't review your own document — choose another reviewer.");
    }

    const pending = await db.query.approvals.findFirst({
      where: and(
        eq(approvals.sopDocumentId, documentId),
        eq(approvals.status, "pending"),
      ),
    });
    if (pending) {
      throw new ApiError(409, "An approval request is already pending for this document.");
    }

    const [approval] = await db
      .insert(approvals)
      .values({
        workspaceId,
        sopDocumentId: documentId,
        requestedByUserId: ctx.user.id,
        reviewerUserId,
        status: "pending",
      })
      .returning();

    await db
      .update(sopDocuments)
      .set({ status: "in_review" })
      .where(eq(sopDocuments.id, documentId));

    await recordAudit({
      workspaceId,
      actorUserId: ctx.user.id,
      action: "approval.request",
      entityType: "sop_document",
      entityId: documentId,
      metadata: { approvalId: approval.id, reviewerUserId },
    });

    return NextResponse.json({ approval }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

const decideSchema = z.object({
  approvalId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  comments: z.string().trim().max(4000).optional(),
});

/** Approve or reject (reviewer only). Rejection requires comments. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, documentId } = await params;
    const ctx = await requireWorkspace(workspaceId, "editor");
    const { approvalId, decision, comments } = decideSchema.parse(await req.json());

    const approval = await db.query.approvals.findFirst({
      where: and(
        eq(approvals.id, approvalId),
        eq(approvals.sopDocumentId, documentId),
        eq(approvals.workspaceId, workspaceId),
      ),
    });
    if (!approval) throw new ApiError(404, "Approval request not found.");
    if (approval.status !== "pending") {
      throw new ApiError(409, "This approval request was already decided.");
    }
    if (approval.reviewerUserId !== ctx.user.id) {
      throw new ApiError(403, "Only the assigned reviewer can decide this request.");
    }
    if (decision === "rejected" && !comments?.trim()) {
      throw new ApiError(422, "Add a comment explaining what needs to change before rejecting.");
    }

    await db
      .update(approvals)
      .set({ status: decision, comments: comments ?? null, decidedAt: new Date() })
      .where(eq(approvals.id, approvalId));

    await db
      .update(sopDocuments)
      .set({ status: decision === "approved" ? "approved" : "draft" })
      .where(eq(sopDocuments.id, documentId));

    await recordAudit({
      workspaceId,
      actorUserId: ctx.user.id,
      action: `approval.${decision}`,
      entityType: "sop_document",
      entityId: documentId,
      metadata: { approvalId, comments },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
