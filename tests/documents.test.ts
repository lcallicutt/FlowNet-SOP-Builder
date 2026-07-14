import { describe, expect, it, beforeEach } from "vitest";
import { asc, eq } from "drizzle-orm";
import { signInAs, signOut } from "./setup";
import {
  createTestProject,
  createTestUser,
  createTestWorkspace,
  getTestDb,
  resetTestDb,
} from "./helpers/db";
import { jsonRequest, params } from "./helpers/request";
import { persistSopPackage } from "@/lib/sop-persist";
import { validSopPackage } from "./helpers/fixtures";
import * as schema from "@/db/schema";

async function seedDocument(plan: "starter" | "professional" | "business" = "professional") {
  const user = await createTestUser();
  const ws = await createTestWorkspace({ ownerId: user.id, plan });
  const project = await createTestProject({
    workspaceId: ws.id,
    createdByUserId: user.id,
  });
  const { sopDocumentId, sopNumber } = await persistSopPackage({
    workspaceId: ws.id,
    projectId: project.id,
    createdByUserId: user.id,
    pkg: validSopPackage(),
    projectMeta: { department: "Support" },
  });
  return { user, ws, project, sopDocumentId, sopNumber };
}

describe("SOP creation (persistSopPackage)", () => {
  beforeEach(async () => {
    await resetTestDb();
    signOut();
  });

  it("creates the document, sections, steps, checklist, and guides", async () => {
    const { ws, sopDocumentId, sopNumber } = await seedDocument();
    const db = await getTestDb();

    expect(sopNumber).toBe("SOP-001");

    const sections = await db.query.documentSections.findMany({
      where: eq(schema.documentSections.sopDocumentId, sopDocumentId),
      orderBy: [asc(schema.documentSections.position)],
    });
    expect(sections.map((s) => s.type)).toContain("purpose");
    expect(sections.map((s) => s.type)).toContain("quality_control");
    // Analysis uncertainties become a flagged review section.
    const openQuestions = sections.find((s) => s.title === "Open Questions for Review");
    expect(openQuestions?.reviewFlags).toContain("needs_confirmation");

    const steps = await db.query.procedureSteps.findMany({
      where: eq(schema.procedureSteps.sopDocumentId, sopDocumentId),
      orderBy: [asc(schema.procedureSteps.position)],
    });
    expect(steps).toHaveLength(2);
    expect(steps[0].stepNumber).toBe(1);
    expect(steps[1].videoTimestampSeconds).toBe(12);
    expect(steps[1].reviewFlags).toContain("needs_confirmation");

    const checklist = await db.query.checklistItems.findMany({
      where: eq(schema.checklistItems.sopDocumentId, sopDocumentId),
    });
    expect(checklist).toHaveLength(5);
    expect(checklist.some((c) => c.category === "sign_off")).toBe(true);

    const quick = await db.query.quickGuides.findFirst({
      where: eq(schema.quickGuides.sopDocumentId, sopDocumentId),
    });
    expect(quick?.content.escalationContact).toBe("Support team lead");

    const training = await db.query.trainingGuides.findFirst({
      where: eq(schema.trainingGuides.sopDocumentId, sopDocumentId),
    });
    expect(training?.content.knowledgeChecks).toHaveLength(1);

    const project = await db.query.projects.findFirst({
      where: eq(schema.projects.workspaceId, ws.id),
    });
    expect(project?.status).toBe("ready_for_review");
  });

  it("assigns sequential SOP numbers per workspace", async () => {
    const { user, ws, project } = await seedDocument();
    const second = await persistSopPackage({
      workspaceId: ws.id,
      projectId: project.id,
      createdByUserId: user.id,
      pkg: validSopPackage(),
      projectMeta: {},
    });
    expect(second.sopNumber).toBe("SOP-002");
  });

  it("refuses to persist a malformed package (nothing saved)", async () => {
    const user = await createTestUser();
    const ws = await createTestWorkspace({ ownerId: user.id });
    const project = await createTestProject({
      workspaceId: ws.id,
      createdByUserId: user.id,
    });
    const bad = validSopPackage();
    (bad.sop as { steps: unknown }).steps = "not an array";

    await expect(
      persistSopPackage({
        workspaceId: ws.id,
        projectId: project.id,
        createdByUserId: user.id,
        pkg: bad,
        projectMeta: {},
      }),
    ).rejects.toThrow(/malformed/i);

    const db = await getTestDb();
    const docs = await db.query.sopDocuments.findMany({
      where: eq(schema.sopDocuments.workspaceId, ws.id),
    });
    expect(docs).toHaveLength(0);
  });
});

