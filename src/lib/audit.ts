import { db } from "@/db";
import { auditLogs } from "@/db/schema";

/**
 * Record an audit event for important document and workspace actions.
 * Audit writes must never break the primary action, so failures are logged
 * and swallowed.
 */
export async function recordAudit(params: {
  workspaceId: string;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      workspaceId: params.workspaceId,
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      metadata: params.metadata,
    });
  } catch (error) {
    console.error("[audit] failed to record event", params.action, error);
  }
}
