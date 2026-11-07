import { and, eq, isNull } from "drizzle-orm";
import { jsonError, jsonOk } from "@/lib/api";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { userProfiles, users } from "@/lib/db/schema";
import { normalizeUsername } from "@/lib/validators/username";
import { getFriendshipStatusMap } from "@/services/friendship.service";
import { toPublicPerson } from "@/lib/profiles/public";
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ username: string }> },
) {
  try {
    const viewer = await requireOnboardedUser();
    const { username } = await ctx.params;
    const normalized = normalizeUsername(username);

    const [row] = await db
      .select({
        user: users,
        profile: userProfiles,
      })
      .from(users)
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(
        and(
          eq(users.usernameNormalized, normalized),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    if (!row?.user.username || !row.profile.onboardingCompletedAt) {
      throw new Error("User not found");
    }

    const friendshipMap = await getFriendshipStatusMap(viewer.id, [row.user.id]);
    const friendship = friendshipMap.get(row.user.id);

    const person = toPublicPerson(
      row.user,
      { publicSummary: row.profile.publicSummary },
      friendship,
    );

    return jsonOk({
      person: {
        ...person,
        score: 0,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
