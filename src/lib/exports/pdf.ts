import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
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

/* ------------------------------------------------------------------ */
/* Page geometry & palette                                             */
/* ------------------------------------------------------------------ */

const PAGE_WIDTH = 612; // US Letter
const PAGE_HEIGHT = 792;
const MARGIN = 56;
const FOOTER_RESERVE = 30;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const NAVY = rgb(0.08, 0.12, 0.2);
const GOLD = rgb(0.85, 0.7, 0.25);
const WHITE = rgb(1, 1, 1);
const BODY_COLOR = rgb(0.13, 0.15, 0.19);
const GRAY = rgb(0.45, 0.48, 0.53);
const LIGHT_GRAY = rgb(0.8, 0.84, 0.88);
const WARNING_COLOR = rgb(0.66, 0.26, 0.09);

function parseBrandColor(color: string | null | undefined): RGB | null {
  const hex = (color ?? "").replace(/^#/, "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return rgb(
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  );
}

/* ------------------------------------------------------------------ */
/* WinAnsi sanitizer                                                   */
/* ------------------------------------------------------------------ */

const REPLACEMENTS: Record<string, string> = {
  "☐": "[ ]",
  "☑": "[x]",
  "✓": "x",
  "✔": "x",
  "→": "->",
  "←": "<-",
  "⇒": "=>",
  "↑": "^",
  "↓": "v",
  "⚠": "(!)",
  "≥": ">=",
  "≤": "<=",
  "≠": "!=",
  "−": "-",
  " ": " ",
  "\t": "  ",
};

// Non-Latin-1 characters that WinAnsi does encode.
const WINANSI_EXTRAS = new Set(
  "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ",
);

