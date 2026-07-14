import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, workspaceMembers } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ApiError, handleRouteError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";

/**
 * Account deletion. Blocks deletion while the user is the sole owner of any
 * workspace (they must transfer ownership or delete the workspace first),
 * then soft-deletes the local user and removes memberships. Clerk-side
 * deletion is handled by the user in Clerk's account UI, or the operator can
 * delete via the Clerk dashboard; our webhook keeps records consistent.
 */
export async function DELETE() {
  try {
    const user = await requireUser();

    const ownerships = await db.query.workspaceMembers.findMany({
      where: and(
        eq(workspaceMembers.userId, user.id),
        eq(workspaceMembers.role, "owner"),
        eq(workspaceMembers.status, "active"),
      ),
      with: { workspace: true },
    });

    for (const membership of ownerships) {
      if (membership.workspace?.deletedAt) continue;
      const owners = await db.query.workspaceMembers.findMany({
        where: and(
          eq(workspaceMembers.workspaceId, membership.workspaceId),
          eq(workspaceMembers.role, "owner"),
          eq(workspaceMembers.status, "active"),
        ),
      });
      if (owners.length <= 1) {
        throw new ApiError(
          409,
          `You're the only owner of "${membership.workspace?.name}". Transfer ownership or delete that workspace before deleting your account.`,
        );
      }
    }

    await db.delete(workspaceMembers).where(eq(workspaceMembers.userId, user.id));
    await db
      .update(users)
      .set({ deletedAt: new Date(), email: `deleted-${user.id}@deleted.invalid`, name: null, imageUrl: null })
      .where(eq(users.id, user.id));

    for (const membership of ownerships) {
      await recordAudit({
        workspaceId: membership.workspaceId,
        actorUserId: user.id,
        action: "account.delete",
        entityType: "user",
        entityId: user.id,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
