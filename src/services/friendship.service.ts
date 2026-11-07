import { and, eq, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations, friendships, users } from "@/lib/db/schema";
import type { FriendshipUiStatus } from "@/lib/profiles/public";
import { createNotification } from "@/services/notification.service";

function canonicalPair(a: string, b: string) {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

export async function getFriendshipStatusMap(currentUserId: string, otherIds: string[]) {
  const map = new Map<string, { status: FriendshipUiStatus; friendshipId: string }>();
  if (otherIds.length === 0) return map;

  const uniqueIds = [...new Set(otherIds)];
  const filtered = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(
          eq(friendships.userLowId, currentUserId),
          sql`${friendships.userHighId} IN (${sql.join(
            uniqueIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`,
        ),
        and(
          eq(friendships.userHighId, currentUserId),
          sql`${friendships.userLowId} IN (${sql.join(
            uniqueIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`,
        ),
      ),
    );

  for (const row of filtered) {
    const otherId = row.userLowId === currentUserId ? row.userHighId : row.userLowId;
    if (!uniqueIds.includes(otherId)) continue;

    let status: FriendshipUiStatus = "NONE";
    if (row.status === "accepted") status = "FRIENDS";
    else if (row.status === "blocked") status = "BLOCKED";
    else if (row.status === "declined") status = "DECLINED";
    else if (row.status === "pending") {
      status = row.requestedBy === currentUserId ? "PENDING_OUTGOING" : "PENDING_INCOMING";
    }

    map.set(otherId, { status, friendshipId: row.id });
  }

  return map;
}

export async function sendFriendRequest(fromUserId: string, toUserId: string) {
  if (fromUserId === toUserId) {
    throw new Error("Cannot send a friend request to yourself");
  }

  const [target] = await db.select().from(users).where(eq(users.id, toUserId)).limit(1);
  if (!target || !target.isActive || target.deletedAt) {
    throw new Error("User not found");
  }

  const { low, high } = canonicalPair(fromUserId, toUserId);
  const [existing] = await db
    .select()
    .from(friendships)
    .where(and(eq(friendships.userLowId, low), eq(friendships.userHighId, high)))
    .limit(1);

  if (existing) {
    if (existing.status === "accepted") throw new Error("Already friends");
    if (existing.status === "blocked") throw new Error("Unable to send request");
    if (existing.status === "pending") {
      if (existing.requestedBy === fromUserId) throw new Error("Request already sent");
      // Reverse pending: auto-accept
      return acceptFriendRequest(existing.id, fromUserId);
    }
    // declined → allow re-request
    const [updated] = await db
      .update(friendships)
      .set({ status: "pending", requestedBy: fromUserId, updatedAt: new Date() })
      .where(eq(friendships.id, existing.id))
      .returning();

    await notifyFriendRequest(fromUserId, toUserId, updated.id);
    return updated;
  }

  const [created] = await db
    .insert(friendships)
    .values({
      userLowId: low,
      userHighId: high,
      requestedBy: fromUserId,
      status: "pending",
    })
    .returning();

  await notifyFriendRequest(fromUserId, toUserId, created.id);
  return created;
}

async function notifyFriendRequest(fromUserId: string, toUserId: string, friendshipId: string) {
  const [actor] = await db.select().from(users).where(eq(users.id, fromUserId)).limit(1);
  await createNotification({
    recipientId: toUserId,
    actorId: fromUserId,
    type: "friend_request_received",
    entityId: friendshipId,
    title: "New friend request",
    body: `${actor?.displayName || actor?.username || "Someone"} sent you a friend request.`,
    href: "/friends",
  });
}

export async function acceptFriendRequest(friendshipId: string, actorUserId: string) {
  const [friendship] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, friendshipId))
    .limit(1);

  if (!friendship) throw new Error("Friend request not found");
  if (friendship.status !== "pending") throw new Error("Request is not pending");
  if (friendship.requestedBy === actorUserId) {
    throw new Error("Cannot accept your own request");
  }
  if (friendship.userLowId !== actorUserId && friendship.userHighId !== actorUserId) {
    throw new Error("Not authorized");
  }

  const [updated] = await db
    .update(friendships)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(eq(friendships.id, friendshipId))
    .returning();

  const [conversation] = await db
    .insert(conversations)
    .values({ friendshipId: updated.id })
    .onConflictDoNothing()
    .returning();

  let ensured = conversation;
  if (!ensured) {
    const [existing] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.friendshipId, updated.id))
      .limit(1);
    ensured = existing!;
  }

  const requesterId = friendship.requestedBy;
  const [actor] = await db.select().from(users).where(eq(users.id, actorUserId)).limit(1);

  await createNotification({
    recipientId: requesterId,
    actorId: actorUserId,
    type: "friend_request_accepted",
    entityId: updated.id,
    title: "Friend request accepted",
    body: `${actor?.displayName || actor?.username || "Someone"} accepted your friend request.`,
    href: ensured ? `/messages/${ensured.id}` : "/friends",
  });

  return { friendship: updated, conversation: ensured };
}

export async function declineFriendRequest(friendshipId: string, actorUserId: string) {
  const [friendship] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, friendshipId))
    .limit(1);

  if (!friendship) throw new Error("Friend request not found");
  if (friendship.status !== "pending") throw new Error("Request is not pending");
  if (friendship.userLowId !== actorUserId && friendship.userHighId !== actorUserId) {
    throw new Error("Not authorized");
  }
  if (friendship.requestedBy === actorUserId) {
    throw new Error("Use cancel instead");
  }

  const [updated] = await db
    .update(friendships)
    .set({ status: "declined", updatedAt: new Date() })
    .where(eq(friendships.id, friendshipId))
    .returning();

  return updated;
}

export async function listFriendships(userId: string) {
  const rows = await db
    .select()
    .from(friendships)
    .where(or(eq(friendships.userLowId, userId), eq(friendships.userHighId, userId)));

  const otherIds = rows.map((r) => (r.userLowId === userId ? r.userHighId : r.userLowId));
  const people =
    otherIds.length === 0
      ? []
      : await db
          .select()
          .from(users)
          .where(
            sql`${users.id} IN (${sql.join(
              otherIds.map((id) => sql`${id}::uuid`),
              sql`, `,
            )})`,
          );

  const byId = new Map(people.map((p) => [p.id, p]));

  return rows.map((row) => {
    const otherId = row.userLowId === userId ? row.userHighId : row.userLowId;
    let uiStatus: FriendshipUiStatus = "NONE";
    if (row.status === "accepted") uiStatus = "FRIENDS";
    else if (row.status === "blocked") uiStatus = "BLOCKED";
    else if (row.status === "declined") uiStatus = "DECLINED";
    else if (row.status === "pending") {
      uiStatus = row.requestedBy === userId ? "PENDING_OUTGOING" : "PENDING_INCOMING";
    }

    return {
      ...row,
      uiStatus,
      otherUser: byId.get(otherId) ?? null,
    };
  });
}
