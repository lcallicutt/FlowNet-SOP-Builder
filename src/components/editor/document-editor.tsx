"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  Check,
  ChevronDown,
  CloudUpload,
  Copy,
  Download,
  History,
  Loader2,
  MoreHorizontal,
  Share2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { readApiError } from "./api";
import { useSaveQueue, type SaveStatus } from "./use-autosave";
import {
  DOCUMENT_STATUSES,
  roleAtLeast,
  type ContentOperation,
  type DocumentPackage,
  type EditorFeatures,
  type EditorRole,
} from "./types";
import {
  DocumentStatusBadge,
  documentStatusLabel,
} from "@/components/library/status-badge";
import { MetadataPopover, type MetadataPatch } from "./metadata-popover";
import { SopTab } from "./sop-tab";
import { ChecklistTab } from "./checklist-tab";
import { QuickGuideTab } from "./quick-guide-tab";
import { TrainingGuideTab } from "./training-guide-tab";
import { TranscriptTab } from "./transcript-tab";
import { ExportDialog } from "./export-dialog";
import { ShareDialog } from "./share-dialog";
import { VersionsSheet } from "./versions-sheet";
import { ApprovalDialog } from "./approval-dialog";

export type EditorApi = {
  workspaceId: string;
  documentId: string;
  canEdit: boolean;
  /** Debounced save (per-field). Also mutate local state before calling. */
  queueOp: (key: string, op: ContentOperation) => void;
  /** Immediate save without a package refetch (optimistic mutations). */
  applyOp: (op: ContentOperation) => Promise<boolean>;
  /** Immediate save followed by a package refetch (server-assigned state). */
  applyStructuralOp: (op: ContentOperation) => Promise<boolean>;
  /** Update local package state. */
  mutate: (fn: (pkg: DocumentPackage) => DocumentPackage) => void;
};

