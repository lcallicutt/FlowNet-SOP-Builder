import { redirect } from "next/navigation";
import { format } from "date-fns";
import { and, desc, eq, inArray, isNull, ne, sql, sum } from "drizzle-orm";
import {
  Activity,
  AlertTriangle,
  Bot,
  Clock,
  HardDrive,
  Users,
  Video,
} from "lucide-react";
import { db } from "@/db";
import {
  processingJobs,
  projects,
  subscriptions,
  uploadedFiles,
  usageRecords,
  users,
} from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/auth";
import { PLANS, PLAN_ORDER } from "@/lib/plans";
import { formatBytes, formatMinutes } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Platform Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  try {
    await requirePlatformAdmin();
  } catch {
    redirect("/dashboard");
  }

  const [
    userCountRows,
    planRows,
    videoRows,
    transcriptionRows,
    failureCountRows,
    aiFailureRows,
    latestFailedJobs,
    storageRows,
    recentUsers,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(isNull(users.deletedAt)),
    db
      .select({ plan: subscriptions.plan, count: sql<number>`count(*)::int` })
      .from(subscriptions)
      .where(inArray(subscriptions.status, ["active", "trialing"]))
      .groupBy(subscriptions.plan),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(projects)
      .where(
        and(
          inArray(projects.status, [
            "published",
            "ready_for_review",
            "transcript_ready",
          ]),
          isNull(projects.deletedAt),
        ),
      ),
    db
      .select({ total: sum(usageRecords.quantity) })
      .from(usageRecords)
      .where(eq(usageRecords.type, "transcription_seconds")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(processingJobs)
      .where(eq(processingJobs.status, "failed")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(processingJobs)
      .where(
        and(
          eq(processingJobs.status, "failed"),
          inArray(processingJobs.type, ["analyze_process", "generate_documents"]),
        ),
      ),
    db
      .select({
        id: processingJobs.id,
        type: processingJobs.type,
        projectId: processingJobs.projectId,
        errorDetail: processingJobs.errorDetail,
        createdAt: processingJobs.createdAt,
      })
      .from(processingJobs)
      .where(eq(processingJobs.status, "failed"))
      .orderBy(desc(processingJobs.createdAt))
      .limit(10),
    db
      .select({ total: sum(uploadedFiles.sizeBytes) })
      .from(uploadedFiles)
      .where(
        and(ne(uploadedFiles.status, "deleted"), isNull(uploadedFiles.deletedAt)),
      ),
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(isNull(users.deletedAt))
      .orderBy(desc(users.createdAt))
      .limit(10),
  ]);

  const totalUsers = userCountRows[0]?.count ?? 0;
  const videosProcessed = videoRows[0]?.count ?? 0;
  const transcriptionMinutes = Number(transcriptionRows[0]?.total ?? 0) / 60;
  const processingFailures = failureCountRows[0]?.count ?? 0;
  const aiFailures = aiFailureRows[0]?.count ?? 0;
  const storageBytes = Number(storageRows[0]?.total ?? 0);

  const subsByPlan = new Map(planRows.map((r) => [r.plan, r.count]));
  const activeSubscriptions = planRows.reduce((acc, r) => acc + r.count, 0);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform admin</h1>
        <p className="text-sm text-muted-foreground">
          Internal operations dashboard — usage, processing health, and signups.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total users" value={totalUsers.toLocaleString()} />
        <StatCard
          icon={Activity}
          label="Active subscriptions"
          value={activeSubscriptions.toLocaleString()}
        />
        <StatCard
          icon={Video}
          label="Videos processed"
          value={videosProcessed.toLocaleString()}
        />
        <StatCard
          icon={Clock}
          label="Transcription minutes"
          value={formatMinutes(transcriptionMinutes)}
        />
        <StatCard
          icon={AlertTriangle}
          label="Processing failures"
          value={processingFailures.toLocaleString()}
          alert={processingFailures > 0}
        />
        <StatCard
          icon={Bot}
          label="AI generation failures"
          value={aiFailures.toLocaleString()}
          alert={aiFailures > 0}
        />
        <StatCard
          icon={HardDrive}
          label="Storage used"
          value={formatBytes(storageBytes)}
        />
      </div>

      {/* Usage by plan */}
      <Card className="py-4">
        <CardHeader className="px-4 py-0">
          <CardTitle className="text-sm font-semibold">Usage by plan</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Monthly price</TableHead>
                <TableHead className="text-right">Active + trialing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PLAN_ORDER.map((planId) => (
                <TableRow key={planId}>
                  <TableCell className="font-medium">{PLANS[planId].name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    ${PLANS[planId].monthlyPriceUsd}/mo
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(subsByPlan.get(planId) ?? 0).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Latest failed jobs */}
        <Card className="py-4">
          <CardHeader className="px-4 py-0">
            <CardTitle className="text-sm font-semibold">
              Latest failed jobs
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            {latestFailedJobs.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No failed jobs. Pipeline is healthy.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {latestFailedJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {job.type}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className="max-w-24 truncate font-mono text-xs text-muted-foreground"
                          title={job.projectId}
                        >
                          {job.projectId.slice(0, 8)}…
                        </TableCell>
                        <TableCell className="max-w-72 text-xs text-muted-foreground">
                          <span className="line-clamp-2">
                            {truncate(job.errorDetail, 200) ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {format(job.createdAt, "MMM d, HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent signups */}
        <Card className="py-4">
          <CardHeader className="px-4 py-0">
            <CardTitle className="text-sm font-semibold">Recent signups</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            {recentUsers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No users yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Signed up</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {format(user.createdAt, "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function truncate(value: string | null, max: number): string | null {
  if (!value) return value;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function StatCard({
  icon: Icon,
  label,
  value,
  alert,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-center gap-3 px-4">
        <span
          className={
            alert
              ? "flex size-9 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive"
              : "flex size-9 shrink-0 items-center justify-center rounded-md bg-navy/5 text-navy dark:bg-gold/10 dark:text-gold"
          }
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold tabular-nums">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
