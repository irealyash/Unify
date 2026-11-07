import { Webhook } from "svix";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userProfiles, users } from "@/lib/db/schema";

type ClerkWebhookEvent = {
  type: string;
  data: {
    id: string;
    image_url?: string;
    first_name?: string | null;
    last_name?: string | null;
    deleted?: boolean;
  };
};

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const payload = await req.text();
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const wh = new Webhook(secret);
  let event: ClerkWebhookEvent;

  try {
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as unknown as ClerkWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotent upsert — onboarding still creates/updates synchronously.
  if (event.type === "user.created" || event.type === "user.updated") {
    const clerkUserId = event.data.id;
    const displayName =
      [event.data.first_name, event.data.last_name].filter(Boolean).join(" ") || null;

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);

    if (existing) {
      await db
        .update(users)
        .set({
          avatarUrl: event.data.image_url ?? existing.avatarUrl,
          displayName: existing.displayName || displayName,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id));
      await db.insert(userProfiles).values({ userId: existing.id }).onConflictDoNothing();
    } else {
      const [created] = await db
        .insert(users)
        .values({
          clerkUserId,
          avatarUrl: event.data.image_url ?? null,
          displayName,
        })
        .returning();
      await db.insert(userProfiles).values({ userId: created.id }).onConflictDoNothing();
    }
  }

  if (event.type === "user.deleted") {
    await db
      .update(users)
      .set({
        isActive: false,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.clerkUserId, event.data.id));
  }

  return NextResponse.json({ ok: true });
}
