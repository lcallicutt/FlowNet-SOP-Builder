import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { requireWorkspace } from "@/lib/auth";
import { ApiError, handleRouteError } from "@/lib/api";
import { getStripePriceId, type PlanId } from "@/lib/plans";
import { stripe } from "@/lib/stripe";

type Params = { params: Promise<{ workspaceId: string }> };

const schema = z.object({ plan: z.enum(["professional", "business"]) });

/** Create a Stripe Checkout session to upgrade the workspace (owner/admin). */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await params;
    const ctx = await requireWorkspace(workspaceId, "admin");
    const { plan } = schema.parse(await req.json());

    const priceId = getStripePriceId(plan as PlanId);
    if (!priceId) {
      throw new ApiError(
        500,
        "Billing isn't fully configured yet — the Stripe price for this plan is missing.",
      );
    }

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.workspaceId, workspaceId),
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      ...(sub?.stripeCustomerId
        ? { customer: sub.stripeCustomerId }
        : { customer_email: ctx.user.email }),
      client_reference_id: workspaceId,
      metadata: { workspaceId, plan },
      subscription_data: { metadata: { workspaceId, plan } },
      success_url: `${appUrl}/w/${workspaceId}/settings/billing?upgraded=1`,
      cancel_url: `${appUrl}/w/${workspaceId}/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return handleRouteError(error);
  }
}
