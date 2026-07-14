import { documentRevisionSchema, type DocumentRevision } from "./schemas";
import { callStructured } from "./structured";
import { OPERATIONS_ANALYST_SYSTEM } from "./prompts";

/**
 * Document revision service: applies a user's natural-language instruction to
 * a single section or step. Scoped small on purpose — bulk regeneration goes
 * through the full pipeline instead.
 */
export async function reviseText(params: {
  kind: "section" | "step_instruction";
  currentText: string;
  instruction: string;
  documentTitle: string;
}): Promise<DocumentRevision> {
  return callStructured(documentRevisionSchema, {
    system: OPERATIONS_ANALYST_SYSTEM,
    user: `Document: "${params.documentTitle}" — revise the following ${
      params.kind === "section" ? "section content" : "procedure step instruction"
    } according to the editor's instruction. Preserve factual content; do not invent process details that are not present or clearly implied. Keep markdown formatting when present.

CURRENT TEXT:
${params.currentText}

EDITOR'S INSTRUCTION:
${params.instruction}`,
    schemaInstructions: `The JSON object must be: {"revised": string, "changeSummary": string (one sentence describing what changed)}.`,
  });
}
