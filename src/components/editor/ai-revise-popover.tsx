"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AutosizeTextarea } from "./autosize-textarea";
import { readApiError } from "./api";

type ReviseTarget =
  | { kind: "section"; sectionId: string }
  | { kind: "step"; stepId: string };

/**
 * "AI revise" popover: takes a natural-language instruction, calls the revise
 * endpoint, and hands the revised text back to the parent (which updates
 * local state — the server already persisted it).
 */
export function AiRevisePopover({
  endpoint,
  target,
  onRevised,
}: {
  endpoint: string;
  target: ReviseTarget;
  onRevised: (revised: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [instruction, setInstruction] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function revise() {
    const trimmed = instruction.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, instruction: trimmed }),
      });
      if (!res.ok) {
        const err = await readApiError(res, "The AI revision failed. Try again.");
        toast.error(err.message);
        return;
      }
      const data = (await res.json()) as { revised: string; changeSummary: string };
      onRevised(data.revised);
      toast.success(data.changeSummary || "Revised.");
      setInstruction("");
      setOpen(false);
    } catch {
      toast.error("Network error — the revision was not applied.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
        >
          <Sparkles className="size-3.5" /> AI revise
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2" align="end">
        <p className="text-sm font-medium">Revise with AI</p>
        <AutosizeTextarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder='e.g. "Make this more concise" or "Add a note about VPN access"'
          disabled={busy}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={() => void revise()} disabled={busy || !instruction.trim()}>
            {busy ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Revising…
              </>
            ) : (
              "Revise"
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
