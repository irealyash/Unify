import { jsonError, jsonOk } from "@/lib/api";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import {
  listNotifications,
  unreadNotificationCount,
} from "@/services/notification.service";

export async function GET() {
  try {
    const user = await requireOnboardedUser();
    const [items, unreadCount] = await Promise.all([
      listNotifications(user.id),
      unreadNotificationCount(user.id),
    ]);
    return jsonOk({ notifications: items, unreadCount });
  } catch (error) {
    return jsonError(error);
  }
}
