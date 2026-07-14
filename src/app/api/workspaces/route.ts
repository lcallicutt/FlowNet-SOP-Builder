import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions, workspaceMembers, workspaces } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";

const createSchema = z.object({
  name: z.string().trim().min(2, "Workspace name is too short.").max(80),
});

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  return `${base || "workspace"}-${Math.random().toString(36).slice(2, 8)}`;
}

/** List workspaces the current user belongs to. */
export async function GET() {
  try {
    const user = await requireUser();
    const memberships = await db.query.workspaceMembers.findMany({
      where: and(
        eq(workspaceMembers.userId, user.id),
        eq(workspaceMembers.status, "active"),
      ),
      with: { workspace: true },
    });
    return NextResponse.json({
      workspaces: memberships
        .filter((m) => m.workspace && !m.workspace.deletedAt)
        .map((m) => ({
          id: m.workspace.id,
          name: m.workspace.name,
          slug: m.workspace.slug,
          role: m.role,
        })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Create a workspace; creator becomes owner on the starter plan. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const limited = rateLimit({
      key: `workspace-create:${user.id}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!limited.ok) {
      return jsonError(429, "Too many workspaces created recently. Try again later.");
    }

    const { name } = createSchema.parse(await req.json());

    const [workspace] = await db
      .insert(workspaces)
      .values({ name, slug: slugify(name), createdByUserId: user.id })
      .returning();

    await db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: user.id,
      role: "owner",
      status: "active",
    });

    await db.insert(subscriptions).values({
      workspaceId: workspace.id,
      plan: "starter",
      status: "active",
    });

    await recordAudit({
      workspaceId: workspace.id,
      actorUserId: user.id,
      action: "workspace.create",
      entityType: "workspace",
      entityId: workspace.id,
    });

    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
