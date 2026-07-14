import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projects, uploadedFiles } from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { buildStorageKey, createSignedUploadUrl } from "@/lib/storage";
import {
  uploadFormSchema,
  validateUpload,
} from "@/lib/upload-validation";
import { getTranscriptionMinutesUsed } from "@/lib/usage";

type Params = { params: Promise<{ workspaceId: string }> };

const requestSchema = z.object({
  file: z.object({
    fileName: z.string().min(1).max(300),
    contentType: z.string().min(1).max(120),
    sizeBytes: z.number().int().positive(),
    /** Client-measured duration; authoritative check happens after ffprobe. */
    durationSeconds: z.number().positive().optional(),
  }),
  form: uploadFormSchema,
});

/**
 * Start a direct upload: validates the file against plan limits, creates the
 * project + file records, and returns a short-lived signed PUT URL. The
 * client uploads directly to storage, then calls /uploads/complete.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await params;
    const ctx = await requireWorkspace(workspaceId, "editor");

    const limited = rateLimit({
      key: `upload:${ctx.user.id}`,
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
    if (!limited.ok) {
      return jsonError(429, "Too many uploads in the last hour. Please wait a bit and try again.");
    }

    const { file, form } = requestSchema.parse(await req.json());

    const usedMinutes = await getTranscriptionMinutesUsed(workspaceId);
    const validationError = validateUpload({
      fileName: file.fileName,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
      durationSeconds: file.durationSeconds,
      plan: ctx.plan,
      usedTranscriptionMinutesThisPeriod: usedMinutes,
    });
    if (validationError) {
      return jsonError(422, validationError.message, validationError.code);
    }

    const [project] = await db
      .insert(projects)
      .values({
        workspaceId,
        title: form.title,
        department: form.department || null,
        processCategory: form.processCategory || null,
        processOwner: form.processOwner || null,
        intendedAudience: form.intendedAudience || null,
        description: form.description || null,
        companyTerminology: form.companyTerminology || null,
        detailLevel: form.detailLevel,
        language: form.language,
        sourceType: "upload",
        status: "uploaded",
        progressPercent: 0,
        createdByUserId: ctx.user.id,
      })
      .returning();

    const storageKey = buildStorageKey({
      workspaceId,
      projectId: project.id,
      kind: "source_video",
      fileName: file.fileName,
    });

    const [fileRow] = await db
      .insert(uploadedFiles)
      .values({
        workspaceId,
        projectId: project.id,
        kind: "source_video",
        status: "pending_upload",
        storageKey,
        fileName: file.fileName,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
        durationSeconds: file.durationSeconds,
        uploadedByUserId: ctx.user.id,
      })
      .returning();

    const uploadUrl = await createSignedUploadUrl({
      storageKey,
      contentType: file.contentType,
      contentLength: file.sizeBytes,
    });

    await recordAudit({
      workspaceId,
      actorUserId: ctx.user.id,
      action: "project.create",
      entityType: "project",
      entityId: project.id,
      metadata: { fileName: file.fileName, sizeBytes: file.sizeBytes },
    });

    return NextResponse.json(
      {
        projectId: project.id,
        uploadedFileId: fileRow.id,
        uploadUrl,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
