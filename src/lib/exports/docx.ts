import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
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

const NAVY = "1F2A44";
const GOLD = "B08A2E";
const WARNING_COLOR = "9A3412"; // dark red/amber
const GRAY = "6B7280";
const BORDER_GRAY = "CBD5E1";

type Block = Paragraph | Table;

function normalizeHex(color: string | null | undefined, fallback: string): string {
  const hex = (color ?? "").replace(/^#/, "").trim();
  return /^[0-9a-fA-F]{6}$/.test(hex) ? hex.toUpperCase() : fallback;
}

/** Render the selected package parts as a Word document. */
export async function renderDocx(
  pkg: DocumentPackage,
  selection: ExportSelection,
  branding: ExportBranding,
): Promise<Uint8Array> {
  const accent = normalizeHex(branding.brandColor, NAVY);
  const children: Block[] = [];

  /* Cover-style header --------------------------------------------- */
  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: (branding.workspaceName || "FlowNet").toUpperCase(),
          bold: true,
          color: GOLD,
          size: 20, // 10pt
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: pkg.document.title || "Untitled SOP",
          bold: true,
          color: accent,
          size: 52, // 26pt
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 240 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 8, color: accent },
      },
      children: [
        new TextRun({
          text: `${pkg.document.sopNumber} · v${pkg.document.versionNumber}`,
          color: GRAY,
          size: 22, // 11pt
        }),
      ],
    }),
  );

  /* Metadata table --------------------------------------------------- */
  children.push(metadataTable(pkg), spacer());

  /* Body -------------------------------------------------------------- */
  const noteMissing = shouldNoteMissing(selection);
  const bodies: Block[][] = [];

  for (const part of selectedParts(selection)) {
    if (part === "sop") {
      const body = sopBlocks(pkg);
      if (body.length > 0) bodies.push(body);
      else if (noteMissing) bodies.push([notGenerated()]);
    } else if (part === "checklist") {
      const body = checklistBlocks(pkg);
      if (body.length > 0) bodies.push(body);
      else if (noteMissing) bodies.push([heading1("Checklist"), notGenerated()]);
    } else if (part === "quick_guide") {
      const body = quickGuideBlocks(pkg);
      if (body.length > 0) bodies.push(body);
      else if (noteMissing) {
        bodies.push([heading1("Quick Reference Guide"), notGenerated()]);
      }
    } else if (part === "training_guide") {
      const body = trainingGuideBlocks(pkg);
      if (body.length > 0) bodies.push(body);
      else if (noteMissing) {
        bodies.push([heading1("Training Guide"), notGenerated()]);
      }
    }
  }

  bodies.forEach((body, i) => {
    if (i > 0) children.push(separator());
    children.push(...body);
  });

  /* Approval / revision footer ---------------------------------------- */
  children.push(
    separator(),
    new Paragraph({
      spacing: { before: 120, after: 60 },
      children: [
        new TextRun({ text: "Revision: ", bold: true, size: 18 }),
        new TextRun({
          text: `v${pkg.document.versionNumber} · ${approvalSummary(pkg)}`,
          size: 18,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: generatedByLine(branding.workspaceName),
          italics: true,
          color: GRAY,
          size: 16, // 8pt
        }),
      ],
    }),
  );

  const doc = new Document({
    creator: "FlowNet SOP Builder",
    title: pkg.document.title || "SOP",
    description: `${pkg.document.sopNumber} v${pkg.document.versionNumber}`,
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } }, // 11pt body
        heading1: {
          run: { color: accent, bold: true, size: 32 },
          paragraph: { spacing: { before: 280, after: 120 } },
        },
        heading2: {
          run: { color: accent, bold: true, size: 26 },
          paragraph: { spacing: { before: 200, after: 100 } },
        },
        heading3: {
          run: { color: NAVY, bold: true, size: 24 },
          paragraph: { spacing: { before: 160, after: 80 } },
        },
      },
    },
    sections: [{ properties: {}, children }],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function spacer(): Paragraph {
  return new Paragraph({ spacing: { after: 120 }, children: [] });
}

function separator(): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_GRAY },
    },
    children: [],
  });
}

