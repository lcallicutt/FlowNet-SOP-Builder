"use client";

import { GraduationCap, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AutosizeTextarea } from "./autosize-textarea";
import { StringListEditor } from "./list-editor";
import type { EditorApi } from "./document-editor";
import type { TrainingGuideContent } from "./types";

/**
 * Form editor over the training guide JSON object. Mirrors the quick guide
 * pattern: mutate locally, debounce a single `update_training_guide` op.
 */
export function TrainingGuideTab({
  guide,
  api,
}: {
  guide: TrainingGuideContent | null;
  api: EditorApi;
}) {
  const { canEdit } = api;

  if (!guide) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-16 text-center">
        <GraduationCap className="size-8 text-muted-foreground" />
        <p className="font-medium">No training guide yet</p>
        <p className="max-w-md text-sm text-muted-foreground">
          A training guide wasn&apos;t generated for this document. Regenerate
          the document from its source video to create one.
        </p>
      </div>
    );
  }

  const apply = (next: TrainingGuideContent) => {
    api.mutate((p) => ({ ...p, trainingGuide: next }));
    api.queueOp("training_guide", { op: "update_training_guide", content: next });
  };

  return (
    <div className="space-y-4">
      <Card className="py-4">
        <CardContent className="space-y-4 px-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Learning objective</Label>
            <AutosizeTextarea
              value={guide.learningObjective}
              disabled={!canEdit}
              placeholder="What should a trainee be able to do afterwards?"
              onChange={(e) => apply({ ...guide, learningObjective: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Process overview</Label>
            <AutosizeTextarea
              value={guide.processOverview}
              disabled={!canEdit}
              placeholder="A high-level narrative of the process"
              onChange={(e) => apply({ ...guide, processOverview: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="py-4">
        <CardHeader className="px-4 py-0">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Key terminology
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4">
          {guide.keyTerminology.map((entry, index) => (
            <div key={index} className="flex items-start gap-2 rounded-md border p-3">
              <div className="flex-1 space-y-2">
                <Input
                  value={entry.term}
                  disabled={!canEdit}
                  placeholder="Term"
                  onChange={(e) =>
                    apply({
                      ...guide,
                      keyTerminology: guide.keyTerminology.map((t, i) =>
                        i === index ? { ...t, term: e.target.value } : t,
                      ),
                    })
                  }
                />
                <AutosizeTextarea
                  value={entry.definition}
                  disabled={!canEdit}
                  placeholder="Definition"
                  onChange={(e) =>
                    apply({
                      ...guide,
                      keyTerminology: guide.keyTerminology.map((t, i) =>
                        i === index ? { ...t, definition: e.target.value } : t,
                      ),
                    })
                  }
                />
              </div>
              {canEdit && (
                <RemoveButton
                  label="Remove term"
                  onClick={() =>
                    apply({
                      ...guide,
                      keyTerminology: guide.keyTerminology.filter((_, i) => i !== index),
                    })
                  }
                />
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
                  keyTerminology: [...guide.keyTerminology, { term: "", definition: "" }],
                })
              }
            >
              <Plus className="size-4" /> Add term
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="py-4">
        <CardHeader className="px-4 py-0">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Guided walkthrough
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4">
          {guide.walkthrough.map((row, index) => (
            <div key={index} className="flex items-start gap-2 rounded-md border p-3">
              <span className="mt-2 text-xs font-semibold text-muted-foreground">
                {index + 1}.
              </span>
              <div className="flex-1 space-y-2">
                <Input
                  value={row.step}
                  disabled={!canEdit}
                  placeholder="Step"
                  onChange={(e) =>
                    apply({
                      ...guide,
                      walkthrough: guide.walkthrough.map((w, i) =>
                        i === index ? { ...w, step: e.target.value } : w,
                      ),
                    })
                  }
                />
                <AutosizeTextarea
                  value={row.detail}
                  disabled={!canEdit}
                  placeholder="Detail — exactly what to do"
                  onChange={(e) =>
                    apply({
                      ...guide,
                      walkthrough: guide.walkthrough.map((w, i) =>
                        i === index ? { ...w, detail: e.target.value } : w,
                      ),
                    })
                  }
                />
                <AutosizeTextarea
                  value={row.whyItMatters}
                  disabled={!canEdit}
                  placeholder="Why it matters"
                  onChange={(e) =>
                    apply({
                      ...guide,
                      walkthrough: guide.walkthrough.map((w, i) =>
                        i === index ? { ...w, whyItMatters: e.target.value } : w,
                      ),
                    })
                  }
                />
              </div>
              {canEdit && (
                <RemoveButton
                  label="Remove walkthrough step"
                  onClick={() =>
                    apply({
                      ...guide,
                      walkthrough: guide.walkthrough.filter((_, i) => i !== index),
                    })
                  }
                />
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
                  walkthrough: [
                    ...guide.walkthrough,
                    { step: "", detail: "", whyItMatters: "" },
                  ],
                })
              }
            >
              <Plus className="size-4" /> Add walkthrough step
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="py-4">
        <CardHeader className="px-4 py-0">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Knowledge checks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4">
          {guide.knowledgeChecks.map((check, index) => (
            <div key={index} className="flex items-start gap-2 rounded-md border p-3">
              <div className="flex-1 space-y-2">
                <AutosizeTextarea
                  value={check.question}
                  disabled={!canEdit}
                  placeholder="Question"
                  onChange={(e) =>
                    apply({
                      ...guide,
                      knowledgeChecks: guide.knowledgeChecks.map((c, i) =>
                        i === index ? { ...c, question: e.target.value } : c,
                      ),
                    })
                  }
                />
                <AutosizeTextarea
                  value={check.answer}
                  disabled={!canEdit}
                  placeholder="Answer"
                  onChange={(e) =>
                    apply({
                      ...guide,
                      knowledgeChecks: guide.knowledgeChecks.map((c, i) =>
                        i === index ? { ...c, answer: e.target.value } : c,
                      ),
                    })
                  }
                />
              </div>
              {canEdit && (
                <RemoveButton
                  label="Remove knowledge check"
                  onClick={() =>
                    apply({
                      ...guide,
                      knowledgeChecks: guide.knowledgeChecks.filter((_, i) => i !== index),
                    })
                  }
                />
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
                  knowledgeChecks: [
                    ...guide.knowledgeChecks,
                    { question: "", answer: "" },
                  ],
                })
              }
            >
              <Plus className="size-4" /> Add knowledge check
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="py-4">
        <CardContent className="space-y-4 px-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Practice exercise</Label>
            <AutosizeTextarea
              value={guide.practiceExercise}
              disabled={!canEdit}
              placeholder="A safe, hands-on exercise for trainees"
              onChange={(e) => apply({ ...guide, practiceExercise: e.target.value })}
            />
          </div>
          <StringListEditor
            label="Common mistakes"
            items={guide.commonMistakes}
            disabled={!canEdit}
            placeholder="e.g. Skipping the verification step"
            onChange={(commonMistakes) => apply({ ...guide, commonMistakes })}
          />
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Supervisor review</Label>
            <AutosizeTextarea
              value={guide.supervisorReview}
              disabled={!canEdit}
              placeholder="What the supervisor verifies before sign-off"
              onChange={(e) => apply({ ...guide, supervisorReview: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
      aria-label={label}
      onClick={onClick}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
