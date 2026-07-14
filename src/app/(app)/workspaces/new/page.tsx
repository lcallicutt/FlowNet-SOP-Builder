"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/components/app/api";

export default function NewWorkspacePage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Give your workspace a name (at least 2 characters).");
      return;
    }
    setSubmitting(true);
    try {
      const body = await apiFetch<{ workspace: { id: string } }>(
        "/api/workspaces",
        { method: "POST", body: JSON.stringify({ name: trimmed }) },
      );
      toast.success("Workspace created. Welcome aboard!");
      router.push(`/w/${body.workspace.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create workspace.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-md bg-navy font-bold text-gold">
            F
          </span>
          <span className="text-lg font-semibold text-foreground">
            FlowNet <span className="text-muted-foreground">SOP Builder</span>
          </span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Create your workspace</CardTitle>
            <CardDescription>
              Workspaces keep your team&apos;s SOPs together — invite
              teammates, upload process videos, and build a living library of
              documentation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Workspace name</Label>
                <Input
                  id="workspace-name"
                  placeholder="e.g. Acme Operations"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  autoFocus
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Usually your company or team name. You can rename it later.
                </p>
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-gold text-navy hover:bg-gold-dark"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create workspace"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
