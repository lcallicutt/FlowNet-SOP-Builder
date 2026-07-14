import { transcriptCleanupSchema, type TranscriptCleanup } from "./schemas";
import { callStructured } from "./structured";

/**
 * Transcript cleanup service: fixes obvious speech-to-text errors,
 * punctuation, and product/tool names without changing meaning or timing.
 * Segments stay aligned so timestamps remain valid.
 */
export async function cleanupTranscript(params: {
  segments: { segmentIndex: number; text: string }[];
  companyTerminology?: string | null;
}): Promise<TranscriptCleanup> {
  const segmentBlock = params.segments
    .map((s) => `${s.segmentIndex}: ${s.text}`)
    .join("\n");

  return callStructured(transcriptCleanupSchema, {
    system:
      "You are a careful transcription editor. You fix speech-to-text mistakes, capitalization, punctuation, and misheard product or tool names. You never paraphrase, summarize, reorder, merge, or split segments, and you never change what the speaker meant.",
    user: `${
      params.companyTerminology
        ? `Company terminology that may have been misheard (correct toward these spellings when clearly intended): ${params.companyTerminology}\n\n`
        : ""
    }Transcript segments (index: text):\n${segmentBlock}\n\nReturn corrections ONLY for segments that need changes. Keep every correction aligned to its original segment index.`,
    schemaInstructions: `The JSON object must be: {"corrections": [{"segmentIndex": number, "text": string}, ...]}. Include only segments whose text you changed. If nothing needs correction, return {"corrections": []}.`,
    temperature: 0,
  });
}
