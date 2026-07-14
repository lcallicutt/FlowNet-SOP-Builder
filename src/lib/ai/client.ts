import OpenAI from "openai";

let _openai: OpenAI | null = null;

export function openai(): OpenAI {
  if (_openai) return _openai;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  _openai = new OpenAI({ apiKey });
  return _openai;
}

export const GENERATION_MODEL =
  process.env.OPENAI_GENERATION_MODEL ?? "gpt-4o-2024-08-06";

export const TRANSCRIPTION_MODEL =
  process.env.OPENAI_TRANSCRIPTION_MODEL ?? "whisper-1";
