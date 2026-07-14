import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  Clock,
  FileText,
  FilePen,
  Upload,
  Video,
} from "lucide-react";
import { db } from "@/db";
import { projects, sopDocuments } from "@/db/schema";
import { AuthError, requireWorkspace, type WorkspaceContext } from "@/lib/auth";
import { getUsageSummary } from "@/lib/usage";
import { PLANS } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  PROCESSING_STATUSES,
  StatusBadge,
  type ProjectStatus,
} from "@/components/app/status-badge";

export const metadata = { title: "Dashboard" };

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-navy/5 text-navy dark:bg-gold/10 dark:text-gold">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function WorkspaceDashboardPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  let ctx: WorkspaceContext;
  try {
    ctx = await requireWorkspace(workspaceId, "viewer");
  } catch (error) {
    if (error instanceof AuthError) redirect("/dashboard");
    throw error;
  }

  const [docCountsRows, processingRows, recentProjects, usage] =
    await Promise.all([
      db
        .select({
          total: sql<number>`count(*)`,
          drafts: sql<number>`count(*) filter (where ${sopDocuments.status} = 'draft')`,
          published: sql<number>`count(*) filter (where ${sopDocuments.status} = 'published')`,
        })
        .from(sopDocuments)
        .where(
          and(
            eq(sopDocuments.workspaceId, workspaceId),
            isNull(sopDocuments.deletedAt),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(projects)
        .where(
          and(
            eq(projects.workspaceId, workspaceId),
            isNull(projects.deletedAt),
            inArray(projects.status, PROCESSING_STATUSES),
          ),
        ),
      db
        .select({
          id: projects.id,
          title: projects.title,
          status: projects.status,
          progressPercent: projects.progressPercent,
          createdAt: projects.createdAt,
          errorMessage: projects.errorMessage,
        })
        .from(projects)
        .where(
          and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt)),
        )
        .orderBy(desc(projects.createdAt))
        .limit(8),
      getUsageSummary(workspaceId, ctx.plan),
    ]);

  const totalSops = Number(docCountsRows[0]?.total ?? 0);
  const drafts = Number(docCountsRows[0]?.drafts ?? 0);
  const published = Number(docCountsRows[0]?.published ?? 0);
  const processing = Number(processingRows[0]?.count ?? 0);
  const plan = PLANS[ctx.plan];
  const nearLimit = usage.percentUsed > 80;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            What&apos;s happening in {ctx.workspace.name}
          </p>
        </div>
        <Button
          asChild
          size="lg"
          className="bg-gold text-navy shadow-sm hover:bg-gold-dark"
        >
          <Link href={`/w/${workspaceId}/upload`}>
            <Upload className="size-4" />
            Upload a video
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total SOPs" value={totalSops} icon={FileText} />
        <StatCard label="Drafts" value={drafts} icon={FilePen} />
        <StatCard label="Published" value={published} icon={CheckCircle2} />
        <StatCard label="Processing" value={processing} icon={Clock} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent projects</CardTitle>
            <CardDescription>
              Your latest uploads and their processing status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentProjects.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-10 text-center">
                <Video className="size-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">No projects yet</p>
                  <p className="text-sm text-muted-foreground">
                    Upload a screen recording and we&apos;ll turn it into an
                    SOP.
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/w/${workspaceId}/upload`}>
                    Upload your first video
                  </Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y">
                {recentProjects.map((project) => {
                  const status = project.status as ProjectStatus;
                  const isProcessing = PROCESSING_STATUSES.includes(status);
                  return (
                    <li key={project.id}>
                      <Link
                        href={`/w/${workspaceId}/projects/${project.id}`}
                        className="flex items-center gap-4 rounded-md px-2 py-3 transition-colors hover:bg-muted/60"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {project.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(project.createdAt, {
                              addSuffix: true,
                            })}
                          </p>
                          {status === "failed" && project.errorMessage ? (
                            <p className="mt-1 truncate text-xs text-destructive">
                              {project.errorMessage}
                            </p>
                          ) : null}
                          {isProcessing ? (
                            <div className="mt-2 flex items-center gap-2">
                              <Progress
                                value={project.progressPercent}
                                className="h-1.5 max-w-40"
                              />
                              <span className="text-xs tabular-nums text-muted-foreground">
                                {project.progressPercent}%
                              </span>
                            </div>
                          ) : null}
                        </div>
                        <StatusBadge status={status} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>This month&apos;s usage</CardTitle>
            <CardDescription>
              Transcription minutes for {usage.period}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Plan</span>
              <Badge variant="secondary">{plan.name}</Badge>
            </div>
            <div className="space-y-2">
              <Progress
                value={usage.percentUsed}
                className={nearLimit ? "[&>div]:bg-amber-500" : undefined}
              />
              <p className="text-sm">
                <span className="font-medium tabular-nums">
                  {Math.round(usage.usedMinutes)}
                </span>{" "}
                of{" "}
                <span className="tabular-nums">{usage.allowanceMinutes}</span>{" "}
                minutes used
              </p>
              <p className="text-xs text-muted-foreground">
                {Math.floor(usage.remainingMinutes)} minutes remaining this
                month.
              </p>
            </div>
            {nearLimit ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                You&apos;ve used {Math.round(usage.percentUsed)}% of your
                monthly minutes.{" "}
                <Link
                  href={`/w/${workspaceId}/settings/billing`}
                  className="font-medium underline underline-offset-2"
                >
                  Upgrade your plan
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
