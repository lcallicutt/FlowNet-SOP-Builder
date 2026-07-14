import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Shared status badge for SOP documents (library table + editor header). */

const STATUS_STYLES: Record<string, string> = {
  draft: "border-transparent bg-muted text-muted-foreground",
  in_review:
    "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
  approved:
    "border-transparent bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-300",
  published:
    "border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300",
  archived:
    "border-transparent bg-zinc-200 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-400",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  published: "Published",
  archived: "Archived",
};

export function documentStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function DocumentStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Badge className={cn(STATUS_STYLES[status] ?? STATUS_STYLES.draft, className)}>
      {documentStatusLabel(status)}
    </Badge>
  );
}
