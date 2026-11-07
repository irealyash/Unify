import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import { listFriendships, sendFriendRequest } from "@/services/friendship.service";

export async function GET() {
  try {
    const user = await requireOnboardedUser();
    const friendships = await listFriendships(user.id);
    return jsonOk({ friendships });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireOnboardedUser();
    const body = z.object({ toUserId: z.string().uuid() }).parse(await req.json());
    const friendship = await sendFriendRequest(user.id, body.toUserId);
    return jsonOk({ friendship });
  } catch (error) {
    return jsonError(error);
  }
}
