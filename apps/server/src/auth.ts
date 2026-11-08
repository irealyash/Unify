import { createRemoteJWKSet, jwtVerify } from "jose";
import { sql } from "./db";

export type AuthUser = {
  sub: string;
  email: string | null;
  name: string | null;
  picture: string | null;
};

const domain = process.env.AUTH0_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/$/, "");
const clientId = process.env.AUTH0_CLIENT_ID;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!domain) throw new Error("AUTH0_DOMAIN is not set");
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`));
  }
  return jwks;
}

export function isAuth0Configured() {
  return Boolean(domain && clientId);
}

/** Verifies an Auth0 ID token (RS256) issued for this SPA client. */
export async function verifyIdToken(token: string): Promise<AuthUser> {
  if (!domain || !clientId) throw new Error("Auth0 is not configured on the server");
  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: `https://${domain}/`,
    audience: clientId,
  });
  if (!payload.sub) throw new Error("Token is missing subject");
  return {
    sub: String(payload.sub),
    email: typeof payload.email === "string" ? payload.email : null,
    name: typeof payload.name === "string" ? payload.name : null,
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}

/** Upserts the signed-in Auth0 user into Tiger Postgres. */
export async function upsertUser(user: AuthUser) {
  if (!sql) {
    console.warn("[auth] DATABASE_URL unset; skipping user upsert");
    return;
  }
  await sql`
    INSERT INTO users (id, email, name, picture, last_login_at)
    VALUES (${user.sub}, ${user.email}, ${user.name}, ${user.picture}, now())
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = COALESCE(EXCLUDED.name, users.name),
      picture = COALESCE(EXCLUDED.picture, users.picture),
      last_login_at = now(),
      updated_at = now()
  `;
}
