import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { signInAs, signOut, sentEvents } from "./setup";
import {
  createTestProject,
  createTestTranscript,
  createTestUser,
  createTestWorkspace,
  getTestDb,
  resetTestDb,
} from "./helpers/db";
import { jsonRequest, params } from "./helpers/request";
import * as schema from "@/db/schema";

describe("transcript creation and editing", () => {
  beforeEach(async () => {
    await resetTestDb();
    signOut();
    sentEvents.length = 0;
  });

  it("stores ordered, timestamped segments", async () => {
    const user = await createTestUser();
    const ws = await createTestWorkspace({ ownerId: user.id });
    const project = await createTestProject({
      workspaceId: ws.id,
      createdByUserId: user.id,
    });
    const transcript = await createTestTranscript({
      workspaceId: ws.id,
      projectId: project.id,
    });

    const db = await getTestDb();
    const segments = await db.query.transcriptSegments.findMany({
      where: eq(schema.transcriptSegments.transcriptId, transcript.id),
      orderBy: (t, { asc }) => [asc(t.segmentIndex)],
    });
    expect(segments).toHaveLength(3);
    expect(segments[0].startSeconds).toBe(0);
    expect(segments[2].endSeconds).toBe(18);
  });

  it("saves segment edits and refreshes the denormalized full text", async () => {
    const user = await createTestUser();
    const ws = await createTestWorkspace({ ownerId: user.id });
    const project = await createTestProject({
      workspaceId: ws.id,
      createdByUserId: user.id,
    });
    const transcript = await createTestTranscript({
      workspaceId: ws.id,
      projectId: project.id,
    });
    const db = await getTestDb();
    const [firstSegment] = await db.query.transcriptSegments.findMany({
      where: eq(schema.transcriptSegments.transcriptId, transcript.id),
      limit: 1,
    });

    signInAs(user.clerkId);
    const { PATCH } = await import(
      "@/app/api/workspaces/[workspaceId]/projects/[projectId]/transcript/route"
    );
    const res = await PATCH(
      jsonRequest(`/x`, "PATCH", {
        transcriptId: transcript.id,
        edits: [{ segmentId: firstSegment.id, text: "First we open the CORRECTED portal." }],
      }),
      params({ workspaceId: ws.id, projectId: project.id }),
    );
    expect(res.status).toBe(200);

    const updated = await db.query.transcripts.findFirst({
      where: eq(schema.transcripts.id, transcript.id),
    });
    expect(updated?.status).toBe("edited");
    expect(updated?.fullText).toContain("CORRECTED");
  });

  it("kicks off generation with the Generate SOP Package action", async () => {
    const user = await createTestUser();
    const ws = await createTestWorkspace({ ownerId: user.id });
    const project = await createTestProject({
      workspaceId: ws.id,
      createdByUserId: user.id,
      status: "transcript_ready",
    });
    const transcript = await createTestTranscript({
      workspaceId: ws.id,
      projectId: project.id,
    });

    signInAs(user.clerkId);
    const { POST } = await import(
      "@/app/api/workspaces/[workspaceId]/projects/[projectId]/generate/route"
    );
    const res = await POST(
      jsonRequest(`/x`, "POST", { transcriptId: transcript.id }),
      params({ workspaceId: ws.id, projectId: project.id }),
    );
    expect(res.status).toBe(200);
    expect(sentEvents).toContainEqual(
      expect.objectContaining({ name: "project/generate" }),
    );
  });
});
