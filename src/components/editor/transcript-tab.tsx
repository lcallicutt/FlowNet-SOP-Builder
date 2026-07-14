"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimestamp } from "@/lib/utils";
import { readApiError } from "./api";

type TranscriptSegment = {
  id: string;
  index: number;
  startSeconds: number;
  endSeconds: number;
  speaker: string | null;
  text: string;
};

type TranscriptResponse = {
  transcript: {
    id: string;
    status: string;
    language: string | null;
    durationSeconds: number | null;
    wordCount: number | null;
  };
  segments: TranscriptSegment[];
};

/** Read-only view of the source video transcript with timestamped segments. */
export function TranscriptTab({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const [data, setData] = React.useState<TranscriptResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/projects/${projectId}/transcript`,
        );
        if (!res.ok) {
          const err = await readApiError(res, "Could not load the transcript.");
          if (!cancelled) setError(err.message);
          return;
        }
        const body = (await res.json()) as TranscriptResponse;
        if (!cancelled) setData(body);
      } catch {
        if (!cancelled) setError("Could not load the transcript.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectId]);

  if (error) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Source recording transcript
          {data.transcript.durationSeconds
            ? ` · ${formatTimestamp(data.transcript.durationSeconds)}`
            : ""}
          {data.transcript.wordCount
            ? ` · ${data.transcript.wordCount.toLocaleString()} words`
            : ""}{" "}
          — read-only here.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/w/${workspaceId}/projects/${projectId}`}>
            <ExternalLink className="size-4" /> Open transcript review
          </Link>
        </Button>
      </div>
      <div className="divide-y rounded-lg border">
        {data.segments.map((segment) => (
          <div key={segment.id} className="flex gap-3 px-4 py-2.5">
            <Badge
              variant="outline"
              className="mt-0.5 h-fit shrink-0 font-mono text-xs text-muted-foreground"
            >
              {formatTimestamp(segment.startSeconds)}
            </Badge>
            <div className="min-w-0">
              {segment.speaker && (
                <span className="mr-2 text-xs font-semibold text-muted-foreground">
                  {segment.speaker}
                </span>
              )}
              <span className="text-sm leading-relaxed">{segment.text}</span>
            </div>
          </div>
        ))}
        {data.segments.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            The transcript has no segments.
          </p>
        )}
      </div>
    </div>
  );
}
