import { redirect } from "next/navigation";
import { AuthError, requireWorkspace, type WorkspaceContext } from "@/lib/auth";
import { getUsageSummary } from "@/lib/usage";
import { UploadForm } from "@/components/app/upload-form";

export const metadata = { title: "Upload video" };

export default async function UploadPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  let ctx: WorkspaceContext;
  try {
    ctx = await requireWorkspace(workspaceId, "editor");
  } catch (error) {
    if (error instanceof AuthError) redirect(`/w/${workspaceId}`);
    throw error;
  }

  const usage = await getUsageSummary(workspaceId, ctx.plan);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Upload a video
        </h1>
        <p className="text-sm text-muted-foreground">
          Upload a screen recording or paste a Loom link, add a little context,
          and we&apos;ll draft the documentation for you.
        </p>
      </div>
      <UploadForm
        workspaceId={workspaceId}
        plan={ctx.plan}
        usedMinutes={usage.usedMinutes}
        remainingMinutes={usage.remainingMinutes}
      />
    </div>
  );
}
