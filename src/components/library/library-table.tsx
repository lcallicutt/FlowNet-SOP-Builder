"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow, format, isBefore } from "date-fns";
import {
  BookOpen,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { readApiError } from "@/components/editor/api";
import { DocumentStatusBadge } from "@/components/library/status-badge";

type LibraryDocument = {
  id: string;
  sopNumber: string;
  title: string;
  status: string;
  versionNumber: number;
  department: string | null;
  processCategory: string | null;
  processOwner: string | null;
  tags: string[];
  reviewDate: string | null;
  createdAt: string;
  updatedAt: string;
};

const ALL = "__all__";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "in_review", label: "In review" },
  { value: "approved", label: "Approved" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

function distinct(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))].sort();
}

export function LibraryTable({
  workspaceId,
  canAdmin,
}: {
  workspaceId: string;
  canAdmin: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [documents, setDocuments] = React.useState<LibraryDocument[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<LibraryDocument | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Filters seeded from the URL so views are shareable.
  const [q, setQ] = React.useState(searchParams.get("q") ?? "");
  const [department, setDepartment] = React.useState(searchParams.get("department") ?? "");
  const [category, setCategory] = React.useState(searchParams.get("category") ?? "");
  const [owner, setOwner] = React.useState(searchParams.get("owner") ?? "");
  const [status, setStatus] = React.useState(searchParams.get("status") ?? "");
  const [tag, setTag] = React.useState(searchParams.get("tag") ?? "");

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/documents`);
      if (!res.ok) {
        const err = await readApiError(res, "Could not load the SOP library.");
        setLoadError(err.message);
        return;
      }
      const data = (await res.json()) as { documents: LibraryDocument[] };
      setDocuments(data.documents);
      setLoadError(null);
    } catch {
      setLoadError("Could not load the SOP library. Check your connection and try again.");
    }
  }, [workspaceId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Keep the URL query in sync with the filters (replace, not push).
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (department) params.set("department", department);
    if (category) params.set("category", category);
    if (owner) params.set("owner", owner);
    if (status) params.set("status", status);
    if (tag) params.set("tag", tag);
    const qs = params.toString();
    router.replace(`/w/${workspaceId}/library${qs ? `?${qs}` : ""}`, {
      scroll: false,
    });
  }, [q, department, category, owner, status, tag, router, workspaceId]);

  const departments = React.useMemo(
    () => distinct((documents ?? []).map((d) => d.department)),
    [documents],
  );
  const categories = React.useMemo(
    () => distinct((documents ?? []).map((d) => d.processCategory)),
    [documents],
  );
  const owners = React.useMemo(
    () => distinct((documents ?? []).map((d) => d.processOwner)),
    [documents],
  );
  const tags = React.useMemo(
    () => distinct((documents ?? []).flatMap((d) => d.tags)),
    [documents],
  );

  const filtered = React.useMemo(() => {
    if (!documents) return [];
    const needle = q.trim().toLowerCase();
    return documents.filter((d) => {
      if (needle) {
        const haystack = `${d.sopNumber} ${d.title} ${d.tags.join(" ")}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (department && d.department !== department) return false;
      if (category && d.processCategory !== category) return false;
      if (owner && d.processOwner !== owner) return false;
      if (status && d.status !== status) return false;
      if (tag && !d.tags.includes(tag)) return false;
      return true;
    });
  }, [documents, q, department, category, owner, status, tag]);

  const hasFilters = Boolean(q || department || category || owner || status || tag);

  async function duplicateDocument(doc: LibraryDocument) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/documents/${doc.id}/duplicate`,
        { method: "POST" },
      );
      if (!res.ok) {
        const err = await readApiError(res, "Could not duplicate the document.");
        toast.error(err.message);
        return;
      }
      const data = (await res.json()) as { documentId: string; sopNumber: string };
      toast.success(`Duplicated as ${data.sopNumber}.`);
      await load();
    } catch {
      toast.error("Could not duplicate the document.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDocument(doc: LibraryDocument) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/documents/${doc.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const err = await readApiError(res, "Could not delete the document.");
        toast.error(err.message);
        return;
      }
      toast.success(`${doc.sopNumber} deleted.`);
      await load();
    } catch {
      toast.error("Could not delete the document.");
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        {loadError}
      </div>
    );
  }

  if (!documents) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted">
          <BookOpen className="size-6 text-muted-foreground" />
        </span>
        <div>
          <p className="font-medium">No SOPs yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a process video and FlowNet will draft your first SOP,
            checklist, and training guide automatically.
          </p>
        </div>
        <Button asChild>
          <Link href={`/w/${workspaceId}/upload`}>
            <Upload className="size-4" /> Upload a video
          </Link>
        </Button>
      </div>
    );
  }

  const now = new Date();

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title, SOP number, or tag…"
            className="pl-8"
          />
        </div>
        <FilterSelect
          placeholder="Department"
          value={department}
          onChange={setDepartment}
          options={departments}
        />
        <FilterSelect
          placeholder="Category"
          value={category}
          onChange={setCategory}
          options={categories}
        />
        <FilterSelect
          placeholder="Owner"
          value={owner}
          onChange={setOwner}
          options={owners}
        />
        <Select
          value={status || ALL}
          onValueChange={(v) => setStatus(v === ALL ? "" : v)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Tags:</span>
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTag(tag === t ? "" : t)}
              className="cursor-pointer"
            >
              <Badge variant={tag === t ? "default" : "outline"}>{t}</Badge>
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">SOP #</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Department</TableHead>
              <TableHead className="w-20">Version</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last updated</TableHead>
              <TableHead>Review date</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-sm text-muted-foreground">
                  {hasFilters
                    ? "No documents match the current filters."
                    : "No documents."}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((doc) => {
              const reviewDue =
                doc.reviewDate !== null &&
                isBefore(new Date(doc.reviewDate), now);
              return (
                <TableRow key={doc.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {doc.sopNumber}
                  </TableCell>
                  <TableCell className="max-w-72">
                    <Link
                      href={`/w/${workspaceId}/documents/${doc.id}`}
                      className="block truncate font-medium hover:underline"
                    >
                      {doc.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{doc.processOwner ?? "—"}</TableCell>
                  <TableCell className="text-sm">{doc.department ?? "—"}</TableCell>
                  <TableCell className="text-sm tabular-nums">
                    v{doc.versionNumber}
                  </TableCell>
                  <TableCell>
                    <DocumentStatusBadge status={doc.status} />
                  </TableCell>
                  <TableCell
                    className="text-sm text-muted-foreground"
                    title={format(new Date(doc.updatedAt), "PPpp")}
                  >
                    {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-sm",
                      reviewDue
                        ? "font-medium text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {doc.reviewDate
                      ? `${format(new Date(doc.reviewDate), "MMM d, yyyy")}${reviewDue ? " · past due" : ""}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8" disabled={busy}>
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Open menu for {doc.sopNumber}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/w/${workspaceId}/documents/${doc.id}`}>
                            <ExternalLink className="size-4" /> Open
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void duplicateDocument(doc)}>
                          <Copy className="size-4" /> Duplicate
                        </DropdownMenuItem>
                        {canAdmin && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTarget(doc)}
                            >
                              <Trash2 className="size-4" /> Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.sopNumber} — {deleteTarget?.title}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The document and all of its sections, steps, and checklists will
              be removed from the library. Shared links will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={busy}
              onClick={() => deleteTarget && void deleteDocument(deleteTarget)}
            >
              Delete document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterSelect({
  placeholder,
  value,
  onChange,
  options,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  // Preserve a URL-provided value even if it's not among the loaded options.
  const merged = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {placeholder.toLowerCase()}s</SelectItem>
        {merged.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
