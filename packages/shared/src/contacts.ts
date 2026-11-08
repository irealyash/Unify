/**
 * Optional contact details a student shares with their group. Values are normalized to a plain
 * handle (or email address) on the way in, and links are only ever built from those, so nobody
 * can smuggle an arbitrary URL onto a teammate's screen.
 */

export const CONTACT_FIELDS = [
  { id: "email", label: "Email", placeholder: "you@school.edu" },
  { id: "discord", label: "Discord", placeholder: "username" },
  { id: "instagram", label: "Instagram", placeholder: "@username" },
  { id: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/username" },
] as const;

export type ContactId = (typeof CONTACT_FIELDS)[number]["id"];
export type ContactLinks = Partial<Record<ContactId, string>>;

/** Tidies what someone typed: "@name" and full profile URLs both become "name". */
const CLEAN: Record<ContactId, (raw: string) => string> = {
  email: (raw) => raw,
  discord: (raw) => raw.replace(/^@/, ""),
  instagram: (raw) => raw.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, ""),
  linkedin: (raw) => raw.replace(/^(https?:\/\/)?([\w-]+\.)?linkedin\.com\/in\//i, "").replace(/[/?#].*$/, ""),
};

const VALID: Record<ContactId, RegExp> = {
  email: /^[^\s@?&#/]{1,64}@[^\s@?&#/]+\.[^\s@?&#/]{2,}$/,
  discord: /^[A-Za-z0-9_.]{2,32}$/,
  instagram: /^[A-Za-z0-9._]{1,30}$/,
  linkedin: /^[\p{L}\p{N}-]{3,100}$/u,
};

/** Cleans and checks every field. Empty fields are dropped; returns an error for a bad one. */
export function normalizeContacts(raw: ContactLinks): { contacts: ContactLinks } | { error: string } {
  const contacts: ContactLinks = {};
  for (const field of CONTACT_FIELDS) {
    const value = CLEAN[field.id]((raw[field.id] ?? "").trim());
    if (!value) continue;
    if (!VALID[field.id].test(value)) return { error: `That ${field.label} doesn't look right` };
    contacts[field.id] = value;
  }
  return { contacts };
}

/** Where a contact opens, or null if it can only be copied (Discord has no profile links). */
export function contactHref(id: ContactId, value: string): string | null {
  switch (id) {
    case "email":
      return `mailto:${value}`;
    case "instagram":
      return `https://www.instagram.com/${encodeURIComponent(value)}/`;
    case "linkedin":
      return `https://www.linkedin.com/in/${encodeURIComponent(value)}/`;
    case "discord":
      return null;
  }
}
