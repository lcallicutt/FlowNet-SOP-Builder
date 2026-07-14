import { redirect } from "next/navigation";
import { AuthError, requireWorkspace, type WorkspaceContext } from "@/lib/auth";
import { getUsageSummary } from "@/lib/usage";
import { BillingPanel } from "@/components/app/billing-panel";

export const metadata = { title: "Billing" };

export default async function BillingSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const { workspaceId } = await params;
  const { upgraded } = await searchParams;

  let ctx: WorkspaceContext;
  try {
    ctx = await requireWorkspace(workspaceId, "viewer");
  } catch (error) {
    if (error instanceof AuthError) redirect("/dashboard");
    throw error;
  }

  const usage = await getUsageSummary(workspaceId, ctx.plan);

  return (
    <BillingPanel
      workspaceId={workspaceId}
      currentPlan={ctx.plan}
      usage={usage}
      upgraded={upgraded === "1"}
    />
  );
}
