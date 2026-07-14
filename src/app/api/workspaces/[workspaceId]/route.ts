import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { handleRouteError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ workspaceId: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #1A2B3C.")
    .nullable()
    .optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await params;
    const ctx = await requireWorkspace(workspaceId, "viewer");
    return NextResponse.json({
      workspace: {
        id: ctx.workspace.id,
        name: ctx.workspace.name,
        slug: ctx.workspace.slug,
        brandColor: ctx.workspace.brandColor,
        role: ctx.role,
        plan: ctx.plan,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Rename / rebrand a workspace (admin+). */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await params;
    const ctx = await requireWorkspace(workspaceId, "admin");
    const patch = patchSchema.parse(await req.json());

    const [updated] = await db
      .update(workspaces)
      .set(patch)
      .where(eq(workspaces.id, workspaceId))
      .returning();

    await recordAudit({
      workspaceId,
      actorUserId: ctx.user.id,
      action: "workspace.update",
      entityType: "workspace",
      entityId: workspaceId,
      metadata: patch,
    });

    return NextResponse.json({ workspace: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Soft-delete a workspace (owner only). */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await params;
    const ctx = await requireWorkspace(workspaceId, "owner");

    await db
      .update(workspaces)
      .set({ deletedAt: new Date() })
      .where(eq(workspaces.id, workspaceId));

    await recordAudit({
      workspaceId,
      actorUserId: ctx.user.id,
      action: "workspace.delete",
      entityType: "workspace",
      entityId: workspaceId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
