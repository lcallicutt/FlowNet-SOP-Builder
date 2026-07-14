import type { SopPackage } from "@/lib/ai/schemas";

/** A minimal but fully valid generated SOP package. */
export function validSopPackage(): SopPackage {
  return {
    analysis: {
      objective: "Issue a customer refund correctly.",
      trigger: "A customer requests a refund.",
      prerequisites: ["Access to the billing portal"],
      requiredTools: ["Billing portal"],
      requiredPermissions: ["Billing admin role"],
      inputs: ["Customer email", "Order ID"],
      actions: [
        { description: "Open the billing portal", videoTimestampSeconds: 2 },
        { description: "Verify the customer account", videoTimestampSeconds: 6 },
        { description: "Issue the refund", videoTimestampSeconds: 12 },
      ],
      decisions: [
        {
          question: "Is the purchase within 30 days?",
          options: [
            { condition: "yes", action: "Issue a full refund" },
            { condition: "no", action: "Escalate to a manager" },
          ],
        },
      ],
      warnings: ["Refunds over $500 need manager approval"],
      commonMistakes: ["Refunding the wrong invoice"],
      qualityChecks: ["Confirm the refund appears in the ledger"],
      expectedOutputs: ["Refund issued and logged"],
      completionCriteria: ["Customer notified"],
      exceptions: ["Disputed charges follow the chargeback process"],
      troubleshooting: [
        { issue: "Refund button disabled", resolution: "Check payment status is settled" },
      ],
      roles: [{ role: "Support agent", responsibility: "Processes the refund" }],
      followUpActions: ["Log the interaction in the CRM"],
      uncertainties: [
        {
          area: "Refund limit",
          flag: "needs_confirmation",
          note: "The $500 limit was implied but not stated.",
        },
      ],
      sensitiveFindings: [],
    },
    sop: {
      title: "Customer Refund Processing",
      purpose: "Process refunds consistently and safely.",
      scope: "All standard product refunds.",
      intendedAudience: "Support agents",
      definitions: [{ term: "Ledger", definition: "The financial record system." }],
      requiredTools: ["Billing portal"],
      requiredAccess: ["Billing admin role"],
      prerequisites: ["Customer identity verified"],
      roles: [{ role: "Support agent", responsibility: "Processes the refund" }],
      steps: [
        {
          title: "Open the billing portal",
          instruction: "Sign in to the billing portal with your work account.",
          expectedResult: "The billing dashboard is visible.",
          warning: null,
          note: null,
          qualityCheckpoint: null,
          videoTimestampSeconds: 2,
          reviewFlags: [],
        },
        {
          title: "Issue the refund",
          instruction: "Locate the order and click Refund, then confirm.",
          expectedResult: "A refund confirmation appears.",
          warning: "Refunds over $500 need manager approval.",
          note: null,
          qualityCheckpoint: "Confirm the refund appears in the ledger.",
          videoTimestampSeconds: 12,
          reviewFlags: ["needs_confirmation"],
        },
      ],
      decisionPoints: [
        {
          question: "Is the purchase within 30 days?",
          options: [
            { condition: "yes", action: "Issue a full refund" },
            { condition: "no", action: "Escalate to a manager" },
          ],
        },
      ],
      qualityControls: ["Ledger entry verified"],
      troubleshooting: [
        { issue: "Refund button disabled", resolution: "Check payment status" },
      ],
      risksAndWarnings: ["Double refunds harm revenue"],
      completionCriteria: ["Customer notified", "Ledger updated"],
      relatedDocuments: ["Chargeback SOP"],
    },
    checklist: {
      items: [
        { category: "pre_process", text: "Verify customer identity" },
        { category: "action", text: "Issue the refund in the billing portal" },
        { category: "quality", text: "Confirm ledger entry" },
        { category: "completion", text: "Notify the customer" },
        { category: "sign_off", text: "Agent sign-off" },
      ],
    },
    quickGuide: {
      objective: "Refund a customer quickly and safely.",
      requiredTools: ["Billing portal"],
      keySteps: [
        { title: "Verify", summary: "Confirm identity and order." },
        { title: "Refund", summary: "Issue and confirm the refund." },
      ],
      warnings: ["Over $500 needs approval"],
      commonErrors: ["Wrong invoice selected"],
      escalationContact: "Support team lead",
      completionConfirmation: "Refund visible in ledger and customer notified.",
    },
    trainingGuide: {
      learningObjective: "Learn to process refunds end to end.",
      processOverview: "Refunds flow from request to ledger confirmation.",
      keyTerminology: [{ term: "Ledger", definition: "Financial record system." }],
      walkthrough: [
        {
          step: "Open the billing portal",
          detail: "Sign in and locate the customer.",
          whyItMatters: "Starting from the right account prevents wrong refunds.",
        },
      ],
      practiceExercise: "Process a refund in the sandbox environment.",
      knowledgeChecks: [
        {
          question: "When is manager approval required?",
          answer: "For refunds over $500.",
        },
      ],
      commonMistakes: ["Skipping ledger verification"],
      supervisorReview: "Verify a supervised refund was completed correctly.",
    },
  };
}