export function DocumentEditor({
  workspaceId,
  documentId,
  role,
  features,
  currentUser,
}: {
  workspaceId: string;
  documentId: string;
  role: EditorRole;
  features: EditorFeatures;
  currentUser: { id: string; name: string | null; email: string };
}) {
  const router = useRouter();
  const base = `/api/workspaces/${workspaceId}/documents/${documentId}`;
  const canEdit = roleAtLeast(role, "editor");
  const canAdmin = roleAtLeast(role, "admin");

  const [pkg, setPkg] = React.useState<DocumentPackage | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const { status, run, queue } = useSaveQueue();

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch(base);
      if (!res.ok) {
        const err = await readApiError(res, "Could not load the document.");
        setLoadError(err.message);
        return;
      }
      const data = (await res.json()) as { package: DocumentPackage };
      setPkg(data.package);
      setLoadError(null);
    } catch {
      setLoadError("Could not load the document. Check your connection and try again.");
    }
  }, [base]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const sendOps = React.useCallback(
    async (ops: ContentOperation[]): Promise<boolean> => {
      try {
        const res = await fetch(`${base}/content`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operations: ops }),
        });
        if (!res.ok) {
          const err = await readApiError(res, "Could not save changes.");
          toast.error(err.message);
          return false;
        }
        return true;
      } catch {
        toast.error("Network error — your last change was not saved.");
        return false;
      }
    },
    [base],
  );

  const api: EditorApi = React.useMemo(
    () => ({
      workspaceId,
      documentId,
      canEdit,
      queueOp: (key, op) => queue(key, () => sendOps([op])),
      applyOp: (op) => run(() => sendOps([op])),
      applyStructuralOp: async (op) => {
        const ok = await run(() => sendOps([op]));
        if (ok) await refresh();
        return ok;
      },
      mutate: (fn) => setPkg((p) => (p ? fn(p) : p)),
    }),
    [workspaceId, documentId, canEdit, queue, run, sendOps, refresh],
  );

  const patchMetadata = React.useCallback(
    async (patch: MetadataPatch): Promise<boolean> =>
      run(async () => {
        try {
          const res = await fetch(base, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          });
          if (!res.ok) {
            const err = await readApiError(res, "Could not update the document.");
            toast.error(err.message);
            return false;
          }
          setPkg((p) =>
            p
              ? {
                  ...p,
                  document: {
                    ...p.document,
                    ...(patch.title !== undefined ? { title: patch.title } : {}),
                    ...(patch.status !== undefined ? { status: patch.status } : {}),
                    ...(patch.department !== undefined
                      ? { department: patch.department }
                      : {}),
                    ...(patch.processCategory !== undefined
                      ? { processCategory: patch.processCategory }
                      : {}),
                    ...(patch.processOwner !== undefined
                      ? { processOwner: patch.processOwner }
                      : {}),
                    ...(patch.intendedAudience !== undefined
                      ? { intendedAudience: patch.intendedAudience }
                      : {}),
                    ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
                    ...(patch.reviewDate !== undefined
                      ? { reviewDate: patch.reviewDate }
                      : {}),
                    updatedAt: new Date().toISOString(),
                  },
                }
              : p,
          );
          return true;
        } catch {
          toast.error("Network error — the document was not updated.");
          return false;
        }
      }),
    [base, run],
  );

  async function changeStatus(next: string) {
    if (!pkg || next === pkg.document.status) return;
    const ok = await patchMetadata({
      status: next as (typeof DOCUMENT_STATUSES)[number],
    });
    if (ok) toast.success(`Status changed to ${documentStatusLabel(next)}.`);
  }

  async function duplicateDocument() {
    setBusy(true);
    try {
      const res = await fetch(`${base}/duplicate`, { method: "POST" });
      if (!res.ok) {
        const err = await readApiError(res, "Could not duplicate the document.");
        toast.error(err.message);
        return;
      }
      const data = (await res.json()) as { documentId: string; sopNumber: string };
      toast.success(`Duplicated as ${data.sopNumber}. Opening the copy…`);
      router.push(`/w/${workspaceId}/documents/${data.documentId}`);
    } catch {
      toast.error("Could not duplicate the document.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDocument() {
    setBusy(true);
    try {
      const res = await fetch(base, { method: "DELETE" });
      if (!res.ok) {
        const err = await readApiError(res, "Could not delete the document.");
        toast.error(err.message);
        return;
      }
      toast.success("Document deleted.");
      router.push(`/w/${workspaceId}/library`);
    } catch {
      toast.error("Could not delete the document.");
    } finally {
      setBusy(false);
      setDeleteOpen(false);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {loadError}
        </div>
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const doc = pkg.document;
  const hasTranscript = doc.projectId !== null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      {/* ------------------------------------------------ header */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {doc.sopNumber}
          </Badge>
          <Badge variant="outline" className="tabular-nums">
            v{doc.versionNumber}
          </Badge>

          {/* Status badge + change dropdown */}
          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-1"
                  aria-label="Change status"
                >
                  <DocumentStatusBadge status={doc.status} />
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {DOCUMENT_STATUSES.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => void changeStatus(s)}>
                    <span className="flex w-full items-center justify-between gap-4">
                      {documentStatusLabel(s)}
                      {s === doc.status && <Check className="size-4" />}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DocumentStatusBadge status={doc.status} />
          )}

          <SaveIndicator status={status} updatedAt={doc.updatedAt} />

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <ExportDialog
              endpoint={`${base}/export`}
              sopNumber={doc.sopNumber}
              features={features}
              trigger={
                <Button variant="outline" size="sm">
                  <Download className="size-4" /> Export
                </Button>
              }
            />
            <ShareDialog
              endpoint={`${base}/share-links`}
              canEdit={canEdit}
              sharedLinksEnabled={features.sharedLinks}
              trigger={
                <Button variant="outline" size="sm">
                  <Share2 className="size-4" /> Share
                </Button>
              }
            />
            <VersionsSheet
              endpoint={`${base}/versions`}
              currentPackage={pkg}
              canEdit={canEdit}
              versionHistoryEnabled={features.versionHistory}
              onRestored={refresh}
              trigger={
                <Button variant="outline" size="sm">
                  <History className="size-4" /> Versions
                </Button>
              }
            />
            <ApprovalDialog
              workspaceId={workspaceId}
              endpoint={`${base}/approvals`}
              canEdit={canEdit}
              approvalWorkflowEnabled={features.approvalWorkflow}
              currentUser={currentUser}
              onDecided={refresh}
              trigger={
                <Button variant="outline" size="sm">
                  <ShieldCheck className="size-4" /> Approval
                </Button>
              }
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="size-8" disabled={busy}>
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">More actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void duplicateDocument()}>
                  <Copy className="size-4" /> Duplicate
                </DropdownMenuItem>
                {canAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="size-4" /> Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <TitleField
          title={doc.title}
          canEdit={canEdit}
          onChange={(title) => {
            api.mutate((p) => ({ ...p, document: { ...p.document, title } }));
            queue("doc-title", async () => patchMetadata({ title }));
          }}
        />

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <MetadataPopover document={doc} canEdit={canEdit} onSave={patchMetadata} />
          {pkg.latestApproval && (
            <span>
              Latest approval: {pkg.latestApproval.status}
              {pkg.latestApproval.reviewerName
                ? ` · ${pkg.latestApproval.reviewerName}`
                : ""}
            </span>
          )}
        </div>
      </header>

      {/* ------------------------------------------------ tabs */}
      <Tabs defaultValue="sop">
        <TabsList>
          <TabsTrigger value="sop">SOP</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="quick-guide">Quick Guide</TabsTrigger>
          <TabsTrigger value="training-guide">Training Guide</TabsTrigger>
          {hasTranscript && <TabsTrigger value="transcript">Transcript</TabsTrigger>}
        </TabsList>
        <TabsContent value="sop" className="mt-4">
          <SopTab pkg={pkg} api={api} />
        </TabsContent>
        <TabsContent value="checklist" className="mt-4">
          <ChecklistTab items={pkg.checklist} api={api} />
        </TabsContent>
        <TabsContent value="quick-guide" className="mt-4">
          <QuickGuideTab guide={pkg.quickGuide} api={api} />
        </TabsContent>
        <TabsContent value="training-guide" className="mt-4">
          <TrainingGuideTab guide={pkg.trainingGuide} api={api} />
        </TabsContent>
        {hasTranscript && doc.projectId && (
          <TabsContent value="transcript" className="mt-4">
            <TranscriptTab workspaceId={workspaceId} projectId={doc.projectId} />
          </TabsContent>
        )}
      </Tabs>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {doc.sopNumber} — {doc.title}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The document and all of its content will be removed from the
              library. Shared links will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={busy}
              onClick={() => void deleteDocument()}
            >
              Delete document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TitleField({
  title,
  canEdit,
  onChange,
}: {
  title: string;
  canEdit: boolean;
  onChange: (title: string) => void;
}) {
  if (!canEdit) {
    return <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>;
  }
  return (
    <input
      value={title}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Document title"
      placeholder="Untitled SOP"
      className={cn(
        "w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-3xl font-semibold tracking-tight outline-none",
        "hover:border-input focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
      )}
    />
  );
}

function SaveIndicator({
  status,
  updatedAt,
}: {
  status: SaveStatus;
  updatedAt: string;
}) {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-destructive">
        <AlertCircle className="size-3" /> Unsaved changes
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Check className="size-3" /> Saved
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <CloudUpload className="size-3" /> Saved{" "}
      {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
    </span>
  );
}
