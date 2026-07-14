"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, LayoutDashboard, Settings, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkspaceSwitcher } from "@/components/app/workspace-switcher";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

export function AppSidebar({
  workspaceId,
  workspaceName,
  onNavigate,
}: {
  workspaceId: string;
  workspaceName: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const items: NavItem[] = [
    {
      label: "Dashboard",
      href: `/w/${workspaceId}`,
      icon: LayoutDashboard,
      exact: true,
    },
    { label: "Upload video", href: `/w/${workspaceId}/upload`, icon: Upload },
    { label: "SOP Library", href: `/w/${workspaceId}/library`, icon: BookOpen },
    { label: "Settings", href: `/w/${workspaceId}/settings`, icon: Settings },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-5 pb-4">
        <Link
          href={`/w/${workspaceId}`}
          onClick={onNavigate}
          className="flex items-center gap-2.5"
        >
          <span className="flex size-8 items-center justify-center rounded-md bg-gold font-bold text-navy">
            F
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-sidebar-foreground">
              FlowNet
            </span>
            <span className="block text-[11px] tracking-wide text-sidebar-foreground/60 uppercase">
              SOP Builder
            </span>
          </span>
        </Link>
      </div>

      <div className="px-3 pb-4">
        <WorkspaceSwitcher
          workspaceId={workspaceId}
          workspaceName={workspaceName}
        />
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              {active ? (
                <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-gold" />
              ) : null}
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-4 py-4">
        <p className="text-xs text-sidebar-foreground/50">
          Turn recordings into SOPs your team can follow.
        </p>
      </div>
    </div>
  );
}
