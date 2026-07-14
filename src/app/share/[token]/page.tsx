import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { FileQuestion, Lock } from "lucide-react";
import { db } from "@/db";
import { sharedLinks, workspaces } from "@/db/schema";
import { loadDocumentPackage } from "@/lib/documents";
import { SharedDocumentView } from "@/components/share/shared-document-view";

/**
 * Public share page. Its own minimal chrome (navy band + footer inside
 * SharedDocumentView) — deliberately outside the (app) group so no sidebar
 * or workspace chrome renders around it.
 */

export const metadata: Metadata = {
  title: "Shared SOP",
  robots: { index: false, follow: false },
};

type ShareLinkRow = typeof sharedLinks.$inferSelect;

async function resolveLink(token: string): Promise<ShareLinkRow | null> {
  const link = await db.query.sharedLinks.findFirst({
    where: eq(sharedLinks.token, token),
  });
  if (!link) return null;
  if (!link.isActive) return null;
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return null;
  return link;
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const link = await resolveLink(token);
  // Same page for missing, disabled, and expired links — no status leaks.
  if (!link) return <LinkUnavailable />;

  if (link.requireAuth) {
    const { userId } = await auth();
    if (!userId) return <SignInRequired token={token} />;
  }

  const pkg = await loadDocumentPackage(link.sopDocumentId);
  if (!pkg) return <LinkUnavailable />;

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, link.workspaceId),
  });

  return (
    <SharedDocumentView
      pkg={pkg}
      workspaceName={workspace?.name ?? "FlowNet SOP Builder"}
    />
  );
}

function MinimalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      {children}
      <p className="mt-10 text-xs text-muted-foreground">
        Published with FlowNet SOP Builder
      </p>
    </div>
  );
}

function LinkUnavailable() {
  return (
    <MinimalShell>
      <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
          <FileQuestion className="size-6 text-muted-foreground" />
        </span>
        <h1 className="mt-4 text-lg font-semibold">
          This link is no longer available
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The document may have been unshared, or the link may have expired.
          Ask the person who sent it to you for a new link.
        </p>
      </div>
    </MinimalShell>
  );
}

function SignInRequired({ token }: { token: string }) {
  return (
    <MinimalShell>
      <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
          <Lock className="size-6 text-muted-foreground" />
        </span>
        <h1 className="mt-4 text-lg font-semibold">Sign in required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The owner of this document requires viewers to sign in before
          reading it.
        </p>
        <Link
          href={`/sign-in?redirect_url=${encodeURIComponent(`/share/${token}`)}`}
          className="mt-5 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Sign in to view
        </Link>
      </div>
    </MinimalShell>
  );
}
