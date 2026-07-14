"use client";

import * as React from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { WorkspaceRole } from "@/lib/auth";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/components/app/api";

type Member = {
  id: string;
  userId: string | null;
  role: WorkspaceRole;
  status: "pending" | "active";
  name: string | null;
  email: string | null;
  imageUrl: string | null;
};

type InviteRole = "admin" | "editor" | "viewer";

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

function initials(member: Member): string {
  const source = member.name || member.email || "?";
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function MembersManager({
  workspaceId,
  currentRole,
  currentUserId,
}: {
  workspaceId: string;
  currentRole: WorkspaceRole;
  currentUserId: string;
}) {
  const isAdmin = currentRole === "owner" || currentRole === "admin";
  const isOwner = currentRole === "owner";

  const [members, setMembers] = React.useState<Member[] | null>(null);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<InviteRole>("editor");
  const [inviting, setInviting] = React.useState(false);
  const [pendingRemoval, setPendingRemoval] = React.useState<Member | null>(
    null,
  );
  const [mutatingId, setMutatingId] = React.useState<string | null>(null);

  const loadMembers = React.useCallback(async () => {
    try {
      const body = await apiFetch<{ members: Member[] }>(
        `/api/workspaces/${workspaceId}/members`,
      );
      setMembers(body.members);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load members.",
      );
      setMembers([]);
    }
  }, [workspaceId]);

  React.useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error("Enter an email address.");
      return;
    }
    setInviting(true);
    try {
      await apiFetch(`/api/workspaces/${workspaceId}/members`, {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });
      toast.success(`Invitation sent to ${inviteEmail.trim()}.`);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("editor");
      await loadMembers();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not send invite.",
      );
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(member: Member, role: WorkspaceRole) {
    if (role === member.role) return;
    setMutatingId(member.id);
    try {
      await apiFetch(`/api/workspaces/${workspaceId}/members`, {
        method: "PATCH",
        body: JSON.stringify({ memberId: member.id, role }),
      });
      toast.success("Role updated.");
      await loadMembers();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update role.",
      );
    } finally {
      setMutatingId(null);
    }
  }

  async function removeMember(member: Member) {
    setMutatingId(member.id);
    try {
      await apiFetch(`/api/workspaces/${workspaceId}/members`, {
        method: "PATCH",
        body: JSON.stringify({ memberId: member.id, remove: true }),
      });
      toast.success("Member removed.");
      await loadMembers();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not remove member.",
      );
    } finally {
      setMutatingId(null);
      setPendingRemoval(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle>Members</CardTitle>
          <CardDescription>
            People with access to this workspace.
          </CardDescription>
        </div>
        {isAdmin ? (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="size-4" />
                Invite member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite a teammate</DialogTitle>
                <DialogDescription>
                  They&apos;ll join as soon as they sign in with this email.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={invite} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(v) => setInviteRole(v as InviteRole)}
                  >
                    <SelectTrigger id="invite-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={inviting}>
                    {inviting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Send invite
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </CardHeader>
      <CardContent>
        {members === null ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Role</TableHead>
                {isAdmin ? (
                  <TableHead className="text-right">Actions</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const isSelf = member.userId === currentUserId;
                const roleLocked =
                  !isAdmin ||
                  (member.role === "owner" && !isOwner) ||
                  mutatingId === member.id;
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          {member.imageUrl ? (
                            <AvatarImage
                              src={member.imageUrl}
                              alt={member.name ?? member.email ?? "Member"}
                            />
                          ) : null}
                          <AvatarFallback className="text-xs">
                            {initials(member)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {member.name ?? member.email ?? "Invited member"}
                            {isSelf ? (
                              <span className="text-muted-foreground"> (you)</span>
                            ) : null}
                          </p>
                          {member.name && member.email ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {member.email}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {member.status === "pending" ? (
                        <Badge
                          variant="outline"
                          className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                        >
                          Invited
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {isAdmin && !roleLocked ? (
                        <Select
                          value={member.role}
                          onValueChange={(v) =>
                            void changeRole(member, v as WorkspaceRole)
                          }
                        >
                          <SelectTrigger size="sm" className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {isOwner ? (
                              <SelectItem value="owner">Owner</SelectItem>
                            ) : null}
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline">
                          {ROLE_LABELS[member.role]}
                        </Badge>
                      )}
                    </TableCell>
                    {isAdmin ? (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={
                            mutatingId === member.id ||
                            (member.role === "owner" && !isOwner)
                          }
                          onClick={() => setPendingRemoval(member)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AlertDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemoval?.name ?? pendingRemoval?.email ?? "This member"}{" "}
              will immediately lose access to this workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (pendingRemoval) void removeMember(pendingRemoval);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
