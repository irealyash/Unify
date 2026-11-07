import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import {
  listMessages,
  markConversationRead,
  sendMessage,
} from "@/services/messaging.service";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireOnboardedUser();
    const { id } = await ctx.params;
    const messages = await listMessages(id, user.id);
    await markConversationRead(id, user.id);
    return jsonOk({ messages });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireOnboardedUser();
    const { id } = await ctx.params;
    const body = z
      .object({ content: z.string().trim().min(1).max(4000) })
      .parse(await req.json());
    const message = await sendMessage(id, user.id, body.content);
    return jsonOk({ message });
  } catch (error) {
    return jsonError(error);
  }
}
