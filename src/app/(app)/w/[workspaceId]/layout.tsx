import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { AuthError, requireWorkspace, type WorkspaceContext } from "@/lib/auth";
import { AppSidebar } from "@/components/app/app-sidebar";
import { MobileSidebar } from "@/components/app/mobile-sidebar";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block">
        <AppSidebar
          workspaceId={workspaceId}
          workspaceName={ctx.workspace.name}
        />
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur md:px-6">
          <MobileSidebar
            workspaceId={workspaceId}
            workspaceName={ctx.workspace.name}
          />
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
            {ctx.workspace.name}
          </div>
          <UserButton />
        </header>
        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
