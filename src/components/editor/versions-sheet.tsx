"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { format } from "date-fns";
import { Camera, Eye, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { readApiError } from "./api";
import type { DocumentPackage } from "./types";

type VersionSummary = {
  id: string;
  versionNumber: number;
  revisionNotes: string | null;
  createdAt: string;
  createdBy: string;
};

type Compare = {
  versionNumber: number;
  revisionNotes: string | null;
  snapshot: DocumentPackage;
};

/**
 * Version history in a right-hand slide-over (built on the Radix Dialog
 * primitive since the ui kit has no sheet component).
 */
export function VersionsSheet({
  endpoint,
  currentPackage,
  canEdit,
  versionHistoryEnabled,
  onRestored,
  trigger,
}: {
  endpoint: string;
  currentPackage: DocumentPackage;
  canEdit: boolean;
  versionHistoryEnabled: boolean;
  onRestored: () => Promise<void>;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [versions, setVersions] = React.useState<VersionSummary[] | null>(null);
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [restoreTarget, setRestoreTarget] = React.useState<VersionSummary | null>(null);
  const [compare, setCompare] = React.useState<Compare | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) {
        const err = await readApiError(res, "Could not load version history.");
        if (err.code !== "plan_upgrade_required") toast.error(err.message);
        setVersions([]);
        return;
      }
      const data = (await res.json()) as { versions: VersionSummary[] };
      setVersions(data.versions);
    } catch {
      toast.error("Could not load version history.");
    }
  }, [endpoint]);

  React.useEffect(() => {
    if (open && versionHistoryEnabled) void load();
  }, [open, versionHistoryEnabled, load]);

  async function snapshot() {
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionNotes: notes.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await readApiError(res, "Could not snapshot the document.");
        toast.error(err.message);
        return;
      }
      toast.success("Version snapshot created.");
      setNotes("");
      await load();
      await onRestored(); // refresh so the bumped version number shows
    } catch {
      toast.error("Could not snapshot the document.");
    } finally {
      setBusy(false);
    }
  }

  async function restore(version: VersionSummary) {
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: version.id }),
      });
      if (!res.ok) {
        const err = await readApiError(res, "Could not restore the version.");
        toast.error(err.message);
        return;
      }
      toast.success(`Restored version ${version.versionNumber}.`);
      await load();
      await onRestored();
    } catch {
      toast.error("Could not restore the version.");
    } finally {
      setBusy(false);
      setRestoreTarget(null);
    }
  }

  async function view(version: VersionSummary) {
    try {
      const res = await fetch(`${endpoint}/${version.id}`);
      if (!res.ok) {
        const err = await readApiError(res, "Could not load the version snapshot.");
        toast.error(err.message);
        return;
      }
      const data = (await res.json()) as {
        version: { versionNumber: number; revisionNotes: string | null; snapshot: DocumentPackage };
      };
      setCompare({
        versionNumber: data.version.versionNumber,
        revisionNotes: data.version.revisionNotes,
        snapshot: data.version.snapshot,
      });
    } catch {
      toast.error("Could not load the version snapshot.");
    }
  }

  return (
    <SheetPrimitive.Root open={open} onOpenChange={setOpen}>
      <SheetPrimitive.Trigger asChild>{trigger}</SheetPrimitive.Trigger>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <SheetPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col gap-4 overflow-y-auto border-l bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right">
          <div className="flex items-start justify-between">
            <div>
              <SheetPrimitive.Title className="text-lg font-semibold">
                Version history
              </SheetPrimitive.Title>
              <SheetPrimitive.Description className="text-sm text-muted-foreground">
                Current working copy: v{currentPackage.document.versionNumber}
              </SheetPrimitive.Description>
            </div>
            <SheetPrimitive.Close asChild>
              <Button variant="ghost" size="icon" className="size-7" aria-label="Close">
                <X className="size-4" />
              </Button>
            </SheetPrimitive.Close>
          </div>

          {!versionHistoryEnabled ? (
            <p className="flex items-start gap-2 rounded-md border border-accent/50 bg-accent/10 p-3 text-sm">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-gold-dark" />
              Version history is available on the Professional and Business
              plans. Upgrade to snapshot and restore document versions.
            </p>
          ) : (
            <>
              {canEdit && (
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium">Snapshot current version</p>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Revision notes (optional)"
                  />
                  <Button size="sm" onClick={() => void snapshot()} disabled={busy}>
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Camera className="size-4" />
                    )}
                    Snapshot current version
                  </Button>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                {versions === null && (
                  <p className="text-sm text-muted-foreground">Loading versions…</p>
                )}
                {versions?.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No versions yet. Snapshot the document to create the first one.
                  </p>
                )}
                {versions?.map((version) => (
                  <div key={version.id} className="rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        v{version.versionNumber}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(version.createdAt), "MMM d, yyyy p")} ·{" "}
                        {version.createdBy}
                      </span>
                    </div>
                    {version.revisionNotes && (
                      <p className="mt-1.5 text-sm">{version.revisionNotes}</p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => void view(version)}
                      >
                        <Eye className="size-3.5" /> View
                      </Button>
                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7"
                          disabled={busy}
                          onClick={() => setRestoreTarget(version)}
                        >
                          <RotateCcw className="size-3.5" /> Restore
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {compare && (
                <CompareSummary
                  compare={compare}
                  current={currentPackage}
                  onClose={() => setCompare(null)}
                />
              )}
            </>
          )}
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>

      <AlertDialog
        open={restoreTarget !== null}
        onOpenChange={(o) => !o && setRestoreTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Restore version {restoreTarget?.versionNumber}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The current state is automatically snapshotted first, so nothing
              is lost — the working copy is then replaced with this version&apos;s
              content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => restoreTarget && void restore(restoreTarget)}
            >
              Restore version
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SheetPrimitive.Root>
  );
}

function CompareSummary({
  compare,
  current,
  onClose,
}: {
  compare: Compare;
  current: DocumentPackage;
  onClose: () => void;
}) {
  const snap = compare.snapshot;
  const rows: { metric: string; then: string; now: string }[] = [
    { metric: "Title", then: snap.document.title, now: current.document.title },
    {
      metric: "Sections",
      then: String(snap.sections.length),
      now: String(current.sections.length),
    },
    {
      metric: "Steps",
      then: String(snap.steps.length),
      now: String(current.steps.length),
    },
    {
      metric: "Checklist items",
      then: String(snap.checklist.length),
      now: String(current.checklist.length),
    },
  ];

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          v{compare.versionNumber} vs current
        </p>
        <Button variant="ghost" size="icon" className="size-6" aria-label="Close compare" onClick={onClose}>
          <X className="size-3.5" />
        </Button>
      </div>
      {compare.revisionNotes && (
        <p className="text-xs text-muted-foreground">{compare.revisionNotes}</p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead />
            <TableHead>v{compare.versionNumber}</TableHead>
            <TableHead>Current</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.metric}>
              <TableCell className="text-xs font-medium">{row.metric}</TableCell>
              <TableCell className="max-w-28 truncate text-xs" title={row.then}>
                {row.then}
              </TableCell>
              <TableCell className="max-w-28 truncate text-xs" title={row.now}>
                {row.now}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
