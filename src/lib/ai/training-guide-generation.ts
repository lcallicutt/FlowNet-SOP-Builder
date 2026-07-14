import {
  trainingGuideGenerationSchema,
  type ProcessAnalysis,
  type SopGeneration,
  type TrainingGuideGeneration,
} from "./schemas";
import { callStructured } from "./structured";
import { OPERATIONS_ANALYST_SYSTEM } from "./prompts";

/**
 * Training-guide service: converts the SOP + analysis into learning-oriented
 * documentation with rationale, practice, and knowledge checks.
 */
export async function generateTrainingGuide(params: {
  sop: SopGeneration;
  analysis: ProcessAnalysis;
}): Promise<TrainingGuideGeneration> {
  return callStructured(trainingGuideGenerationSchema, {
    system: OPERATIONS_ANALYST_SYSTEM,
    user: `Create training documentation for a new employee learning this process. The walkthrough should follow the SOP's major steps; "whyItMatters" must explain the operational reason each major step exists (use the analysis's warnings, quality checks, and expected outputs). The practice exercise must be safely executable (use test data or a sandbox where the process touches real customer data or money). Knowledge checks should test understanding of decisions, risks, and completion criteria — not trivia.

SOP:
${JSON.stringify(params.sop, null, 2)}

PROCESS ANALYSIS (for rationale):
${JSON.stringify(
      {
        warnings: params.analysis.warnings,
        commonMistakes: params.analysis.commonMistakes,
        qualityChecks: params.analysis.qualityChecks,
        expectedOutputs: params.analysis.expectedOutputs,
        exceptions: params.analysis.exceptions,
      },
      null,
      2,
    )}`,
    schemaInstructions: `The JSON object must have exactly: learningObjective (string), processOverview (string), keyTerminology (array of {term, definition}), walkthrough (non-empty array of {step: string, detail: string, whyItMatters: string}), practiceExercise (string), knowledgeChecks (non-empty array of {question: string, answer: string}), commonMistakes (string[]), supervisorReview (string describing what a supervisor should verify before signing off the trainee).`,
    maxOutputTokens: 8192,
  });
}
