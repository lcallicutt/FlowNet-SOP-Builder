"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, FileText, PenLine } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/components/project/use-project";
import { ProcessingView } from "@/components/project/processing-view";
import { FailedView } from "@/components/project/failed-view";
import { TranscriptReview } from "@/components/project/transcript-review";
import {
  isProcessingStatus,
  type Project,
  type WorkspaceRole,
} from "@/components/project/types";

/* ------------------------------------------------------------------ */
/* Ready view                                                          */
/* ------------------------------------------------------------------ */

function ReadyView({
  workspaceId,
  documentId,
  project,
  onViewTranscript,
}: {
  workspaceId: string;
  documentId: string;
  project: Project;
  onViewTranscript: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {project.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {project.status === "published"
            ? "This project's SOP package has been published."
            : "Processing is complete."}
        </p>
      </div>

      <Card className="border-gold/40">
        <CardHeader className="items-center text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-gold/15">
            <BadgeCheck className="size-6 text-gold-dark" aria-hidden />
          </div>
          <CardTitle className="text-xl">SOP package ready</CardTitle>
          <CardDescription className="mx-auto max-w-md">
            Your SOP, checklist, quick-reference guide, and training guide have
            been generated and are ready to review in the editor.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <Button
            asChild
            size="lg"
            className="bg-gold text-navy shadow-xs hover:bg-gold-dark"
          >
            <Link href={`/w/${workspaceId}/documents/${documentId}`}>
              <PenLine aria-hidden />
              Open in editor
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={onViewTranscript}>
            <FileText aria-hidden />
            View transcript
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Loading skeleton                                                    */
/* ------------------------------------------------------------------ */

function ProjectSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Skeleton className="aspect-video w-full rounded-xl" />
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Project view                                                        */
/* ------------------------------------------------------------------ */

export function ProjectView({
  workspaceId,
  projectId,
  role,
}: {
  workspaceId: string;
  projectId: string;
  role: WorkspaceRole;
}) {
  const { project, documentId, loading, loadError, beginProcessing } =
    useProject(workspaceId, projectId);
  // Set when the user explicitly opens the transcript from the ready/failed
  // summaries; cleared automatically when the project re-enters processing.
  const [showTranscript, setShowTranscript] = useState(false);

  if (loading) {
    return <ProjectSkeleton />;
  }

  if (!project) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertTitle>Project unavailable</AlertTitle>
          <AlertDescription>
            {loadError ?? "Could not load this project."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const status = project.status;

  if (isProcessingStatus(status)) {
    return <ProcessingView project={project} />;
  }

  if (status === "failed" && !showTranscript) {
    return (
      <FailedView
        workspaceId={workspaceId}
        projectId={projectId}
        project={project}
        role={role}
        onRetryStarted={() => beginProcessing("transcribing")}
        onViewTranscript={() => setShowTranscript(true)}
      />
    );
  }

  const isReady =
    (status === "ready_for_review" || status === "published") &&
    documentId !== null;

  if (isReady && !showTranscript) {
    return (
      <ReadyView
        workspaceId={workspaceId}
        documentId={documentId}
        project={project}
        onViewTranscript={() => setShowTranscript(true)}
      />
    );
  }

  return (
    <TranscriptReview
      workspaceId={workspaceId}
      projectId={projectId}
      project={project}
      role={role}
      documentId={documentId}
      onProcessingStarted={(next) => {
        setShowTranscript(false);
        beginProcessing(next);
      }}
      onBack={
        showTranscript && (isReady || status === "failed")
          ? () => setShowTranscript(false)
          : undefined
      }
    />
  );
}
