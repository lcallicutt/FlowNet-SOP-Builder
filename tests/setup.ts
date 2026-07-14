import { vi, beforeAll } from "vitest";
import { getTestDb } from "./helpers/db";

/**
 * Global test wiring:
 *  - "@/db" resolves to the in-memory pglite database
 *  - Clerk auth() returns a controllable test identity
 *  - object storage and the Inngest client are stubbed (no network)
 */

export const authState: { clerkId: string | null } = { clerkId: null };

export function signInAs(clerkId: string) {
  authState.clerkId = clerkId;
}
export function signOut() {
  authState.clerkId = null;
}

vi.mock("@/db", async () => {
  const { getTestDb } = await import("./helpers/db");
  const schema = await import("@/db/schema");
  const db = await getTestDb();
  return { db, schema };
});

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: authState.clerkId })),
  currentUser: vi.fn(async () =>
    authState.clerkId
      ? {
          id: authState.clerkId,
          emailAddresses: [{ emailAddress: `${authState.clerkId}@test.dev` }],
          firstName: "Test",
          lastName: "User",
          imageUrl: null,
        }
      : null,
  ),
  clerkMiddleware: vi.fn(),
  createRouteMatcher: vi.fn(() => () => false),
}));

vi.mock("@/lib/storage", () => ({
  s3Client: vi.fn(),
  bucket: () => "test-bucket",
  buildStorageKey: (p: { workspaceId: string; kind: string; fileName: string }) =>
    `workspaces/${p.workspaceId}/test/${p.kind}/${p.fileName}`,
  createSignedUploadUrl: vi.fn(async () => "https://storage.test/upload-url"),
  createSignedDownloadUrl: vi.fn(async () => "https://storage.test/download-url"),
  deleteObject: vi.fn(async () => {}),
  putObject: vi.fn(async () => {}),
}));

export const sentEvents: { name: string; data: unknown }[] = [];
vi.mock("@/inngest/client", () => ({
  inngest: {
    send: vi.fn(async (event: { name: string; data: unknown }) => {
      sentEvents.push(event);
    }),
  },
}));

beforeAll(async () => {
  await getTestDb();
});
