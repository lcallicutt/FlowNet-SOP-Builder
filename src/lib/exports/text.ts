import type { DocumentPackage } from "@/lib/documents";
import type { ExportBranding, ExportSelection } from "./types";
import {
  approvalSummary,
  generatedByLine,
  groupChecklist,
  humanize,
  markdownToBlocks,
  metadataRows,
  selectedParts,
  shouldNoteMissing,
  stepDetails,
} from "./shared";

const RULER = "=".repeat(72);
const THIN_RULER = "-".repeat(72);
const INDENT = "    ";

/** Render the selected package parts as plain text. */
export function renderPlainText(
  pkg: DocumentPackage,
  selection: ExportSelection,
  branding: ExportBranding,
): string {
  const out: string[] = [];
  const push = (...lines: string[]) => out.push(...lines);

  /* Header + metadata --------------------------------------------- */
  push(RULER);
  push((pkg.document.title || "UNTITLED SOP").toUpperCase());
  push(RULER, "");
  const rows = metadataRows(pkg);
  const width = Math.max(...rows.map((r) => r.label.length));
  for (const row of rows) {
    push(`${row.label.padEnd(width)} : ${row.value}`);
  }
  push("");

  const bodies: string[][] = [];
  const noteMissing = shouldNoteMissing(selection);

  for (const part of selectedParts(selection)) {
    if (part === "sop") {
      const body = renderSopBody(pkg);
      if (body.length > 0) bodies.push(body);
      else if (noteMissing) bodies.push(["Not generated.", ""]);
    } else if (part === "checklist") {
      const body = renderChecklistBody(pkg);
      if (body.length > 0) bodies.push(body);
      else if (noteMissing) bodies.push([...header("Checklist"), "Not generated.", ""]);
    } else if (part === "quick_guide") {
      const body = renderQuickGuideBody(pkg);
      if (body.length > 0) bodies.push(body);
      else if (noteMissing) {
        bodies.push([...header("Quick Reference Guide"), "Not generated.", ""]);
      }
    } else if (part === "training_guide") {
      const body = renderTrainingGuideBody(pkg);
      if (body.length > 0) bodies.push(body);
      else if (noteMissing) {
        bodies.push([...header("Training Guide"), "Not generated.", ""]);
      }
    }
  }

  bodies.forEach((body, i) => {
    if (i > 0) push(RULER, "");
    push(...body);
  });

  /* Footer --------------------------------------------------------- */
  push(RULER);
  push(`Revision: v${pkg.document.versionNumber} | ${approvalSummary(pkg)}`);
  push(generatedByLine(branding.workspaceName));
  push("");

  return out.join("\n");
}

function header(title: string): string[] {
  return [title.toUpperCase(), THIN_RULER, ""];
}

function subHeader(title: string): string[] {
  return [title.toUpperCase(), ""];
}

function contentLines(markdown: string): string[] {
  const out: string[] = [];
  for (const block of markdownToBlocks(markdown)) {
    if (block.kind === "heading") out.push(block.text.toUpperCase());
    else if (block.kind === "bullet") out.push(`${INDENT}- ${block.text}`);
    else out.push(block.text);
  }
  return out;
}

function flagLines(reviewFlags: string[]): string[] {
  return (reviewFlags ?? []).map(
    (flag) => `${INDENT}!! REVIEW: ${humanize(flag)}`,
  );
}

function renderSopBody(pkg: DocumentPackage): string[] {
  const out: string[] = [];
  for (const section of pkg.sections ?? []) {
    out.push(...header(section.title || humanize(section.type)));
    if (section.content?.trim()) out.push(...contentLines(section.content), "");
    const flags = flagLines(section.reviewFlags);
    if (flags.length > 0) out.push(...flags, "");
  }
  const steps = pkg.steps ?? [];
  if (steps.length > 0) {
    out.push(...header("Procedure"));
    for (const step of steps) {
      out.push(`STEP ${step.stepNumber}: ${(step.title || "Untitled step").toUpperCase()}`);
      if (step.instruction?.trim()) {
        out.push(`${INDENT}${step.instruction.trim()}`);
      }
      for (const d of stepDetails(step)) {
        out.push(`${INDENT}${d.label}: ${d.value}`);
      }
      out.push(...flagLines(step.reviewFlags));
      out.push("");
    }
  }
  return out;
}

