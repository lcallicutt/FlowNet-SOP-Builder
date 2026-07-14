import type { DocumentPackage } from "@/lib/documents";
import type {
  ExportBranding,
  ExportFormat,
  ExportResult,
  ExportSelection,
} from "./types";
import { renderMarkdown } from "./markdown";
import { renderPlainText } from "./text";
import { renderDocx } from "./docx";
import { renderPdf } from "./pdf";
import { slugify } from "./shared";

export type {
  ExportBranding,
  ExportFormat,
  ExportResult,
  ExportSelection,
} from "./types";
export { renderMarkdown } from "./markdown";
export { renderPlainText } from "./text";
export { renderDocx } from "./docx";
export { renderPdf } from "./pdf";

const FORMAT_META: Record<ExportFormat, { ext: string; contentType: string }> = {
  pdf: { ext: "pdf", contentType: "application/pdf" },
  docx: {
    ext: "docx",
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  markdown: { ext: "md", contentType: "text/markdown" },
  text: { ext: "txt", contentType: "text/plain" },
};

export function extensionForFormat(format: ExportFormat): string {
  return FORMAT_META[format].ext;
}

export function contentTypeForFormat(format: ExportFormat): string {
  return FORMAT_META[format].contentType;
}

/**
 * Render an export in the requested format. Plan-based authorization of
 * formats is enforced by the API route, not here.
 */
export async function renderExport(
  pkg: DocumentPackage,
  format: ExportFormat,
  selection: ExportSelection,
  branding: ExportBranding,
): Promise<ExportResult> {
  let bytes: Uint8Array;
  switch (format) {
    case "pdf":
      bytes = await renderPdf(pkg, selection, branding);
      break;
    case "docx":
      bytes = await renderDocx(pkg, selection, branding);
      break;
    case "markdown":
      bytes = new TextEncoder().encode(renderMarkdown(pkg, selection, branding));
      break;
    case "text":
      bytes = new TextEncoder().encode(renderPlainText(pkg, selection, branding));
      break;
  }

  const { ext, contentType } = FORMAT_META[format];
  const fileName = `${pkg.document.sopNumber}-${slugify(pkg.document.title)}-${selection}.${ext}`;
  return { bytes, contentType, fileName };
}
