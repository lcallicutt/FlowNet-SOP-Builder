import {
  sopGenerationSchema,
  type ProcessAnalysis,
  type SopGeneration,
} from "./schemas";
import { callStructured } from "./structured";
import {
  OPERATIONS_ANALYST_SYSTEM,
  describeProjectContext,
  type ProjectContext,
} from "./prompts";

/**
 * SOP generation service: writes the full Standard Operating Procedure from
 * the structured process analysis.
 */
export async function generateSop(params: {
  context: ProjectContext;
  analysis: ProcessAnalysis;
}): Promise<SopGeneration> {
  const detailGuidance: Record<ProjectContext["detailLevel"], string> = {
    concise:
      "Keep instructions tight — one to two sentences per step. Skip background explanation.",
    standard:
      "Write complete, self-sufficient instructions with expected results for meaningful steps.",
    detailed:
      "Write thorough instructions including exact UI locations, field values, and expected results for every step.",
    training_level:
      "Write for someone performing the process for the first time: explain context, exact locations, what success looks like, and why steps matter.",
  };

  return callStructured(sopGenerationSchema, {
    system: OPERATIONS_ANALYST_SYSTEM,
    user: `${describeProjectContext(params.context)}

Using the structured process analysis below, write a complete Standard Operating Procedure. ${detailGuidance[params.context.detailLevel]}

Carry every uncertainty from the analysis onto the relevant step or leave it in place via reviewFlags — do not resolve uncertainty by inventing specifics. Preserve videoTimestampSeconds on steps derived from timestamped actions. Never include sensitive values; reference credential stores generically and flag those steps with potential_security_concern.

PROCESS ANALYSIS:
${JSON.stringify(params.analysis, null, 2)}`,
    schemaInstructions: `The JSON object must have exactly these keys: title (string), purpose (string), scope (string), intendedAudience (string), definitions (array of {term, definition}), requiredTools (string[]), requiredAccess (string[]), prerequisites (string[]), roles (array of {role, responsibility}), steps (non-empty array of {title: string, instruction: string, expectedResult?: string, warning?: string, note?: string, qualityCheckpoint?: string, videoTimestampSeconds?: number, reviewFlags: array of flag strings}), decisionPoints (array of {question, options: [{condition, action}]}), qualityControls (string[]), troubleshooting (array of {issue, resolution}), risksAndWarnings (string[]), completionCriteria (string[]), relatedDocuments (string[]). Valid review flags: needs_confirmation, inferred_from_recording, missing_information, potential_security_concern, unclear_responsibility, unclear_completion_criteria. Use empty arrays where nothing applies.`,
    maxOutputTokens: 8192,
  });
}
