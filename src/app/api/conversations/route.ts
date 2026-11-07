import { jsonError, jsonOk } from "@/lib/api";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import { listConversations } from "@/services/messaging.service";

export async function GET() {
  try {
    const user = await requireOnboardedUser();
    const conversations = await listConversations(user.id);
    return jsonOk({ conversations });
  } catch (error) {
    return jsonError(error);
  }
}
