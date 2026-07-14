import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  approvals,
  checklistItems,
  documentSections,
  documentVersions,
  procedureSteps,
  quickGuides,
  sopDocuments,
  trainingGuides,
  type QuickGuideContent,
  type TrainingGuideContent,
} from "@/db/schema";

/**
 * Assembled, denormalized view of a full SOP package. This is the shared
 * contract used by the editor payloads, version snapshots, exports, and the
 * public share page.
 */
export type SopSection = {
  id: string;
  type: string;
  title: string;
  content: string;
  position: number;
  reviewFlags: string[];
};

export type SopStep = {
  id: string;
  stepNumber: number;
  title: string;
  instruction: string;
  expectedResult: string | null;
  warning: string | null;
  note: string | null;
  qualityCheckpoint: string | null;
  videoTimestampSeconds: number | null;
  reviewFlags: string[];
  position: number;
};

export type SopChecklistItem = {
  id: string;
  category: string;
  text: string;
  isChecked: boolean;
  position: number;
};

export type DocumentPackage = {
  document: {
    id: string;
    workspaceId: string;
    projectId: string | null;
    sopNumber: string;
    title: string;
    status: string;
    versionNumber: number;
    department: string | null;
    processCategory: string | null;
    processOwner: string | null;
    intendedAudience: string | null;
    tags: string[];
    reviewDate: string | null;
    createdAt: string;
    updatedAt: string;
  };
  sections: SopSection[];
  steps: SopStep[];
  checklist: SopChecklistItem[];
  quickGuide: QuickGuideContent | null;
  trainingGuide: TrainingGuideContent | null;
  latestApproval: {
    status: string;
    reviewerName: string | null;
    comments: string | null;
    decidedAt: string | null;
  } | null;
};

export async function loadDocumentPackage(
  sopDocumentId: string,
): Promise<DocumentPackage | null> {
  const doc = await db.query.sopDocuments.findFirst({
    where: eq(sopDocuments.id, sopDocumentId),
  });
  if (!doc || doc.deletedAt) return null;

  const [sections, steps, checklist, quickGuide, trainingGuide, approvalRows] =
    await Promise.all([
      db.query.documentSections.findMany({
        where: eq(documentSections.sopDocumentId, sopDocumentId),
        orderBy: [asc(documentSections.position)],
      }),
      db.query.procedureSteps.findMany({
        where: eq(procedureSteps.sopDocumentId, sopDocumentId),
        orderBy: [asc(procedureSteps.position)],
      }),
      db.query.checklistItems.findMany({
        where: eq(checklistItems.sopDocumentId, sopDocumentId),
        orderBy: [asc(checklistItems.position)],
      }),
      db.query.quickGuides.findFirst({
        where: eq(quickGuides.sopDocumentId, sopDocumentId),
      }),
      db.query.trainingGuides.findFirst({
        where: eq(trainingGuides.sopDocumentId, sopDocumentId),
      }),
      db.query.approvals.findMany({
        where: eq(approvals.sopDocumentId, sopDocumentId),
        orderBy: [asc(approvals.createdAt)],
        with: { reviewer: true },
      }),
    ]);

  const latest = approvalRows.at(-1);

  return {
    document: {
      id: doc.id,
      workspaceId: doc.workspaceId,
      projectId: doc.projectId,
      sopNumber: doc.sopNumber,
      title: doc.title,
      status: doc.status,
      versionNumber: doc.versionNumber,
      department: doc.department,
      processCategory: doc.processCategory,
      processOwner: doc.processOwner,
      intendedAudience: doc.intendedAudience,
      tags: doc.tags ?? [],
      reviewDate: doc.reviewDate?.toISOString() ?? null,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    },
    sections: sections.map((s) => ({
      id: s.id,
      type: s.type,
      title: s.title,
      content: s.content,
      position: s.position,
      reviewFlags: s.reviewFlags ?? [],
    })),
    steps: steps.map((s) => ({
      id: s.id,
      stepNumber: s.stepNumber,
      title: s.title,
      instruction: s.instruction,
      expectedResult: s.expectedResult,
      warning: s.warning,
      note: s.note,
      qualityCheckpoint: s.qualityCheckpoint,
      videoTimestampSeconds: s.videoTimestampSeconds,
      reviewFlags: s.reviewFlags ?? [],
      position: s.position,
    })),
    checklist: checklist.map((c) => ({
      id: c.id,
      category: c.category,
      text: c.text,
      isChecked: c.isChecked,
      position: c.position,
    })),
    quickGuide: quickGuide?.content ?? null,
    trainingGuide: trainingGuide?.content ?? null,
    latestApproval: latest
      ? {
          status: latest.status,
          reviewerName: latest.reviewer?.name ?? latest.reviewer?.email ?? null,
          comments: latest.comments,
          decidedAt: latest.decidedAt?.toISOString() ?? null,
        }
      : null,
  };
}

/**
 * Snapshot the current package as an immutable version row and bump the
 * document's version number.
 */
export async function createDocumentVersion(params: {
  sopDocumentId: string;
  workspaceId: string;
  createdByUserId: string;
  revisionNotes?: string;
}): Promise<{ versionNumber: number } | null> {
  const pkg = await loadDocumentPackage(params.sopDocumentId);
  if (!pkg) return null;

  const nextVersion = pkg.document.versionNumber + 1;

  await db.insert(documentVersions).values({
    workspaceId: params.workspaceId,
    sopDocumentId: params.sopDocumentId,
    versionNumber: pkg.document.versionNumber,
    snapshot: pkg as unknown as Record<string, unknown>,
    revisionNotes: params.revisionNotes ?? null,
    createdByUserId: params.createdByUserId,
  });

  await db
    .update(sopDocuments)
    .set({ versionNumber: nextVersion })
    .where(eq(sopDocuments.id, params.sopDocumentId));

  return { versionNumber: nextVersion };
}

/** Assign the next SOP number for a workspace, e.g. SOP-007. */
export function formatSopNumber(counter: number): string {
  return `SOP-${String(counter).padStart(3, "0")}`;
}
