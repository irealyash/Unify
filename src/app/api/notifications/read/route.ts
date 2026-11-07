import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import { markNotificationsRead } from "@/services/notification.service";

export async function POST(req: Request) {
  try {
    const user = await requireOnboardedUser();
    const body = z
      .object({ ids: z.array(z.string().uuid()).optional() })
      .parse(await req.json().catch(() => ({})));
    await markNotificationsRead(user.id, body.ids);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
