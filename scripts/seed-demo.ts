/**
 * Demo data seeder.
 *
 * Usage: DATABASE_URL=... pnpm seed [-- --clerk-id=user_xxx]
 *
 * Creates a demo workspace (on the Business plan so every feature is
 * visible) with four realistic SOP packages:
 *   1. Client onboarding
 *   2. Weekly social-media scheduling
 *   3. Customer refund processing
 *   4. Church event publishing
 *
 * If --clerk-id is passed, the workspace is attached to that Clerk user so
 * you can sign in and see the data; otherwise a placeholder demo user is
 * created.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { demoSopPackages } from "./seed-data";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Configure .env.local first.");
    process.exit(1);
  }
  const db = drizzle(neon(url), { schema });

  const clerkIdArg = process.argv
    .find((a) => a.startsWith("--clerk-id="))
    ?.split("=")[1];

  // 1. Demo user
  let user = clerkIdArg
    ? await db.query.users.findFirst({
        where: eq(schema.users.clerkId, clerkIdArg),
      })
    : undefined;
  if (!user) {
    [user] = await db
      .insert(schema.users)
      .values({
        clerkId: clerkIdArg ?? `demo_${Date.now()}`,
        email: "demo@flownet.example",
        name: "Demo Owner",
      })
      .onConflictDoNothing({ target: schema.users.clerkId })
      .returning();
  }
  if (!user) throw new Error("Could not create or find the demo user.");

  // 2. Demo workspace on the Business plan
  const [workspace] = await db
    .insert(schema.workspaces)
    .values({
      name: "FlowNet Demo Co.",
      slug: `flownet-demo-${Math.random().toString(36).slice(2, 8)}`,
      createdByUserId: user.id,
    })
    .returning();
  await db.insert(schema.workspaceMembers).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: "owner",
    status: "active",
  });
  await db.insert(schema.subscriptions).values({
    workspaceId: workspace.id,
    plan: "business",
    status: "active",
  });
  console.log(`Workspace: ${workspace.name} (${workspace.id})`);

  // 3. Four demo SOP packages, each with a project + transcript
  let sopCounter = 0;
  for (const demo of demoSopPackages) {
    sopCounter++;
    const [project] = await db
      .insert(schema.projects)
      .values({
        workspaceId: workspace.id,
        title: demo.projectTitle,
        department: demo.department,
        processCategory: demo.category,
        processOwner: demo.processOwner,
        intendedAudience: demo.audience,
        detailLevel: "standard",
        language: "en",
        sourceType: "upload",
        status: "ready_for_review",
        progressPercent: 100,
        createdByUserId: user.id,
      })
      .returning();

    const fullText = demo.transcript.map((s) => s.text).join(" ");
    const [transcript] = await db
      .insert(schema.transcripts)
      .values({
        workspaceId: workspace.id,
        projectId: project.id,
        status: "ready",
        language: "en",
        fullText,
        wordCount: fullText.split(/\s+/).length,
        durationSeconds: demo.transcript.at(-1)?.end ?? 0,
      })
      .returning();
    await db.insert(schema.transcriptSegments).values(
      demo.transcript.map((s, i) => ({
        workspaceId: workspace.id,
        transcriptId: transcript.id,
        segmentIndex: i,
        startSeconds: s.start,
        endSeconds: s.end,
        text: s.text,
      })),
    );

    const [doc] = await db
      .insert(schema.sopDocuments)
      .values({
        workspaceId: workspace.id,
        projectId: project.id,
        sopNumber: `SOP-${String(sopCounter).padStart(3, "0")}`,
        title: demo.title,
        status: demo.status,
        versionNumber: 1,
        department: demo.department,
        processCategory: demo.category,
        processOwner: demo.processOwner,
        intendedAudience: demo.audience,
        tags: demo.tags,
        reviewDate: new Date(Date.now() + 180 * 24 * 3600 * 1000),
        createdByUserId: user.id,
      })
      .returning();

    await db.insert(schema.documentSections).values(
      demo.sections.map((s, i) => ({
        workspaceId: workspace.id,
        sopDocumentId: doc.id,
        type: s.type,
        title: s.title,
        content: s.content,
        position: i,
        reviewFlags: s.reviewFlags ?? [],
      })),
    );
    await db.insert(schema.procedureSteps).values(
      demo.steps.map((s, i) => ({
        workspaceId: workspace.id,
        sopDocumentId: doc.id,
        stepNumber: i + 1,
        title: s.title,
        instruction: s.instruction,
        expectedResult: s.expectedResult ?? null,
        warning: s.warning ?? null,
        qualityCheckpoint: s.qualityCheckpoint ?? null,
        videoTimestampSeconds: s.timestamp ?? null,
        reviewFlags: s.reviewFlags ?? [],
        position: i,
      })),
    );
    await db.insert(schema.checklistItems).values(
      demo.checklist.map((c, i) => ({
        workspaceId: workspace.id,
        sopDocumentId: doc.id,
        category: c.category,
        text: c.text,
        position: i,
      })),
    );
    await db.insert(schema.quickGuides).values({
      workspaceId: workspace.id,
      sopDocumentId: doc.id,
      content: demo.quickGuide,
    });
    await db.insert(schema.trainingGuides).values({
      workspaceId: workspace.id,
      sopDocumentId: doc.id,
      content: demo.trainingGuide,
    });

    console.log(`  Seeded ${doc.sopNumber}: ${doc.title}`);
  }

  await db
    .update(schema.workspaces)
    .set({ sopCounter })
    .where(eq(schema.workspaces.id, workspace.id));

  console.log("Done. Sign in and open the workspace to explore the demo data.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
