import type { DocumentPackage } from "@/lib/documents";
import type { ExportSelection } from "./types";

/* ------------------------------------------------------------------ */
/* Labels & humanization                                               */
/* ------------------------------------------------------------------ */

export const CHECKLIST_CATEGORY_LABELS: Record<string, string> = {
  pre_process: "Pre-process checks",
  action: "Action items",
  decision: "Decision checks",
  quality: "Quality checks",
  completion: "Completion checks",
  sign_off: "Sign-off",
};

/** Category display order for grouped checklists. */
export const CHECKLIST_CATEGORY_ORDER = [
  "pre_process",
  "action",
  "decision",
  "quality",
  "completion",
  "sign_off",
];

/** "needs_confirmation" → "Needs confirmation" */
export function humanize(value: string): string {
  const words = (value ?? "").trim().replace(/[_-]+/g, " ");
  if (!words) return "";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function checklistCategoryLabel(category: string): string {
  return CHECKLIST_CATEGORY_LABELS[category] ?? humanize(category);
}

/** 65 → "1:05" */
export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** ISO timestamp → "2026-07-14"; null/invalid → "—". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}

export function slugify(text: string): string {
  const slug = (text ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "document";
}

/* ------------------------------------------------------------------ */
/* Metadata                                                            */
/* ------------------------------------------------------------------ */

export type MetadataRow = { label: string; value: string };

export function metadataRows(pkg: DocumentPackage): MetadataRow[] {
  const doc = pkg.document;
  return [
    { label: "SOP Number", value: doc.sopNumber || "—" },
    { label: "Version", value: `v${doc.versionNumber}` },
    { label: "Status", value: humanize(doc.status) || "—" },
    { label: "Department", value: doc.department || "—" },
    { label: "Process Owner", value: doc.processOwner || "—" },
    { label: "Created", value: formatDate(doc.createdAt) },
    { label: "Last Updated", value: formatDate(doc.updatedAt) },
    { label: "Review Date", value: formatDate(doc.reviewDate) },
  ];
}

/* ------------------------------------------------------------------ */
/* Selection helpers                                                   */
/* ------------------------------------------------------------------ */

export type PackagePart = "sop" | "checklist" | "quick_guide" | "training_guide";

export function selectedParts(selection: ExportSelection): PackagePart[] {
  if (selection === "full_package") {
    return ["sop", "checklist", "quick_guide", "training_guide"];
  }
  return [selection];
}

/**
 * Missing/empty optional content renders a "Not generated" note only when it
 * was specifically requested; in full_package it is silently omitted.
 */
export function shouldNoteMissing(selection: ExportSelection): boolean {
  return selection !== "full_package";
}

export type ChecklistGroup = {
  category: string;
  label: string;
  items: DocumentPackage["checklist"];
};

export function groupChecklist(
  checklist: DocumentPackage["checklist"],
): ChecklistGroup[] {
  const byCategory = new Map<string, DocumentPackage["checklist"]>();
  for (const item of checklist ?? []) {
    const key = item.category || "action";
    const bucket = byCategory.get(key);
    if (bucket) bucket.push(item);
    else byCategory.set(key, [item]);
  }
  const orderedKeys = [
    ...CHECKLIST_CATEGORY_ORDER.filter((c) => byCategory.has(c)),
    ...[...byCategory.keys()].filter(
      (c) => !CHECKLIST_CATEGORY_ORDER.includes(c),
    ),
  ];
  return orderedKeys.map((category) => ({
    category,
    label: checklistCategoryLabel(category),
    items: byCategory.get(category) ?? [],
  }));
}

/* ------------------------------------------------------------------ */
/* Tiny markdown helpers (for DOCX/PDF renderers)                      */
/* ------------------------------------------------------------------ */

/** Strip inline markdown emphasis/code/link markers without full parsing. */
export function stripInlineMarkdown(text: string): string {
  return (text ?? "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}

export type ContentBlock = {
  kind: "paragraph" | "bullet" | "heading";
  text: string;
};

/**
 * Convert a markdown section body into flat blocks (paragraphs, bullets and
 * headings) with inline markers stripped. Deliberately not a full parser.
 */
export function markdownToBlocks(markdown: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({
        kind: "paragraph",
        text: stripInlineMarkdown(paragraph.join(" ")),
      });
      paragraph = [];
    }
  };
  for (const raw of (markdown ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const bullet = /^[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", text: stripInlineMarkdown(heading[1]) });
    } else if (bullet) {
      flush();
      blocks.push({ kind: "bullet", text: stripInlineMarkdown(bullet[1]) });
    } else if (numbered) {
      flush();
      blocks.push({ kind: "bullet", text: stripInlineMarkdown(numbered[1]) });
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

/* ------------------------------------------------------------------ */
/* Step sub-item helpers                                               */
/* ------------------------------------------------------------------ */

export type StepDetail = { label: string; value: string };

export function stepDetails(step: DocumentPackage["steps"][number]): StepDetail[] {
  const details: StepDetail[] = [];
  if (step.expectedResult) {
    details.push({ label: "Expected result", value: step.expectedResult });
  }
  if (step.warning) details.push({ label: "Warning", value: step.warning });
  if (step.note) details.push({ label: "Note", value: step.note });
  if (step.qualityCheckpoint) {
    details.push({ label: "Quality check", value: step.qualityCheckpoint });
  }
  if (
    step.videoTimestampSeconds !== null &&
    step.videoTimestampSeconds !== undefined
  ) {
    details.push({
      label: "Source timestamp",
      value: formatTimestamp(step.videoTimestampSeconds),
    });
  }
  return details;
}

/* ------------------------------------------------------------------ */
/* Approval footer                                                     */
/* ------------------------------------------------------------------ */

export function approvalSummary(pkg: DocumentPackage): string {
  const approval = pkg.latestApproval;
  if (!approval) return "No approval recorded.";
  const parts = [`Approval status: ${humanize(approval.status) || "Unknown"}`];
  if (approval.reviewerName) parts.push(`Reviewer: ${approval.reviewerName}`);
  if (approval.decidedAt) parts.push(`Decided: ${formatDate(approval.decidedAt)}`);
  return parts.join(" · ");
}

export function generatedByLine(workspaceName: string): string {
  return `Generated by FlowNet SOP Builder for ${workspaceName || "your workspace"}`;
}
