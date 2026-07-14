import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  checklistGenerationSchema,
  processAnalysisSchema,
  sopGenerationSchema,
  sopPackageSchema,
} from "@/lib/ai/schemas";
import { validSopPackage } from "./helpers/fixtures";

const createMock = vi.fn();
vi.mock("@/lib/ai/client", () => ({
  openai: () => ({
    chat: { completions: { create: createMock } },
  }),
  GENERATION_MODEL: "test-model",
  TRANSCRIPTION_MODEL: "test-transcribe",
}));

describe("AI schema validation", () => {
  it("accepts a fully valid package", () => {
    expect(sopPackageSchema.safeParse(validSopPackage()).success).toBe(true);
  });

  it("rejects a SOP with no steps", () => {
    const pkg = validSopPackage();
    pkg.sop.steps = [];
    expect(sopGenerationSchema.safeParse(pkg.sop).success).toBe(false);
  });

  it("rejects unknown review flags", () => {
    const pkg = validSopPackage();
    // @ts-expect-error deliberately invalid flag
    pkg.sop.steps[0].reviewFlags = ["made_up_flag"];
    expect(sopGenerationSchema.safeParse(pkg.sop).success).toBe(false);
  });

  it("rejects checklist items with invalid categories", () => {
    const result = checklistGenerationSchema.safeParse({
      items: [{ category: "nonsense", text: "Do the thing" }],
    });
    expect(result.success).toBe(false);
  });

  it("requires sensitive findings to describe context, never values", () => {
    const analysis = validSopPackage().analysis;
    analysis.sensitiveFindings = [
      { kind: "password", context: "Spoken while logging into the admin panel" },
    ];
    expect(processAnalysisSchema.safeParse(analysis).success).toBe(true);
  });
});

describe("structured output repair", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("returns validated data on the first attempt", async () => {
    const { callStructured } = await import("@/lib/ai/structured");
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ items: [{ category: "action", text: "Do it" }] }) } }],
    });
    const result = await callStructured(checklistGenerationSchema, {
      system: "s",
      user: "u",
      schemaInstructions: "i",
    });
    expect(result.items[0].text).toBe("Do it");
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("makes exactly one repair attempt and succeeds", async () => {
    const { callStructured } = await import("@/lib/ai/structured");
    createMock
      .mockResolvedValueOnce({
        choices: [{ message: { content: '{"items": [{"category": "bogus", "text": "x"}]}' } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: '{"items": [{"category": "action", "text": "x"}]}' } }],
      });
    const result = await callStructured(checklistGenerationSchema, {
      system: "s",
      user: "u",
      schemaInstructions: "i",
    });
    expect(result.items[0].category).toBe("action");
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("throws AiValidationError after a failed repair and never returns bad data", async () => {
    const { callStructured, AiValidationError } = await import("@/lib/ai/structured");
    createMock
      .mockResolvedValueOnce({ choices: [{ message: { content: "not json at all" } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: '{"wrong": true}' } }] });
    await expect(
      callStructured(checklistGenerationSchema, {
        system: "s",
        user: "u",
        schemaInstructions: "i",
      }),
    ).rejects.toBeInstanceOf(AiValidationError);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("unwraps fenced JSON", async () => {
    const { callStructured } = await import("@/lib/ai/structured");
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: '```json\n{"items": [{"category": "quality", "text": "check"}]}\n```',
          },
        },
      ],
    });
    const result = await callStructured(checklistGenerationSchema, {
      system: "s",
      user: "u",
      schemaInstructions: "i",
    });
    expect(result.items[0].category).toBe("quality");
  });
});
