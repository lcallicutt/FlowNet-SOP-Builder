import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthError, requireWorkspace, roleAtLeast } from "@/lib/auth";
import { LibraryTable } from "@/components/library/library-table";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "SOP Library" };

export default async function LibraryPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  let role: "owner" | "admin" | "editor" | "viewer";
  try {
    const ctx = await requireWorkspace(workspaceId, "viewer");
    role = ctx.role;
  } catch (error) {
    if (error instanceof AuthError) redirect("/dashboard");
    throw error;
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">SOP Library</h1>
        <p className="text-sm text-muted-foreground">
          Every standard operating procedure in this workspace — searchable,
          filterable, and ready to share.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <LibraryTable
          workspaceId={workspaceId}
          canAdmin={roleAtLeast(role, "admin")}
        />
      </Suspense>
    </div>
  );
}