describe("document editing (content operations)", () => {
  beforeEach(async () => {
    await resetTestDb();
    signOut();
  });

  it("updates, adds, reorders, and deletes steps with renumbering", async () => {
    const { user, ws, sopDocumentId } = await seedDocument();
    signInAs(user.clerkId);
    const { PATCH } = await import(
      "@/app/api/workspaces/[workspaceId]/documents/[documentId]/content/route"
    );
    const db = await getTestDb();
    const call = (operations: unknown[]) =>
      PATCH(
        jsonRequest(`/x`, "PATCH", { operations }),
        params({ workspaceId: ws.id, documentId: sopDocumentId }),
      );

    const steps = () =>
      db.query.procedureSteps.findMany({
        where: eq(schema.procedureSteps.sopDocumentId, sopDocumentId),
        orderBy: [asc(schema.procedureSteps.position)],
      });

    const initial = await steps();
    // Update
    let res = await call([
      { op: "update_step", stepId: initial[0].id, instruction: "Updated instruction." },
    ]);
    expect(res.status).toBe(200);
    expect((await steps())[0].instruction).toBe("Updated instruction.");

    // Add after first
    res = await call([
      { op: "add_step", afterStepId: initial[0].id, title: "New middle step", instruction: "Do the middle thing." },
    ]);
    expect(res.status).toBe(200);
    let current = await steps();
    expect(current).toHaveLength(3);
    expect(current[1].title).toBe("New middle step");
    expect(current.map((s) => s.stepNumber)).toEqual([1, 2, 3]);

    // Reorder (reverse)
    res = await call([
      { op: "reorder_steps", orderedIds: [...current.map((s) => s.id)].reverse() },
    ]);
    expect(res.status).toBe(200);
    current = await steps();
    expect(current[0].title).toBe("Issue the refund");
    expect(current.map((s) => s.stepNumber)).toEqual([1, 2, 3]);

    // Delete
    res = await call([{ op: "delete_step", stepId: current[0].id }]);
    expect(res.status).toBe(200);
    current = await steps();
    expect(current).toHaveLength(2);
    expect(current.map((s) => s.stepNumber)).toEqual([1, 2]);
  });

  it("edits checklist items and resolves review flags", async () => {
    const { user, ws, sopDocumentId } = await seedDocument();
    signInAs(user.clerkId);
    const { PATCH } = await import(
      "@/app/api/workspaces/[workspaceId]/documents/[documentId]/content/route"
    );
    const db = await getTestDb();

    const items = await db.query.checklistItems.findMany({
      where: eq(schema.checklistItems.sopDocumentId, sopDocumentId),
    });
    let res = await PATCH(
      jsonRequest(`/x`, "PATCH", {
        operations: [
          { op: "update_checklist_item", itemId: items[0].id, isChecked: true },
          { op: "add_checklist_item", category: "quality", text: "Extra QC check" },
        ],
      }),
      params({ workspaceId: ws.id, documentId: sopDocumentId }),
    );
    expect(res.status).toBe(200);
    const after = await db.query.checklistItems.findMany({
      where: eq(schema.checklistItems.sopDocumentId, sopDocumentId),
    });
    expect(after).toHaveLength(6);

    const flagged = await db.query.procedureSteps.findMany({
      where: eq(schema.procedureSteps.sopDocumentId, sopDocumentId),
    });
    const withFlag = flagged.find((s) => s.reviewFlags.length > 0)!;
    res = await PATCH(
      jsonRequest(`/x`, "PATCH", {
        operations: [{ op: "resolve_step_flags", stepId: withFlag.id }],
      }),
      params({ workspaceId: ws.id, documentId: sopDocumentId }),
    );
    expect(res.status).toBe(200);
    const resolved = await db.query.procedureSteps.findFirst({
      where: eq(schema.procedureSteps.id, withFlag.id),
    });
    expect(resolved?.reviewFlags).toHaveLength(0);
    expect(resolved?.flagsResolvedAt).not.toBeNull();
  });

  it("rejects edits from viewers", async () => {
    const { ws, sopDocumentId } = await seedDocument();
    const viewer = await createTestUser();
    const db = await getTestDb();
    await db.insert(schema.workspaceMembers).values({
      workspaceId: ws.id,
      userId: viewer.id,
      role: "viewer",
      status: "active",
    });
    signInAs(viewer.clerkId);
    const { PATCH } = await import(
      "@/app/api/workspaces/[workspaceId]/documents/[documentId]/content/route"
    );
    const res = await PATCH(
      jsonRequest(`/x`, "PATCH", {
        operations: [{ op: "add_checklist_item", category: "action", text: "hack" }],
      }),
      params({ workspaceId: ws.id, documentId: sopDocumentId }),
    );
    expect(res.status).toBe(403);
  });
});

