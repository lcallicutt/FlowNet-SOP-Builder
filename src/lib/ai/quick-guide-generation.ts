import {
  quickGuideGenerationSchema,
  type QuickGuideGeneration,
  type SopGeneration,
} from "./schemas";
import { callStructured } from "./structured";
import { OPERATIONS_ANALYST_SYSTEM } from "./prompts";

/**
 * Quick-reference guide service: a one-page simplification of the SOP for
 * operators who already know the process.
 */
export async function generateQuickGuide(params: {
  sop: SopGeneration;
}): Promise<QuickGuideGeneration> {
  return callStructured(quickGuideGenerationSchema, {
    system: OPERATIONS_ANALYST_SYSTEM,
    user: `Create a quick-reference guide from this SOP. Key steps should compress the procedure to its 5-10 most important moves. escalationContact should name the role to escalate to (from the SOP's roles) — if no escalation role is identifiable, say "Process owner". completionConfirmation is one sentence describing how the operator confirms the process finished correctly.

SOP:
${JSON.stringify(params.sop, null, 2)}`,
    schemaInstructions: `The JSON object must have exactly: objective (string), requiredTools (string[]), keySteps (non-empty array of {title: string, summary: string}), warnings (string[]), commonErrors (string[]), escalationContact (string), completionConfirmation (string).`,
  });
}