/** Replace characters pdf-lib's WinAnsi encoding cannot represent. */
export function sanitizeForWinAnsi(text: string): string {
  let out = "";
  for (const ch of text ?? "") {
    const mapped = REPLACEMENTS[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    if ((code >= 0x20 && code <= 0xff) || WINANSI_EXTRAS.has(ch)) out += ch;
    else if (ch === "\n") out += "\n";
    else out += "?";
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Cursor-based layout writer                                          */
/* ------------------------------------------------------------------ */

class PdfWriter {
  page!: PDFPage;
  y = 0;

  constructor(
    private readonly doc: PDFDocument,
    readonly font: PDFFont,
    readonly bold: PDFFont,
    readonly accent: RGB,
  ) {
    this.newPage();
  }

  newPage(): void {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  ensure(height: number): void {
    if (this.y - height < MARGIN + FOOTER_RESERVE) this.newPage();
  }

  gap(height: number): void {
    this.y -= height;
  }

  wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const lines: string[] = [];
    for (const rawLine of sanitizeForWinAnsi(text).split("\n")) {
      const words = rawLine.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        lines.push("");
        continue;
      }
      let current = "";
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
          current = candidate;
        } else {
          lines.push(current);
          current = word;
        }
      }
      if (current) lines.push(current);
    }
    return lines;
  }

  /** Write wrapped text at the cursor; returns nothing, advances cursor. */
  text(
    text: string,
    opts: {
      font?: PDFFont;
      size?: number;
      color?: RGB;
      indent?: number;
      lineGap?: number;
      spaceAfter?: number;
    } = {},
  ): void {
    const font = opts.font ?? this.font;
    const size = opts.size ?? 10;
    const color = opts.color ?? BODY_COLOR;
    const indent = opts.indent ?? 0;
    const lineHeight = size + (opts.lineGap ?? 3);
    const lines = this.wrap(text, font, size, CONTENT_WIDTH - indent);
    for (const line of lines) {
      this.ensure(lineHeight);
      this.y -= lineHeight;
      if (line) {
        this.page.drawText(line, {
          x: MARGIN + indent,
          y: this.y,
          size,
          font,
          color,
        });
      }
    }
    this.y -= opts.spaceAfter ?? 0;
  }

  /** Bold label followed by regular value, wrapped together. */
  label(label: string, value: string, valueColor?: RGB, indent = 14): void {
    const size = 10;
    const lineHeight = size + 3;
    const labelText = sanitizeForWinAnsi(`${label}: `);
    const labelWidth = this.bold.widthOfTextAtSize(labelText, size);
    const lines = this.wrap(
      value,
      this.font,
      size,
      CONTENT_WIDTH - indent - labelWidth,
    );
    this.ensure(lineHeight);
    this.y -= lineHeight;
    this.page.drawText(labelText, {
      x: MARGIN + indent,
      y: this.y,
      size,
      font: this.bold,
      color: valueColor ?? BODY_COLOR,
    });
    if (lines.length > 0) {
      this.page.drawText(lines[0], {
        x: MARGIN + indent + labelWidth,
        y: this.y,
        size,
        font: this.font,
        color: valueColor ?? BODY_COLOR,
      });
    }
    // Continuation lines align under the value.
    for (const line of lines.slice(1)) {
      this.ensure(lineHeight);
      this.y -= lineHeight;
      this.page.drawText(line, {
        x: MARGIN + indent + labelWidth,
        y: this.y,
        size,
        font: this.font,
        color: valueColor ?? BODY_COLOR,
      });
    }
    this.y -= 2;
  }

  heading1(text: string): void {
    this.ensure(40);
    this.gap(14);
    this.text(text, {
      font: this.bold,
      size: 15,
      color: this.accent,
      spaceAfter: 2,
    });
    // Accent underline
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y,
      width: CONTENT_WIDTH,
      height: 0.9,
      color: this.accent,
    });
    this.gap(8);
  }

  heading2(text: string): void {
    this.ensure(30);
    this.gap(10);
    this.text(text, {
      font: this.bold,
      size: 12,
      color: this.accent,
      spaceAfter: 3,
    });
  }

  heading3(text: string): void {
    this.ensure(24);
    this.gap(7);
    this.text(text, { font: this.bold, size: 10.5, spaceAfter: 2 });
  }

  body(text: string, indent = 0): void {
    this.text(text, { indent, spaceAfter: 4 });
  }

  bullet(text: string, indent = 14): void {
    const size = 10;
    const lineHeight = size + 3;
    const lines = this.wrap(text, this.font, size, CONTENT_WIDTH - indent - 12);
    lines.forEach((line, i) => {
      this.ensure(lineHeight);
      this.y -= lineHeight;
      if (i === 0) {
        this.page.drawText("•", {
          x: MARGIN + indent,
          y: this.y,
          size,
          font: this.font,
          color: BODY_COLOR,
        });
      }
      this.page.drawText(line, {
        x: MARGIN + indent + 12,
        y: this.y,
        size,
        font: this.font,
        color: BODY_COLOR,
      });
    });
    this.y -= 2;
  }

  checkbox(text: string, checked: boolean, indent = 14): void {
    const size = 10;
    const lineHeight = size + 5;
    const boxSize = 9;
    const textX = MARGIN + indent + boxSize + 8;
    const lines = this.wrap(
      text,
      this.font,
      size,
      CONTENT_WIDTH - indent - boxSize - 8,
    );
    lines.forEach((line, i) => {
      this.ensure(lineHeight);
      this.y -= lineHeight;
      if (i === 0) {
        this.page.drawRectangle({
          x: MARGIN + indent,
          y: this.y - 1,
          width: boxSize,
          height: boxSize,
          borderColor: rgb(0.35, 0.4, 0.48),
          borderWidth: 1,
        });
        if (checked) {
          this.page.drawText("x", {
            x: MARGIN + indent + 2,
            y: this.y,
            size: 8,
            font: this.bold,
            color: BODY_COLOR,
          });
        }
      }
      this.page.drawText(line, {
        x: textX,
        y: this.y,
        size,
        font: this.font,
        color: BODY_COLOR,
      });
    });
    this.y -= 2;
  }

  separator(): void {
    this.ensure(24);
    this.gap(12);
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y,
      width: CONTENT_WIDTH,
      height: 0.75,
      color: LIGHT_GRAY,
    });
    this.gap(12);
  }
}

/* ------------------------------------------------------------------ */
/* Renderer                                                            */
/* ------------------------------------------------------------------ */