function heading1(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1 });
}

function heading2(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2 });
}

function heading3(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_3 });
}

function notGenerated(): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: "Not generated.", italics: true, color: GRAY }),
    ],
  });
}

function bodyParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text })],
  });
}

function bulletParagraph(text: string, prefix = "• "): Paragraph {
  return new Paragraph({
    indent: { left: 360 },
    spacing: { after: 40 },
    children: [new TextRun({ text: `${prefix}${text}` })],
  });
}

function labeledParagraph(
  label: string,
  value: string,
  labelColor?: string,
): Paragraph {
  return new Paragraph({
    indent: { left: 360 },
    spacing: { after: 60 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, color: labelColor }),
      new TextRun({ text: value }),
    ],
  });
}

/** Markdown section body → paragraphs (inline markers stripped). */
function markdownParagraphs(markdown: string): Paragraph[] {
  const out: Paragraph[] = [];
  for (const block of markdownToBlocks(markdown)) {
    if (block.kind === "heading") {
      out.push(
        new Paragraph({
          spacing: { before: 120, after: 60 },
          children: [new TextRun({ text: block.text, bold: true })],
        }),
      );
    } else if (block.kind === "bullet") {
      out.push(bulletParagraph(block.text));
    } else {
      out.push(bodyParagraph(block.text));
    }
  }
  return out;
}

function reviewFlagParagraphs(reviewFlags: string[]): Paragraph[] {
  return (reviewFlags ?? []).map(
    (flag) =>
      new Paragraph({
        indent: { left: 360 },
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: `⚠ Review: ${humanize(flag)}`,
            bold: true,
            color: WARNING_COLOR,
          }),
        ],
      }),
  );
}

function metadataTable(pkg: DocumentPackage): Table {
  const border = { style: BorderStyle.SINGLE, size: 4, color: BORDER_GRAY };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: border,
      bottom: border,
      left: border,
      right: border,
      insideHorizontal: border,
      insideVertical: border,
    },
    rows: metadataRows(pkg).map(
      (row) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 30, type: WidthType.PERCENTAGE },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: row.label, bold: true, size: 20 }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 70, type: WidthType.PERCENTAGE },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: row.value, size: 20 })],
                }),
              ],
            }),
          ],
        }),
    ),
  });
}

/* ------------------------------------------------------------------ */
/* Package parts                                                       */
/* ------------------------------------------------------------------ */

function sopBlocks(pkg: DocumentPackage): Block[] {
  const out: Block[] = [];
  for (const section of pkg.sections ?? []) {
    out.push(heading2(section.title || humanize(section.type)));
    if (section.content?.trim()) out.push(...markdownParagraphs(section.content));
    out.push(...reviewFlagParagraphs(section.reviewFlags));
  }
  const steps = pkg.steps ?? [];
  if (steps.length > 0) {
    out.push(heading1("Procedure"));
    for (const step of steps) {
      out.push(
        heading3(`Step ${step.stepNumber} — ${step.title || "Untitled step"}`),
      );
      if (step.instruction?.trim()) {
        out.push(labeledParagraph("Instruction", step.instruction.trim()));
      }
      for (const detail of stepDetails(step)) {
        out.push(
          labeledParagraph(
            detail.label,
            detail.value,
            detail.label === "Warning" ? WARNING_COLOR : undefined,
          ),
        );
      }
      out.push(...reviewFlagParagraphs(step.reviewFlags));
    }
  }
  return out;
}

function checklistBlocks(pkg: DocumentPackage): Block[] {
  const groups = groupChecklist(pkg.checklist);
  if (groups.length === 0) return [];
  const out: Block[] = [heading1("Checklist")];
  for (const group of groups) {
    out.push(heading2(group.label));
    for (const item of group.items) {
      out.push(
        new Paragraph({
          indent: { left: 240 },
          spacing: { after: 60 },
          children: [
            new TextRun({ text: item.isChecked ? "☑ " : "☐ " }),
            new TextRun({ text: item.text }),
          ],
        }),
      );
    }
  }
  return out;
}

