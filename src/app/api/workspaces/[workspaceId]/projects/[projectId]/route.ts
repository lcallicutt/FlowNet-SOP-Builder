import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, sopDocuments, uploadedFiles } from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { ApiError, handleRouteError } from "@/lib/api";
import { deleteObject } from "@/lib/storage";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ workspaceId: string; projectId: string }> };

/** Project detail + processing status (polled by the processing screen). */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId } = await params;
    await requireWorkspace(workspaceId, "viewer");

    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId),
      ),
    });
    if (!project || project.deletedAt) throw new ApiError(404, "Project not found.");

    const document = await db.query.sopDocuments.findFirst({
      where: and(
        eq(sopDocuments.projectId, projectId),
        eq(sopDocuments.workspaceId, workspaceId),
      ),
    });

    return NextResponse.json({
      project: {
        id: project.id,
        title: project.title,
        status: project.status,
        progressPercent: project.progressPercent,
        errorMessage: project.errorMessage,
        detailLevel: project.detailLevel,
        language: project.language,
        sourceType: project.sourceType,
        loomUrl: project.loomUrl,
        createdAt: project.createdAt,
      },
      documentId: document?.id ?? null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Delete a project and its stored files (editor+). */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId } = await params;
    const ctx = await requireWorkspace(workspaceId, "editor");

    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId),
      ),
    });
    if (!project) throw new ApiError(404, "Project not found.");

    const files = await db.query.uploadedFiles.findMany({
      where: and(
        eq(uploadedFiles.projectId, projectId),
        eq(uploadedFiles.workspaceId, workspaceId),
      ),
    });

    // Best-effort object deletion; DB rows are marked deleted regardless.
    for (const file of files) {
      try {
        await deleteObject(file.storageKey);
      } catch (error) {
        console.error("[project.delete] failed to delete object", file.storageKey, error);
      }
    }
    await db
      .update(uploadedFiles)
      .set({ status: "deleted", deletedAt: new Date() })
      .where(eq(uploadedFiles.projectId, projectId));

    await db
      .update(projects)
      .set({ deletedAt: new Date() })
      .where(eq(projects.id, projectId));

    await recordAudit({
      workspaceId,
      actorUserId: ctx.user.id,
      action: "project.delete",
      entityType: "project",
      entityId: projectId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
