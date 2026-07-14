"use client";

import * as React from "react";
import { useClerk } from "@clerk/nextjs";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiFetch } from "@/components/app/api";

export function DeleteAccountCard() {
  const { signOut } = useClerk();
  const [deleting, setDeleting] = React.useState(false);

  async function deleteAccount() {
    setDeleting(true);
    try {
      await apiFetch<{ ok: boolean }>("/api/account", { method: "DELETE" });
      toast.success("Your account has been deleted.");
      await signOut({ redirectUrl: "/" });
    } catch (error) {
      // A 409 arrives here with the API's message (e.g. sole workspace owner).
      toast.error(
        error instanceof Error ? error.message : "Could not delete account.",
      );
      setDeleting(false);
    }
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Delete my account</CardTitle>
        <CardDescription>
          Permanently removes your FlowNet account and your workspace
          memberships. If you&apos;re the sole owner of a workspace, transfer
          ownership or delete that workspace first.
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
              Delete my account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                You&apos;ll be signed out immediately and lose access to all
                workspaces. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => void deleteAccount()}
              >
                Delete account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
