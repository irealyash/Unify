import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, type notificationTypeEnum } from "@/lib/db/schema";
import { publishToUser } from "@/lib/ably/server";

type NotificationType = (typeof notificationTypeEnum.enumValues)[number];

export async function createNotification(params: {
  recipientId: string;
  actorId?: string | null;
  type: NotificationType;
  entityId?: string | null;
  title: string;
  body: string;
  href?: string | null;
}) {
  const [notification] = await db
    .insert(notifications)
    .values({
      recipientId: params.recipientId,
      actorId: params.actorId ?? null,
      type: params.type,
      entityId: params.entityId ?? null,
      title: params.title,
      body: params.body,
      href: params.href ?? null,
    })
    .returning();

  await publishToUser(params.recipientId, "notification", notification);
  return notification;
}

export async function listNotifications(userId: string, limit = 50) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function unreadNotificationCount(userId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.recipientId, userId), isNull(notifications.readAt)));
  return row?.count ?? 0;
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  const where = ids?.length
    ? and(eq(notifications.recipientId, userId), inArray(notifications.id, ids))
    : and(eq(notifications.recipientId, userId), isNull(notifications.readAt));

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(where);
}
