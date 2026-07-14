"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, Loader2, RotateCcw, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ApiError,
  apiFetch,
  canEdit,
  type Project,
  type TranscriptResponse,
  type WorkspaceRole,
} from "@/components/project/types";

type FailedViewProps = {
  workspaceId: string;
  projectId: string;
  project: Project;
  role: WorkspaceRole;
  /** Called after a retry was accepted so the parent resumes polling. */
  onRetryStarted: () => void;
  /** Switches the parent to the transcript review screen. */
  onViewTranscript: () => void;
};

export function FailedView({
  workspaceId,
  projectId,
  project,
  role,
  onRetryStarted,
  onViewTranscript,
}: FailedViewProps) {
  const router = useRouter();
  const editor = canEdit(role);
  const base = `/api/workspaces/${workspaceId}/projects/${projectId}`;

  // Whether a transcript already exists decides which retry path applies:
  // no transcript -> the failure happened during transcription (re-run it);
  // transcript exists -> the failure was in generation (retry from there).
  const [hasTranscript, setHasTranscript] = useState<boolean | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<TranscriptResponse>(`${base}/transcript`, { cache: "no-store" })
      .then(() => {
        if (!cancelled) setHasTranscript(true);
      })
      .catch(() => {
        if (!cancelled) setHasTranscript(false);
      });
    return () => {
      cancelled = true;
    };
  }, [base]);

  async function retryTranscription() {
    setRetrying(true);
    try {
      await apiFetch<{ ok: boolean }>(`${base}/transcript/regenerate`, {
        method: "POST",
      });
      toast.success("Processing restarted.");
      onRetryStarted();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not restart processing.",
      );
    } finally {
      setRetrying(false);
    }
  }

  async function deleteProject() {
    setDeleting(true);
    try {
      await apiFetch<{ ok: boolean }>(base, { method: "DELETE" });
      toast.success("Project deleted.");
      router.push(`/w/${workspaceId}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not delete the project.",
      );
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {project.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          Processing could not be completed.
        </p>
      </div>

      <Alert variant="destructive" className="border-destructive/40">
        <AlertTriangle aria-hidden />
        <AlertTitle>Processing failed</AlertTitle>
        <AlertDescription>
          {project.errorMessage ??
            "Something went wrong while processing this recording."}
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {hasTranscript === true
              ? "Your transcript is intact — retry generating the SOP package from the transcript view."
              : hasTranscript === false
                ? "You can retry processing this recording, or delete the project."
                : "Checking what can be recovered…"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {editor && hasTranscript === false && (
              <Button onClick={retryTranscription} disabled={retrying}>
                {retrying ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <RotateCcw aria-hidden />
                )}
                Try again
              </Button>
            )}
            {hasTranscript === true && (
              <Button variant="outline" onClick={onViewTranscript}>
                <FileText aria-hidden />
                View transcript
              </Button>
            )}
            {editor && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={deleting}>
                    {deleting ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : (
                      <Trash2 aria-hidden />
                    )}
                    Delete project
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this project?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes “{project.title}”, including its
                      recording and any transcript. This action cannot be
                      undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-white hover:bg-destructive/90"
                      onClick={() => void deleteProject()}
                    >
                      Delete project
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
