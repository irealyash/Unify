import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import { getDiscovery, type DiscoveryKind } from "@/services/matching.service";

const kindSchema = z.enum(["you_might_like", "might_like_you", "mutual"]);

export async function GET(req: Request) {
  try {
    const user = await requireOnboardedUser();
    const { searchParams } = new URL(req.url);
    const kind = kindSchema.parse(searchParams.get("kind") ?? "mutual") as DiscoveryKind;
    const offset = Number(searchParams.get("offset") ?? 0);
    const results = await getDiscovery(kind, user.id, Number.isFinite(offset) ? offset : 0);
    return jsonOk({ kind, results });
  } catch (error) {
    return jsonError(error);
  }
}
