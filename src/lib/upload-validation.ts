import { z } from "zod";
import { PLANS, type PlanId } from "@/lib/plans";

/**
 * Upload validation shared by the client (pre-flight UX) and the server
 * (authoritative enforcement). The server must always re-validate.
 */

export const SUPPORTED_VIDEO_TYPES: Record<string, string[]> = {
  "video/mp4": [".mp4", ".m4v"],
  "video/quicktime": [".mov"],
  "video/webm": [".webm"],
  "video/x-m4v": [".m4v"],
};

export const SUPPORTED_AUDIO_TYPES: Record<string, string[]> = {
  "audio/mpeg": [".mp3"],
  "audio/mp3": [".mp3"],
  "audio/wav": [".wav"],
  "audio/x-wav": [".wav"],
  "audio/mp4": [".m4a"],
  "audio/x-m4a": [".m4a"],
};

export const SUPPORTED_CONTENT_TYPES = {
  ...SUPPORTED_VIDEO_TYPES,
  ...SUPPORTED_AUDIO_TYPES,
};

export const SUPPORTED_EXTENSIONS = Array.from(
  new Set(Object.values(SUPPORTED_CONTENT_TYPES).flat()),
);

export type UploadValidationError =
  | { code: "unsupported_type"; message: string }
  | { code: "file_too_large"; message: string }
  | { code: "duration_too_long"; message: string }
  | { code: "limit_reached"; message: string };

export function fileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx).toLowerCase();
}

export function isSupportedFile(fileName: string, contentType: string): boolean {
  const ext = fileExtension(fileName);
  if (contentType in SUPPORTED_CONTENT_TYPES) {
    return SUPPORTED_CONTENT_TYPES[contentType].includes(ext);
  }
  // Some browsers send generic types (e.g. application/octet-stream for .m4a);
  // fall back to the extension allowlist.
  return SUPPORTED_EXTENSIONS.includes(ext);
}

export function isAudioFile(fileName: string, contentType: string): boolean {
  if (contentType in SUPPORTED_AUDIO_TYPES) return true;
  const ext = fileExtension(fileName);
  return Object.values(SUPPORTED_AUDIO_TYPES).some((exts) =>
    exts.includes(ext),
  );
}

export function validateUpload(params: {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  durationSeconds?: number;
  plan: PlanId;
  usedTranscriptionMinutesThisPeriod: number;
}): UploadValidationError | null {
  const features = PLANS[params.plan].features;

  if (!isSupportedFile(params.fileName, params.contentType)) {
    return {
      code: "unsupported_type",
      message: `That file type isn't supported. Upload one of: ${SUPPORTED_EXTENSIONS.join(", ")}.`,
    };
  }

  if (params.sizeBytes <= 0 || params.sizeBytes > features.maxUploadBytes) {
    const maxMb = Math.round(features.maxUploadBytes / (1024 * 1024));
    return {
      code: "file_too_large",
      message: `This file exceeds your plan's ${maxMb} MB upload limit. Trim the recording or upgrade your plan.`,
    };
  }

  if (
    params.durationSeconds !== undefined &&
    params.durationSeconds > features.maxRecordingMinutes * 60
  ) {
    return {
      code: "duration_too_long",
      message: `Recordings on your plan can be up to ${features.maxRecordingMinutes} minutes. Split the video into shorter parts or upgrade.`,
    };
  }

  const remaining =
    features.transcriptionMinutesPerMonth -
    params.usedTranscriptionMinutesThisPeriod;
  if (remaining <= 0) {
    return {
      code: "limit_reached",
      message:
        "You've used all of this month's transcription minutes. Upgrade your plan or wait for your allowance to reset.",
    };
  }

  return null;
}

/** Metadata collected by the upload form. */
export const uploadFormSchema = z.object({
  title: z.string().trim().min(1, "Give the project a title.").max(200),
  department: z.string().trim().max(120).optional().or(z.literal("")),
  processCategory: z.string().trim().max(120).optional().or(z.literal("")),
  processOwner: z.string().trim().max(120).optional().or(z.literal("")),
  intendedAudience: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  companyTerminology: z.string().trim().max(4000).optional().or(z.literal("")),
  detailLevel: z.enum(["concise", "standard", "detailed", "training_level"]),
  language: z.string().trim().min(2).max(12).default("en"),
});

export type UploadFormValues = z.infer<typeof uploadFormSchema>;
