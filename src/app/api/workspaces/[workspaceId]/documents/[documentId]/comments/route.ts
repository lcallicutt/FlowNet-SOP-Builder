import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { comments, sopDocuments } from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { ApiError, handleRouteError } from "@/lib/api";

type Params = { params: Promise<{ workspaceId: string; documentId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, documentId } = await params;
    await requireWorkspace(workspaceId, "viewer");
    const rows = await db.query.comments.findMany({
      where: and(
        eq(comments.sopDocumentId, documentId),
        eq(comments.workspaceId, workspaceId),
      ),
      orderBy: [desc(comments.createdAt)],
      limit: 200,
    });
    return NextResponse.json({ comments: rows });
  } catch (error) {
    return handleRouteError(error);
  }
}

const createSchema = z.object({ body: z.string().trim().min(1).max(4000) });

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, documentId } = await params;
    const ctx = await requireWorkspace(workspaceId, "viewer");
    const { body } = createSchema.parse(await req.json());

    const doc = await db.query.sopDocuments.findFirst({
      where: and(
        eq(sopDocuments.id, documentId),
        eq(sopDocuments.workspaceId, workspaceId),
      ),
    });
    if (!doc || doc.deletedAt) throw new ApiError(404, "Document not found.");

    const [comment] = await db
      .insert(comments)
      .values({
        workspaceId,
        sopDocumentId: documentId,
        authorUserId: ctx.user.id,
        body,
      })
      .returning();

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
