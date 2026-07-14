"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/components/app/api";

type WorkspaceListItem = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

export function WorkspaceSwitcher({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string;
  workspaceName: string;
}) {
  const router = useRouter();
  const [workspaces, setWorkspaces] = React.useState<WorkspaceListItem[] | null>(
    null,
  );
  const [loading, setLoading] = React.useState(false);

  async function loadWorkspaces() {
    if (workspaces || loading) return;
    setLoading(true);
    try {
      const body = await apiFetch<{ workspaces: WorkspaceListItem[] }>(
        "/api/workspaces",
      );
      setWorkspaces(body.workspaces);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load workspaces.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && void loadWorkspaces()}>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/60 px-3 py-2 text-left text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none">
        <span className="flex size-6 shrink-0 items-center justify-center rounded bg-gold/15 text-gold">
          <Building2 className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">
          {workspaceName}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          Workspaces
        </DropdownMenuLabel>
        {loading && !workspaces ? (
          <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
        ) : (
          (workspaces ?? [{ id: workspaceId, name: workspaceName, slug: "", role: "" }]).map(
            (ws) => (
              <DropdownMenuItem
                key={ws.id}
                onSelect={() => {
                  if (ws.id !== workspaceId) router.push(`/w/${ws.id}`);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{ws.name}</span>
                {ws.id === workspaceId ? (
                  <Check className="size-4 text-gold-dark" />
                ) : null}
              </DropdownMenuItem>
            ),
          )
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/workspaces/new">
            <Plus className="size-4" />
            Create workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
