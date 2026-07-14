import { processAnalysisSchema, type ProcessAnalysis } from "./schemas";
import { callStructured } from "./structured";
import {
  OPERATIONS_ANALYST_SYSTEM,
  describeProjectContext,
  formatTranscriptForPrompt,
  type ProjectContext,
} from "./prompts";

/**
 * Process extraction service: turns the reviewed transcript into a
 * structured analysis of the demonstrated process. This is analysis, not
 * document writing — the SOP/checklist/guide generators consume its output.
 */
export async function extractProcess(params: {
  context: ProjectContext;
  segments: {
    startSeconds: number;
    endSeconds: number;
    text: string;
    speaker?: string | null;
  }[];
}): Promise<ProcessAnalysis> {
  return callStructured(processAnalysisSchema, {
    system: OPERATIONS_ANALYST_SYSTEM,
    user: `${describeProjectContext(params.context)}

Analyze the following timestamped transcript of a process demonstration. Identify and classify the process objective, trigger/starting condition, prerequisites, required tools, required credentials or permissions, input data, actions performed (with the video timestamp in seconds where each action begins), decisions and their conditional branches, warnings, common mistakes, quality-control checks, expected outputs, completion criteria, exceptions, troubleshooting steps, roles and responsibilities, and follow-up actions.

Ignore introductions, small talk, filler, repeated attempts, and commentary that is not part of the repeatable process. Record every uncertainty, gap, contradiction, or inference in "uncertainties" with the appropriate flag rather than guessing. Record any likely sensitive values (passwords, API keys, account numbers, health information) in "sensitiveFindings" — describe where they appeared, never the value itself.

TRANSCRIPT:
${formatTranscriptForPrompt(params.segments)}`,
    schemaInstructions: `The JSON object must have exactly these keys: objective (string), trigger (string), prerequisites (string[]), requiredTools (string[]), requiredPermissions (string[]), inputs (string[]), actions (array of {description: string, detail?: string, videoTimestampSeconds?: number}), decisions (array of {question: string, options: [{condition: string, action: string}]}), warnings (string[]), commonMistakes (string[]), qualityChecks (string[]), expectedOutputs (string[]), completionCriteria (string[]), exceptions (string[]), troubleshooting (array of {issue: string, resolution: string}), roles (array of {role: string, responsibility: string}), followUpActions (string[]), uncertainties (array of {area: string, flag: one of needs_confirmation|inferred_from_recording|missing_information|potential_security_concern|unclear_responsibility|unclear_completion_criteria, note: string}), sensitiveFindings (array of {kind: one of password|api_key|account_number|protected_health_information|personal_data|other, context: string}). Use empty arrays when a category has no entries.`,
    maxOutputTokens: 8192,
  });
}
