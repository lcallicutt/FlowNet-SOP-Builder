import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { usageRecords } from "@/db/schema";
import { PLANS, type PlanId } from "@/lib/plans";

/** Current billing period bucket, YYYY-MM in UTC. */
export function currentPeriod(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function recordTranscriptionUsage(params: {
  workspaceId: string;
  projectId: string;
  seconds: number;
}) {
  await db.insert(usageRecords).values({
    workspaceId: params.workspaceId,
    projectId: params.projectId,
    type: "transcription_seconds",
    quantity: params.seconds,
    period: currentPeriod(),
  });
}

export async function getTranscriptionMinutesUsed(
  workspaceId: string,
  period = currentPeriod(),
): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${usageRecords.quantity}), 0)`,
    })
    .from(usageRecords)
    .where(
      and(
        eq(usageRecords.workspaceId, workspaceId),
        eq(usageRecords.period, period),
        eq(usageRecords.type, "transcription_seconds"),
      ),
    );
  return (row?.total ?? 0) / 60;
}

export async function getUsageSummary(workspaceId: string, plan: PlanId) {
  const usedMinutes = await getTranscriptionMinutesUsed(workspaceId);
  const allowance = PLANS[plan].features.transcriptionMinutesPerMonth;
  return {
    period: currentPeriod(),
    usedMinutes,
    allowanceMinutes: allowance,
    remainingMinutes: Math.max(0, allowance - usedMinutes),
    percentUsed: allowance > 0 ? Math.min(100, (usedMinutes / allowance) * 100) : 100,
  };
}
