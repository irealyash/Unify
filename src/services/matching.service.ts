import { sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  cosineDistanceToDisplayScore,
  cosineDistanceToSimilarity,
  mutualDisplayScore,
} from "@/lib/matching/scores";
import { toPublicPerson, type FriendshipUiStatus, type PublicPerson } from "@/lib/profiles/public";
import { getFriendshipStatusMap } from "@/services/friendship.service";

export type DiscoveryKind = "you_might_like" | "might_like_you" | "mutual";
export type UbcFilter = "all" | "ubc_students" | "ubc_verified";

export type DiscoveryResult = PublicPerson & {
  score: number;
  scoreAB?: number;
  scoreBA?: number;
};

type RawMatchRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  interests: string[] | null;
  skills: string[] | null;
  is_ubc_student_claim: boolean;
  is_ubc_verified: boolean;
  public_summary: string | null;
  distance: number;
  distance_ab?: number;
  distance_ba?: number;
};

function extractRows(result: unknown): RawMatchRow[] {
  if (Array.isArray(result)) return result as RawMatchRow[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: RawMatchRow[] }).rows ?? [];
  }
  return [];
}

function pageSize() {
  const raw = Number(process.env.DISCOVERY_PAGE_SIZE || 20);
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 50) : 20;
}

function ubcFilterSql(filter: UbcFilter): SQL {
  if (filter === "ubc_verified") {
    return sql`AND u.is_ubc_verified = true`;
  }
  if (filter === "ubc_students") {
    // Claimed UBC students (includes verified)
    return sql`AND (u.is_ubc_student_claim = true OR u.is_ubc_verified = true)`;
  }
  return sql``;
}

async function hydrateResults(
  currentUserId: string,
  rows: RawMatchRow[],
  mapper: (row: RawMatchRow) => Omit<DiscoveryResult, keyof PublicPerson> & { score: number },
): Promise<DiscoveryResult[]> {
  const friendshipMap = await getFriendshipStatusMap(
    currentUserId,
    rows.map((r) => r.id),
  );

  return rows.map((row) => {
    const friendship = friendshipMap.get(row.id);
    const person = toPublicPerson(
      {
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        interests: row.interests ?? [],
        skills: row.skills ?? [],
        isUbcStudentClaim: row.is_ubc_student_claim,
        isUbcVerified: row.is_ubc_verified,
      },
      { publicSummary: row.public_summary || "" },
      friendship
        ? {
            status: friendship.status as FriendshipUiStatus,
            friendshipId: friendship.friendshipId,
          }
        : undefined,
    );

    return {
      ...person,
      ...mapper(row),
    };
  });
}

