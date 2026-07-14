import { auth, currentUser } from "@clerk/nextjs/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  subscriptions,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema";
import type { PlanId } from "@/lib/plans";

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

export function roleAtLeast(role: WorkspaceRole, min: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export class AuthError extends Error {
  constructor(
    public status: 401 | 403 | 404,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Resolve the signed-in Clerk user to our local users row, creating it on
 * first sight (webhooks normally do this, but this keeps dev setups working).
 */
export async function requireUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new AuthError(401, "Sign in to continue.");

  const existing = await db.query.users.findFirst({
    where: and(eq(users.clerkId, clerkId), isNull(users.deletedAt)),
  });
  if (existing) return existing;

  const clerkUser = await currentUser();
  if (!clerkUser) throw new AuthError(401, "Sign in to continue.");
  const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
  const [created] = await db
    .insert(users)
    .values({
      clerkId,
      email,
      name:
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
        null,
      imageUrl: clerkUser.imageUrl ?? null,
    })
    .onConflictDoNothing({ target: users.clerkId })
    .returning();
  if (created) {
    await claimPendingInvites(created.id, email);
    return created;
  }
  const raced = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  });
  if (!raced) throw new AuthError(401, "Could not resolve your account.");
  return raced;
}

/** Attach any pending email invitations to a newly created user. */
export async function claimPendingInvites(userId: string, email: string) {
  if (!email) return;
  await db
    .update(workspaceMembers)
    .set({ userId, status: "active", invitedEmail: null })
    .where(
      and(
        eq(workspaceMembers.invitedEmail, email.toLowerCase()),
        eq(workspaceMembers.status, "pending"),
      ),
    );
}

export type WorkspaceContext = {
  user: typeof users.$inferSelect;
  workspace: typeof workspaces.$inferSelect;
  membership: typeof workspaceMembers.$inferSelect;
  role: WorkspaceRole;
  plan: PlanId;
};

/**
 * Authorize the current user against a workspace. This is the single
 * chokepoint for workspace-level data isolation — every workspace-scoped
 * route and action must go through it.
 */
export async function requireWorkspace(
  workspaceId: string,
  minRole: WorkspaceRole = "viewer",
): Promise<WorkspaceContext> {
  const user = await requireUser();

  const membership = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, user.id),
      eq(workspaceMembers.status, "active"),
    ),
  });
  if (!membership) throw new AuthError(404, "Workspace not found.");

  const role = membership.role as WorkspaceRole;
  if (!roleAtLeast(role, minRole)) {
    throw new AuthError(403, "You don't have permission to do that in this workspace.");
  }

  const workspace = await db.query.workspaces.findFirst({
    where: and(eq(workspaces.id, workspaceId), isNull(workspaces.deletedAt)),
  });
  if (!workspace) throw new AuthError(404, "Workspace not found.");

  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.workspaceId, workspaceId),
  });

  return {
    user,
    workspace,
    membership,
    role,
    plan: (subscription?.plan ?? "starter") as PlanId,
  };
}

/** Platform-level admin gate for the internal dashboard. */
export async function requirePlatformAdmin() {
  const user = await requireUser();
  if (!user.isPlatformAdmin) throw new AuthError(404, "Not found.");
  return user;
}
