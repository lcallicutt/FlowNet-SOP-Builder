import { redirect } from "next/navigation";
import { AuthError, requireWorkspace, type WorkspaceContext } from "@/lib/auth";
import { MembersManager } from "@/components/app/members-manager";

export const metadata = { title: "Members" };

export default async function MembersSettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  let ctx: WorkspaceContext;
  try {
    ctx = await requireWorkspace(workspaceId, "viewer");
  } catch (error) {
    if (error instanceof AuthError) redirect("/dashboard");
    throw error;
  }

  return (
    <MembersManager
      workspaceId={workspaceId}
      currentRole={ctx.role}
      currentUserId={ctx.user.id}
    />
  );
}
