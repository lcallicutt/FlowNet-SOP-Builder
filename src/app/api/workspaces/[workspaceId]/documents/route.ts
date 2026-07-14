import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, isNull, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { sopDocuments } from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { handleRouteError } from "@/lib/api";

type Params = { params: Promise<{ workspaceId: string }> };

/** SOP library listing with search + filters. */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await params;
    await requireWorkspace(workspaceId, "viewer");

    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const department = url.searchParams.get("department")?.trim();
    const category = url.searchParams.get("category")?.trim();
    const owner = url.searchParams.get("owner")?.trim();
    const status = url.searchParams.get("status")?.trim();
    const tag = url.searchParams.get("tag")?.trim();

    const conditions: SQL[] = [
      eq(sopDocuments.workspaceId, workspaceId),
      isNull(sopDocuments.deletedAt),
    ];
    if (q) {
      const search = or(
        ilike(sopDocuments.title, `%${q}%`),
        ilike(sopDocuments.sopNumber, `%${q}%`),
      );
      if (search) conditions.push(search);
    }
    if (department) conditions.push(eq(sopDocuments.department, department));
    if (category) conditions.push(eq(sopDocuments.processCategory, category));
    if (owner) conditions.push(eq(sopDocuments.processOwner, owner));
    if (
      status &&
      ["draft", "in_review", "approved", "published", "archived"].includes(status)
    ) {
      conditions.push(
        eq(sopDocuments.status, status as "draft" | "in_review" | "approved" | "published" | "archived"),
      );
    }

    let docs = await db.query.sopDocuments.findMany({
      where: and(...conditions),
      orderBy: [desc(sopDocuments.updatedAt)],
      limit: 200,
    });
    if (tag) {
      docs = docs.filter((d) => (d.tags ?? []).includes(tag));
    }

    return NextResponse.json({
      documents: docs.map((d) => ({
        id: d.id,
        sopNumber: d.sopNumber,
        title: d.title,
        status: d.status,
        versionNumber: d.versionNumber,
        department: d.department,
        processCategory: d.processCategory,
        processOwner: d.processOwner,
        tags: d.tags ?? [],
        reviewDate: d.reviewDate,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
