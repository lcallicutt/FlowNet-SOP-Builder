import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { uploadedFiles } from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { ApiError, handleRouteError } from "@/lib/api";
import { inngest } from "@/inngest/client";
import { PLANS } from "@/lib/plans";

type Params = { params: Promise<{ workspaceId: string }> };

const schema = z.object({
  projectId: z.string().uuid(),
  uploadedFileId: z.string().uuid(),
});

/**
 * Called after the client finishes the direct PUT upload. Marks the file
 * uploaded and kicks off the background processing pipeline.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await params;
    const ctx = await requireWorkspace(workspaceId, "editor");
    const { projectId, uploadedFileId } = schema.parse(await req.json());

    const file = await db.query.uploadedFiles.findFirst({
      where: and(
        eq(uploadedFiles.id, uploadedFileId),
        eq(uploadedFiles.workspaceId, workspaceId),
        eq(uploadedFiles.projectId, projectId),
      ),
    });
    if (!file) throw new ApiError(404, "Upload not found.");
    if (file.status === "deleted") {
      throw new ApiError(410, "This upload was deleted before processing began.");
    }

    await db
      .update(uploadedFiles)
      .set({ status: "uploaded" })
      .where(eq(uploadedFiles.id, uploadedFileId));

    await inngest.send({
      name: "project/uploaded",
      data: {
        projectId,
        workspaceId,
        uploadedFileId,
        priority: PLANS[ctx.plan].features.priorityProcessing,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
