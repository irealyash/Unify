import { cookies } from "next/headers";
import { randomUUID } from "crypto";

export const PARTICIPANT_COOKIE = "mutual_participant";

export async function getParticipantToken() {
  const jar = await cookies();
  return jar.get(PARTICIPANT_COOKIE)?.value ?? null;
}

export async function setParticipantToken(token: string) {
  const jar = await cookies();
  jar.set(PARTICIPANT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function newSessionToken() {
  return randomUUID();
}
