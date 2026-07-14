import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  attachments,
  procedureSteps,
  sopDocuments,
  uploadedFiles,
} from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { ApiError, handleRouteError } from "@/lib/api";
import {
  buildStorageKey,
  createSignedDownloadUrl,
  createSignedUploadUrl,
} from "@/lib/storage";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ workspaceId: string; documentId: string }> };

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Screenshot / attachment support. MVP flow: user uploads an image manually
 * and attaches it to a procedure step. The data model stores the source-video
 * timestamp on the step, so automated frame extraction can slot in later
 * (with mandatory user review before insertion — see lib/media.ts).
 */

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, documentId } = await params;
    await requireWorkspace(workspaceId, "viewer");
    const rows = await db.query.attachments.findMany({
      where: and(
        eq(attachments.sopDocumentId, documentId),
        eq(attachments.workspaceId, workspaceId),
      ),
      with: { file: true },
    });
    const withUrls = await Promise.all(
      rows.map(async (a) => ({
        id: a.id,
        procedureStepId: a.procedureStepId,
        caption: a.caption,
        reviewedAt: a.reviewedAt,
        fileName: a.file?.fileName,
        url:
          a.file && a.file.status === "uploaded"
            ? await createSignedDownloadUrl(a.file.storageKey, { expiresIn: 3600 })
            : null,
      })),
    );
    return NextResponse.json({ attachments: withUrls });
  } catch (error) {
    return handleRouteError(error);
  }
}

const createSchema = z.object({
  fileName: z.string().min(1).max(300),
  contentType: z.string(),
  sizeBytes: z.number().int().positive(),
  procedureStepId: z.string().uuid().nullable().optional(),
  caption: z.string().trim().max(500).optional(),
});

/** Start a screenshot upload; returns a signed PUT URL. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, documentId } = await params;
    const ctx = await requireWorkspace(workspaceId, "editor");
    const input = createSchema.parse(await req.json());

    if (!IMAGE_TYPES.includes(input.contentType)) {
      throw new ApiError(422, "Screenshots must be PNG, JPEG, WebP, or GIF images.");
    }
    if (input.sizeBytes > MAX_IMAGE_BYTES) {
      throw new ApiError(422, "Screenshots can be up to 10 MB.");
    }

    const doc = await db.query.sopDocuments.findFirst({
      where: and(
        eq(sopDocuments.id, documentId),
        eq(sopDocuments.workspaceId, workspaceId),
      ),
    });
    if (!doc || doc.deletedAt) throw new ApiError(404, "Document not found.");

    if (input.procedureStepId) {
      const step = await db.query.procedureSteps.findFirst({
        where: and(
          eq(procedureSteps.id, input.procedureStepId),
          eq(procedureSteps.sopDocumentId, documentId),
        ),
      });
      if (!step) throw new ApiError(404, "Procedure step not found.");
    }

    const storageKey = buildStorageKey({
      workspaceId,
      projectId: doc.projectId ?? undefined,
      kind: "screenshot",
      fileName: input.fileName,
    });

    const [fileRow] = await db
      .insert(uploadedFiles)
      .values({
        workspaceId,
        projectId: doc.projectId,
        kind: "screenshot",
        status: "pending_upload",
        storageKey,
        fileName: input.fileName,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        uploadedByUserId: ctx.user.id,
      })
      .returning();

    const [attachment] = await db
      .insert(attachments)
      .values({
        workspaceId,
        sopDocumentId: documentId,
        procedureStepId: input.procedureStepId ?? null,
        uploadedFileId: fileRow.id,
        caption: input.caption ?? null,
        // Manual uploads are user-chosen, so they count as reviewed.
        reviewedAt: new Date(),
        createdByUserId: ctx.user.id,
      })
      .returning();

    const uploadUrl = await createSignedUploadUrl({
      storageKey,
      contentType: input.contentType,
      contentLength: input.sizeBytes,
    });

    await recordAudit({
      workspaceId,
      actorUserId: ctx.user.id,
      action: "attachment.create",
      entityType: "attachment",
      entityId: attachment.id,
      metadata: { documentId, stepId: input.procedureStepId },
    });

    return NextResponse.json(
      { attachmentId: attachment.id, uploadedFileId: fileRow.id, uploadUrl },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

const patchSchema = z.object({
  attachmentId: z.string().uuid(),
  uploadedFileId: z.string().uuid().optional(),
  markUploaded: z.boolean().optional(),
  remove: z.boolean().optional(),
});

/** Confirm upload completion or remove an attachment. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, documentId } = await params;
    const ctx = await requireWorkspace(workspaceId, "editor");
    const input = patchSchema.parse(await req.json());

    const attachment = await db.query.attachments.findFirst({
      where: and(
        eq(attachments.id, input.attachmentId),
        eq(attachments.sopDocumentId, documentId),
        eq(attachments.workspaceId, workspaceId),
      ),
    });
    if (!attachment) throw new ApiError(404, "Attachment not found.");

    if (input.markUploaded) {
      await db
        .update(uploadedFiles)
        .set({ status: "uploaded" })
        .where(eq(uploadedFiles.id, attachment.uploadedFileId));
    }
    if (input.remove) {
      await db.delete(attachments).where(eq(attachments.id, attachment.id));
      await db
        .update(uploadedFiles)
        .set({ status: "deleted", deletedAt: new Date() })
        .where(eq(uploadedFiles.id, attachment.uploadedFileId));
      await recordAudit({
        workspaceId,
        actorUserId: ctx.user.id,
        action: "attachment.delete",
        entityType: "attachment",
        entityId: attachment.id,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