export async function getPeopleYouMightLike(
  currentUserId: string,
  offset = 0,
  ubcFilter: UbcFilter = "all",
) {
  const limit = pageSize();
  const ubcClause = ubcFilterSql(ubcFilter);
  const result = await db.execute(sql`
    WITH me AS (
      SELECT seeking_embedding, embedding_model
      FROM user_profiles
      WHERE user_id = ${currentUserId}::uuid
        AND seeking_embedding IS NOT NULL
        AND onboarding_completed_at IS NOT NULL
    )
    SELECT
      u.id,
      u.username,
      u.display_name,
      u.avatar_url,
      u.interests,
      u.skills,
      u.is_ubc_student_claim,
      u.is_ubc_verified,
      p.public_summary,
      (p.self_embedding <=> me.seeking_embedding) AS distance
    FROM users u
    INNER JOIN user_profiles p ON p.user_id = u.id
    CROSS JOIN me
    WHERE u.id <> ${currentUserId}::uuid
      AND u.is_active = true
      AND u.deleted_at IS NULL
      AND p.onboarding_completed_at IS NOT NULL
      AND p.self_embedding IS NOT NULL
      AND p.embedding_model = me.embedding_model
      AND NOT EXISTS (
        SELECT 1 FROM blocked_users b
        WHERE (b.blocker_id = ${currentUserId}::uuid AND b.blocked_id = u.id)
           OR (b.blocker_id = u.id AND b.blocked_id = ${currentUserId}::uuid)
      )
      ${ubcClause}
    ORDER BY distance ASC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  const rows = extractRows(result);
  return hydrateResults(currentUserId, rows, (row) => ({
    score: cosineDistanceToDisplayScore(Number(row.distance)),
  }));
}

export async function getPeopleWhoMightLikeYou(
  currentUserId: string,
  offset = 0,
  ubcFilter: UbcFilter = "all",
) {
  const limit = pageSize();
  const ubcClause = ubcFilterSql(ubcFilter);
  const result = await db.execute(sql`
    WITH me AS (
      SELECT self_embedding, embedding_model
      FROM user_profiles
      WHERE user_id = ${currentUserId}::uuid
        AND self_embedding IS NOT NULL
        AND onboarding_completed_at IS NOT NULL
    )
    SELECT
      u.id,
      u.username,
      u.display_name,
      u.avatar_url,
      u.interests,
      u.skills,
      u.is_ubc_student_claim,
      u.is_ubc_verified,
      p.public_summary,
      (p.seeking_embedding <=> me.self_embedding) AS distance
    FROM users u
    INNER JOIN user_profiles p ON p.user_id = u.id
    CROSS JOIN me
    WHERE u.id <> ${currentUserId}::uuid
      AND u.is_active = true
      AND u.deleted_at IS NULL
      AND p.onboarding_completed_at IS NOT NULL
      AND p.seeking_embedding IS NOT NULL
      AND p.embedding_model = me.embedding_model
      AND NOT EXISTS (
        SELECT 1 FROM blocked_users b
        WHERE (b.blocker_id = ${currentUserId}::uuid AND b.blocked_id = u.id)
           OR (b.blocker_id = u.id AND b.blocked_id = ${currentUserId}::uuid)
      )
      ${ubcClause}
    ORDER BY distance ASC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  const rows = extractRows(result);
  return hydrateResults(currentUserId, rows, (row) => ({
    score: cosineDistanceToDisplayScore(Number(row.distance)),
  }));
}

export async function getMutualConnections(
  currentUserId: string,
  offset = 0,
  ubcFilter: UbcFilter = "all",
) {
  const limit = pageSize();
  const ubcClause = ubcFilterSql(ubcFilter);
  const result = await db.execute(sql`
    WITH me AS (
      SELECT self_embedding, seeking_embedding, embedding_model
      FROM user_profiles
      WHERE user_id = ${currentUserId}::uuid
        AND self_embedding IS NOT NULL
        AND seeking_embedding IS NOT NULL
        AND onboarding_completed_at IS NOT NULL
    )
    SELECT
      u.id,
      u.username,
      u.display_name,
      u.avatar_url,
      u.interests,
      u.skills,
      u.is_ubc_student_claim,
      u.is_ubc_verified,
      p.public_summary,
      (p.self_embedding <=> me.seeking_embedding) AS distance_ab,
      (me.self_embedding <=> p.seeking_embedding) AS distance_ba
    FROM users u
    INNER JOIN user_profiles p ON p.user_id = u.id
    CROSS JOIN me
    WHERE u.id <> ${currentUserId}::uuid
      AND u.is_active = true
      AND u.deleted_at IS NULL
      AND p.onboarding_completed_at IS NOT NULL
      AND p.self_embedding IS NOT NULL
      AND p.seeking_embedding IS NOT NULL
      AND p.embedding_model = me.embedding_model
      AND NOT EXISTS (
        SELECT 1 FROM blocked_users b
        WHERE (b.blocker_id = ${currentUserId}::uuid AND b.blocked_id = u.id)
           OR (b.blocker_id = u.id AND b.blocked_id = ${currentUserId}::uuid)
      )
      ${ubcClause}
    ORDER BY
      CASE
        WHEN (
          (1 - (p.self_embedding <=> me.seeking_embedding))
          + (1 - (me.self_embedding <=> p.seeking_embedding))
        ) = 0 THEN 0
        ELSE (
          2.0
          * (1 - (p.self_embedding <=> me.seeking_embedding))
          * (1 - (me.self_embedding <=> p.seeking_embedding))
          / (
            (1 - (p.self_embedding <=> me.seeking_embedding))
            + (1 - (me.self_embedding <=> p.seeking_embedding))
          )
        )
      END DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  const rows = extractRows(result);
  return hydrateResults(currentUserId, rows, (row) => {
    const scoreAB = cosineDistanceToSimilarity(Number(row.distance_ab));
    const scoreBA = cosineDistanceToSimilarity(Number(row.distance_ba));
    return {
      score: mutualDisplayScore(scoreAB, scoreBA),
      scoreAB: cosineDistanceToDisplayScore(Number(row.distance_ab)),
      scoreBA: cosineDistanceToDisplayScore(Number(row.distance_ba)),
    };
  });
}

export async function getDiscovery(
  kind: DiscoveryKind,
  currentUserId: string,
  offset = 0,
  ubcFilter: UbcFilter = "all",
) {
  switch (kind) {
    case "you_might_like":
      return getPeopleYouMightLike(currentUserId, offset, ubcFilter);
    case "might_like_you":
      return getPeopleWhoMightLikeYou(currentUserId, offset, ubcFilter);
    case "mutual":
      return getMutualConnections(currentUserId, offset, ubcFilter);
    default:
      throw new Error("Unknown discovery kind");
  }
}
