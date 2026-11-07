import { z } from "zod";

export const RESERVED_USERNAMES = new Set(
  [
    "admin",
    "administrator",
    "mutual",
    "mutualize",
    "motif",
    "support",
    "help",
    "api",
    "www",
    "root",
    "system",
    "null",
    "undefined",
    "me",
    "you",
    "settings",
    "discover",
    "messages",
    "friends",
    "notifications",
    "onboarding",
    "sign-in",
    "sign-up",
    "login",
    "logout",
    "profile",
    "ubc",
  ].map((s) => s.toLowerCase()),
);

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores are allowed")
  .refine((value) => !RESERVED_USERNAMES.has(value.toLowerCase()), {
    message: "This username is reserved",
  });

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}
