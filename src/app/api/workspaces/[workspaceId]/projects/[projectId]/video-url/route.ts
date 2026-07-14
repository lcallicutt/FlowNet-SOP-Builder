import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { uploadedFiles } from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { ApiError, handleRouteError } from "@/lib/api";
import { createSignedDownloadUrl } from "@/lib/storage";

type Params = { params: Promise<{ workspaceId: string; projectId: string }> };

/** Short-lived signed URL for the source recording (video player). */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId } = await params;
    await requireWorkspace(workspaceId, "viewer");

    const file = await db.query.uploadedFiles.findFirst({
      where: and(
        eq(uploadedFiles.projectId, projectId),
        eq(uploadedFiles.workspaceId, workspaceId),
        eq(uploadedFiles.kind, "source_video"),
        eq(uploadedFiles.status, "uploaded"),
      ),
    });
    if (!file) {
      throw new ApiError(
        410,
        "The source recording is no longer available — it may have been deleted.",
        "source_unavailable",
      );
    }

    const url = await createSignedDownloadUrl(file.storageKey, {
      expiresIn: 60 * 60,
    });
    return NextResponse.json({
      url,
      contentType: file.contentType,
      fileName: file.fileName,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
