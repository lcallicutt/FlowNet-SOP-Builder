import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documentVersions } from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { ApiError, handleRouteError } from "@/lib/api";
import { PLANS } from "@/lib/plans";

type Params = {
  params: Promise<{ workspaceId: string; documentId: string; versionId: string }>;
};

/** Fetch one version's snapshot (used for the basic compare view). */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, documentId, versionId } = await params;
    const ctx = await requireWorkspace(workspaceId, "viewer");
    if (!PLANS[ctx.plan].features.versionHistory) {
      throw new ApiError(
        403,
        "Version history is available on the Professional and Business plans.",
        "plan_upgrade_required",
      );
    }

    const version = await db.query.documentVersions.findFirst({
      where: and(
        eq(documentVersions.id, versionId),
        eq(documentVersions.sopDocumentId, documentId),
        eq(documentVersions.workspaceId, workspaceId),
      ),
    });
    if (!version) throw new ApiError(404, "Version not found.");

    return NextResponse.json({
      version: {
        id: version.id,
        versionNumber: version.versionNumber,
        revisionNotes: version.revisionNotes,
        createdAt: version.createdAt,
        snapshot: version.snapshot,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
