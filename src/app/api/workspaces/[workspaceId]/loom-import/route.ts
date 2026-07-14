import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/api";
import { importFromLoom, parseLoomUrl } from "@/lib/loom";
import { uploadFormSchema } from "@/lib/upload-validation";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ workspaceId: string }> };

const schema = z.object({
  loomUrl: z.string().url(),
  form: uploadFormSchema,
});

/**
 * Paste-a-Loom-URL flow. Creates the project with the link attached, then
 * delegates to the Loom importer service — which is currently an explicit
 * placeholder (see src/lib/loom.ts). The user gets an honest message and a
 * project ready to receive a direct upload of the downloaded file.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await params;
    const ctx = await requireWorkspace(workspaceId, "editor");
    const { loomUrl, form } = schema.parse(await req.json());

    const parsed = parseLoomUrl(loomUrl);
    if (!parsed.ok) return jsonError(422, parsed.message, "invalid_loom_url");

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
        sourceType: "loom_url",
        loomUrl: parsed.normalizedUrl,
        status: "uploaded",
        createdByUserId: ctx.user.id,
      })
      .returning();

    const result = await importFromLoom({
      workspaceId,
      userId: ctx.user.id,
      loomUrl: parsed.normalizedUrl,
    });

    await recordAudit({
      workspaceId,
      actorUserId: ctx.user.id,
      action: "project.loom_import_attempt",
      entityType: "project",
      entityId: project.id,
      metadata: { loomUrl: parsed.normalizedUrl, result: result.status },
    });

    return NextResponse.json({ projectId: project.id, result });
  } catch (error) {
    return handleRouteError(error);
  }
}
