import { toFile } from "openai";
import { openai, TRANSCRIPTION_MODEL } from "@/lib/ai/client";

/**
 * Speech-to-text via the OpenAI transcription API.
 *
 * Large recordings are split into chunks upstream (see lib/media.ts); each
 * chunk is transcribed independently and merged here with its time offset so
 * segment timestamps stay correct relative to the original recording.
 */

export type TranscribedSegment = {
  startSeconds: number;
  endSeconds: number;
  text: string;
};

export type TranscriptionResult = {
  language: string | null;
  durationSeconds: number;
  segments: TranscribedSegment[];
};

export async function transcribeAudioChunk(params: {
  audio: Buffer;
  fileName: string;
  language?: string;
  /** Offset of this chunk within the full recording, in seconds. */
  offsetSeconds: number;
}): Promise<TranscriptionResult> {
  const client = openai();

  const response = await client.audio.transcriptions.create({
    model: TRANSCRIPTION_MODEL,
    file: await toFile(params.audio, params.fileName),
    response_format: "verbose_json",
    ...(params.language && params.language !== "auto"
      ? { language: params.language }
      : {}),
    timestamp_granularities: ["segment"],
  });

  const verbose = response as unknown as {
    language?: string;
    duration?: number;
    text: string;
    segments?: { start: number; end: number; text: string }[];
  };

  const segments: TranscribedSegment[] = (verbose.segments ?? []).map((s) => ({
    startSeconds: s.start + params.offsetSeconds,
    endSeconds: s.end + params.offsetSeconds,
    text: s.text.trim(),
  }));

  // Fallback when the model returns no segment detail.
  if (segments.length === 0 && verbose.text?.trim()) {
    segments.push({
      startSeconds: params.offsetSeconds,
      endSeconds: params.offsetSeconds + (verbose.duration ?? 0),
      text: verbose.text.trim(),
    });
  }

  return {
    language: verbose.language ?? null,
    durationSeconds: verbose.duration ?? 0,
    segments,
  };
}

/** Merge chunk results in order; chunks must be passed sorted by offset. */
export function mergeTranscriptions(
  chunks: TranscriptionResult[],
): TranscriptionResult {
  return {
    language: chunks.find((c) => c.language)?.language ?? null,
    durationSeconds: chunks.reduce((sum, c) => sum + c.durationSeconds, 0),
    segments: chunks
      .flatMap((c) => c.segments)
      .filter((s) => s.text.length > 0)
      .sort((a, b) => a.startSeconds - b.startSeconds),
  };
}
