import type { z } from "zod";
import { openai, GENERATION_MODEL } from "./client";

/**
 * Structured-output helper shared by all AI services.
 *
 * Calls the model in JSON mode, validates against the given Zod schema, and
 * on validation failure makes exactly one repair attempt (feeding the
 * validation errors back to the model). If the repair also fails, throws
 * AiValidationError — callers must NOT persist anything in that case.
 */

export class AiValidationError extends Error {
  constructor(
    message: string,
    public issues: string[],
    public rawResponse: string,
  ) {
    super(message);
  }
}

export type StructuredCallOptions = {
  system: string;
  user: string;
  /** Extra guidance describing the exact JSON shape expected. */
  schemaInstructions: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

function extractJson(text: string): string {
  // Models occasionally wrap JSON in fences even in JSON mode.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

export async function callStructured<S extends z.ZodTypeAny>(
  schema: S,
  options: StructuredCallOptions,
): Promise<z.infer<S>> {
  const client = openai();
  const model = options.model ?? GENERATION_MODEL;

  const baseMessages = [
    {
      role: "system" as const,
      content: `${options.system}\n\nRespond with a single JSON object only. ${options.schemaInstructions}`,
    },
    { role: "user" as const, content: options.user },
  ];

  const first = await client.chat.completions.create({
    model,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxOutputTokens ?? 8192,
    response_format: { type: "json_object" },
    messages: baseMessages,
  });

  const firstText = first.choices[0]?.message?.content ?? "";
  const firstResult = tryParse(schema, firstText);
  if (firstResult.ok) return firstResult.data;

  // One structured repair attempt.
  const repair = await client.chat.completions.create({
    model,
    temperature: 0,
    max_tokens: options.maxOutputTokens ?? 8192,
    response_format: { type: "json_object" },
    messages: [
      ...baseMessages,
      { role: "assistant" as const, content: firstText },
      {
        role: "user" as const,
        content: `Your previous response failed validation with these errors:\n${firstResult.issues.join(
          "\n",
        )}\n\nReturn the corrected JSON object. Fix only the structural problems; do not change content that was valid. Respond with JSON only.`,
      },
    ],
  });

  const repairText = repair.choices[0]?.message?.content ?? "";
  const repairResult = tryParse(schema, repairText);
  if (repairResult.ok) return repairResult.data;

  throw new AiValidationError(
    "AI response failed schema validation after one repair attempt.",
    repairResult.issues,
    repairText,
  );
}

function tryParse<S extends z.ZodTypeAny>(
  schema: S,
  text: string,
): { ok: true; data: z.infer<S> } | { ok: false; issues: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch (e) {
    return {
      ok: false,
      issues: [`Response was not valid JSON: ${(e as Error).message}`],
    };
  }
  const result = schema.safeParse(parsed);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    issues: result.error.issues.map(
      (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
    ),
  };
}
