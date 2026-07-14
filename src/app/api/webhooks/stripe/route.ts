import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { stripe } from "@/lib/stripe";
import { planForStripePriceId, type PlanId } from "@/lib/plans";

/**
 * Stripe webhook: keeps the subscriptions table in sync. Signature-verified;
 * unverified requests are rejected.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const workspaceId =
        session.metadata?.workspaceId ?? session.client_reference_id;
      if (!workspaceId) break;
      await db
        .update(subscriptions)
        .set({
          stripeCustomerId:
            typeof session.customer === "string"
              ? session.customer
              : session.customer?.id ?? null,
          stripeSubscriptionId:
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id ?? null,
          ...(session.metadata?.plan
            ? { plan: session.metadata.plan as PlanId, status: "active" as const }
            : {}),
        })
        .where(eq(subscriptions.workspaceId, workspaceId));
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const workspaceId = sub.metadata?.workspaceId;
      if (!workspaceId) break;

      const priceId = sub.items.data[0]?.price?.id;
      const plan = priceId ? planForStripePriceId(priceId) : null;
      const item = sub.items.data[0];

      await db
        .update(subscriptions)
        .set({
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId ?? null,
          ...(plan ? { plan } : {}),
          status:
            sub.status === "active" || sub.status === "trialing"
              ? sub.status === "trialing"
                ? "trialing"
                : "active"
              : sub.status === "past_due"
                ? "past_due"
                : sub.status === "canceled"
                  ? "canceled"
                  : "incomplete",
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          ...(item?.current_period_start
            ? { currentPeriodStart: new Date(item.current_period_start * 1000) }
            : {}),
          ...(item?.current_period_end
            ? { currentPeriodEnd: new Date(item.current_period_end * 1000) }
            : {}),
        })
        .where(eq(subscriptions.workspaceId, workspaceId));
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const workspaceId = sub.metadata?.workspaceId;
      if (!workspaceId) break;
      // Downgrade to the free tier when the paid subscription ends.
      await db
        .update(subscriptions)
        .set({
          plan: "starter",
          status: "canceled",
          stripeSubscriptionId: null,
          stripePriceId: null,
          cancelAtPeriodEnd: false,
        })
        .where(eq(subscriptions.workspaceId, workspaceId));
      break;
    }
  }

  return NextResponse.json({ received: true });
}