function quickGuideBlocks(pkg: DocumentPackage): Block[] {
  const guide = pkg.quickGuide;
  if (!guide) return [];
  const out: Block[] = [heading1("Quick Reference Guide")];
  if (guide.objective) out.push(labeledParagraph("Objective", guide.objective));
  if (guide.requiredTools?.length) {
    out.push(heading2("Required tools"));
    for (const tool of guide.requiredTools) out.push(bulletParagraph(tool));
  }
  if (guide.keySteps?.length) {
    out.push(heading2("Key steps"));
    guide.keySteps.forEach((step, i) => {
      out.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { after: 60 },
          children: [
            new TextRun({ text: `${i + 1}. ${step.title}`, bold: true }),
            new TextRun({ text: step.summary ? ` — ${step.summary}` : "" }),
          ],
        }),
      );
    });
  }
  if (guide.warnings?.length) {
    out.push(heading2("Warnings"));
    for (const warning of guide.warnings) {
      out.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: `⚠ ${warning}`,
              color: WARNING_COLOR,
            }),
          ],
        }),
      );
    }
  }
  if (guide.commonErrors?.length) {
    out.push(heading2("Common errors"));
    for (const error of guide.commonErrors) out.push(bulletParagraph(error));
  }
  if (guide.escalationContact) {
    out.push(labeledParagraph("Escalation contact", guide.escalationContact));
  }
  if (guide.completionConfirmation) {
    out.push(
      labeledParagraph("Completion confirmation", guide.completionConfirmation),
    );
  }
  return out;
}

function trainingGuideBlocks(pkg: DocumentPackage): Block[] {
  const guide = pkg.trainingGuide;
  if (!guide) return [];
  const out: Block[] = [heading1("Training Guide")];
  if (guide.learningObjective) {
    out.push(labeledParagraph("Learning objective", guide.learningObjective));
  }
  if (guide.processOverview) {
    out.push(heading2("Process overview"), bodyParagraph(guide.processOverview));
  }
  if (guide.keyTerminology?.length) {
    out.push(heading2("Key terminology"));
    for (const entry of guide.keyTerminology) {
      out.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { after: 40 },
          children: [
            new TextRun({ text: `${entry.term}: `, bold: true }),
            new TextRun({ text: entry.definition }),
          ],
        }),
      );
    }
  }
  if (guide.walkthrough?.length) {
    out.push(heading2("Guided walkthrough"));
    guide.walkthrough.forEach((item, i) => {
      out.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { after: 40 },
          children: [new TextRun({ text: `${i + 1}. ${item.step}`, bold: true })],
        }),
      );
      if (item.detail) {
        out.push(
          new Paragraph({
            indent: { left: 600 },
            spacing: { after: 40 },
            children: [new TextRun({ text: item.detail })],
          }),
        );
      }
      if (item.whyItMatters) {
        out.push(
          new Paragraph({
            indent: { left: 600 },
            spacing: { after: 60 },
            children: [
              new TextRun({ text: "Why it matters: ", bold: true, size: 20 }),
              new TextRun({ text: item.whyItMatters, italics: true, size: 20 }),
            ],
          }),
        );
      }
    });
  }
  if (guide.practiceExercise) {
    out.push(heading2("Practice exercise"), bodyParagraph(guide.practiceExercise));
  }
  if (guide.knowledgeChecks?.length) {
    out.push(heading2("Knowledge checks"));
    guide.knowledgeChecks.forEach((check, i) => {
      out.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { after: 20 },
          children: [
            new TextRun({ text: `${i + 1}. Q: `, bold: true }),
            new TextRun({ text: check.question }),
          ],
        }),
        new Paragraph({
          indent: { left: 600 },
          spacing: { after: 60 },
          children: [
            new TextRun({ text: "A: ", bold: true }),
            new TextRun({ text: check.answer }),
          ],
        }),
      );
    });
  }
  if (guide.commonMistakes?.length) {
    out.push(heading2("Common mistakes"));
    for (const mistake of guide.commonMistakes) out.push(bulletParagraph(mistake));
  }
  if (guide.supervisorReview) {
    out.push(labeledParagraph("Supervisor review", guide.supervisorReview));
  }
  return out;
}
