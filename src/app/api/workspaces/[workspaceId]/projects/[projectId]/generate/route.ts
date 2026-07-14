import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, sopDocuments, transcripts } from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { ApiError, handleRouteError, jsonError } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { inngest } from "@/inngest/client";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ workspaceId: string; projectId: string }> };

const schema = z.object({ transcriptId: z.string().uuid() });

/** "Generate SOP Package" — confirms the transcript and starts AI generation. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId } = await params;
    const ctx = await requireWorkspace(workspaceId, "editor");
    const { transcriptId } = schema.parse(await req.json());

    const limited = rateLimit({
      key: `generate:${workspaceId}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!limited.ok) {
      return jsonError(429, "Too many generation requests. Try again in a little while.");
    }

    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId),
      ),
    });
    if (!project || project.deletedAt) throw new ApiError(404, "Project not found.");
    if (
      !["transcript_ready", "failed"].includes(project.status) &&
      project.status !== "ready_for_review"
    ) {
      throw new ApiError(
        409,
        "This project isn't ready for generation yet — wait for transcription to finish.",
      );
    }

    const transcript = await db.query.transcripts.findFirst({
      where: and(
        eq(transcripts.id, transcriptId),
        eq(transcripts.projectId, projectId),
        eq(transcripts.workspaceId, workspaceId),
      ),
    });
    if (!transcript || !["ready", "edited"].includes(transcript.status)) {
      throw new ApiError(409, "The transcript isn't ready to generate from.");
    }

    const existingDoc = await db.query.sopDocuments.findFirst({
      where: and(
        eq(sopDocuments.projectId, projectId),
        eq(sopDocuments.workspaceId, workspaceId),
      ),
    });
    if (existingDoc && !existingDoc.deletedAt) {
      throw new ApiError(
        409,
        "This project already has a generated SOP. Open it in the editor, or duplicate it to create a variant.",
      );
    }

    await inngest.send({
      name: "project/generate",
      data: {
        projectId,
        workspaceId,
        transcriptId,
        requestedByUserId: ctx.user.id,
      },
    });

    await recordAudit({
      workspaceId,
      actorUserId: ctx.user.id,
      action: "project.generate_requested",
      entityType: "project",
      entityId: projectId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