/** Render the selected package parts as a PDF. */
export async function renderPdf(
  pkg: DocumentPackage,
  selection: ExportSelection,
  branding: ExportBranding,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(pkg.document.title || "SOP");
  pdfDoc.setCreator("FlowNet SOP Builder");

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const accent = parseBrandColor(branding.brandColor) ?? NAVY;
  const w = new PdfWriter(pdfDoc, font, bold, accent);

  /* Header band on page 1 ------------------------------------------- */
  const bandHeight = 96;
  w.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - bandHeight,
    width: PAGE_WIDTH,
    height: bandHeight,
    color: NAVY,
  });
  w.page.drawText(
    sanitizeForWinAnsi((branding.workspaceName || "FlowNet").toUpperCase()),
    { x: MARGIN, y: PAGE_HEIGHT - 34, size: 9, font: bold, color: GOLD },
  );
  const titleLines = w
    .wrap(pkg.document.title || "Untitled SOP", bold, 18, CONTENT_WIDTH)
    .slice(0, 2);
  titleLines.forEach((line, i) => {
    w.page.drawText(line, {
      x: MARGIN,
      y: PAGE_HEIGHT - 58 - i * 22,
      size: 18,
      font: bold,
      color: WHITE,
    });
  });
  w.y = PAGE_HEIGHT - bandHeight - 22;

  /* Metadata block ---------------------------------------------------- */
  const rows = metadataRows(pkg);
  const labelWidth = 110;
  for (const row of rows) {
    const size = 9.5;
    const lineHeight = size + 4.5;
    w.ensure(lineHeight);
    w.y -= lineHeight;
    w.page.drawText(sanitizeForWinAnsi(row.label), {
      x: MARGIN,
      y: w.y,
      size,
      font: bold,
      color: GRAY,
    });
    w.page.drawText(sanitizeForWinAnsi(row.value), {
      x: MARGIN + labelWidth,
      y: w.y,
      size,
      font,
      color: BODY_COLOR,
    });
  }
  w.gap(8);

  /* Body --------------------------------------------------------------- */
  const noteMissing = shouldNoteMissing(selection);
  let renderedParts = 0;
  const startPart = () => {
    if (renderedParts > 0) w.separator();
    renderedParts += 1;
  };

  for (const part of selectedParts(selection)) {
    if (part === "sop") {
      if (
        (pkg.sections?.length ?? 0) > 0 ||
        (pkg.steps?.length ?? 0) > 0
      ) {
        startPart();
        writeSop(w, pkg);
      } else if (noteMissing) {
        startPart();
        w.text("Not generated.", { color: GRAY });
      }
    } else if (part === "checklist") {
      if ((pkg.checklist?.length ?? 0) > 0) {
        startPart();
        writeChecklist(w, pkg);
      } else if (noteMissing) {
        startPart();
        w.heading1("Checklist");
        w.text("Not generated.", { color: GRAY });
      }
    } else if (part === "quick_guide") {
      if (pkg.quickGuide) {
        startPart();
        writeQuickGuide(w, pkg);
      } else if (noteMissing) {
        startPart();
        w.heading1("Quick Reference Guide");
        w.text("Not generated.", { color: GRAY });
      }
    } else if (part === "training_guide") {
      if (pkg.trainingGuide) {
        startPart();
        writeTrainingGuide(w, pkg);
      } else if (noteMissing) {
        startPart();
        w.heading1("Training Guide");
        w.text("Not generated.", { color: GRAY });
      }
    }
  }

  /* Approval / revision footer block ------------------------------------ */
  w.separator();
  w.text(`Revision: v${pkg.document.versionNumber} · ${approvalSummary(pkg)}`, {
    size: 8.5,
    color: GRAY,
  });
  w.text(generatedByLine(branding.workspaceName), {
    size: 8.5,
    color: GRAY,
  });

  /* Page-number footers (second pass) ------------------------------------ */
  const pages = pdfDoc.getPages();
  pages.forEach((page, i) => {
    const footer = sanitizeForWinAnsi(
      `${pkg.document.sopNumber} · v${pkg.document.versionNumber} · page ${i + 1} of ${pages.length}`,
    );
    page.drawText(footer, {
      x: MARGIN,
      y: 32,
      size: 8,
      font,
      color: GRAY,
    });
  });

  return pdfDoc.save();
}

/* ------------------------------------------------------------------ */
/* Package parts                                                       */
/* ------------------------------------------------------------------ */

function writeMarkdownContent(w: PdfWriter, markdown: string): void {
  for (const block of markdownToBlocks(markdown)) {
    if (block.kind === "heading") {
      w.text(block.text, { font: w.bold, size: 10.5, spaceAfter: 3 });
    } else if (block.kind === "bullet") {
      w.bullet(block.text);
    } else {
      w.body(block.text);
    }
  }
}

function writeReviewFlags(w: PdfWriter, reviewFlags: string[]): void {
  for (const flag of reviewFlags ?? []) {
    w.text(`(!) Review: ${humanize(flag)}`, {
      font: w.bold,
      size: 9,
      color: WARNING_COLOR,
      indent: 14,
      spaceAfter: 2,
    });
  }
}

