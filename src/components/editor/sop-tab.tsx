"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Clock,
  ListPlus,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatTimestamp } from "@/lib/utils";
import { AutosizeTextarea } from "./autosize-textarea";
import { AiRevisePopover } from "./ai-revise-popover";
import { ReviewFlags } from "./review-flags";
import type { EditorApi } from "./document-editor";
import {
  SECTION_TYPES,
  humanizeToken,
  type DocumentPackage,
  type SectionType,
  type SopSection,
  type SopStep,
} from "./types";

export function SopTab({ pkg, api }: { pkg: DocumentPackage; api: EditorApi }) {
  const reviseEndpoint = `/api/workspaces/${api.workspaceId}/documents/${api.documentId}/revise`;

  return (
    <div className="space-y-8">
      <SectionsList sections={pkg.sections} api={api} reviseEndpoint={reviseEndpoint} />
      <ProcedureList steps={pkg.steps} api={api} reviseEndpoint={reviseEndpoint} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function SectionsList({
  sections,
  api,
  reviseEndpoint,
}: {
  sections: SopSection[];
  api: EditorApi;
  reviseEndpoint: string;
}) {
  const { canEdit } = api;

  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const ordered = [...sections];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    api.mutate((p) => ({
      ...p,
      sections: ordered.map((s, i) => ({ ...s, position: i })),
    }));
    void api.applyOp({ op: "reorder_sections", orderedIds: ordered.map((s) => s.id) });
  }

  function updateSection(id: string, patch: Partial<Pick<SopSection, "title" | "content">>) {
    api.mutate((p) => ({
      ...p,
      sections: p.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Sections
      </h2>
      {sections.length === 0 && (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          No sections yet. Add a Purpose or Scope section to frame this SOP.
        </p>
      )}
      {sections.map((section, index) => (
        <Card key={section.id} className="py-4">
          <CardContent className="space-y-3 px-4">
            <div className="flex items-start gap-2">
              <ReorderButtons
                disabled={!canEdit}
                isFirst={index === 0}
                isLast={index === sections.length - 1}
                onUp={() => moveSection(index, -1)}
                onDown={() => moveSection(index, 1)}
              />
              {canEdit ? (
                <Input
                  value={section.title}
                  aria-label="Section title"
                  className="h-8 flex-1 border-transparent font-medium shadow-none hover:border-input"
                  onChange={(e) => {
                    const title = e.target.value;
                    updateSection(section.id, { title });
                    api.queueOp(`section-title-${section.id}`, {
                      op: "update_section",
                      sectionId: section.id,
                      title,
                    });
                  }}
                />
              ) : (
                <p className="flex-1 py-1 font-medium">{section.title}</p>
              )}
              <Badge variant="outline" className="text-muted-foreground">
                {humanizeToken(section.type)}
              </Badge>
              {canEdit && (
                <>
                  <AiRevisePopover
                    endpoint={reviseEndpoint}
                    target={{ kind: "section", sectionId: section.id }}
                    onRevised={(revised) => updateSection(section.id, { content: revised })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    aria-label="Delete section"
                    onClick={() =>
                      void api.applyStructuralOp({
                        op: "delete_section",
                        sectionId: section.id,
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </>
              )}
            </div>
            <ReviewFlags
              flags={section.reviewFlags}
              canEdit={canEdit}
              onResolve={() => {
                api.mutate((p) => ({
                  ...p,
                  sections: p.sections.map((s) =>
                    s.id === section.id ? { ...s, reviewFlags: [] } : s,
                  ),
                }));
                void api.applyOp({
                  op: "resolve_section_flags",
                  sectionId: section.id,
                });
              }}
            />
            <AutosizeTextarea
              value={section.content}
              disabled={!canEdit}
              placeholder="Write the section content (markdown supported: **bold**, - lists)…"
              onChange={(e) => {
                const content = e.target.value;
                updateSection(section.id, { content });
                api.queueOp(`section-content-${section.id}`, {
                  op: "update_section",
                  sectionId: section.id,
                  content,
                });
              }}
            />
          </CardContent>
        </Card>
      ))}
      {canEdit && <AddSectionForm api={api} />}
    </section>
  );
}

function AddSectionForm({ api }: { api: EditorApi }) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [type, setType] = React.useState<SectionType>("custom");
  const [busy, setBusy] = React.useState(false);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add section
      </Button>
    );
  }

  async function add() {
    if (!title.trim()) return;
    setBusy(true);
    const ok = await api.applyStructuralOp({
      op: "add_section",
      type,
      title: title.trim(),
      content: "",
    });
    setBusy(false);
    if (ok) {
      setTitle("");
      setType("custom");
      setOpen(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3">
      <div className="min-w-48 flex-1 space-y-1.5">
        <Label className="text-xs text-muted-foreground">Section title</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Troubleshooting"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void add();
            }
          }}
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as SectionType)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SECTION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {humanizeToken(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={() => void add()} disabled={busy || !title.trim()}>
        Add
      </Button>
      <Button variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Procedure steps                                                     */
/* ------------------------------------------------------------------ */

function ProcedureList({
  steps,
  api,
  reviseEndpoint,
}: {
  steps: SopStep[];
  api: EditorApi;
  reviseEndpoint: string;
}) {
  const { canEdit } = api;

  function moveStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const ordered = [...steps];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    api.mutate((p) => ({
      ...p,
      steps: ordered.map((s, i) => ({ ...s, position: i, stepNumber: i + 1 })),
    }));
    void api.applyOp({ op: "reorder_steps", orderedIds: ordered.map((s) => s.id) });
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Procedure
      </h2>
      {steps.length === 0 && (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          No steps yet. Add the first step of the procedure below.
        </p>
      )}
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <StepCard
            key={step.id}
            step={step}
            api={api}
            reviseEndpoint={reviseEndpoint}
            isFirst={index === 0}
            isLast={index === steps.length - 1}
            onMoveUp={() => moveStep(index, -1)}
            onMoveDown={() => moveStep(index, 1)}
          />
        ))}
      </ol>
      {canEdit && (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void api.applyStructuralOp({ op: "add_step", title: "New step" })
          }
        >
          <Plus className="size-4" /> Add step
        </Button>
      )}
    </section>
  );
}

const STEP_EXTRAS = [
  { field: "expectedResult", label: "Expected result" },
  { field: "warning", label: "Warning" },
  { field: "note", label: "Note" },
  { field: "qualityCheckpoint", label: "Quality checkpoint" },
] as const;

type StepExtraField = (typeof STEP_EXTRAS)[number]["field"];

function StepCard({
  step,
  api,
  reviseEndpoint,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  step: SopStep;
  api: EditorApi;
  reviseEndpoint: string;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { canEdit } = api;
  const filledExtras = STEP_EXTRAS.filter((e) => step[e.field]).length;
  const [extrasOpen, setExtrasOpen] = React.useState(false);

  function updateStep(patch: Partial<SopStep>) {
    api.mutate((p) => ({
      ...p,
      steps: p.steps.map((s) => (s.id === step.id ? { ...s, ...patch } : s)),
    }));
  }

  function editExtra(field: StepExtraField, value: string) {
    updateStep({ [field]: value } as Partial<SopStep>);
    const patch: Partial<Record<StepExtraField, string | null>> = {
      [field]: value === "" ? null : value,
    };
    api.queueOp(`step-${field}-${step.id}`, {
      op: "update_step",
      stepId: step.id,
      ...patch,
    });
  }

  return (
    <li>
      <Card className="py-4">
        <CardContent className="space-y-3 px-4">
          <div className="flex items-start gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white dark:bg-gold dark:text-navy">
              {step.stepNumber}
            </span>
            {canEdit ? (
              <Input
                value={step.title}
                aria-label={`Step ${step.stepNumber} title`}
                className="h-8 flex-1 border-transparent font-medium shadow-none hover:border-input"
                onChange={(e) => {
                  const title = e.target.value;
                  updateStep({ title });
                  api.queueOp(`step-title-${step.id}`, {
                    op: "update_step",
                    stepId: step.id,
                    title,
                  });
                }}
              />
            ) : (
              <p className="flex-1 py-1 font-medium">{step.title}</p>
            )}
            {step.videoTimestampSeconds !== null && (
              <Badge variant="outline" className="gap-1 font-mono text-muted-foreground">
                <Clock className="size-3" />
                {formatTimestamp(step.videoTimestampSeconds)}
              </Badge>
            )}
            <ReorderButtons
              disabled={!canEdit}
              isFirst={isFirst}
              isLast={isLast}
              onUp={onMoveUp}
              onDown={onMoveDown}
            />
            {canEdit && (
              <>
                <AiRevisePopover
                  endpoint={reviseEndpoint}
                  target={{ kind: "step", stepId: step.id }}
                  onRevised={(revised) => updateStep({ instruction: revised })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground"
                  aria-label="Add step after this one"
                  title="Add step after"
                  onClick={() =>
                    void api.applyStructuralOp({
                      op: "add_step",
                      afterStepId: step.id,
                      title: "New step",
                    })
                  }
                >
                  <ListPlus className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  aria-label="Delete step"
                  onClick={() =>
                    void api.applyStructuralOp({ op: "delete_step", stepId: step.id })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </>
            )}
          </div>

          <ReviewFlags
            flags={step.reviewFlags}
            canEdit={canEdit}
            onResolve={() => {
              updateStep({ reviewFlags: [] });
              void api.applyOp({ op: "resolve_step_flags", stepId: step.id });
            }}
          />

          <AutosizeTextarea
            value={step.instruction}
            disabled={!canEdit}
            placeholder="Describe exactly what to do in this step…"
            className="ml-10 w-[calc(100%-2.5rem)]"
            onChange={(e) => {
              const instruction = e.target.value;
              updateStep({ instruction });
              api.queueOp(`step-instruction-${step.id}`, {
                op: "update_step",
                stepId: step.id,
                instruction,
              });
            }}
          />

          <div className="ml-10">
            <button
              type="button"
              onClick={() => setExtrasOpen((o) => !o)}
              className="flex cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {extrasOpen ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
              Details
              {filledExtras > 0 && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {filledExtras}
                </Badge>
              )}
            </button>
            {extrasOpen && (
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {STEP_EXTRAS.map(({ field, label }) => (
                  <div key={field} className="space-y-1">
                    <Label
                      className={cn(
                        "text-xs",
                        field === "warning"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {label}
                    </Label>
                    <AutosizeTextarea
                      value={step[field] ?? ""}
                      disabled={!canEdit}
                      placeholder={`Add a ${label.toLowerCase()}…`}
                      className={cn(
                        field === "warning" &&
                          step.warning &&
                          "border-amber-300 dark:border-amber-500/40",
                      )}
                      onChange={(e) => editExtra(field, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

function ReorderButtons({
  disabled,
  isFirst,
  isLast,
  onUp,
  onDown,
}: {
  disabled: boolean;
  isFirst: boolean;
  isLast: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  if (disabled) return null;
  return (
    <span className="flex shrink-0 flex-col">
      <Button
        variant="ghost"
        size="icon"
        className="size-5 text-muted-foreground"
        aria-label="Move up"
        disabled={isFirst}
        onClick={onUp}
      >
        <ArrowUp className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-5 text-muted-foreground"
        aria-label="Move down"
        disabled={isLast}
        onClick={onDown}
      >
        <ArrowDown className="size-3.5" />
      </Button>
    </span>
  );
}
