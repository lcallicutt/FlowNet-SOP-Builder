"use client";

import { useEffect, useState, type RefObject } from "react";
import { VideoOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimestamp } from "@/lib/utils";
import {
  ApiError,
  apiFetch,
  type Project,
  type TranscriptMeta,
  type VideoUrlResponse,
} from "@/components/project/types";

const DETAIL_LEVEL_LABELS: Record<Project["detailLevel"], string> = {
  concise: "Concise",
  standard: "Standard",
  detailed: "Detailed",
  training_level: "Training level",
};

function languageLabel(code: string | null): string {
  if (!code) return "—";
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code
    );
  } catch {
    return code;
  }
}

type VideoPanelProps = {
  workspaceId: string;
  projectId: string;
  project: Project;
  transcript: TranscriptMeta | null;
  videoRef: RefObject<HTMLVideoElement | null>;
};

type VideoState =
  | { kind: "loading" }
  | { kind: "ready"; url: string; contentType: string }
  | { kind: "unavailable" }
  | { kind: "error"; message: string };

export function VideoPanel({
  workspaceId,
  projectId,
  project,
  transcript,
  videoRef,
}: VideoPanelProps) {
  const [video, setVideo] = useState<VideoState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    apiFetch<VideoUrlResponse>(
      `/api/workspaces/${workspaceId}/projects/${projectId}/video-url`,
      { cache: "no-store" },
    )
      .then((body) => {
        if (cancelled) return;
        setVideo({ kind: "ready", url: body.url, contentType: body.contentType });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (
          err instanceof ApiError &&
          (err.status === 410 || err.code === "source_unavailable")
        ) {
          setVideo({ kind: "unavailable" });
        } else {
          setVideo({
            kind: "error",
            message:
              err instanceof ApiError
                ? err.message
                : "Could not load the recording.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectId]);

  const meta: { label: string; value: string }[] = [
    {
      label: "Duration",
      value:
        transcript?.durationSeconds != null
          ? formatTimestamp(transcript.durationSeconds)
          : "—",
    },
    {
      label: "Words",
      value:
        transcript?.wordCount != null
          ? transcript.wordCount.toLocaleString()
          : "—",
    },
    {
      label: "Language",
      value: languageLabel(transcript?.language ?? project.language),
    },
    { label: "Detail level", value: DETAIL_LEVEL_LABELS[project.detailLevel] },
  ];

  return (
    <Card className="overflow-hidden py-0 gap-0">
      <div className="bg-navy">
        {video.kind === "loading" && (
          <Skeleton className="aspect-video w-full rounded-none bg-navy-light" />
        )}
        {video.kind === "ready" && (
          <video
            ref={videoRef}
            controls
            preload="metadata"
            playsInline
            className="aspect-video w-full bg-black"
            src={video.url}
          />
        )}
        {(video.kind === "unavailable" || video.kind === "error") && (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-center">
            <VideoOff className="size-8 text-sidebar-foreground/50" aria-hidden />
            <p className="text-sm text-sidebar-foreground/70">
              {video.kind === "unavailable"
                ? "Source recording unavailable"
                : video.message}
            </p>
          </div>
        )}
      </div>

      <CardContent className="space-y-3 px-4 py-4">
        <h2 className="text-base font-semibold leading-snug text-foreground">
          {project.title}
        </h2>
        <Separator />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {meta.map((item) => (
            <div key={item.label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {item.label}
              </dt>
              <dd className="mt-0.5 font-medium tabular-nums text-foreground">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
