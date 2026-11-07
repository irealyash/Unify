import { jsonError, jsonOk } from "@/lib/api";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import { acceptFriendRequest } from "@/services/friendship.service";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireOnboardedUser();
    const { id } = await ctx.params;
    const result = await acceptFriendRequest(id, user.id);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
