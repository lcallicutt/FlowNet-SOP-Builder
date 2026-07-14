"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  FileText,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatTimestamp } from "@/lib/utils";
import { VideoPanel } from "@/components/project/video-panel";
import {
  ApiError,
  apiFetch,
  canEdit,
  type Project,
  type ProjectStatus,
  type TranscriptResponse,
  type TranscriptSegment,
  type WorkspaceRole,
} from "@/components/project/types";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (;;) {
    const idx = lower.indexOf(q, cursor);
    if (idx === -1) {
      parts.push(text.slice(cursor));
      break;
    }
    if (idx > cursor) parts.push(text.slice(cursor, idx));
    parts.push(
      <mark
        key={`${idx}-${cursor}`}
        className="rounded-sm bg-gold/35 px-0.5 text-inherit"
      >
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    cursor = idx + q.length;
  }
  return <>{parts}</>;
}

function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

/* ------------------------------------------------------------------ */
/* Segment row                                                         */
/* ------------------------------------------------------------------ */

type SegmentRowProps = {
  segment: TranscriptSegment;
  text: string;
  isDirty: boolean;
  isEditing: boolean;
  editable: boolean;
  query: string;
  onSeek: (seconds: number) => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onChange: (value: string) => void;
};

function SegmentRow({
  segment,
  text,
  isDirty,
  isEditing,
  editable,
  query,
  onSeek,
  onStartEdit,
  onStopEdit,
  onChange,
}: SegmentRowProps) {
  return (
    <div className="group flex gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-muted/60">
      <button
        type="button"
        onClick={() => onSeek(segment.startSeconds)}
        className="mt-0.5 h-6 shrink-0 rounded border border-transparent bg-navy/5 px-1.5 font-mono text-xs font-medium tabular-nums text-navy transition-colors hover:border-gold hover:bg-gold/15 hover:text-navy dark:bg-secondary dark:text-foreground"
        title={`Jump to ${formatTimestamp(segment.startSeconds)}`}
      >
        {formatTimestamp(segment.startSeconds)}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          {segment.speaker && (
            <span className="text-xs font-semibold uppercase tracking-wide text-gold-dark">
              <Highlighted text={segment.speaker} query={query} />
            </span>
          )}
          {isDirty && (
            <Badge
              variant="outline"
              className="h-4 border-gold/60 px-1.5 text-[10px] text-gold-dark"
            >
              Edited
            </Badge>
          )}
        </div>

        {isEditing ? (
          <Textarea
            autoFocus
            defaultValue={text}
            ref={autoResize}
            rows={1}
            onFocus={(e) => {
              autoResize(e.currentTarget);
              // Put the caret at the end instead of selecting everything.
              const len = e.currentTarget.value.length;
              e.currentTarget.setSelectionRange(len, len);
            }}
            onChange={(e) => {
              autoResize(e.currentTarget);
              onChange(e.currentTarget.value);
            }}
            onBlur={onStopEdit}
            onKeyDown={(e) => {
              if (e.key === "Escape") onStopEdit();
            }}
            className="mt-1 min-h-0 resize-none overflow-hidden text-sm leading-relaxed"
          />
        ) : (
          <p
            onClick={editable ? onStartEdit : undefined}
            onKeyDown={
              editable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onStartEdit();
                    }
                  }
                : undefined
            }
            role={editable ? "button" : undefined}
            tabIndex={editable ? 0 : undefined}
            className={cn(
              "mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground",
              editable &&
                "cursor-text rounded-sm outline-none transition-colors hover:bg-gold/10 focus-visible:ring-2 focus-visible:ring-ring/50",
            )}
            title={editable ? "Click to edit" : undefined}
          >
            <Highlighted text={text} query={query} />
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Transcript review                                                   */
/* ------------------------------------------------------------------ */

type TranscriptReviewProps = {
  workspaceId: string;
  projectId: string;
  project: Project;
  role: WorkspaceRole;
  documentId: string | null;
  /** Resume polling in the given processing status. */
  onProcessingStarted: (status: ProjectStatus) => void;
  /** Present when this view was opened from the ready summary. */
  onBack?: () => void;
};

type TranscriptState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: TranscriptResponse };

export function TranscriptReview({
  workspaceId,
  projectId,
  project,
  role,
  documentId,
  onProcessingStarted,
  onBack,
}: TranscriptReviewProps) {
  const base = `/api/workspaces/${workspaceId}/projects/${projectId}`;
  // Read-only when the viewer lacks edit rights, or once a document exists
  // (the transcript is then a historical record of what was generated).
  const editable = canEdit(role) && !documentId;
  const showGenerate = editable && project.status !== "published";

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState<TranscriptState>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<TranscriptResponse>(`${base}/transcript`, { cache: "no-store" })
      .then((data) => {
        if (!cancelled) setState({ kind: "ready", data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setState({ kind: "missing" });
        } else {
          setState({
            kind: "error",
            message:
              err instanceof ApiError
                ? err.message
                : "Could not load the transcript.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [base]);

  const segments = useMemo(
    () => (state.kind === "ready" ? state.data.segments : []),
    [state],
  );

  const textFor = useCallback(
    (segment: TranscriptSegment) => dirty[segment.id] ?? segment.text,
    [dirty],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return segments;
    return segments.filter(
      (s) =>
        textFor(s).toLowerCase().includes(q) ||
        (s.speaker ?? "").toLowerCase().includes(q),
    );
  }, [segments, query, textFor]);

  const dirtyCount = Object.keys(dirty).length;

  function seekTo(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    void video.play().catch(() => {
      // Autoplay can be blocked; the user can press play manually.
    });
    video.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function setSegmentText(segment: TranscriptSegment, value: string) {
    setDirty((prev) => {
      if (value === segment.text) {
        const { [segment.id]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [segment.id]: value };
    });
  }

  const saveEdits = useCallback(async (): Promise<boolean> => {
    if (state.kind !== "ready") return true;
    const edits = Object.entries(dirty).map(([segmentId, text]) => ({
      segmentId,
      text,
    }));
    if (edits.length === 0) return true;
    setSaving(true);
    try {
      await apiFetch<{ ok: boolean }>(`${base}/transcript`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcriptId: state.data.transcript.id, edits }),
      });
      setState((prev) =>
        prev.kind === "ready"
          ? {
              kind: "ready",
              data: {
                ...prev.data,
                segments: prev.data.segments.map((s) =>
                  dirty[s.id] !== undefined ? { ...s, text: dirty[s.id] } : s,
                ),
              },
            }
          : prev,
      );
      setDirty({});
      setEditingId(null);
      toast.success(
        `Saved ${edits.length} segment ${edits.length === 1 ? "edit" : "edits"}.`,
      );
      return true;
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Could not save your transcript edits.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [base, dirty, state]);

  async function regenerate() {
    setRegenerating(true);
    try {
      await apiFetch<{ ok: boolean }>(`${base}/transcript/regenerate`, {
        method: "POST",
      });
      toast.success("Re-transcription started.");
      onProcessingStarted("transcribing");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Could not start re-transcription.",
      );
    } finally {
      setRegenerating(false);
    }
  }

  async function generate() {
    if (state.kind !== "ready") return;
    setGenerating(true);
    try {
      // Persist pending edits first so generation uses the corrected
      // transcript. Abort if saving fails (saveEdits already toasted).
      const saved = await saveEdits();
      if (!saved) return;
      await apiFetch<{ ok: boolean }>(`${base}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcriptId: state.data.transcript.id }),
      });
      toast.success("Generating your SOP package.");
      onProcessingStarted("analyzing_process");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Could not start generating the SOP package.",
      );
    } finally {
      setGenerating(false);
    }
  }

  const busy = saving || regenerating || generating;
  const generationFailed =
    project.status === "transcript_ready" && Boolean(project.errorMessage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Back to summary
            </button>
          )}
          <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
            {project.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Review the transcript, fix anything that was misheard, then
            generate your SOP package.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editable && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={busy}>
                  {regenerating ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <RotateCcw aria-hidden />
                  )}
                  Regenerate transcription
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Regenerate the transcription?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This uses transcription minutes from your plan and replaces
                    the current transcript — including every edit you have made
                    to it. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void regenerate()}>
                    Regenerate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {showGenerate && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={busy || state.kind !== "ready"}
                  className="bg-gold text-navy shadow-xs hover:bg-gold-dark"
                >
                  {generating ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Sparkles aria-hidden />
                  )}
                  Generate SOP Package
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Generate SOP package?</AlertDialogTitle>
                  <AlertDialogDescription>
                    We&apos;ll analyze this transcript and create the SOP,
                    checklist, quick-reference guide, and training guide.
                    {dirtyCount > 0 &&
                      ` Your ${dirtyCount} unsaved ${
                        dirtyCount === 1 ? "edit" : "edits"
                      } will be saved first.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-gold text-navy hover:bg-gold-dark"
                    onClick={() => void generate()}
                  >
                    Generate package
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {generationFailed && (
        <Alert className="border-amber-400/60 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400">
          <AlertTriangle aria-hidden />
          <AlertTitle>SOP generation didn&apos;t finish</AlertTitle>
          <AlertDescription className="text-amber-800/90 dark:text-amber-200/80">
            {project.errorMessage} Your transcript is safe — you can try
            generating again.
          </AlertDescription>
        </Alert>
      )}

      {/* Two-column layout: sticky video left, transcript right */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="lg:sticky lg:top-6">
          <VideoPanel
            workspaceId={workspaceId}
            projectId={projectId}
            project={project}
            transcript={state.kind === "ready" ? state.data.transcript : null}
            videoRef={videoRef}
          />
        </div>

        <Card className="gap-0 py-0">
          <CardHeader className="gap-3 border-b px-4 py-4 [.border-b]:pb-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <FileText className="size-4 text-gold-dark" aria-hidden />
                Transcript
              </h2>
              {!editable && <Badge variant="secondary">Read-only</Badge>}
            </div>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the transcript…"
                className="pl-8"
                aria-label="Search transcript"
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {state.kind === "loading" && (
              <div className="space-y-4 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-6 w-12" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {state.kind === "missing" && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                The transcript isn&apos;t available yet. Check back in a
                moment.
              </p>
            )}

            {state.kind === "error" && (
              <p className="p-6 text-center text-sm text-destructive">
                {state.message}
              </p>
            )}

            {state.kind === "ready" && (
              <>
                <ScrollArea className="h-[min(65vh,44rem)]">
                  <div className="space-y-0.5 p-2">
                    {filtered.length === 0 ? (
                      <p className="p-6 text-center text-sm text-muted-foreground">
                        {query
                          ? "No segments match your search."
                          : "This transcript has no segments."}
                      </p>
                    ) : (
                      filtered.map((segment) => (
                        <SegmentRow
                          key={segment.id}
                          segment={segment}
                          text={textFor(segment)}
                          isDirty={dirty[segment.id] !== undefined}
                          isEditing={editingId === segment.id}
                          editable={editable}
                          query={query.trim()}
                          onSeek={seekTo}
                          onStartEdit={() => setEditingId(segment.id)}
                          onStopEdit={() =>
                            setEditingId((prev) =>
                              prev === segment.id ? null : prev,
                            )
                          }
                          onChange={(value) => setSegmentText(segment, value)}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>

                {dirtyCount > 0 && (
                  <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-b-xl border-t bg-card/95 px-4 py-3 backdrop-blur">
                    <p className="text-sm text-muted-foreground">
                      {dirtyCount} unsaved{" "}
                      {dirtyCount === 1 ? "change" : "changes"}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={saving}
                        onClick={() => {
                          setDirty({});
                          setEditingId(null);
                        }}
                      >
                        Discard
                      </Button>
                      <Button
                        size="sm"
                        disabled={saving}
                        onClick={() => void saveEdits()}
                      >
                        {saving && (
                          <Loader2 className="animate-spin" aria-hidden />
                        )}
                        Save changes
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
