import { jsonError, jsonOk } from "@/lib/api";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import { getPeopleYouMightLike } from "@/services/matching.service";

export async function GET(req: Request) {
  try {
    const user = await requireOnboardedUser();
    const offset = Number(new URL(req.url).searchParams.get("offset") ?? 0);
    const results = await getPeopleYouMightLike(user.id, Number.isFinite(offset) ? offset : 0);
    return jsonOk({ results });
  } catch (error) {
    return jsonError(error);
  }
}
