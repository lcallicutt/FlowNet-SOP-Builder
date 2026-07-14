import {
  checklistGenerationSchema,
  type ChecklistGeneration,
  type SopGeneration,
} from "./schemas";
import { callStructured } from "./structured";
import { OPERATIONS_ANALYST_SYSTEM } from "./prompts";

/**
 * Checklist generation service: condenses the SOP into an operational
 * checklist an experienced operator can run through.
 */
export async function generateChecklist(params: {
  sop: SopGeneration;
}): Promise<ChecklistGeneration> {
  return callStructured(checklistGenerationSchema, {
    system: OPERATIONS_ANALYST_SYSTEM,
    user: `Condense the following SOP into a concise operational checklist. Group items as: pre_process (prerequisites and setup checks), action (the core steps, one item per meaningful action, imperative voice), decision (checks at decision points), quality (quality-control verifications), completion (confirmation the outcome was achieved), and exactly one sign_off item at the end for the operator's sign-off. Each item must be a single actionable line.

SOP:
${JSON.stringify(
      {
        title: params.sop.title,
        prerequisites: params.sop.prerequisites,
        requiredTools: params.sop.requiredTools,
        requiredAccess: params.sop.requiredAccess,
        steps: params.sop.steps.map((s) => ({
          title: s.title,
          instruction: s.instruction,
          qualityCheckpoint: s.qualityCheckpoint,
        })),
        decisionPoints: params.sop.decisionPoints,
        qualityControls: params.sop.qualityControls,
        completionCriteria: params.sop.completionCriteria,
      },
      null,
      2,
    )}`,
    schemaInstructions: `The JSON object must be: {"items": [{"category": one of pre_process|action|decision|quality|completion|sign_off, "text": string}, ...]} with at least one item and exactly one sign_off item as the final entry.`,
  });
}
