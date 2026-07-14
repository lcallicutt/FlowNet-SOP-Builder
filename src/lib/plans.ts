/**
 * Centralized plan configuration.
 *
 * All pricing, limits, and feature gating live here — never hard-code plan
 * limits or prices elsewhere in the application. Stripe price IDs come from
 * the environment so test/live modes can differ per deployment.
 */

export type PlanId = "starter" | "professional" | "business";

export type PlanFeatures = {
  /** Monthly transcription allowance, in minutes. */
  transcriptionMinutesPerMonth: number;
  /** Maximum members per workspace (including the owner). */
  maxWorkspaceMembers: number;
  /** Maximum upload size in bytes. */
  maxUploadBytes: number;
  /** Maximum single-recording duration in minutes. */
  maxRecordingMinutes: number;
  /** Document types beyond the core SOP. */
  allDocumentTypes: boolean;
  pdfExport: boolean;
  docxExport: boolean;
  versionHistory: boolean;
  sharedLinks: boolean;
  approvalWorkflow: boolean;
  workspaceBranding: boolean;
  advancedPermissions: boolean;
  priorityProcessing: boolean;
};

export type PlanDefinition = {
  id: PlanId;
  name: string;
  description: string;
  monthlyPriceUsd: number;
  /** env var name that holds the Stripe price id (null = free tier). */
  stripePriceEnvVar: string | null;
  features: PlanFeatures;
  /** Marketing bullet points, in display order. */
  highlights: string[];
};

const MB = 1024 * 1024;

export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    description: "For solo operators documenting their first processes.",
    monthlyPriceUsd: 0,
    stripePriceEnvVar: null,
    features: {
      transcriptionMinutesPerMonth: 30,
      maxWorkspaceMembers: 1,
      maxUploadBytes: 500 * MB,
      maxRecordingMinutes: 30,
      allDocumentTypes: false,
      pdfExport: true,
      docxExport: false,
      versionHistory: false,
      sharedLinks: false,
      approvalWorkflow: false,
      workspaceBranding: false,
      advancedPermissions: false,
      priorityProcessing: false,
    },
    highlights: [
      "30 transcription minutes / month",
      "1 user",
      "SOP generation",
      "PDF export",
    ],
  },
  professional: {
    id: "professional",
    name: "Professional",
    description: "For teams turning tribal knowledge into a real SOP library.",
    monthlyPriceUsd: 49,
    stripePriceEnvVar: "STRIPE_PRICE_PROFESSIONAL_MONTHLY",
    features: {
      transcriptionMinutesPerMonth: 300,
      maxWorkspaceMembers: 10,
      maxUploadBytes: 2048 * MB,
      maxRecordingMinutes: 90,
      allDocumentTypes: true,
      pdfExport: true,
      docxExport: true,
      versionHistory: true,
      sharedLinks: true,
      approvalWorkflow: false,
      workspaceBranding: false,
      advancedPermissions: false,
      priorityProcessing: false,
    },
    highlights: [
      "300 transcription minutes / month",
      "Up to 10 users",
      "All document types (SOP, checklist, quick guide, training guide)",
      "DOCX export",
      "Version history",
      "Shared links",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    description: "For organizations that need governance and scale.",
    monthlyPriceUsd: 149,
    stripePriceEnvVar: "STRIPE_PRICE_BUSINESS_MONTHLY",
    features: {
      transcriptionMinutesPerMonth: 1200,
      maxWorkspaceMembers: 50,
      maxUploadBytes: 5120 * MB,
      maxRecordingMinutes: 180,
      allDocumentTypes: true,
      pdfExport: true,
      docxExport: true,
      versionHistory: true,
      sharedLinks: true,
      approvalWorkflow: true,
      workspaceBranding: true,
      advancedPermissions: true,
      priorityProcessing: true,
    },
    highlights: [
      "1,200 transcription minutes / month",
      "Up to 50 users",
      "Approval workflows",
      "Workspace branding on exports",
      "Advanced permissions",
      "Priority processing",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["starter", "professional", "business"];

export function getPlan(id: PlanId): PlanDefinition {
  return PLANS[id];
}

export function getStripePriceId(id: PlanId): string | null {
  const envVar = PLANS[id].stripePriceEnvVar;
  if (!envVar) return null;
  return process.env[envVar] ?? null;
}

export function planForStripePriceId(priceId: string): PlanId | null {
  for (const id of PLAN_ORDER) {
    if (getStripePriceId(id) === priceId) return id;
  }
  return null;
}
