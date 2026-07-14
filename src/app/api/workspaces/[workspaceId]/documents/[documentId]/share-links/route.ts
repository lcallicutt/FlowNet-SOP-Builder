import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sharedLinks, sopDocuments } from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { ApiError, handleRouteError } from "@/lib/api";
import { PLANS } from "@/lib/plans";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ workspaceId: string; documentId: string }> };

function shareUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/share/${token}`;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, documentId } = await params;
    await requireWorkspace(workspaceId, "viewer");
    const links = await db.query.sharedLinks.findMany({
      where: and(
        eq(sharedLinks.sopDocumentId, documentId),
        eq(sharedLinks.workspaceId, workspaceId),
      ),
      orderBy: [desc(sharedLinks.createdAt)],
    });
    return NextResponse.json({
      links: links.map((l) => ({
        id: l.id,
        url: shareUrl(l.token),
        requireAuth: l.requireAuth,
        isActive: l.isActive,
        expiresAt: l.expiresAt,
        createdAt: l.createdAt,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

const createSchema = z.object({
  requireAuth: z.boolean().default(false),
  expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
});

/** Create a read-only share link. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, documentId } = await params;
    const ctx = await requireWorkspace(workspaceId, "editor");
    if (!PLANS[ctx.plan].features.sharedLinks) {
      throw new ApiError(
        403,
        "Shared links are available on the Professional and Business plans.",
        "plan_upgrade_required",
      );
    }
    const { requireAuth, expiresInDays } = createSchema.parse(
      await req.json().catch(() => ({})),
    );

    const doc = await db.query.sopDocuments.findFirst({
      where: and(
        eq(sopDocuments.id, documentId),
        eq(sopDocuments.workspaceId, workspaceId),
      ),
    });
    if (!doc || doc.deletedAt) throw new ApiError(404, "Document not found.");

    const token = randomBytes(24).toString("base64url");
    const [link] = await db
      .insert(sharedLinks)
      .values({
        workspaceId,
        sopDocumentId: documentId,
        token,
        requireAuth,
        isActive: true,
        expiresAt: expiresInDays
          ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
          : null,
        createdByUserId: ctx.user.id,
      })
      .returning();

    await recordAudit({
      workspaceId,
      actorUserId: ctx.user.id,
      action: "share_link.create",
      entityType: "shared_link",
      entityId: link.id,
      metadata: { documentId, requireAuth },
    });

    return NextResponse.json(
      { link: { id: link.id, url: shareUrl(token), requireAuth: link.requireAuth } },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

const patchSchema = z.object({
  linkId: z.string().uuid(),
  isActive: z.boolean(),
});

/** Enable/disable a share link. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, documentId } = await params;
    const ctx = await requireWorkspace(workspaceId, "editor");
    const { linkId, isActive } = patchSchema.parse(await req.json());

    const link = await db.query.sharedLinks.findFirst({
      where: and(
        eq(sharedLinks.id, linkId),
        eq(sharedLinks.sopDocumentId, documentId),
        eq(sharedLinks.workspaceId, workspaceId),
      ),
    });
    if (!link) throw new ApiError(404, "Share link not found.");

    await db
      .update(sharedLinks)
      .set({ isActive })
      .where(eq(sharedLinks.id, linkId));

    await recordAudit({
      workspaceId,
      actorUserId: ctx.user.id,
      action: isActive ? "share_link.enable" : "share_link.disable",
      entityType: "shared_link",
      entityId: linkId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
