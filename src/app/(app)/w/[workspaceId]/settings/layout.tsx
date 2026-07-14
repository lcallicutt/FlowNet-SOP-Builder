import { SettingsNav } from "@/components/app/settings-nav";

export const metadata = { title: "Settings" };

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your workspace, team, and billing.
        </p>
      </div>
      <SettingsNav workspaceId={workspaceId} />
      <div>{children}</div>
    </div>
  );
}
