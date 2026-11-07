import { jsonError, jsonOk } from "@/lib/api";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import { declineFriendRequest } from "@/services/friendship.service";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireOnboardedUser();
    const { id } = await ctx.params;
    const friendship = await declineFriendRequest(id, user.id);
    return jsonOk({ friendship });
  } catch (error) {
    return jsonError(error);
  }
}
