import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { ApiError, handleRouteError, jsonError } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { inngest } from "@/inngest/client";
import { getUsageSummary } from "@/lib/usage";

type Params = { params: Promise<{ workspaceId: string; projectId: string }> };

/** Re-run transcription from the stored source recording. Uses new minutes. */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId } = await params;
    const ctx = await requireWorkspace(workspaceId, "editor");

    const limited = rateLimit({
      key: `retranscribe:${ctx.user.id}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!limited.ok) {
      return jsonError(429, "Too many re-transcription requests. Try again later.");
    }

    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId),
      ),
    });
    if (!project || project.deletedAt) throw new ApiError(404, "Project not found.");

    const usage = await getUsageSummary(workspaceId, ctx.plan);
    if (usage.remainingMinutes <= 0) {
      return jsonError(
        403,
        "You've used all of this month's transcription minutes, so re-transcription isn't available. Upgrade your plan or wait for your allowance to reset.",
        "limit_reached",
      );
    }

    await inngest.send({
      name: "project/retranscribe",
      data: { projectId, workspaceId, requestedByUserId: ctx.user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
