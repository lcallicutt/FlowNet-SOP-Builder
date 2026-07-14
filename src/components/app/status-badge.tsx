import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type ProjectStatus =
  | "uploaded"
  | "extracting_audio"
  | "transcribing"
  | "transcript_ready"
  | "analyzing_process"
  | "generating_documentation"
  | "ready_for_review"
  | "published"
  | "failed";

export const PROCESSING_STATUSES: ProjectStatus[] = [
  "uploaded",
  "extracting_audio",
  "transcribing",
  "analyzing_process",
  "generating_documentation",
];

type StatusStyle = {
  label: string;
  className: string;
  pulse?: boolean;
};

const STATUS_STYLES: Record<ProjectStatus, StatusStyle> = {
  uploaded: {
    label: "Queued",
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    pulse: true,
  },
  extracting_audio: {
    label: "Extracting audio",
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    pulse: true,
  },
  transcribing: {
    label: "Transcribing",
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    pulse: true,
  },
  transcript_ready: {
    label: "Transcript ready",
    className:
      "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
  },
  analyzing_process: {
    label: "Analyzing process",
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    pulse: true,
  },
  generating_documentation: {
    label: "Generating docs",
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    pulse: true,
  },
  ready_for_review: {
    label: "Ready for review",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  published: {
    label: "Published",
    className:
      "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200",
  },
  failed: {
    label: "Failed",
    className:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
  },
};

export function projectStatusLabel(status: ProjectStatus): string {
  return STATUS_STYLES[status].label;
}

export function StatusBadge({
  status,
  className,
}: {
  status: ProjectStatus;
  className?: string;
}) {
  const style = STATUS_STYLES[status];
  return (
    <Badge variant="outline" className={cn(style.className, className)}>
      {style.pulse ? (
        <span className="size-1.5 animate-pulse rounded-full bg-current" />
      ) : null}
      {style.label}
    </Badge>
  );
}
