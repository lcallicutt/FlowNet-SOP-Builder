"use client";

import { Plus, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AutosizeTextarea } from "./autosize-textarea";
import { StringListEditor } from "./list-editor";
import type { EditorApi } from "./document-editor";
import type { QuickGuideContent } from "./types";

/**
 * Form editor over the quick guide JSON object. Every change updates local
 * state and debounces a single `update_quick_guide` op with the full object.
 */
export function QuickGuideTab({
  guide,
  api,
}: {
  guide: QuickGuideContent | null;
  api: EditorApi;
}) {
  const { canEdit } = api;

  if (!guide) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-16 text-center">
        <Zap className="size-8 text-muted-foreground" />
        <p className="font-medium">No quick guide yet</p>
        <p className="max-w-md text-sm text-muted-foreground">
          A quick reference guide wasn&apos;t generated for this document.
          Regenerate the document from its source video to create one.
        </p>
      </div>
    );
  }

  const apply = (next: QuickGuideContent) => {
    api.mutate((p) => ({ ...p, quickGuide: next }));
    api.queueOp("quick_guide", { op: "update_quick_guide", content: next });
  };

  return (
    <div className="space-y-4">
      <Card className="py-4">
        <CardContent className="space-y-4 px-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Objective</Label>
            <AutosizeTextarea
              value={guide.objective}
              disabled={!canEdit}
              placeholder="What does this process accomplish?"
              onChange={(e) => apply({ ...guide, objective: e.target.value })}
            />
          </div>
          <StringListEditor
            label="Required tools"
            items={guide.requiredTools}
            disabled={!canEdit}
            placeholder="e.g. Stripe dashboard access"
            onChange={(requiredTools) => apply({ ...guide, requiredTools })}
          />
        </CardContent>
      </Card>

      <Card className="py-4">
        <CardHeader className="px-4 py-0">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Key steps
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4">
          {guide.keySteps.map((step, index) => (
            <div key={index} className="flex items-start gap-2 rounded-md border p-3">
              <span className="mt-2 text-xs font-semibold text-muted-foreground">
                {index + 1}.
              </span>
              <div className="flex-1 space-y-2">
                <Input
                  value={step.title}
                  disabled={!canEdit}
                  placeholder="Step title"
                  onChange={(e) =>
                    apply({
                      ...guide,
                      keySteps: guide.keySteps.map((s, i) =>
                        i === index ? { ...s, title: e.target.value } : s,
                      ),
                    })
                  }
                />
                <AutosizeTextarea
                  value={step.summary}
                  disabled={!canEdit}
                  placeholder="One-line summary"
                  onChange={(e) =>
                    apply({
                      ...guide,
                      keySteps: guide.keySteps.map((s, i) =>
                        i === index ? { ...s, summary: e.target.value } : s,
                      ),
                    })
                  }
                />
              </div>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Remove key step"
                  onClick={() =>
                    apply({
                      ...guide,
                      keySteps: guide.keySteps.filter((_, i) => i !== index),
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                apply({
                  ...guide,
                  keySteps: [...guide.keySteps, { title: "", summary: "" }],
                })
              }
            >
              <Plus className="size-4" /> Add key step
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="py-4">
        <CardContent className="space-y-4 px-4">
          <StringListEditor
            label="Warnings"
            items={guide.warnings}
            disabled={!canEdit}
            placeholder="e.g. Never refund without a manager sign-off"
            onChange={(warnings) => apply({ ...guide, warnings })}
          />
          <StringListEditor
            label="Common errors"
            items={guide.commonErrors}
            disabled={!canEdit}
            placeholder="e.g. Forgetting to tag the invoice"
            onChange={(commonErrors) => apply({ ...guide, commonErrors })}
          />
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Escalation contact</Label>
            <Input
              value={guide.escalationContact}
              disabled={!canEdit}
              placeholder="Who to contact when something goes wrong"
              onChange={(e) => apply({ ...guide, escalationContact: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Completion confirmation
            </Label>
            <AutosizeTextarea
              value={guide.completionConfirmation}
              disabled={!canEdit}
              placeholder="How do you know the process finished correctly?"
              onChange={(e) =>
                apply({ ...guide, completionConfirmation: e.target.value })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
