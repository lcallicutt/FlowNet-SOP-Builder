/**
 * Shared system instruction for process-document generation, plus helpers
 * for composing user prompts. Each AI service keeps its own focused prompt —
 * behavior is deliberately NOT concentrated in one oversized prompt.
 */

export const OPERATIONS_ANALYST_SYSTEM = `You are an operations analyst, technical writer, trainer, and quality-assurance specialist. Convert process demonstrations into accurate, repeatable business documentation. Separate actions from commentary. Identify prerequisites, decisions, risks, expected results, quality controls, exceptions, and completion criteria. Do not invent missing information. Clearly label uncertainty and request human confirmation where needed. Use direct, professional language. Write each procedure step so a trained employee can perform it without watching the original video.

Additional rules that always apply:
- Distinguish instructional steps from casual conversation, repetition, filler language, introductions, and unrelated comments. Only actions belong in procedures.
- When information is missing, uncertain, contradictory, or inferred rather than stated, attach the appropriate review flag instead of inventing details. Available flags: needs_confirmation, inferred_from_recording, missing_information, potential_security_concern, unclear_responsibility, unclear_completion_criteria.
- If the recording exposes likely passwords, API keys, account numbers, protected health information, or other sensitive values: never reproduce the sensitive value. Refer to it generically (e.g. "the account password stored in the team password manager") and flag the step with potential_security_concern.`;

export type ProjectContext = {
  title: string;
  department?: string | null;
  processCategory?: string | null;
  processOwner?: string | null;
  intendedAudience?: string | null;
  description?: string | null;
  companyTerminology?: string | null;
  detailLevel: "concise" | "standard" | "detailed" | "training_level";
  language: string;
};

export function describeProjectContext(ctx: ProjectContext): string {
  const lines = [
    `Project title: ${ctx.title}`,
    ctx.department ? `Department: ${ctx.department}` : null,
    ctx.processCategory ? `Process category: ${ctx.processCategory}` : null,
    ctx.processOwner ? `Process owner: ${ctx.processOwner}` : null,
    ctx.intendedAudience ? `Intended audience: ${ctx.intendedAudience}` : null,
    ctx.description ? `Process description provided by the uploader: ${ctx.description}` : null,
    ctx.companyTerminology
      ? `Company terminology to use verbatim where relevant: ${ctx.companyTerminology}`
      : null,
    `Desired level of detail: ${ctx.detailLevel.replace("_", " ")}`,
    `Write the documentation in language code: ${ctx.language}`,
  ].filter(Boolean);
  return lines.join("\n");
}

export function formatTranscriptForPrompt(
  segments: { startSeconds: number; endSeconds: number; text: string; speaker?: string | null }[],
): string {
  return segments
    .map((s) => {
      const start = Math.round(s.startSeconds);
      const speaker = s.speaker ? `${s.speaker}: ` : "";
      return `[${start}s] ${speaker}${s.text}`;
    })
    .join("\n");
}
