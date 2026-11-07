import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations, friendships, messages, users } from "@/lib/db/schema";
import { publishToConversation, publishToUser } from "@/lib/ably/server";
import { createNotification } from "@/services/notification.service";

const MESSAGE_RATE_WINDOW_MS = 10_000;
const MESSAGE_RATE_LIMIT = 8;
const recentSends = new Map<string, number[]>();

function assertRateLimit(userId: string) {
  const now = Date.now();
  const stamps = (recentSends.get(userId) ?? []).filter((t) => now - t < MESSAGE_RATE_WINDOW_MS);
  if (stamps.length >= MESSAGE_RATE_LIMIT) {
    throw new Error("You're sending messages too quickly. Please wait a moment.");
  }
  stamps.push(now);
  recentSends.set(userId, stamps);
}

export async function assertConversationMember(conversationId: string, userId: string) {
  const [row] = await db
    .select({
      conversation: conversations,
      friendship: friendships,
    })
    .from(conversations)
    .innerJoin(friendships, eq(friendships.id, conversations.friendshipId))
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!row) throw new Error("Conversation not found");
  if (row.friendship.status !== "accepted") {
    throw new Error("Messaging is only available after friendship is accepted");
  }
  if (row.friendship.userLowId !== userId && row.friendship.userHighId !== userId) {
    throw new Error("Not authorized");
  }

  const otherUserId =
    row.friendship.userLowId === userId ? row.friendship.userHighId : row.friendship.userLowId;

  return { ...row, otherUserId };
}

export async function listConversations(userId: string) {
  const rows = await db
    .select({
      conversation: conversations,
      friendship: friendships,
    })
    .from(conversations)
    .innerJoin(friendships, eq(friendships.id, conversations.friendshipId))
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(eq(friendships.userLowId, userId), eq(friendships.userHighId, userId)),
      ),
    )
    .orderBy(desc(conversations.updatedAt));

  const result = [];
  for (const row of rows) {
    const otherUserId =
      row.friendship.userLowId === userId ? row.friendship.userHighId : row.friendship.userLowId;
    const [otherUser] = await db.select().from(users).where(eq(users.id, otherUserId)).limit(1);
    const [lastMessage] = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, row.conversation.id))
      .orderBy(desc(messages.createdAt))
      .limit(1);
    const [unread] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, row.conversation.id),
          ne(messages.senderId, userId),
          isNull(messages.readAt),
        ),
      );

    result.push({
      id: row.conversation.id,
      updatedAt: row.conversation.updatedAt,
      otherUser,
      lastMessage: lastMessage ?? null,
      unreadCount: unread?.count ?? 0,
    });
  }

  return result;
}

export async function listMessages(conversationId: string, userId: string, limit = 100) {
  await assertConversationMember(conversationId, userId);
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  return rows.reverse();
}

export async function sendMessage(conversationId: string, senderId: string, content: string) {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > 4000) {
    throw new Error("Message must be between 1 and 4000 characters");
  }

  assertRateLimit(senderId);
  const membership = await assertConversationMember(conversationId, senderId);

  const [message] = await db
    .insert(messages)
    .values({
      conversationId,
      senderId,
      content: trimmed,
    })
    .returning();

  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  await publishToConversation(conversationId, "message", message);

  const [sender] = await db.select().from(users).where(eq(users.id, senderId)).limit(1);
  await createNotification({
    recipientId: membership.otherUserId,
    actorId: senderId,
    type: "new_message",
    entityId: message.id,
    title: "New message",
    body: `${sender?.displayName || sender?.username || "Someone"}: ${trimmed.slice(0, 120)}`,
    href: `/messages/${conversationId}`,
  });
  await publishToUser(membership.otherUserId, "message", {
    conversationId,
    message,
  });

  return message;
}

export async function markConversationRead(conversationId: string, userId: string) {
  await assertConversationMember(conversationId, userId);
  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        ne(messages.senderId, userId),
        isNull(messages.readAt),
      ),
    );
}
