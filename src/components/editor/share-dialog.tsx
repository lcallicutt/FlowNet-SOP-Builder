"use client";

import * as React from "react";
import { format } from "date-fns";
import { Copy, Link2, Loader2, Lock, Sparkles } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { readApiError } from "./api";

type ShareLink = {
  id: string;
  url: string;
  requireAuth: boolean;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
};

export function ShareDialog({
  endpoint,
  canEdit,
  sharedLinksEnabled,
  trigger,
}: {
  endpoint: string;
  canEdit: boolean;
  sharedLinksEnabled: boolean;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [links, setLinks] = React.useState<ShareLink[] | null>(null);
  const [requireAuth, setRequireAuth] = React.useState(false);
  const [expiresInDays, setExpiresInDays] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) {
        const err = await readApiError(res, "Could not load share links.");
        toast.error(err.message);
        return;
      }
      const data = (await res.json()) as { links: ShareLink[] };
      setLinks(data.links);
    } catch {
      toast.error("Could not load share links.");
    }
  }, [endpoint]);

  React.useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function createLink() {
    setBusy(true);
    try {
      const days = expiresInDays.trim() ? Number(expiresInDays) : null;
      if (days !== null && (!Number.isInteger(days) || days < 1 || days > 365)) {
        toast.error("Expiry must be a whole number of days between 1 and 365.");
        return;
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireAuth, expiresInDays: days }),
      });
      if (!res.ok) {
        const err = await readApiError(res, "Could not create the share link.");
        toast.error(err.message);
        return;
      }
      const data = (await res.json()) as { link: { url: string } };
      await copyToClipboard(data.link.url);
      toast.success("Share link created and copied to clipboard.");
      setExpiresInDays("");
      await load();
    } catch {
      toast.error("Could not create the share link.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleLink(link: ShareLink, isActive: boolean) {
    setLinks((prev) =>
      prev ? prev.map((l) => (l.id === link.id ? { ...l, isActive } : l)) : prev,
    );
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkId: link.id, isActive }),
      });
      if (!res.ok) {
        const err = await readApiError(res, "Could not update the link.");
        toast.error(err.message);
        await load();
      }
    } catch {
      toast.error("Could not update the link.");
      await load();
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      toast.error("Could not copy to clipboard — copy the URL manually.");
      return false;
    }
  }

  const expired = (link: ShareLink) =>
    link.expiresAt !== null && new Date(link.expiresAt) < new Date();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share this SOP</DialogTitle>
          <DialogDescription>
            Anyone with an active link can view a read-only copy of this
            document.
          </DialogDescription>
        </DialogHeader>

        {!sharedLinksEnabled && (
          <p className="flex items-start gap-2 rounded-md border border-accent/50 bg-accent/10 p-3 text-sm">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-gold-dark" />
            Shared links are available on the Professional and Business plans.
            Upgrade to publish read-only links to your SOPs.
          </p>
        )}

        {sharedLinksEnabled && canEdit && (
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium">Create a new link</p>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={requireAuth} onCheckedChange={setRequireAuth} />
                Require sign-in to view
              </label>
              <div className="flex items-center gap-2">
                <Label htmlFor="share-expiry" className="text-sm font-normal">
                  Expires in
                </Label>
                <Input
                  id="share-expiry"
                  type="number"
                  min={1}
                  max={365}
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  placeholder="never"
                  className="h-8 w-20"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
              <Button size="sm" onClick={() => void createLink()} disabled={busy}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Link2 className="size-4" />
                )}
                Create link
              </Button>
            </div>
          </div>
        )}

        <Separator />

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {links === null && (
            <p className="text-sm text-muted-foreground">Loading links…</p>
          )}
          {links?.length === 0 && (
            <p className="text-sm text-muted-foreground">No share links yet.</p>
          )}
          {links?.map((link) => (
            <div key={link.id} className="flex items-center gap-2 rounded-md border p-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs">{link.url}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  Created {format(new Date(link.createdAt), "MMM d, yyyy")}
                  {link.requireAuth && (
                    <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]">
                      <Lock className="size-2.5" /> Sign-in required
                    </Badge>
                  )}
                  {link.expiresAt && (
                    <span>
                      · {expired(link) ? "expired" : "expires"}{" "}
                      {format(new Date(link.expiresAt), "MMM d, yyyy")}
                    </span>
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label="Copy link"
                onClick={async () => {
                  if (await copyToClipboard(link.url)) toast.success("Link copied.");
                }}
              >
                <Copy className="size-3.5" />
              </Button>
              <Switch
                checked={link.isActive}
                disabled={!canEdit}
                aria-label={link.isActive ? "Disable link" : "Enable link"}
                onCheckedChange={(checked) => void toggleLink(link, checked)}
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
