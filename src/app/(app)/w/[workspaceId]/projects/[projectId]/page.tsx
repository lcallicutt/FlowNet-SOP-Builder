import { redirect } from "next/navigation";
import { AuthError, requireWorkspace, type WorkspaceRole } from "@/lib/auth";
import { ProjectView } from "@/components/project/project-view";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  const { workspaceId, projectId } = await params;

  let role: WorkspaceRole;
  try {
    const ctx = await requireWorkspace(workspaceId, "viewer");
    role = ctx.role;
  } catch (err) {
    if (err instanceof AuthError) {
      redirect(`/w/${workspaceId}`);
    }
    throw err;
  }

  return (
    <ProjectView workspaceId={workspaceId} projectId={projectId} role={role} />
  );
}
