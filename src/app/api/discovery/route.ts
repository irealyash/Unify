import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import {
  getDiscovery,
  type DiscoveryKind,
  type UbcFilter,
} from "@/services/matching.service";

const kindSchema = z.enum(["you_might_like", "might_like_you", "mutual"]);
const ubcFilterSchema = z.enum(["all", "ubc_students", "ubc_verified"]);

export async function GET(req: Request) {
  try {
    const user = await requireOnboardedUser();
    const { searchParams } = new URL(req.url);
    const kind = kindSchema.parse(searchParams.get("kind") ?? "mutual") as DiscoveryKind;
    const ubcFilter = ubcFilterSchema.parse(
      searchParams.get("ubc") ?? "all",
    ) as UbcFilter;
    const offset = Number(searchParams.get("offset") ?? 0);
    const results = await getDiscovery(
      kind,
      user.id,
      Number.isFinite(offset) ? offset : 0,
      ubcFilter,
    );
    return jsonOk({ kind, ubcFilter, results });
  } catch (error) {
    return jsonError(error);
  }
}
