"use client";

import { Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { humanizeFlag } from "./types";

/**
 * Amber chips for AI review flags with a single "Mark resolved" action that
 * clears every flag on the section/step.
 */
export function ReviewFlags({
  flags,
  canEdit,
  onResolve,
}: {
  flags: string[];
  canEdit: boolean;
  onResolve: () => void;
}) {
  if (flags.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {flags.map((flag) => (
        <Badge
          key={flag}
          className="border-transparent bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300"
        >
          <Flag className="size-3" /> {humanizeFlag(flag)}
        </Badge>
      ))}
      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground"
          onClick={onResolve}
        >
          Mark resolved
        </Button>
      )}
    </div>
  );
}
