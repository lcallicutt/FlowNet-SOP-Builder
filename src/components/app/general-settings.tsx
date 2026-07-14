"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { WorkspaceRole } from "@/lib/auth";
import type { PlanId } from "@/lib/plans";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/components/app/api";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function GeneralSettings({
  workspaceId,
  initialName,
  initialBrandColor,
  role,
  plan,
}: {
  workspaceId: string;
  initialName: string;
  initialBrandColor: string | null;
  role: WorkspaceRole;
  plan: PlanId;
}) {
  const router = useRouter();
  const canEdit = role === "owner" || role === "admin";
  const brandingAvailable = plan === "business";

  const [name, setName] = React.useState(initialName);
  const [savingName, setSavingName] = React.useState(false);
  const [brandColor, setBrandColor] = React.useState(initialBrandColor ?? "");
  const [savingColor, setSavingColor] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Workspace name is too short.");
      return;
    }
    setSavingName(true);
    try {
      await apiFetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      });
      toast.success("Workspace renamed.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not rename workspace.",
      );
    } finally {
      setSavingName(false);
    }
  }

  async function saveBrandColor(e: React.FormEvent) {
    e.preventDefault();
    const value = brandColor.trim();
    if (value && !HEX_RE.test(value)) {
      toast.error("Enter a hex color like #1A2B3C.");
      return;
    }
    setSavingColor(true);
    try {
      await apiFetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        body: JSON.stringify({ brandColor: value || null }),
      });
      toast.success("Brand color saved.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save brand color.",
      );
    } finally {
      setSavingColor(false);
    }
  }

  async function deleteWorkspace() {
    setDeleting(true);
    try {
      await apiFetch(`/api/workspaces/${workspaceId}`, { method: "DELETE" });
      toast.success("Workspace deleted.");
      router.push("/dashboard");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete workspace.",
      );
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workspace name</CardTitle>
          <CardDescription>
            Shown in the sidebar and on exported documents.
          </CardDescription>
        </CardHeader>
        <form onSubmit={saveName}>
          <CardContent>
            <div className="max-w-sm space-y-2">
              <Label htmlFor="ws-name">Name</Label>
              <Input
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                disabled={!canEdit}
              />
              {!canEdit ? (
                <p className="text-xs text-muted-foreground">
                  Only workspace admins can rename the workspace.
                </p>
              ) : null}
            </div>
          </CardContent>
          <CardFooter className="mt-4">
            <Button type="submit" disabled={!canEdit || savingName}>
              {savingName ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brand color</CardTitle>
          <CardDescription>
            Used on exported PDFs and shared documents.
          </CardDescription>
        </CardHeader>
        <form onSubmit={saveBrandColor}>
          <CardContent className="space-y-3">
            <div className="flex max-w-sm items-end gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="brand-color">Hex color</Label>
                <Input
                  id="brand-color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  placeholder="#1A2B3C"
                  maxLength={7}
                  disabled={!canEdit || !brandingAvailable}
                />
              </div>
              <span
                aria-hidden
                className="mb-0.5 size-8 shrink-0 rounded-md border"
                style={{
                  backgroundColor: HEX_RE.test(brandColor.trim())
                    ? brandColor.trim()
                    : "transparent",
                }}
              />
            </div>
            {!brandingAvailable ? (
              <p className="text-xs text-muted-foreground">
                Workspace branding is available on the{" "}
                <span className="font-medium">Business</span> plan.{" "}
                <Link
                  href={`/w/${workspaceId}/settings/billing`}
                  className="text-gold-dark underline underline-offset-2"
                >
                  Upgrade to unlock it
                </Link>
                .
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="mt-4">
            <Button
              type="submit"
              disabled={!canEdit || !brandingAvailable || savingColor}
            >
              {savingColor ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </Button>
          </CardFooter>
        </form>
      </Card>

      {role === "owner" ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
            <CardDescription>
              Deleting a workspace removes access for every member. Projects
              and SOPs will no longer be reachable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleting}>
                  {deleting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Delete workspace
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete this workspace?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This deletes “{initialName}” for everyone. This action
                    cannot be undone from the app.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/90"
                    onClick={() => void deleteWorkspace()}
                  >
                    Delete workspace
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
