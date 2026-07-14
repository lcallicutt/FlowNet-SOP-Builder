import type {
  DocumentPackage,
  SopChecklistItem,
  SopSection,
  SopStep,
} from "@/lib/documents";
import type {
  QuickGuideContent,
  ReviewFlag,
  TrainingGuideContent,
} from "@/db/schema";

export type {
  DocumentPackage,
  SopChecklistItem,
  SopSection,
  SopStep,
  QuickGuideContent,
  ReviewFlag,
  TrainingGuideContent,
};

/** Plan feature booleans the editor UI gates on. */
export type EditorFeatures = {
  versionHistory: boolean;
  sharedLinks: boolean;
  approvalWorkflow: boolean;
  docxExport: boolean;
  allDocumentTypes: boolean;
};

export type EditorRole = "owner" | "admin" | "editor" | "viewer";

/** Client-safe copy of the role ranking from src/lib/auth.ts. */
const ROLE_RANK: Record<EditorRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

export function roleAtLeast(role: EditorRole, min: EditorRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export const SECTION_TYPES = [
  "purpose",
  "scope",
  "intended_audience",
  "definitions",
  "required_tools",
  "required_access",
  "prerequisites",
  "roles_responsibilities",
  "decision_points",
  "quality_control",
  "troubleshooting",
  "risks_warnings",
  "completion_criteria",
  "related_documents",
  "custom",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const CHECKLIST_CATEGORIES = [
  { value: "pre_process", label: "Pre-process checks" },
  { value: "action", label: "Action items" },
  { value: "decision", label: "Decision checks" },
  { value: "quality", label: "Quality checks" },
  { value: "completion", label: "Completion checks" },
  { value: "sign_off", label: "Sign-off" },
] as const;
export type ChecklistCategory = (typeof CHECKLIST_CATEGORIES)[number]["value"];

export const DOCUMENT_STATUSES = [
  "draft",
  "in_review",
  "approved",
  "published",
  "archived",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** Mirrors the discriminated union accepted by PATCH .../content. */
export type ContentOperation =
  | { op: "update_section"; sectionId: string; title?: string; content?: string }
  | { op: "add_section"; type?: SectionType; title: string; content?: string }
  | { op: "delete_section"; sectionId: string }
  | { op: "reorder_sections"; orderedIds: string[] }
  | { op: "resolve_section_flags"; sectionId: string }
  | {
      op: "update_step";
      stepId: string;
      title?: string;
      instruction?: string;
      expectedResult?: string | null;
      warning?: string | null;
      note?: string | null;
      qualityCheckpoint?: string | null;
      videoTimestampSeconds?: number | null;
    }
  | { op: "add_step"; afterStepId?: string | null; title: string; instruction?: string }
  | { op: "delete_step"; stepId: string }
  | { op: "reorder_steps"; orderedIds: string[] }
  | { op: "resolve_step_flags"; stepId: string }
  | {
      op: "update_checklist_item";
      itemId: string;
      text?: string;
      category?: ChecklistCategory;
      isChecked?: boolean;
    }
  | { op: "add_checklist_item"; category: ChecklistCategory; text: string }
  | { op: "delete_checklist_item"; itemId: string }
  | { op: "reorder_checklist"; orderedIds: string[] }
  | { op: "update_quick_guide"; content: QuickGuideContent }
  | { op: "update_training_guide"; content: TrainingGuideContent };

/** "needs_confirmation" → "Needs confirmation". */
export function humanizeFlag(flag: string): string {
  const words = flag.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "roles_responsibilities" → "Roles responsibilities". */
export function humanizeToken(token: string): string {
  return humanizeFlag(token);
}
