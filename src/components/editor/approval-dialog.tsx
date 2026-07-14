"use client";

import * as React from "react";
import { format } from "date-fns";
import { CheckCircle2, Loader2, Send, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AutosizeTextarea } from "./autosize-textarea";
import { readApiError } from "./api";

type Approval = {
  id: string;
  status: "pending" | "approved" | "rejected";
  comments: string | null;
  reviewer: string;
  requestedBy: string;
  decidedAt: string | null;
  createdAt: string;
};

type Member = {
  id: string;
  userId: string | null;
  role: string;
  status: string;
  name: string | null;
  email: string | null;
};

const APPROVAL_BADGES: Record<Approval["status"], string> = {
  pending:
    "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
  approved:
    "border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300",
  rejected:
    "border-transparent bg-red-100 text-red-900 dark:bg-red-500/15 dark:text-red-300",
};

export function ApprovalDialog({
  workspaceId,
  endpoint,
  canEdit,
  approvalWorkflowEnabled,
  currentUser,
  onDecided,
  trigger,
}: {
  workspaceId: string;
  endpoint: string;
  canEdit: boolean;
  approvalWorkflowEnabled: boolean;
  currentUser: { id: string; name: string | null; email: string };
  onDecided: () => Promise<void>;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [approvals, setApprovals] = React.useState<Approval[] | null>(null);
  const [members, setMembers] = React.useState<Member[] | null>(null);
  const [reviewerUserId, setReviewerUserId] = React.useState("");
  const [comments, setComments] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const [approvalsRes, membersRes] = await Promise.all([
        fetch(endpoint),
        fetch(`/api/workspaces/${workspaceId}/members`),
      ]);
      if (approvalsRes.ok) {
        const data = (await approvalsRes.json()) as { approvals: Approval[] };
        setApprovals(data.approvals);
      } else {
        const err = await readApiError(approvalsRes, "Could not load approvals.");
        toast.error(err.message);
      }
      if (membersRes.ok) {
        const data = (await membersRes.json()) as { members: Member[] };
        setMembers(data.members);
      }
    } catch {
      toast.error("Could not load approval history.");
    }
  }, [endpoint, workspaceId]);

  React.useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const pending = approvals?.find((a) => a.status === "pending") ?? null;

  // Reviewers must be active members with editor+ access, other than yourself.
  const eligibleReviewers = (members ?? []).filter(
    (m) =>
      m.status === "active" &&
      m.userId !== null &&
      m.userId !== currentUser.id &&
      m.role !== "viewer",
  );

  const currentUserLabel = currentUser.name ?? currentUser.email;
  const pendingAssignedToMe = pending !== null && pending.reviewer === currentUserLabel;

  async function requestApproval() {
    if (!reviewerUserId) return;
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewerUserId }),
      });
      if (!res.ok) {
        const err = await readApiError(res, "Could not request approval.");
        toast.error(err.message);
        return;
      }
      toast.success("Approval requested — the document is now in review.");
      setReviewerUserId("");
      await load();
      await onDecided();
    } catch {
      toast.error("Could not request approval.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: "approved" | "rejected") {
    if (!pending) return;
    if (decision === "rejected" && !comments.trim()) {
      toast.error("Add a comment explaining what needs to change before rejecting.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvalId: pending.id,
          decision,
          comments: comments.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await readApiError(res, "Could not record the decision.");
        toast.error(err.message);
        return;
      }
      toast.success(decision === "approved" ? "Document approved." : "Changes requested.");
      setComments("");
      await load();
      await onDecided();
    } catch {
      toast.error("Could not record the decision.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Approval workflow</DialogTitle>
          <DialogDescription>
            Route this SOP to a reviewer before publishing.
          </DialogDescription>
        </DialogHeader>

        {!approvalWorkflowEnabled && (
          <p className="flex items-start gap-2 rounded-md border border-accent/50 bg-accent/10 p-3 text-sm">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-gold-dark" />
            Approval workflows are available on the Business plan. Upgrade to
            require sign-off before SOPs go live.
          </p>
        )}

        {approvalWorkflowEnabled && canEdit && !pending && (
          <div className="space-y-2 rounded-md border p-3">
            <Label className="text-sm font-medium">Request approval</Label>
            <div className="flex gap-2">
              <Select value={reviewerUserId} onValueChange={setReviewerUserId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Choose a reviewer…" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleReviewers.map((m) => (
                    <SelectItem key={m.id} value={m.userId ?? m.id}>
                      {m.name ?? m.email ?? "Unknown member"} ({m.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => void requestApproval()}
                disabled={busy || !reviewerUserId}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Request
              </Button>
            </div>
            {members !== null && eligibleReviewers.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No eligible reviewers — invite another member with editor
                access or higher.
              </p>
            )}
          </div>
        )}

        {pending && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm">
              <span className="font-medium">Pending review</span> — assigned to{" "}
              {pending.reviewer}, requested by {pending.requestedBy}.
            </p>
            {canEdit && (
              <>
                {!pendingAssignedToMe && (
                  <p className="text-xs text-muted-foreground">
                    Only the assigned reviewer ({pending.reviewer}) can decide
                    this request.
                  </p>
                )}
                <AutosizeTextarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Comments (required when rejecting)…"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void decide("approved")}
                  >
                    <CheckCircle2 className="size-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void decide("rejected")}
                  >
                    <XCircle className="size-4" /> Reject
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        <Separator />

        <div className="max-h-60 space-y-2 overflow-y-auto">
          <p className="text-sm font-medium">History</p>
          {approvals === null && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {approvals?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No approval requests yet.
            </p>
          )}
          {approvals?.map((approval) => (
            <div key={approval.id} className="rounded-md border p-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={APPROVAL_BADGES[approval.status]}>
                  {approval.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {approval.requestedBy} → {approval.reviewer} ·{" "}
                  {format(new Date(approval.createdAt), "MMM d, yyyy")}
                  {approval.decidedAt &&
                    ` · decided ${format(new Date(approval.decidedAt), "MMM d, yyyy")}`}
                </span>
              </div>
              {approval.comments && <p className="mt-1.5">{approval.comments}</p>}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
