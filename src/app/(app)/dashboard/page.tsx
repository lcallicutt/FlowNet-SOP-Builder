import { redirect } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { workspaceMembers, workspaces } from "@/db/schema";
import { AuthError, requireUser } from "@/lib/auth";

/**
 * Post-sign-in landing: send the user to their first workspace, or to the
 * workspace creation screen if they don't belong to any yet.
 */
export default async function DashboardPage() {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AuthError) redirect("/sign-in");
    throw error;
  }

  const rows = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.userId, user.id),
        eq(workspaceMembers.status, "active"),
        isNull(workspaces.deletedAt),
      ),
    )
    .orderBy(asc(workspaceMembers.createdAt))
    .limit(1);

  if (rows.length === 0) redirect("/workspaces/new");
  redirect(`/w/${rows[0].workspaceId}`);
}
