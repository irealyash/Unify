import { eq } from "drizzle-orm";
import { auth0 } from "@/lib/auth0";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export async function getSessionUser() {
  const session = await auth0.getSession();
  if (!session?.user?.sub) return null;

  const auth0Sub = session.user.sub;
  const email = session.user.email ?? "";
  const name = session.user.name ?? session.user.nickname ?? "";
  const pictureUrl = session.user.picture ?? "";

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.auth0Sub, auth0Sub))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        email,
        name,
        pictureUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(users)
    .values({ auth0Sub, email, name, pictureUrl })
    .returning();
  return created;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Sign in with Google to continue");
  return user;
}