function renderChecklistBody(pkg: DocumentPackage): string[] {
  const groups = groupChecklist(pkg.checklist);
  if (groups.length === 0) return [];
  const out: string[] = [...header("Checklist")];
  for (const group of groups) {
    out.push(...subHeader(group.label));
    for (const item of group.items) {
      out.push(`${INDENT}[${item.isChecked ? "x" : " "}] ${item.text}`);
    }
    out.push("");
  }
  return out;
}

function renderQuickGuideBody(pkg: DocumentPackage): string[] {
  const guide = pkg.quickGuide;
  if (!guide) return [];
  const out: string[] = [...header("Quick Reference Guide")];
  if (guide.objective) out.push(`Objective: ${guide.objective}`, "");
  if (guide.requiredTools?.length) {
    out.push(...subHeader("Required tools"));
    for (const tool of guide.requiredTools) out.push(`${INDENT}- ${tool}`);
    out.push("");
  }
  if (guide.keySteps?.length) {
    out.push(...subHeader("Key steps"));
    guide.keySteps.forEach((step, i) => {
      out.push(`${INDENT}${i + 1}. ${step.title} - ${step.summary}`);
    });
    out.push("");
  }
  if (guide.warnings?.length) {
    out.push(...subHeader("Warnings"));
    for (const warning of guide.warnings) out.push(`${INDENT}! ${warning}`);
    out.push("");
  }
  if (guide.commonErrors?.length) {
    out.push(...subHeader("Common errors"));
    for (const error of guide.commonErrors) out.push(`${INDENT}- ${error}`);
    out.push("");
  }
  if (guide.escalationContact) {
    out.push(`Escalation contact: ${guide.escalationContact}`, "");
  }
  if (guide.completionConfirmation) {
    out.push(`Completion confirmation: ${guide.completionConfirmation}`, "");
  }
  return out;
}

function renderTrainingGuideBody(pkg: DocumentPackage): string[] {
  const guide = pkg.trainingGuide;
  if (!guide) return [];
  const out: string[] = [...header("Training Guide")];
  if (guide.learningObjective) {
    out.push(`Learning objective: ${guide.learningObjective}`, "");
  }
  if (guide.processOverview) {
    out.push(...subHeader("Process overview"), guide.processOverview, "");
  }
  if (guide.keyTerminology?.length) {
    out.push(...subHeader("Key terminology"));
    for (const entry of guide.keyTerminology) {
      out.push(`${INDENT}${entry.term}: ${entry.definition}`);
    }
    out.push("");
  }
  if (guide.walkthrough?.length) {
    out.push(...subHeader("Guided walkthrough"));
    guide.walkthrough.forEach((item, i) => {
      out.push(`${INDENT}${i + 1}. ${item.step}`);
      if (item.detail) out.push(`${INDENT}${INDENT}${item.detail}`);
      if (item.whyItMatters) {
        out.push(`${INDENT}${INDENT}Why it matters: ${item.whyItMatters}`);
      }
    });
    out.push("");
  }
  if (guide.practiceExercise) {
    out.push(...subHeader("Practice exercise"), guide.practiceExercise, "");
  }
  if (guide.knowledgeChecks?.length) {
    out.push(...subHeader("Knowledge checks"));
    guide.knowledgeChecks.forEach((check, i) => {
      out.push(`${INDENT}${i + 1}. Q: ${check.question}`);
      out.push(`${INDENT}   A: ${check.answer}`);
    });
    out.push("");
  }
  if (guide.commonMistakes?.length) {
    out.push(...subHeader("Common mistakes"));
    for (const mistake of guide.commonMistakes) out.push(`${INDENT}- ${mistake}`);
    out.push("");
  }
  if (guide.supervisorReview) {
    out.push(`Supervisor review: ${guide.supervisorReview}`, "");
  }
  return out;
}
