import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { signInAs, signOut } from "./setup";
import {
  addMember,
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

describe("approval workflow", () => {
  beforeEach(async () => {
    await resetTestDb();
    signOut();
  });

  async function seed() {
    const owner = await createTestUser();
    const reviewer = await createTestUser();
    const ws = await createTestWorkspace({ ownerId: owner.id, plan: "business" });
    await addMember({ workspaceId: ws.id, userId: reviewer.id, role: "editor" });
    const project = await createTestProject({
      workspaceId: ws.id,
      createdByUserId: owner.id,
    });
    const { sopDocumentId } = await persistSopPackage({
      workspaceId: ws.id,
      projectId: project.id,
      createdByUserId: owner.id,
      pkg: validSopPackage(),
      projectMeta: {},
    });
    return { owner, reviewer, ws, sopDocumentId };
  }

  it("runs request → approve → publish", async () => {
    const { owner, reviewer, ws, sopDocumentId } = await seed();
    const db = await getTestDb();
    const approvalRoutes = await import(
      "@/app/api/workspaces/[workspaceId]/documents/[documentId]/approvals/route"
    );
    const docRoutes = await import(
      "@/app/api/workspaces/[workspaceId]/documents/[documentId]/route"
    );
    const p = params({ workspaceId: ws.id, documentId: sopDocumentId });

    // Publishing without approval is blocked on the Business plan.
    signInAs(owner.clerkId);
    let res = await docRoutes.PATCH(
      jsonRequest(`/x`, "PATCH", { status: "published" }),
      p,
    );
    expect(res.status).toBe(409);

    // Request approval.
    res = await approvalRoutes.POST(
      jsonRequest(`/x`, "POST", { reviewerUserId: reviewer.id }),
      p,
    );
    expect(res.status).toBe(201);
    const { approval } = await res.json();

    let doc = await db.query.sopDocuments.findFirst({
      where: eq(schema.sopDocuments.id, sopDocumentId),
    });
    expect(doc?.status).toBe("in_review");

    // Requester cannot decide their own request.
    res = await approvalRoutes.PATCH(
      jsonRequest(`/x`, "PATCH", { approvalId: approval.id, decision: "approved" }),
      p,
    );
    expect(res.status).toBe(403);

    // Reviewer approves; the decision is recorded.
    signInAs(reviewer.clerkId);
    res = await approvalRoutes.PATCH(
      jsonRequest(`/x`, "PATCH", {
        approvalId: approval.id,
        decision: "approved",
        comments: "Looks accurate.",
      }),
      p,
    );
    expect(res.status).toBe(200);

    const decided = await db.query.approvals.findFirst({
      where: eq(schema.approvals.id, approval.id),
    });
    expect(decided?.status).toBe("approved");
    expect(decided?.comments).toBe("Looks accurate.");
    expect(decided?.decidedAt).not.toBeNull();

    doc = await db.query.sopDocuments.findFirst({
      where: eq(schema.sopDocuments.id, sopDocumentId),
    });
    expect(doc?.status).toBe("approved");

    // Now the owner can publish.
    signInAs(owner.clerkId);
    res = await docRoutes.PATCH(
      jsonRequest(`/x`, "PATCH", { status: "published" }),
      p,
    );
    expect(res.status).toBe(200);
  });

  it("requires comments on rejection and returns the doc to draft", async () => {
    const { owner, reviewer, ws, sopDocumentId } = await seed();
    const approvalRoutes = await import(
      "@/app/api/workspaces/[workspaceId]/documents/[documentId]/approvals/route"
    );
    const p = params({ workspaceId: ws.id, documentId: sopDocumentId });

    signInAs(owner.clerkId);
    const res = await approvalRoutes.POST(
      jsonRequest(`/x`, "POST", { reviewerUserId: reviewer.id }),
      p,
    );
    const { approval } = await res.json();

    signInAs(reviewer.clerkId);
    const noComments = await approvalRoutes.PATCH(
      jsonRequest(`/x`, "PATCH", { approvalId: approval.id, decision: "rejected" }),
      p,
    );
    expect(noComments.status).toBe(422);

    const rejected = await approvalRoutes.PATCH(
      jsonRequest(`/x`, "PATCH", {
        approvalId: approval.id,
        decision: "rejected",
        comments: "Step 2 is missing the confirmation dialog.",
      }),
      p,
    );
    expect(rejected.status).toBe(200);

    const db = await getTestDb();
    const doc = await db.query.sopDocuments.findFirst({
      where: eq(schema.sopDocuments.id, sopDocumentId),
    });
    expect(doc?.status).toBe("draft");
  });

  it("gates approvals behind the Business plan", async () => {
    const owner = await createTestUser();
    const ws = await createTestWorkspace({ ownerId: owner.id, plan: "professional" });
    const project = await createTestProject({
      workspaceId: ws.id,
      createdByUserId: owner.id,
    });
    const { sopDocumentId } = await persistSopPackage({
      workspaceId: ws.id,
      projectId: project.id,
      createdByUserId: owner.id,
      pkg: validSopPackage(),
      projectMeta: {},
    });
    signInAs(owner.clerkId);
    const { POST } = await import(
      "@/app/api/workspaces/[workspaceId]/documents/[documentId]/approvals/route"
    );
    const res = await POST(
      jsonRequest(`/x`, "POST", { reviewerUserId: owner.id }),
      params({ workspaceId: ws.id, documentId: sopDocumentId }),
    );
    expect(res.status).toBe(403);
  });
});