describe("version creation and restore", () => {
  beforeEach(async () => {
    await resetTestDb();
    signOut();
  });

  it("creates versions and restores prior content", async () => {
    const { user, ws, sopDocumentId } = await seedDocument("professional");
    signInAs(user.clerkId);
    const versionRoutes = await import(
      "@/app/api/workspaces/[workspaceId]/documents/[documentId]/versions/route"
    );
    const contentRoutes = await import(
      "@/app/api/workspaces/[workspaceId]/documents/[documentId]/content/route"
    );
    const db = await getTestDb();
    const p = params({ workspaceId: ws.id, documentId: sopDocumentId });

    // Snapshot v1
    let res = await versionRoutes.POST(
      jsonRequest(`/x`, "POST", { revisionNotes: "Initial release" }),
      p,
    );
    expect(res.status).toBe(201);

    // Change a step
    const [step] = await db.query.procedureSteps.findMany({
      where: eq(schema.procedureSteps.sopDocumentId, sopDocumentId),
      limit: 1,
    });
    await contentRoutes.PATCH(
      jsonRequest(`/x`, "PATCH", {
        operations: [
          { op: "update_step", stepId: step.id, instruction: "CHANGED after v1" },
        ],
      }),
      p,
    );

    // List versions
    res = await versionRoutes.GET(jsonRequest(`/x`, "GET"), p);
    const { versions } = await res.json();
    expect(versions).toHaveLength(1);
    expect(versions[0].revisionNotes).toBe("Initial release");

    // Restore v1 → instruction reverts; an auto-snapshot of current state is kept.
    res = await versionRoutes.PUT(
      jsonRequest(`/x`, "PUT", { versionId: versions[0].id }),
      p,
    );
    expect(res.status).toBe(200);

    const steps = await db.query.procedureSteps.findMany({
      where: eq(schema.procedureSteps.sopDocumentId, sopDocumentId),
    });
    expect(steps.some((s) => s.instruction === "CHANGED after v1")).toBe(false);

    res = await versionRoutes.GET(jsonRequest(`/x`, "GET"), p);
    const after = await res.json();
    expect(after.versions.length).toBe(2);
  });

  it("gates version history behind the plan", async () => {
    const { user, ws, sopDocumentId } = await seedDocument("starter");
    signInAs(user.clerkId);
    const { POST } = await import(
      "@/app/api/workspaces/[workspaceId]/documents/[documentId]/versions/route"
    );
    const res = await POST(
      jsonRequest(`/x`, "POST", {}),
      params({ workspaceId: ws.id, documentId: sopDocumentId }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("plan_upgrade_required");
  });
});
