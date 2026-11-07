import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, userProfiles } from "@/lib/db/schema";

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export async function requireClerkUserId() {
  const { userId } = await auth();
  if (!userId) {
    throw new AuthError("Unauthorized", 401);
  }
  return userId;
}

export async function getAppUserByClerkId(clerkUserId: string) {
  const [row] = await db
    .select({
      user: users,
      profile: userProfiles,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  if (!row) return null;
  return { ...row.user, profile: row.profile };
}

export async function requireAppUser() {
  const clerkUserId = await requireClerkUserId();
  const appUser = await getAppUserByClerkId(clerkUserId);

  if (!appUser || !appUser.isActive || appUser.deletedAt) {
    throw new AuthError("User profile not found. Complete onboarding first.", 404);
  }

  return appUser;
}

export async function requireOnboardedUser() {
  const user = await requireAppUser();
  if (!user.username || !user.profile?.onboardingCompletedAt) {
    throw new AuthError("Onboarding incomplete", 403);
  }
  return user;
}

export async function syncClerkBasics() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const existing = await getAppUserByClerkId(clerkUser.id);
  const avatarUrl = clerkUser.imageUrl ?? null;
  const displayName =
    clerkUser.fullName ||
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    null;

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        avatarUrl: avatarUrl ?? existing.avatarUrl,
        displayName: existing.displayName || displayName,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(users)
    .values({
      clerkUserId: clerkUser.id,
      avatarUrl,
      displayName,
    })
    .returning();

  await db.insert(userProfiles).values({ userId: created.id });
  return created;
}
