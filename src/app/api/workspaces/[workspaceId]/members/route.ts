import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, workspaceMembers } from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { ApiError, handleRouteError } from "@/lib/api";
import { PLANS } from "@/lib/plans";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ workspaceId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await params;
    await requireWorkspace(workspaceId, "viewer");
    const members = await db.query.workspaceMembers.findMany({
      where: eq(workspaceMembers.workspaceId, workspaceId),
      with: { user: true },
    });
    return NextResponse.json({
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        status: m.status,
        name: m.user?.name ?? null,
        email: m.user?.email ?? m.invitedEmail,
        imageUrl: m.user?.imageUrl ?? null,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  role: z.enum(["admin", "editor", "viewer"]),
});

/** Invite a member by email (admin+). Seat count is plan-limited. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await params;
    const ctx = await requireWorkspace(workspaceId, "admin");
    const { email, role } = inviteSchema.parse(await req.json());
    const normalizedEmail = email.toLowerCase();

    const existing = await db.query.workspaceMembers.findMany({
      where: eq(workspaceMembers.workspaceId, workspaceId),
      with: { user: true },
    });

    const seatLimit = PLANS[ctx.plan].features.maxWorkspaceMembers;
    if (existing.length >= seatLimit) {
      throw new ApiError(
        403,
        `Your ${PLANS[ctx.plan].name} plan includes up to ${seatLimit} member${seatLimit === 1 ? "" : "s"}. Upgrade to invite more people.`,
        "limit_reached",
      );
    }
    if (
      existing.some(
        (m) =>
          m.user?.email?.toLowerCase() === normalizedEmail ||
          m.invitedEmail === normalizedEmail,
      )
    ) {
      throw new ApiError(409, "That person is already a member or has a pending invite.");
    }

    // If the user already has an account, activate immediately.
    const knownUser = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });

    const [member] = await db
      .insert(workspaceMembers)
      .values(
        knownUser
          ? {
              workspaceId,
              userId: knownUser.id,
              role,
              status: "active",
              invitedByUserId: ctx.user.id,
            }
          : {
              workspaceId,
              invitedEmail: normalizedEmail,
              role,
              status: "pending",
              invitedByUserId: ctx.user.id,
            },
      )
      .returning();

    await recordAudit({
      workspaceId,
      actorUserId: ctx.user.id,
      action: "member.invite",
      entityType: "workspace_member",
      entityId: member.id,
      metadata: { email: normalizedEmail, role },
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

const updateSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(["owner", "admin", "editor", "viewer"]).optional(),
  remove: z.boolean().optional(),
});

/** Change a member's role or remove them (admin+; owner transfers need owner). */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await params;
    const ctx = await requireWorkspace(workspaceId, "admin");
    const { memberId, role, remove } = updateSchema.parse(await req.json());

    const member = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.id, memberId),
        eq(workspaceMembers.workspaceId, workspaceId),
      ),
    });
    if (!member) throw new ApiError(404, "Member not found.");

    const touchesOwner = member.role === "owner" || role === "owner";
    if (touchesOwner && ctx.role !== "owner") {
      throw new ApiError(403, "Only the workspace owner can transfer or change ownership.");
    }
    if (member.role === "owner" && (remove || (role && role !== "owner"))) {
      const owners = await db.query.workspaceMembers.findMany({
        where: and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.role, "owner"),
        ),
      });
      if (owners.length <= 1) {
        throw new ApiError(400, "A workspace must keep at least one owner.");
      }
    }

    if (remove) {
      await db
        .delete(workspaceMembers)
        .where(eq(workspaceMembers.id, memberId));
    } else if (role) {
      await db
        .update(workspaceMembers)
        .set({ role })
        .where(eq(workspaceMembers.id, memberId));
    }

    await recordAudit({
      workspaceId,
      actorUserId: ctx.user.id,
      action: remove ? "member.remove" : "member.update_role",
      entityType: "workspace_member",
      entityId: memberId,
      metadata: { role },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
