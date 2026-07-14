/**
 * Manual smoke check for the export renderers.
 * Run: pnpm exec tsx src/lib/exports/__smoke__.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DocumentPackage } from "@/lib/documents";
import {
  renderExport,
  type ExportFormat,
  type ExportSelection,
} from "./index";

const pkg: DocumentPackage = {
  document: {
    id: "doc-1",
    workspaceId: "ws-1",
    projectId: "proj-1",
    sopNumber: "SOP-014",
    title: "Customer Refund Processing — Stripe & QuickBooks",
    status: "in_review",
    versionNumber: 3,
    department: "Finance",
    processCategory: "Billing",
    processOwner: "Dana Whitfield",
    intendedAudience: "Finance associates",
    tags: ["refunds", "stripe"],
    reviewDate: "2026-10-01T00:00:00.000Z",
    createdAt: "2026-05-02T14:30:00.000Z",
    updatedAt: "2026-07-10T09:15:00.000Z",
  },
  sections: [
    {
      id: "sec-1",
      type: "purpose",
      title: "Purpose",
      content:
        "Ensure **all customer refunds** are processed within *2 business days* using `Stripe` and QuickBooks.\n\n- Applies to card payments\n- Applies to ACH payments",
      position: 0,
      reviewFlags: [],
    },
    {
      id: "sec-2",
      type: "risks_warnings",
      title: "Risks & Warnings",
      content: "Refunds over $500 require manager approval → see escalation matrix.",
      position: 1,
      reviewFlags: ["needs_confirmation", "potential_security_concern"],
    },
  ],
  steps: [
    {
      id: "step-1",
      stepNumber: 1,
      title: "Locate the payment in Stripe",
      instruction:
        "Open the Stripe dashboard and search for the customer's email — use “exact match” quotes.",
      expectedResult: "The original charge appears with a Succeeded badge.",
      warning: null,
      note: "If multiple charges match, verify the amount and date first.",
      qualityCheckpoint: null,
      videoTimestampSeconds: 65,
      reviewFlags: [],
      position: 0,
    },
    {
      id: "step-2",
      stepNumber: 2,
      title: "Issue the refund",
      instruction: "Click Refund, enter the amount, and confirm.",
      expectedResult: "Stripe shows the refund as Pending → Succeeded.",
      warning: "Never refund more than the original charge amount.",
      note: null,
      qualityCheckpoint: "Refund amount matches the approved request ticket.",
      videoTimestampSeconds: 154.7,
      reviewFlags: ["inferred_from_recording"],
      position: 1,
    },
  ],
  checklist: [
    {
      id: "chk-1",
      category: "pre_process",
      text: "Confirm the refund request ticket is approved",
      isChecked: false,
      position: 0,
    },
    {
      id: "chk-2",
      category: "action",
      text: "Issue refund in Stripe ☐ and record ID",
      isChecked: true,
      position: 1,
    },
    {
      id: "chk-3",
      category: "sign_off",
      text: "Manager sign-off recorded in the ticket",
      isChecked: false,
      position: 2,
    },
  ],
  quickGuide: {
    objective: "Process a standard customer refund end-to-end.",
    requiredTools: ["Stripe dashboard access", "QuickBooks Online"],
    keySteps: [
      { title: "Find charge", summary: "Search by customer email in Stripe." },
      { title: "Refund", summary: "Issue the refund and note the refund ID." },
    ],
    warnings: ["Refunds over $500 need manager approval."],
    commonErrors: ["Refunding the wrong charge when a customer has duplicates."],
    escalationContact: "finance-leads@example.com",
    completionConfirmation: "Refund ID recorded in the ticket and books balanced.",
  },
  trainingGuide: {
    learningObjective: "New associates can process refunds unsupervised.",
    processOverview: "Refunds flow from ticket approval → Stripe → QuickBooks.",
    keyTerminology: [
      { term: "Charge", definition: "The original payment record in Stripe." },
    ],
    walkthrough: [
      {
        step: "Find the charge",
        detail: "Use the customer email from the ticket.",
        whyItMatters: "Refunding the wrong charge creates accounting drift.",
      },
    ],
    practiceExercise: "Process a $10 refund in the Stripe test environment.",
    knowledgeChecks: [
      {
        question: "What is the approval threshold for manager sign-off?",
        answer: "$500.",
      },
    ],
    commonMistakes: ["Forgetting to record the refund ID in the ticket."],
    supervisorReview: "Supervisor reviews the first five refunds processed.",
  },
  latestApproval: {
    status: "approved",
    reviewerName: "Priya Natarajan",
    comments: "Looks good.",
    decidedAt: "2026-07-09T16:00:00.000Z",
  },
};

// Sparse package: missing guides, empty checklist, no approval.
const sparsePkg: DocumentPackage = {
  ...pkg,
  sections: [],
  steps: [],
  checklist: [],
  quickGuide: null,
  trainingGuide: null,
  latestApproval: null,
};

const branding = { workspaceName: "Acme Operations", brandColor: "#1F4E79" };
const outDir = process.env.SMOKE_OUT_DIR ?? null;

async function main() {
  const formats: ExportFormat[] = ["markdown", "text", "docx", "pdf"];
  const selections: ExportSelection[] = [
    "sop",
    "checklist",
    "quick_guide",
    "training_guide",
    "full_package",
  ];

  if (outDir) mkdirSync(outDir, { recursive: true });

  for (const format of formats) {
    for (const selection of selections) {
      const result = await renderExport(pkg, format, selection, branding);
      if (result.bytes.length === 0) {
        throw new Error(`Empty output for ${format}/${selection}`);
      }
      console.log(
        `${format.padEnd(8)} ${selection.padEnd(15)} ${String(result.bytes.length).padStart(7)} bytes  ${result.fileName}`,
      );
      if (outDir && selection === "full_package") {
        writeFileSync(join(outDir, result.fileName), result.bytes);
      }
    }
    // Sparse package must not throw and must note missing content.
    const sparse = await renderExport(sparsePkg, format, "training_guide", {
      workspaceName: "",
      brandColor: null,
    });
    if (sparse.bytes.length === 0) {
      throw new Error(`Empty sparse output for ${format}`);
    }
    console.log(`${format.padEnd(8)} sparse/training  ${String(sparse.bytes.length).padStart(6)} bytes`);
    const sparseFull = await renderExport(sparsePkg, format, "full_package", {
      workspaceName: "Acme",
    });
    if (sparseFull.bytes.length === 0) {
      throw new Error(`Empty sparse full_package output for ${format}`);
    }
  }

  // Markdown sanity checks
  const md = new TextDecoder().decode(
    (await renderExport(pkg, "markdown", "full_package", branding)).bytes,
  );
  for (const expected of [
    "# Customer Refund Processing",
    "| SOP Number | SOP-014 |",
    "### Step 1. Locate the payment in Stripe",
    "**Source timestamp:** 1:05",
    "**Source timestamp:** 2:34",
    "> ⚠ Review: Needs confirmation",
    "- [ ] Confirm the refund request ticket is approved",
    "- [x] Issue refund in Stripe",
    "### Pre-process checks",
    "### Sign-off",
    "## Quick Reference Guide",
    "## Training Guide",
    "Generated by FlowNet SOP Builder for Acme Operations",
  ]) {
    if (!md.includes(expected)) {
      throw new Error(`Markdown output missing: ${expected}`);
    }
  }

  const sparseMd = new TextDecoder().decode(
    (await renderExport(sparsePkg, "markdown", "quick_guide", branding)).bytes,
  );
  if (!sparseMd.includes("Not generated")) {
    throw new Error("Sparse quick_guide markdown missing 'Not generated'");
  }
  const sparseFullMd = new TextDecoder().decode(
    (await renderExport(sparsePkg, "markdown", "full_package", branding)).bytes,
  );
  if (sparseFullMd.includes("Not generated")) {
    throw new Error("Sparse full_package markdown should omit 'Not generated'");
  }

  console.log("\nAll export renderers passed the smoke check.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
