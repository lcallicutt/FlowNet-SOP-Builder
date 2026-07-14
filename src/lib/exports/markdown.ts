import type { DocumentPackage } from "@/lib/documents";
import type { ExportBranding, ExportSelection } from "./types";
import {
  approvalSummary,
  generatedByLine,
  groupChecklist,
  humanize,
  metadataRows,
  selectedParts,
  shouldNoteMissing,
  stepDetails,
} from "./shared";

/** Render the selected package parts as a professional Markdown document. */
export function renderMarkdown(
  pkg: DocumentPackage,
  selection: ExportSelection,
  branding: ExportBranding,
): string {
  const out: string[] = [];
  const push = (...lines: string[]) => out.push(...lines);

  /* Header + metadata table -------------------------------------- */
  push(`# ${pkg.document.title || "Untitled SOP"}`, "");
  push("| Field | Value |", "| --- | --- |");
  for (const row of metadataRows(pkg)) {
    push(`| ${row.label} | ${row.value} |`);
  }
  push("");

  const bodies: string[][] = [];
  const noteMissing = shouldNoteMissing(selection);

  for (const part of selectedParts(selection)) {
    if (part === "sop") {
      const body = renderSopBody(pkg);
      if (body.length > 0) bodies.push(body);
      else if (noteMissing) bodies.push(["_Not generated._", ""]);
    } else if (part === "checklist") {
      const body = renderChecklistBody(pkg);
      if (body.length > 0) bodies.push(body);
      else if (noteMissing) {
        bodies.push(["## Checklist", "", "_Not generated._", ""]);
      }
    } else if (part === "quick_guide") {
      const body = renderQuickGuideBody(pkg);
      if (body.length > 0) bodies.push(body);
      else if (noteMissing) {
        bodies.push(["## Quick Reference Guide", "", "_Not generated._", ""]);
      }
    } else if (part === "training_guide") {
      const body = renderTrainingGuideBody(pkg);
      if (body.length > 0) bodies.push(body);
      else if (noteMissing) {
        bodies.push(["## Training Guide", "", "_Not generated._", ""]);
      }
    }
  }

  bodies.forEach((body, i) => {
    if (i > 0) push("---", "");
    push(...body);
  });

  /* Revision / approval footer ------------------------------------ */
  push("---", "");
  push(
    `**Revision:** v${pkg.document.versionNumber} · ${approvalSummary(pkg)}`,
    "",
    `_${generatedByLine(branding.workspaceName)}_`,
    "",
  );

  return out.join("\n");
}

function flagLines(reviewFlags: string[]): string[] {
  return (reviewFlags ?? []).map((flag) => `> ⚠ Review: ${humanize(flag)}`);
}

function renderSopBody(pkg: DocumentPackage): string[] {
  const out: string[] = [];
  for (const section of pkg.sections ?? []) {
    out.push(`## ${section.title || humanize(section.type)}`, "");
    if (section.content?.trim()) out.push(section.content.trim(), "");
    const flags = flagLines(section.reviewFlags);
    if (flags.length > 0) out.push(...flags, "");
  }
  const steps = pkg.steps ?? [];
  if (steps.length > 0) {
    out.push("## Procedure", "");
    for (const step of steps) {
      out.push(`### Step ${step.stepNumber}. ${step.title || "Untitled step"}`, "");
      if (step.instruction?.trim()) out.push(step.instruction.trim(), "");
      const details = stepDetails(step);
      if (details.length > 0) {
        for (const d of details) out.push(`- **${d.label}:** ${d.value}`);
        out.push("");
      }
      const flags = flagLines(step.reviewFlags);
      if (flags.length > 0) out.push(...flags, "");
    }
  }
  return out;
}

function renderChecklistBody(pkg: DocumentPackage): string[] {
  const groups = groupChecklist(pkg.checklist);
  if (groups.length === 0) return [];
  const out: string[] = ["## Checklist", ""];
  for (const group of groups) {
    out.push(`### ${group.label}`, "");
    for (const item of group.items) {
      out.push(`- [${item.isChecked ? "x" : " "}] ${item.text}`);
    }
    out.push("");
  }
  return out;
}

function renderQuickGuideBody(pkg: DocumentPackage): string[] {
  const guide = pkg.quickGuide;
  if (!guide) return [];
  const out: string[] = ["## Quick Reference Guide", ""];
  if (guide.objective) out.push(`**Objective:** ${guide.objective}`, "");
  if (guide.requiredTools?.length) {
    out.push("### Required tools", "");
    for (const tool of guide.requiredTools) out.push(`- ${tool}`);
    out.push("");
  }
  if (guide.keySteps?.length) {
    out.push("### Key steps", "");
    guide.keySteps.forEach((step, i) => {
      out.push(`${i + 1}. **${step.title}** — ${step.summary}`);
    });
    out.push("");
  }
  if (guide.warnings?.length) {
    out.push("### Warnings", "");
    for (const warning of guide.warnings) out.push(`- ⚠ ${warning}`);
    out.push("");
  }
  if (guide.commonErrors?.length) {
    out.push("### Common errors", "");
    for (const error of guide.commonErrors) out.push(`- ${error}`);
    out.push("");
  }
  if (guide.escalationContact) {
    out.push(`**Escalation contact:** ${guide.escalationContact}`, "");
  }
  if (guide.completionConfirmation) {
    out.push(`**Completion confirmation:** ${guide.completionConfirmation}`, "");
  }
  return out;
}

function renderTrainingGuideBody(pkg: DocumentPackage): string[] {
  const guide = pkg.trainingGuide;
  if (!guide) return [];
  const out: string[] = ["## Training Guide", ""];
  if (guide.learningObjective) {
    out.push(`**Learning objective:** ${guide.learningObjective}`, "");
  }
  if (guide.processOverview) {
    out.push("### Process overview", "", guide.processOverview, "");
  }
  if (guide.keyTerminology?.length) {
    out.push("### Key terminology", "");
    for (const entry of guide.keyTerminology) {
      out.push(`- **${entry.term}** — ${entry.definition}`);
    }
    out.push("");
  }
  if (guide.walkthrough?.length) {
    out.push("### Guided walkthrough", "");
    guide.walkthrough.forEach((item, i) => {
      out.push(`${i + 1}. **${item.step}**`);
      if (item.detail) out.push(`   - ${item.detail}`);
      if (item.whyItMatters) out.push(`   - _Why it matters:_ ${item.whyItMatters}`);
    });
    out.push("");
  }
  if (guide.practiceExercise) {
    out.push("### Practice exercise", "", guide.practiceExercise, "");
  }
  if (guide.knowledgeChecks?.length) {
    out.push("### Knowledge checks", "");
    guide.knowledgeChecks.forEach((check, i) => {
      out.push(`${i + 1}. **Q:** ${check.question}`);
      out.push(`   **A:** ${check.answer}`);
    });
    out.push("");
  }
  if (guide.commonMistakes?.length) {
    out.push("### Common mistakes", "");
    for (const mistake of guide.commonMistakes) out.push(`- ${mistake}`);
    out.push("");
  }
  if (guide.supervisorReview) {
    out.push(`**Supervisor review:** ${guide.supervisorReview}`, "");
  }
  return out;
}
