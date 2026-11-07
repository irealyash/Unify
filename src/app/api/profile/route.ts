import { eq } from "drizzle-orm";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAppUser, requireClerkUserId, syncClerkBasics } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { userProfiles, users } from "@/lib/db/schema";
import { onboardingSchema } from "@/lib/validators/profile";
import { usernameSchema } from "@/lib/validators/username";
import { completeOnboarding, setUbcStudentClaim } from "@/services/profile.service";

export async function GET() {
  try {
    await requireClerkUserId();
    await syncClerkBasics();
    const user = await requireAppUser();
    return jsonOk({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isUbcStudentClaim: user.isUbcStudentClaim,
        isUbcVerified: user.isUbcVerified,
        interests: user.interests,
        skills: user.skills,
      },
      profile: user.profile
        ? {
            publicSummary: user.profile.publicSummary,
            selfText: user.profile.selfText,
            seekingText: user.profile.seekingText,
            selfVersion: user.profile.selfVersion,
            seekingVersion: user.profile.seekingVersion,
            onboardingCompletedAt: user.profile.onboardingCompletedAt,
            embeddingModel: user.profile.embeddingModel,
          }
        : null,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  try {
    await requireClerkUserId();
    const synced = await syncClerkBasics();
    if (!synced) throw new Error("Unauthorized");

    const body = await req.json();
    const parsed = onboardingSchema.parse(body);
    usernameSchema.parse(parsed.username);

    const result = await completeOnboarding({
      userId: synced.id,
      username: parsed.username,
      displayName: parsed.displayName,
      selfText: parsed.selfText,
      seekingText: parsed.seekingText,
    });

    return jsonOk(result);
  } catch (error) {
    console.error("[POST /api/profile] onboarding failed:", error);
    return jsonError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireAppUser();
    const body = await req.json();
    const schema = z.object({
      displayName: z.string().trim().min(1).max(80).optional(),
      isUbcStudentClaim: z.boolean().optional(),
      username: z.string().optional(),
    });
    const parsed = schema.parse(body);

    if (parsed.username) {
      const { isUsernameAvailable } = await import("@/services/profile.service");
      const { normalizeUsername } = await import("@/lib/validators/username");
      const availability = await isUsernameAvailable(parsed.username, user.id);
      if (!availability.available) throw new Error(availability.reason);
      await db
        .update(users)
        .set({
          username: availability.username,
          usernameNormalized: normalizeUsername(availability.username!),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    }

    if (parsed.displayName) {
      await db
        .update(users)
        .set({ displayName: parsed.displayName, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }

    if (typeof parsed.isUbcStudentClaim === "boolean") {
      await setUbcStudentClaim(user.id, parsed.isUbcStudentClaim);
    }

    const [fresh] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const [profile] = await db
      .select({
        publicSummary: userProfiles.publicSummary,
        onboardingCompletedAt: userProfiles.onboardingCompletedAt,
      })
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);

    return jsonOk({ user: fresh, profile });
  } catch (error) {
    return jsonError(error);
  }
}
