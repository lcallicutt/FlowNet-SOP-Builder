import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
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

async function seedDocument(plan: "starter" | "professional" | "business") {
  const user = await createTestUser();
  const ws = await createTestWorkspace({ ownerId: user.id, plan });
  const project = await createTestProject({
    workspaceId: ws.id,
    createdByUserId: user.id,
  });
  const { sopDocumentId } = await persistSopPackage({
    workspaceId: ws.id,
    projectId: project.id,
    createdByUserId: user.id,
    pkg: validSopPackage(),
    projectMeta: {},
  });
  return { user, ws, sopDocumentId };
}

describe("export authorization", () => {
  beforeEach(async () => {
    await resetTestDb();
    signOut();
  });

  it("renders a real PDF for an authorized member", async () => {
    const { user, ws, sopDocumentId } = await seedDocument("starter");
    signInAs(user.clerkId);
    const { POST } = await import(
      "@/app/api/workspaces/[workspaceId]/documents/[documentId]/export/route"
    );
    const res = await POST(
      jsonRequest(`/x`, "POST", { format: "pdf", selection: "sop" }),
      params({ workspaceId: ws.id, documentId: sopDocumentId }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("blocks DOCX and non-SOP selections on the starter plan", async () => {
    const { user, ws, sopDocumentId } = await seedDocument("starter");
    signInAs(user.clerkId);
    const { POST } = await import(
      "@/app/api/workspaces/[workspaceId]/documents/[documentId]/export/route"
    );
    const p = params({ workspaceId: ws.id, documentId: sopDocumentId });

    const docx = await POST(
      jsonRequest(`/x`, "POST", { format: "docx", selection: "sop" }),
      p,
    );
    expect(docx.status).toBe(403);

    const fullPackage = await POST(
      jsonRequest(`/x`, "POST", { format: "pdf", selection: "full_package" }),
      p,
    );
    expect(fullPackage.status).toBe(403);
  });

  it("allows DOCX + full package on Professional", async () => {
    const { user, ws, sopDocumentId } = await seedDocument("professional");
    signInAs(user.clerkId);
    const { POST } = await import(
      "@/app/api/workspaces/[workspaceId]/documents/[documentId]/export/route"
    );
    const res = await POST(
      jsonRequest(`/x`, "POST", { format: "docx", selection: "full_package" }),
      params({ workspaceId: ws.id, documentId: sopDocumentId }),
    );
    expect(res.status).toBe(200);
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("denies exports to non-members", async () => {
    const { ws, sopDocumentId } = await seedDocument("professional");
    const outsider = await createTestUser();
    signInAs(outsider.clerkId);
    const { POST } = await import(
      "@/app/api/workspaces/[workspaceId]/documents/[documentId]/export/route"
    );
    const res = await POST(
      jsonRequest(`/x`, "POST", { format: "pdf", selection: "sop" }),
      params({ workspaceId: ws.id, documentId: sopDocumentId }),
    );
    expect(res.status).toBe(404);
  });
});

describe("shared-link access", () => {
  beforeEach(async () => {
    await resetTestDb();
    signOut();
  });

  it("creates, lists, and disables share links (plan-gated)", async () => {
    const { user, ws, sopDocumentId } = await seedDocument("professional");
    signInAs(user.clerkId);
    const routes = await import(
      "@/app/api/workspaces/[workspaceId]/documents/[documentId]/share-links/route"
    );
    const p = params({ workspaceId: ws.id, documentId: sopDocumentId });

    const created = await routes.POST(
      jsonRequest(`/x`, "POST", { requireAuth: false }),
      p,
    );
    expect(created.status).toBe(201);
    const { link } = await created.json();
    expect(link.url).toMatch(/\/share\/[A-Za-z0-9_-]{20,}/);

    const db = await getTestDb();
    const row = await db.query.sharedLinks.findFirst({
      where: eq(schema.sharedLinks.id, link.id),
    });
    expect(row?.isActive).toBe(true);

    const disabled = await routes.PATCH(
      jsonRequest(`/x`, "PATCH", { linkId: link.id, isActive: false }),
      p,
    );
    expect(disabled.status).toBe(200);
    const after = await db.query.sharedLinks.findFirst({
      where: eq(schema.sharedLinks.id, link.id),
    });
    expect(after?.isActive).toBe(false);
  });

  it("blocks share links on the starter plan", async () => {
    const { user, ws, sopDocumentId } = await seedDocument("starter");
    signInAs(user.clerkId);
    const { POST } = await import(
      "@/app/api/workspaces/[workspaceId]/documents/[documentId]/share-links/route"
    );
    const res = await POST(
      jsonRequest(`/x`, "POST", {}),
      params({ workspaceId: ws.id, documentId: sopDocumentId }),
    );
    expect(res.status).toBe(403);
  });
});

describe("subscription limit enforcement", () => {
  beforeEach(async () => {
    await resetTestDb();
    signOut();
  });

  it("rejects uploads once transcription minutes are exhausted", async () => {
    const user = await createTestUser();
    const ws = await createTestWorkspace({ ownerId: user.id, plan: "starter" });
    const db = await getTestDb();
    // Consume the entire 30-minute starter allowance.
    const period = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;
    await db.insert(schema.usageRecords).values({
      workspaceId: ws.id,
      type: "transcription_seconds",
      quantity: 30 * 60,
      period,
    });

    signInAs(user.clerkId);
    const { POST } = await import("@/app/api/workspaces/[workspaceId]/uploads/route");
    const res = await POST(
      jsonRequest(`/x`, "POST", {
        file: { fileName: "a.mp4", contentType: "video/mp4", sizeBytes: 1024 },
        form: { title: "Over the limit", detailLevel: "standard", language: "en" },
      }),
      params({ workspaceId: ws.id }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("limit_reached");
  });

  it("enforces the seat limit when inviting members", async () => {
    const user = await createTestUser();
    const ws = await createTestWorkspace({ ownerId: user.id, plan: "starter" }); // 1 seat
    signInAs(user.clerkId);
    const { POST } = await import("@/app/api/workspaces/[workspaceId]/members/route");
    const res = await POST(
      jsonRequest(`/x`, "POST", { email: "newhire@test.dev", role: "editor" }),
      params({ workspaceId: ws.id }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("limit_reached");
  });
});
