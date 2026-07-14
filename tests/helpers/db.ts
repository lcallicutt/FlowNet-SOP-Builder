import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import * as schema from "@/db/schema";

/**
 * In-memory PostgreSQL (pglite) wired to the real Drizzle schema. Tests run
 * against actual SQL — including FK constraints and enums — with no external
 * database. The `@/db` module is mocked in tests/setup.ts to point here.
 */

export type TestDb = PgliteDatabase<typeof schema>;

let client: PGlite | null = null;
let testDb: TestDb | null = null;

export async function getTestDb(): Promise<TestDb> {
  if (testDb) return testDb;
  client = new PGlite();
  testDb = drizzle(client, { schema });

  const migrationsDir = path.resolve(__dirname, "../../drizzle");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = readFileSync(path.join(migrationsDir, file), "utf8");
    // drizzle-kit separates statements with the statement-breakpoint marker.
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await client.exec(trimmed);
    }
  }
  return testDb;
}

export async function resetTestDb(): Promise<void> {
  if (!client) return;
  // Truncate everything between tests, preserving the schema.
  await client.exec(`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
}

/* ------------------------------------------------------------------ */
/* Seed helpers                                                        */
/* ------------------------------------------------------------------ */

let seedCounter = 0;

export async function createTestUser(overrides?: {
  email?: string;
  isPlatformAdmin?: boolean;
}) {
  const db = await getTestDb();
  seedCounter++;
  const [user] = await db
    .insert(schema.users)
    .values({
      clerkId: `clerk_test_${seedCounter}_${Date.now()}`,
      email: overrides?.email ?? `user${seedCounter}@test.dev`,
      name: `Test User ${seedCounter}`,
      isPlatformAdmin: overrides?.isPlatformAdmin ?? false,
    })
    .returning();
  return user;
}

export async function createTestWorkspace(params: {
  ownerId: string;
  plan?: "starter" | "professional" | "business";
  name?: string;
}) {
  const db = await getTestDb();
  seedCounter++;
  const [workspace] = await db
    .insert(schema.workspaces)
    .values({
      name: params.name ?? `Workspace ${seedCounter}`,
      slug: `ws-${seedCounter}-${Date.now()}`,
      createdByUserId: params.ownerId,
    })
    .returning();
  await db.insert(schema.workspaceMembers).values({
    workspaceId: workspace.id,
    userId: params.ownerId,
    role: "owner",
    status: "active",
  });
  await db.insert(schema.subscriptions).values({
    workspaceId: workspace.id,
    plan: params.plan ?? "starter",
    status: "active",
  });
  return workspace;
}

export async function addMember(params: {
  workspaceId: string;
  userId: string;
  role: "owner" | "admin" | "editor" | "viewer";
}) {
  const db = await getTestDb();
  const [member] = await db
    .insert(schema.workspaceMembers)
    .values({
      workspaceId: params.workspaceId,
      userId: params.userId,
      role: params.role,
      status: "active",
    })
    .returning();
  return member;
}

export async function createTestProject(params: {
  workspaceId: string;
  createdByUserId: string;
  status?: (typeof schema.projects.$inferInsert)["status"];
}) {
  const db = await getTestDb();
  const [project] = await db
    .insert(schema.projects)
    .values({
      workspaceId: params.workspaceId,
      title: "Test process recording",
      detailLevel: "standard",
      language: "en",
      sourceType: "upload",
      status: params.status ?? "transcript_ready",
      createdByUserId: params.createdByUserId,
    })
    .returning();
  return project;
}

export async function createTestTranscript(params: {
  workspaceId: string;
  projectId: string;
  segments?: { text: string; start: number; end: number }[];
}) {
  const db = await getTestDb();
  const segments =
    params.segments ??
    [
      { text: "First we open the billing portal.", start: 0, end: 5 },
      { text: "Then we verify the customer account.", start: 5, end: 11 },
      { text: "Finally we issue the refund and log it.", start: 11, end: 18 },
    ];
  const fullText = segments.map((s) => s.text).join(" ");
  const [transcript] = await db
    .insert(schema.transcripts)
    .values({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      status: "ready",
      language: "en",
      fullText,
      wordCount: fullText.split(/\s+/).length,
      durationSeconds: segments.at(-1)?.end ?? 0,
    })
    .returning();
  await db.insert(schema.transcriptSegments).values(
    segments.map((s, i) => ({
      workspaceId: params.workspaceId,
      transcriptId: transcript.id,
      segmentIndex: i,
      startSeconds: s.start,
      endSeconds: s.end,
      text: s.text,
    })),
  );
  return transcript;
}
