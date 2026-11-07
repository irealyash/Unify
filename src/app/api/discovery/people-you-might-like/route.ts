import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import { getPeopleYouMightLike, type UbcFilter } from "@/services/matching.service";

const ubcFilterSchema = z.enum(["all", "ubc_students", "ubc_verified"]);

export async function GET(req: Request) {
  try {
    const user = await requireOnboardedUser();
    const { searchParams } = new URL(req.url);
    const offset = Number(searchParams.get("offset") ?? 0);
    const ubcFilter = ubcFilterSchema.parse(
      searchParams.get("ubc") ?? "all",
    ) as UbcFilter;
    const results = await getPeopleYouMightLike(
      user.id,
      Number.isFinite(offset) ? offset : 0,
      ubcFilter,
    );
    return jsonOk({ results, ubcFilter });
  } catch (error) {
    return jsonError(error);
  }
}
