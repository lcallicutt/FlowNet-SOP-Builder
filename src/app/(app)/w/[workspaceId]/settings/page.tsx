import { redirect } from "next/navigation";
import { AuthError, requireWorkspace, type WorkspaceContext } from "@/lib/auth";
import { GeneralSettings } from "@/components/app/general-settings";

export default async function GeneralSettingsPage({
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
    <GeneralSettings
      workspaceId={workspaceId}
      initialName={ctx.workspace.name}
      initialBrandColor={ctx.workspace.brandColor}
      role={ctx.role}
      plan={ctx.plan}
    />
  );
}
