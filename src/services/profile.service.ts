import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { profileVersions, userProfiles, users } from "@/lib/db/schema";
import { getEmbeddingModel } from "@/lib/embeddings";
import { generateText } from "@/lib/gemini/client";
import { normalizeUsername, usernameSchema } from "@/lib/validators/username";
import { regenerateBothEmbeddings, regenerateEmbedding } from "@/services/embedding.service";

export async function isUsernameAvailable(username: string, excludeUserId?: string) {
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) {
    return { available: false, reason: parsed.error.issues[0]?.message ?? "Invalid username" };
  }

  const normalized = normalizeUsername(parsed.data);
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.usernameNormalized, normalized),
        excludeUserId ? ne(users.id, excludeUserId) : sql`true`,
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return { available: false, reason: "Username is already taken" };
  }

  return { available: true as const, username: parsed.data, normalized };
}

async function generatePublicSummary(selfText: string) {
  try {
    const summary = await generateText({
      temperature: 0.4,
      system:
        "Write a short public profile summary (1-2 sentences, max 220 characters) from the user's self-description. Do not invent facts. Do not include private contact info. Return only the summary text.",
      user: selfText,
    });
    return (summary || selfText.slice(0, 220)).trim().slice(0, 220);
  } catch {
    return selfText.slice(0, 220);
  }
}

export async function completeOnboarding(params: {
  userId: string;
  username: string;
  displayName?: string;
  selfText: string;
  seekingText: string;
}) {
  const availability = await isUsernameAvailable(params.username, params.userId);
  if (!availability.available) {
    throw new Error(availability.reason);
  }

  const selfText = params.selfText.trim();
  const seekingText = params.seekingText.trim();
  const publicSummary = await generatePublicSummary(selfText);
  const model = getEmbeddingModel();

  await db
    .update(users)
    .set({
      username: availability.username,
      usernameNormalized: availability.normalized,
      displayName: params.displayName?.trim() || availability.username,
      updatedAt: new Date(),
    })
    .where(eq(users.id, params.userId));

  // Ensure profile row exists (webhook/sync race), then upsert content.
  await db
    .insert(userProfiles)
    .values({
      userId: params.userId,
      selfText,
      seekingText,
      publicSummary,
      embeddingModel: model,
      selfVersion: 1,
      seekingVersion: 1,
      profileVersion: 1,
      onboardingCompletedAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        selfText,
        seekingText,
        publicSummary,
        embeddingModel: model,
        selfVersion: 1,
        seekingVersion: 1,
        profileVersion: 1,
        onboardingCompletedAt: new Date(),
        updatedAt: new Date(),
      },
    });

  // Idempotent: retries after a partial onboarding must not fail on unique (user, type, version).
  await db
    .insert(profileVersions)
    .values([
      {
        userId: params.userId,
        assistantType: "self",
        profileText: selfText,
        version: 1,
      },
      {
        userId: params.userId,
        assistantType: "seeking",
        profileText: seekingText,
        version: 1,
      },
    ])
    .onConflictDoUpdate({
      target: [
        profileVersions.userId,
        profileVersions.assistantType,
        profileVersions.version,
      ],
      set: {
        profileText: sql`excluded.profile_text`,
      },
    });

  const embeddings = await regenerateBothEmbeddings(params.userId);

  return {
    username: availability.username,
    embeddingModel: embeddings.self.model,
    embeddingDimensions: embeddings.self.dimensions,
    hasSelfEmbedding: true,
    hasSeekingEmbedding: true,
    // Stored on user_profiles.self_embedding / user_profiles.seeking_embedding
    // (not on the users table).
  };
}

export async function updateOwnedProfileText(params: {
  userId: string;
  side: "self" | "seeking";
  profileText: string;
  expectedVersion: number;
}) {
  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, params.userId))
    .limit(1);

  if (!profile) throw new Error("Profile not found");

  const currentVersion = params.side === "self" ? profile.selfVersion : profile.seekingVersion;
  if (currentVersion !== params.expectedVersion) {
    throw new Error("Profile was updated elsewhere. Refresh and try again.");
  }

  const nextVersion = currentVersion + 1;
  const publicSummary =
    params.side === "self"
      ? await generatePublicSummary(params.profileText)
      : profile.publicSummary;

  if (params.side === "self") {
    await db
      .update(userProfiles)
      .set({
        selfText: params.profileText,
        publicSummary,
        selfVersion: nextVersion,
        profileVersion: profile.profileVersion + 1,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, params.userId));
  } else {
    await db
      .update(userProfiles)
      .set({
        seekingText: params.profileText,
        seekingVersion: nextVersion,
        profileVersion: profile.profileVersion + 1,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, params.userId));
  }

  await db.insert(profileVersions).values({
    userId: params.userId,
    assistantType: params.side,
    profileText: params.profileText,
    version: nextVersion,
  });

  await regenerateEmbedding(params.userId, params.side);

  return { version: nextVersion, publicSummary };
}

export async function undoLastProfileUpdate(userId: string, side: "self" | "seeking") {
  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  if (!profile) throw new Error("Profile not found");

  const currentVersion = side === "self" ? profile.selfVersion : profile.seekingVersion;
  if (currentVersion <= 1) {
    throw new Error("Nothing to undo");
  }

  const previousVersion = currentVersion - 1;
  const [previous] = await db
    .select()
    .from(profileVersions)
    .where(
      and(
        eq(profileVersions.userId, userId),
        eq(profileVersions.assistantType, side),
        eq(profileVersions.version, previousVersion),
      ),
    )
    .limit(1);

  if (!previous) throw new Error("Previous version not found");

  return updateOwnedProfileText({
    userId,
    side,
    profileText: previous.profileText,
    expectedVersion: currentVersion,
  });
}

export async function setUbcStudentClaim(userId: string, claim: boolean) {
  const [updated] = await db
    .update(users)
    .set({
      isUbcStudentClaim: claim,
      // Clearing claim also clears verified badge until re-verified
      isUbcVerified: claim ? undefined : false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  if (!claim) {
    await db
      .update(users)
      .set({ isUbcVerified: false, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  return updated;
}
