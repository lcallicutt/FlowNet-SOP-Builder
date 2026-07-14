import { z } from "zod";
import { REVIEW_FLAGS } from "@/db/schema";

/**
 * Strict schemas for all structured AI output. Every AI response is validated
 * against these before anything is written to the database.
 */

export const reviewFlagSchema = z.enum(REVIEW_FLAGS);

export const sensitiveFindingSchema = z.object({
  kind: z.enum([
    "password",
    "api_key",
    "account_number",
    "protected_health_information",
    "personal_data",
    "other",
  ]),
  /** Where in the process it appeared — never the sensitive value itself. */
  context: z.string(),
});

export const decisionPointSchema = z.object({
  question: z.string().min(1),
  options: z
    .array(
      z.object({
        condition: z.string().min(1),
        action: z.string().min(1),
      }),
    )
    .min(1),
});

export const troubleshootingItemSchema = z.object({
  issue: z.string().min(1),
  resolution: z.string().min(1),
});

export const roleResponsibilitySchema = z.object({
  role: z.string().min(1),
  responsibility: z.string().min(1),
});

export const uncertaintySchema = z.object({
  area: z.string().min(1),
  flag: reviewFlagSchema,
  note: z.string().min(1),
});

/* ------------------------------------------------------------------ */
/* Process analysis (extraction)                                       */
/* ------------------------------------------------------------------ */

export const processAnalysisSchema = z.object({
  objective: z.string().min(1),
  trigger: z.string().min(1),
  prerequisites: z.array(z.string()),
  requiredTools: z.array(z.string()),
  requiredPermissions: z.array(z.string()),
  inputs: z.array(z.string()),
  actions: z.array(
    z.object({
      description: z.string().min(1),
      detail: z.string().optional().nullable(),
      videoTimestampSeconds: z.number().min(0).optional().nullable(),
    }),
  ),
  decisions: z.array(decisionPointSchema),
  warnings: z.array(z.string()),
  commonMistakes: z.array(z.string()),
  qualityChecks: z.array(z.string()),
  expectedOutputs: z.array(z.string()),
  completionCriteria: z.array(z.string()),
  exceptions: z.array(z.string()),
  troubleshooting: z.array(troubleshootingItemSchema),
  roles: z.array(roleResponsibilitySchema),
  followUpActions: z.array(z.string()),
  uncertainties: z.array(uncertaintySchema),
  sensitiveFindings: z.array(sensitiveFindingSchema),
});
export type ProcessAnalysis = z.infer<typeof processAnalysisSchema>;

/* ------------------------------------------------------------------ */
/* SOP generation                                                      */
/* ------------------------------------------------------------------ */

export const sopStepSchema = z.object({
  title: z.string().min(1),
  instruction: z.string().min(1),
  expectedResult: z.string().optional().nullable(),
  warning: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  qualityCheckpoint: z.string().optional().nullable(),
  videoTimestampSeconds: z.number().min(0).optional().nullable(),
  reviewFlags: z.array(reviewFlagSchema).default([]),
});

export const sopGenerationSchema = z.object({
  title: z.string().min(1),
  purpose: z.string().min(1),
  scope: z.string().min(1),
  intendedAudience: z.string().min(1),
  definitions: z.array(
    z.object({ term: z.string().min(1), definition: z.string().min(1) }),
  ),
  requiredTools: z.array(z.string()),
  requiredAccess: z.array(z.string()),
  prerequisites: z.array(z.string()),
  roles: z.array(roleResponsibilitySchema),
  steps: z.array(sopStepSchema).min(1),
  decisionPoints: z.array(decisionPointSchema),
  qualityControls: z.array(z.string()),
  troubleshooting: z.array(troubleshootingItemSchema),
  risksAndWarnings: z.array(z.string()),
  completionCriteria: z.array(z.string()),
  relatedDocuments: z.array(z.string()),
});
export type SopGeneration = z.infer<typeof sopGenerationSchema>;

/* ------------------------------------------------------------------ */
/* Checklist                                                           */
/* ------------------------------------------------------------------ */

export const checklistGenerationSchema = z.object({
  items: z
    .array(
      z.object({
        category: z.enum([
          "pre_process",
          "action",
          "decision",
          "quality",
          "completion",
          "sign_off",
        ]),
        text: z.string().min(1),
      }),
    )
    .min(1),
});
export type ChecklistGeneration = z.infer<typeof checklistGenerationSchema>;

/* ------------------------------------------------------------------ */
/* Quick-reference guide                                               */
/* ------------------------------------------------------------------ */

export const quickGuideGenerationSchema = z.object({
  objective: z.string().min(1),
  requiredTools: z.array(z.string()),
  keySteps: z
    .array(z.object({ title: z.string().min(1), summary: z.string().min(1) }))
    .min(1),
  warnings: z.array(z.string()),
  commonErrors: z.array(z.string()),
  escalationContact: z.string(),
  completionConfirmation: z.string(),
});
export type QuickGuideGeneration = z.infer<typeof quickGuideGenerationSchema>;

/* ------------------------------------------------------------------ */
/* Training guide                                                      */
/* ------------------------------------------------------------------ */

export const trainingGuideGenerationSchema = z.object({
  learningObjective: z.string().min(1),
  processOverview: z.string().min(1),
  keyTerminology: z.array(
    z.object({ term: z.string().min(1), definition: z.string().min(1) }),
  ),
  walkthrough: z
    .array(
      z.object({
        step: z.string().min(1),
        detail: z.string().min(1),
        whyItMatters: z.string().min(1),
      }),
    )
    .min(1),
  practiceExercise: z.string().min(1),
  knowledgeChecks: z
    .array(
      z.object({ question: z.string().min(1), answer: z.string().min(1) }),
    )
    .min(1),
  commonMistakes: z.array(z.string()),
  supervisorReview: z.string().min(1),
});
export type TrainingGuideGeneration = z.infer<
  typeof trainingGuideGenerationSchema
>;

/* ------------------------------------------------------------------ */
/* Transcript cleanup                                                  */
/* ------------------------------------------------------------------ */

export const transcriptCleanupSchema = z.object({
  /** Only segments whose text actually changed. */
  corrections: z.array(
    z.object({
      segmentIndex: z.number().int().min(0),
      text: z.string().min(1),
    }),
  ),
});
export type TranscriptCleanup = z.infer<typeof transcriptCleanupSchema>;

/* ------------------------------------------------------------------ */
/* Document revision                                                   */
/* ------------------------------------------------------------------ */

export const documentRevisionSchema = z.object({
  revised: z.string().min(1),
  changeSummary: z.string().min(1),
});
export type DocumentRevision = z.infer<typeof documentRevisionSchema>;

/** The full generated package persisted after a successful pipeline run. */
export const sopPackageSchema = z.object({
  analysis: processAnalysisSchema,
  sop: sopGenerationSchema,
  checklist: checklistGenerationSchema,
  quickGuide: quickGuideGenerationSchema,
  trainingGuide: trainingGuideGenerationSchema,
});
export type SopPackage = z.infer<typeof sopPackageSchema>;
