/** Output file formats supported by the export engine. */
export type ExportFormat = "pdf" | "docx" | "markdown" | "text";

/** Which part of the document package to export. */
export type ExportSelection =
  | "sop"
  | "checklist"
  | "quick_guide"
  | "training_guide"
  | "full_package";

/**
 * Workspace branding applied to exports. Logo images are out of scope for
 * now, but the shape is designed so binary assets can be added later.
 */
export type ExportBranding = {
  workspaceName: string;
  /** Hex color like "#1F2A44"; renderers fall back to house style when absent. */
  brandColor?: string | null;
  /** Reserved for future logo embedding in PDF/DOCX headers. */
  logoBytes?: Uint8Array;
};

export type ExportResult = {
  bytes: Uint8Array;
  contentType: string;
  fileName: string;
};
