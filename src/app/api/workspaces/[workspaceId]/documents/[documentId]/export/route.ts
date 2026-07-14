import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { sopDocuments } from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { ApiError, handleRouteError, jsonError } from "@/lib/api";
import { PLANS } from "@/lib/plans";
import { loadDocumentPackage } from "@/lib/documents";
import { renderExport } from "@/lib/exports";
import { rateLimit } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ workspaceId: string; documentId: string }> };

const schema = z.object({
  format: z.enum(["pdf", "docx", "markdown", "text"]),
  selection: z.enum([
    "sop",
    "checklist",
    "quick_guide",
    "training_guide",
    "full_package",
  ]),
});

/** Render and download an export. Format access is plan-gated. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, documentId } = await params;
    const ctx = await requireWorkspace(workspaceId, "viewer");
    const { format, selection } = schema.parse(await req.json());

    const limited = rateLimit({
      key: `export:${ctx.user.id}`,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    });
    if (!limited.ok) {
      return jsonError(429, "Too many exports in the last hour. Try again soon.");
    }

    const features = PLANS[ctx.plan].features;
    if (format === "pdf" && !features.pdfExport) {
      throw new ApiError(403, "PDF export isn't included in your plan.", "plan_upgrade_required");
    }
    if (format === "docx" && !features.docxExport) {
      throw new ApiError(
        403,
        "DOCX export is available on the Professional and Business plans.",
        "plan_upgrade_required",
      );
    }
    if (
      !features.allDocumentTypes &&
      ["checklist", "quick_guide", "training_guide", "full_package"].includes(selection)
    ) {
      throw new ApiError(
        403,
        "Checklist, quick-guide, and training-guide exports are available on the Professional and Business plans.",
        "plan_upgrade_required",
      );
    }

    const doc = await db.query.sopDocuments.findFirst({
      where: and(
        eq(sopDocuments.id, documentId),
        eq(sopDocuments.workspaceId, workspaceId),
      ),
    });
    if (!doc || doc.deletedAt) throw new ApiError(404, "Document not found.");

    const pkg = await loadDocumentPackage(documentId);
    if (!pkg) throw new ApiError(404, "Document not found.");

    let result;
    try {
      result = await renderExport(pkg, format, selection, {
        workspaceName: features.workspaceBranding
          ? ctx.workspace.name
          : "FlowNet SOP Builder",
        brandColor: features.workspaceBranding ? ctx.workspace.brandColor : null,
      });
    } catch (error) {
      console.error("[export] render failed", { documentId, format, selection, error });
      return jsonError(
        500,
        "We couldn't generate that export. Try a different format, or try again in a moment.",
        "export_failed",
      );
    }

    await recordAudit({
      workspaceId,
      actorUserId: ctx.user.id,
      action: "document.export",
      entityType: "sop_document",
      entityId: documentId,
      metadata: { format, selection },
    });

    return new NextResponse(Buffer.from(result.bytes), {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
