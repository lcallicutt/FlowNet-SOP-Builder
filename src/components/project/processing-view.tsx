"use client";

import { Check, Circle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Project, ProjectStatus } from "@/components/project/types";

type Stage = {
  status: ProjectStatus;
  label: string;
  description: string;
};

const PIPELINE: Stage[] = [
  {
    status: "uploaded",
    label: "Uploaded",
    description: "Recording received and queued for processing.",
  },
  {
    status: "extracting_audio",
    label: "Extracting audio",
    description: "Separating the audio track from your recording.",
  },
  {
    status: "transcribing",
    label: "Transcribing",
    description: "Converting speech to text with timestamps.",
  },
  {
    status: "transcript_ready",
    label: "Transcript ready",
    description: "Transcript available for your review and edits.",
  },
  {
    status: "analyzing_process",
    label: "Analyzing process",
    description: "Identifying steps, decisions, and quality checkpoints.",
  },
  {
    status: "generating_documentation",
    label: "Generating documentation",
    description: "Writing the SOP, checklist, and training materials.",
  },
  {
    status: "ready_for_review",
    label: "Ready for review",
    description: "Your SOP package is ready to open in the editor.",
  },
];

function stageIndex(status: ProjectStatus): number {
  const idx = PIPELINE.findIndex((s) => s.status === status);
  return idx === -1 ? 0 : idx;
}

export function ProcessingView({ project }: { project: Project }) {
  const currentIndex = stageIndex(project.status);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {project.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          We&apos;re working on your recording. This page updates
          automatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Processing pipeline</span>
            <span className="text-sm font-normal tabular-nums text-muted-foreground">
              {Math.min(100, Math.max(0, project.progressPercent))}%
            </span>
          </CardTitle>
          <Progress
            value={Math.min(100, Math.max(0, project.progressPercent))}
            className="mt-2 [&_[data-slot=progress-indicator]]:bg-gold"
          />
        </CardHeader>
        <CardContent>
          <ol className="space-y-0">
            {PIPELINE.map((stage, i) => {
              const done = i < currentIndex;
              const current = i === currentIndex;
              const last = i === PIPELINE.length - 1;
              return (
                <li key={stage.status} className="relative flex gap-4 pb-6 last:pb-0">
                  {!last && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-px",
                        done ? "bg-gold" : "bg-border",
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border",
                      done && "border-gold bg-gold text-navy",
                      current && "border-gold bg-background text-gold-dark",
                      !done && !current && "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? (
                      <Check className="size-4" aria-hidden />
                    ) : current ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Circle className="size-2.5 fill-current opacity-40" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 pt-1">
                    <p
                      className={cn(
                        "text-sm font-medium leading-none",
                        current
                          ? "text-foreground"
                          : done
                            ? "text-foreground/80"
                            : "text-muted-foreground",
                      )}
                    >
                      {stage.label}
                      {current && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-medium text-gold-dark">
                          In progress
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {stage.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
