import { jsonError, jsonOk } from "@/lib/api";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import {
  conversationChannelName,
  createAblyTokenRequest,
  userChannelName,
} from "@/lib/ably/server";
import { listConversations } from "@/services/messaging.service";

export async function GET() {
  try {
    const user = await requireOnboardedUser();
    const conversations = await listConversations(user.id);

    const capability: Record<string, string[]> = {
      [userChannelName(user.id)]: ["subscribe", "presence"],
    };

    for (const conversation of conversations) {
      capability[conversationChannelName(conversation.id)] = ["subscribe", "presence"];
    }

    const tokenRequest = await createAblyTokenRequest(user.id, capability);
    return jsonOk({ tokenRequest });
  } catch (error) {
    return jsonError(error);
  }
}
