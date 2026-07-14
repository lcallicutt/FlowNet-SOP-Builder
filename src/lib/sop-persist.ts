import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  checklistItems,
  documentSections,
  procedureSteps,
  projects,
  quickGuides,
  sopDocuments,
  trainingGuides,
  workspaces,
  type ReviewFlag,
} from "@/db/schema";
import { sopPackageSchema, type SopPackage } from "@/lib/ai/schemas";
import { formatSopNumber } from "@/lib/documents";
import { recordAudit } from "@/lib/audit";

/**
 * Persist a validated AI-generated SOP package as editable database rows.
 * The package MUST have passed sopPackageSchema validation — this function
 * re-validates as a final gate and throws (persisting nothing) on failure.
 */
export async function persistSopPackage(params: {
  workspaceId: string;
  projectId: string;
  createdByUserId: string;
  pkg: SopPackage;
  projectMeta: {
    department?: string | null;
    processCategory?: string | null;
    processOwner?: string | null;
    intendedAudience?: string | null;
  };
}): Promise<{ sopDocumentId: string; sopNumber: string }> {
  const parsed = sopPackageSchema.safeParse(params.pkg);
  if (!parsed.success) {
    throw new Error(
      `Refusing to persist malformed SOP package: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  const pkg = parsed.data;

  // Reserve the next SOP number atomically on the workspace counter.
  const [ws] = await db
    .update(workspaces)
    .set({ sopCounter: sql`${workspaces.sopCounter} + 1` })
    .where(eq(workspaces.id, params.workspaceId))
    .returning({ counter: workspaces.sopCounter });
  const sopNumber = formatSopNumber(ws.counter);

  const reviewDate = new Date();
  reviewDate.setMonth(reviewDate.getMonth() + 6);

  const [doc] = await db
    .insert(sopDocuments)
    .values({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      sopNumber,
      title: pkg.sop.title,
      status: "draft",
      versionNumber: 1,
      department: params.projectMeta.department ?? null,
      processCategory: params.projectMeta.processCategory ?? null,
      processOwner: params.projectMeta.processOwner ?? null,
      intendedAudience:
        pkg.sop.intendedAudience || params.projectMeta.intendedAudience || null,
      reviewDate,
      createdByUserId: params.createdByUserId,
    })
    .returning();

  const mdList = (items: string[]) => items.map((i) => `- ${i}`).join("\n");

  type SectionSeed = {
    type: (typeof documentSections.$inferInsert)["type"];
    title: string;
    content: string;
    reviewFlags?: ReviewFlag[];
  };

  const sections: SectionSeed[] = [
    { type: "purpose", title: "Purpose", content: pkg.sop.purpose },
    { type: "scope", title: "Scope", content: pkg.sop.scope },
    {
      type: "intended_audience",
      title: "Intended Audience",
      content: pkg.sop.intendedAudience,
    },
    {
      type: "definitions",
      title: "Definitions",
      content: pkg.sop.definitions
        .map((d) => `**${d.term}** — ${d.definition}`)
        .join("\n\n"),
    },
    {
      type: "required_tools",
      title: "Required Tools and Systems",
      content: mdList(pkg.sop.requiredTools),
    },
    {
      type: "required_access",
      title: "Required Access and Permissions",
      content: mdList(pkg.sop.requiredAccess),
    },
    {
      type: "prerequisites",
      title: "Prerequisites",
      content: mdList(pkg.sop.prerequisites),
    },
    {
      type: "roles_responsibilities",
      title: "Roles and Responsibilities",
      content: pkg.sop.roles
        .map((r) => `**${r.role}** — ${r.responsibility}`)
        .join("\n\n"),
    },
    {
      type: "decision_points",
      title: "Decision Points",
      content: pkg.sop.decisionPoints
        .map(
          (d) =>
            `**${d.question}**\n${d.options
              .map((o) => `- If ${o.condition}: ${o.action}`)
              .join("\n")}`,
        )
        .join("\n\n"),
    },
    {
      type: "quality_control",
      title: "Quality-Control Checks",
      content: mdList(pkg.sop.qualityControls),
    },
    {
      type: "troubleshooting",
      title: "Troubleshooting",
      content: pkg.sop.troubleshooting
        .map((t) => `**${t.issue}**\n${t.resolution}`)
        .join("\n\n"),
    },
    {
      type: "risks_warnings",
      title: "Risks and Warnings",
      content: mdList(pkg.sop.risksAndWarnings),
    },
    {
      type: "completion_criteria",
      title: "Completion Criteria",
      content: mdList(pkg.sop.completionCriteria),
    },
    {
      type: "related_documents",
      title: "Related Documents",
      content: mdList(pkg.sop.relatedDocuments),
    },
  ];

  // Surface analysis-level uncertainties and sensitive findings for review.
  if (pkg.analysis.uncertainties.length > 0) {
    sections.push({
      type: "custom",
      title: "Open Questions for Review",
      content: pkg.analysis.uncertainties
        .map((u) => `- **${u.area}** (${u.flag.replace(/_/g, " ")}): ${u.note}`)
        .join("\n"),
      reviewFlags: Array.from(
        new Set(pkg.analysis.uncertainties.map((u) => u.flag)),
      ),
    });
  }
  if (pkg.analysis.sensitiveFindings.length > 0) {
    sections.push({
      type: "custom",
      title: "Sensitive Information Notices",
      content: pkg.analysis.sensitiveFindings
        .map(
          (f) =>
            `- A likely ${f.kind.replace(/_/g, " ")} appeared in the recording (${f.context}). The value was NOT stored. Reference it via your credential store.`,
        )
        .join("\n"),
      reviewFlags: ["potential_security_concern"],
    });
  }

  await db.insert(documentSections).values(
    sections
      .filter((s) => s.content.trim().length > 0)
      .map((s, i) => ({
        workspaceId: params.workspaceId,
        sopDocumentId: doc.id,
        type: s.type,
        title: s.title,
        content: s.content,
        position: i,
        reviewFlags: s.reviewFlags ?? [],
      })),
  );

  await db.insert(procedureSteps).values(
    pkg.sop.steps.map((s, i) => ({
      workspaceId: params.workspaceId,
      sopDocumentId: doc.id,
      stepNumber: i + 1,
      title: s.title,
      instruction: s.instruction,
      expectedResult: s.expectedResult ?? null,
      warning: s.warning ?? null,
      note: s.note ?? null,
      qualityCheckpoint: s.qualityCheckpoint ?? null,
      videoTimestampSeconds: s.videoTimestampSeconds ?? null,
      reviewFlags: s.reviewFlags ?? [],
      position: i,
    })),
  );

  await db.insert(checklistItems).values(
    pkg.checklist.items.map((c, i) => ({
      workspaceId: params.workspaceId,
      sopDocumentId: doc.id,
      category: c.category,
      text: c.text,
      position: i,
    })),
  );

  await db.insert(quickGuides).values({
    workspaceId: params.workspaceId,
    sopDocumentId: doc.id,
    content: pkg.quickGuide,
  });

  await db.insert(trainingGuides).values({
    workspaceId: params.workspaceId,
    sopDocumentId: doc.id,
    content: pkg.trainingGuide,
  });

  await db
    .update(projects)
    .set({ status: "ready_for_review", progressPercent: 100, errorMessage: null })
    .where(eq(projects.id, params.projectId));

  await recordAudit({
    workspaceId: params.workspaceId,
    actorUserId: params.createdByUserId,
    action: "document.generated",
    entityType: "sop_document",
    entityId: doc.id,
    metadata: { sopNumber, projectId: params.projectId },
  });

  return { sopDocumentId: doc.id, sopNumber };
}
