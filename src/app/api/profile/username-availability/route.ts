import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireClerkUserId, syncClerkBasics } from "@/lib/auth/current-user";
import { isUsernameAvailable } from "@/services/profile.service";

export async function GET(req: Request) {
  try {
    await requireClerkUserId();
    const user = await syncClerkBasics();
    const { searchParams } = new URL(req.url);
    const username = z.string().parse(searchParams.get("username"));
    const result = await isUsernameAvailable(username, user?.id);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
