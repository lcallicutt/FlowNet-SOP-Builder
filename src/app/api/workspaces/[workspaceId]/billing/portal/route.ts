import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { ApiError, handleRouteError } from "@/lib/api";
import { stripe } from "@/lib/stripe";

type Params = { params: Promise<{ workspaceId: string }> };

/** Open the Stripe billing portal for the workspace's customer. */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await params;
    await requireWorkspace(workspaceId, "admin");

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.workspaceId, workspaceId),
    });
    if (!sub?.stripeCustomerId) {
      throw new ApiError(
        404,
        "No billing account yet — upgrade to a paid plan first.",
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const session = await stripe().billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${appUrl}/w/${workspaceId}/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return handleRouteError(error);
  }
}
