/**
 * Shared client-side types and fetch helpers for the project processing /
 * transcript review screens.
 */

export type ProjectStatus =
  | "uploaded"
  | "extracting_audio"
  | "transcribing"
  | "transcript_ready"
  | "analyzing_process"
  | "generating_documentation"
  | "ready_for_review"
  | "published"
  | "failed";

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

export type Project = {
  id: string;
  title: string;
  status: ProjectStatus;
  progressPercent: number;
  errorMessage: string | null;
  detailLevel: "concise" | "standard" | "detailed" | "training_level";
  language: string;
  sourceType: "upload" | "loom_url";
  loomUrl: string | null;
  createdAt: string;
};

export type ProjectResponse = {
  project: Project;
  documentId: string | null;
};

export type TranscriptSegment = {
  id: string;
  index: number;
  startSeconds: number;
  endSeconds: number;
  speaker: string | null;
  text: string;
};

export type TranscriptMeta = {
  id: string;
  status: "processing" | "ready" | "edited" | "failed";
  language: string | null;
  durationSeconds: number | null;
  wordCount: number | null;
};

export type TranscriptResponse = {
  transcript: TranscriptMeta;
  segments: TranscriptSegment[];
};

export type VideoUrlResponse = {
  url: string;
  contentType: string;
  fileName: string;
};

/** Statuses during which we poll the project endpoint. */
export const PROCESSING_STATUSES: readonly ProjectStatus[] = [
  "uploaded",
  "extracting_audio",
  "transcribing",
  "analyzing_process",
  "generating_documentation",
];

export function isProcessingStatus(status: ProjectStatus): boolean {
  return PROCESSING_STATUSES.includes(status);
}

/** Statuses at which a transcript is expected to exist. */
export function hasTranscriptStatus(status: ProjectStatus): boolean {
  return (
    status === "transcript_ready" ||
    status === "analyzing_process" ||
    status === "generating_documentation" ||
    status === "ready_for_review" ||
    status === "published"
  );
}

const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

/** Client-side mirror of roleAtLeast (the server helper pulls in the db). */
export function canEdit(role: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.editor;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ErrorBody = { error?: { message?: string; code?: string } };

/**
 * Fetch JSON from an internal API route. Throws ApiError with the body's
 * error message/code when the response is not ok.
 */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON body (e.g. empty); fall through.
  }
  if (!res.ok) {
    const err = (body ?? {}) as ErrorBody;
    throw new ApiError(
      err.error?.message ?? "Something went wrong. Please try again.",
      res.status,
      err.error?.code,
    );
  }
  return body as T;
}
