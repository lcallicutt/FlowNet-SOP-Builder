import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { claimPendingInvites } from "@/lib/auth";

type ClerkEmail = { id: string; email_address: string };
type ClerkUserPayload = {
  id: string;
  email_addresses?: ClerkEmail[];
  primary_email_address_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
};

/**
 * Clerk → local user sync. Verified with the svix signature; unverified
 * requests are rejected.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    console.error("[clerk-webhook] CLERK_WEBHOOK_SIGNING_SECRET not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let event: { type: string; data: ClerkUserPayload };
  try {
    event = new Webhook(secret).verify(payload, headers) as typeof event;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const data = event.data;
  const primaryEmail =
    data.email_addresses?.find((e) => e.id === data.primary_email_address_id)
      ?.email_address ??
    data.email_addresses?.[0]?.email_address ??
    "";
  const name =
    [data.first_name, data.last_name].filter(Boolean).join(" ") || null;

  switch (event.type) {
    case "user.created": {
      const [created] = await db
        .insert(users)
        .values({
          clerkId: data.id,
          email: primaryEmail,
          name,
          imageUrl: data.image_url ?? null,
        })
        .onConflictDoNothing({ target: users.clerkId })
        .returning();
      if (created) await claimPendingInvites(created.id, primaryEmail);
      break;
    }
    case "user.updated": {
      await db
        .update(users)
        .set({ email: primaryEmail, name, imageUrl: data.image_url ?? null })
        .where(eq(users.clerkId, data.id));
      break;
    }
    case "user.deleted": {
      // Soft-delete; workspace content is retained per data-retention policy
      // until the workspace owner deletes it or account purge runs.
      await db
        .update(users)
        .set({ deletedAt: new Date() })
        .where(eq(users.clerkId, data.id));
      break;
    }
  }

  return NextResponse.json({ ok: true });
}