function writeSop(w: PdfWriter, pkg: DocumentPackage): void {
  for (const section of pkg.sections ?? []) {
    w.heading2(section.title || humanize(section.type));
    if (section.content?.trim()) writeMarkdownContent(w, section.content);
    writeReviewFlags(w, section.reviewFlags);
  }
  const steps = pkg.steps ?? [];
  if (steps.length > 0) {
    w.heading1("Procedure");
    for (const step of steps) {
      w.heading3(`Step ${step.stepNumber} — ${step.title || "Untitled step"}`);
      if (step.instruction?.trim()) {
        w.label("Instruction", step.instruction.trim());
      }
      for (const detail of stepDetails(step)) {
        w.label(
          detail.label,
          detail.value,
          detail.label === "Warning" ? WARNING_COLOR : undefined,
        );
      }
      writeReviewFlags(w, step.reviewFlags);
      w.gap(4);
    }
  }
}

function writeChecklist(w: PdfWriter, pkg: DocumentPackage): void {
  w.heading1("Checklist");
  for (const group of groupChecklist(pkg.checklist)) {
    w.heading2(group.label);
    for (const item of group.items) {
      w.checkbox(item.text, item.isChecked);
    }
  }
}

function writeQuickGuide(w: PdfWriter, pkg: DocumentPackage): void {
  const guide = pkg.quickGuide;
  if (!guide) return;
  w.heading1("Quick Reference Guide");
  if (guide.objective) w.label("Objective", guide.objective, undefined, 0);
  if (guide.requiredTools?.length) {
    w.heading2("Required tools");
    for (const tool of guide.requiredTools) w.bullet(tool);
  }
  if (guide.keySteps?.length) {
    w.heading2("Key steps");
    guide.keySteps.forEach((step, i) => {
      w.label(`${i + 1}. ${step.title}`, step.summary ?? "");
    });
  }
  if (guide.warnings?.length) {
    w.heading2("Warnings");
    for (const warning of guide.warnings) {
      w.text(`(!) ${warning}`, {
        color: WARNING_COLOR,
        indent: 14,
        spaceAfter: 2,
      });
    }
  }
  if (guide.commonErrors?.length) {
    w.heading2("Common errors");
    for (const error of guide.commonErrors) w.bullet(error);
  }
  if (guide.escalationContact) {
    w.gap(4);
    w.label("Escalation contact", guide.escalationContact, undefined, 0);
  }
  if (guide.completionConfirmation) {
    w.label("Completion confirmation", guide.completionConfirmation, undefined, 0);
  }
}

function writeTrainingGuide(w: PdfWriter, pkg: DocumentPackage): void {
  const guide = pkg.trainingGuide;
  if (!guide) return;
  w.heading1("Training Guide");
  if (guide.learningObjective) {
    w.label("Learning objective", guide.learningObjective, undefined, 0);
  }
  if (guide.processOverview) {
    w.heading2("Process overview");
    w.body(guide.processOverview);
  }
  if (guide.keyTerminology?.length) {
    w.heading2("Key terminology");
    for (const entry of guide.keyTerminology) {
      w.label(entry.term, entry.definition);
    }
  }
  if (guide.walkthrough?.length) {
    w.heading2("Guided walkthrough");
    guide.walkthrough.forEach((item, i) => {
      w.text(`${i + 1}. ${item.step}`, {
        font: w.bold,
        indent: 14,
        spaceAfter: 1,
      });
      if (item.detail) w.body(item.detail, 28);
      if (item.whyItMatters) {
        w.text(`Why it matters: ${item.whyItMatters}`, {
          size: 9,
          color: GRAY,
          indent: 28,
          spaceAfter: 4,
        });
      }
    });
  }
  if (guide.practiceExercise) {
    w.heading2("Practice exercise");
    w.body(guide.practiceExercise);
  }
  if (guide.knowledgeChecks?.length) {
    w.heading2("Knowledge checks");
    guide.knowledgeChecks.forEach((check, i) => {
      w.label(`${i + 1}. Q`, check.question);
      w.label("A", check.answer, undefined, 28);
    });
  }
  if (guide.commonMistakes?.length) {
    w.heading2("Common mistakes");
    for (const mistake of guide.commonMistakes) w.bullet(mistake);
  }
  if (guide.supervisorReview) {
    w.gap(4);
    w.label("Supervisor review", guide.supervisorReview, undefined, 0);
  }
}
