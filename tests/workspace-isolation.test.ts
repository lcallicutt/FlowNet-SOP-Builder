import { describe, expect, it, beforeEach } from "vitest";
import { signInAs, signOut } from "./setup";
import {
  addMember,
  createTestProject,
  createTestTranscript,
  createTestUser,
  createTestWorkspace,
  resetTestDb,
} from "./helpers/db";
import { jsonRequest, params } from "./helpers/request";
import { persistSopPackage } from "@/lib/sop-persist";
import { validSopPackage } from "./helpers/fixtures";

describe("authentication and workspace isolation", () => {
  beforeEach(async () => {
    await resetTestDb();
    signOut();
  });

  it("rejects unauthenticated requests", async () => {
    const { GET } = await import("@/app/api/workspaces/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("hides other users' workspaces (404, not 403 — no existence leak)", async () => {
    const owner = await createTestUser();
    const outsider = await createTestUser();
    const workspace = await createTestWorkspace({ ownerId: owner.id });

    signInAs(outsider.clerkId);
    const { GET } = await import("@/app/api/workspaces/[workspaceId]/route");
    const res = await GET(
      jsonRequest(`/api/workspaces/${workspace.id}`, "GET"),
      params({ workspaceId: workspace.id }),
    );
    expect(res.status).toBe(404);
  });

  it("blocks cross-workspace document access even with a valid document id", async () => {
    const owner = await createTestUser();
    const outsider = await createTestUser();
    const wsA = await createTestWorkspace({ ownerId: owner.id });
    const wsB = await createTestWorkspace({ ownerId: outsider.id });

    const project = await createTestProject({
      workspaceId: wsA.id,
      createdByUserId: owner.id,
    });
    const { sopDocumentId } = await persistSopPackage({
      workspaceId: wsA.id,
      projectId: project.id,
      createdByUserId: owner.id,
      pkg: validSopPackage(),
      projectMeta: {},
    });

    signInAs(outsider.clerkId);
    const { GET } = await import(
      "@/app/api/workspaces/[workspaceId]/documents/[documentId]/route"
    );
    // Through their own workspace: the document isn't there → 404.
    const crossRes = await GET(
      jsonRequest(`/api/workspaces/${wsB.id}/documents/${sopDocumentId}`, "GET"),
      params({ workspaceId: wsB.id, documentId: sopDocumentId }),
    );
    expect(crossRes.status).toBe(404);
    // Through the victim's workspace: membership check fails → 404.
    const directRes = await GET(
      jsonRequest(`/api/workspaces/${wsA.id}/documents/${sopDocumentId}`, "GET"),
      params({ workspaceId: wsA.id, documentId: sopDocumentId }),
    );
    expect(directRes.status).toBe(404);
  });

  it("enforces role hierarchy: viewers cannot start uploads", async () => {
    const owner = await createTestUser();
    const viewer = await createTestUser();
    const workspace = await createTestWorkspace({ ownerId: owner.id });
    await addMember({ workspaceId: workspace.id, userId: viewer.id, role: "viewer" });

    signInAs(viewer.clerkId);
    const { POST } = await import("@/app/api/workspaces/[workspaceId]/uploads/route");
    const res = await POST(
      jsonRequest(`/api/workspaces/${workspace.id}/uploads`, "POST", {
        file: { fileName: "a.mp4", contentType: "video/mp4", sizeBytes: 1000 },
        form: { title: "T", detailLevel: "standard", language: "en" },
      }),
      params({ workspaceId: workspace.id }),
    );
    expect(res.status).toBe(403);
  });

  it("editors can edit transcripts in their workspace", async () => {
    const owner = await createTestUser();
    const editor = await createTestUser();
    const workspace = await createTestWorkspace({ ownerId: owner.id });
    await addMember({ workspaceId: workspace.id, userId: editor.id, role: "editor" });
    const project = await createTestProject({
      workspaceId: workspace.id,
      createdByUserId: owner.id,
    });
    const transcript = await createTestTranscript({
      workspaceId: workspace.id,
      projectId: project.id,
    });

    signInAs(editor.clerkId);
    const routes = await import(
      "@/app/api/workspaces/[workspaceId]/projects/[projectId]/transcript/route"
    );
    const getRes = await routes.GET(
      jsonRequest(`/x`, "GET"),
      params({ workspaceId: workspace.id, projectId: project.id }),
    );
    expect(getRes.status).toBe(200);
    const body = await getRes.json();
    expect(body.segments).toHaveLength(3);
    expect(body.transcript.id).toBe(transcript.id);
  });
});
