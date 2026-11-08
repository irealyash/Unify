/**
 * Biomes: themed areas that each hold one group.
 *
 * `profile` is written in exactly the same structure and voice as student profiles
 * (see PROFILE_STYLE_GUIDE on the server) because the two are embedded and compared.
 * It describes the ideal member of the biome, not the place.
 */

export type BiomeId = "night_city" | "highlands";

export type BiomeDef = {
  id: BiomeId;
  name: string;
  /** One line shown to students on the reveal card. */
  tagline: string;
  /** Ideal-member profile, embedded into the biome's vector. */
  profile: string;
  /** Answers that point toward this biome; used only if AI is unavailable. */
  answerHints: Record<string, string[]>;
  /** Placeholder palette for the plain phase-3 rooms (phase 4 builds the real scenes). */
  colors: { floor: string; wall: string; accent: string };
};

export const BIOMES: BiomeDef[] = [
  {
    id: "night_city",
    name: "Night City",
    tagline: "Fast-paced, ambitious, always on.",
    profile:
      "This student starts work right away and moves fast, finishing well ahead of deadlines with time left to improve it. They are aiming for an A or A+ and treat this project as a top priority. They want an active group chat with quick replies and frequent meetings to keep momentum high. They put in long hours, often into the evening, and naturally take charge as an organizer or a heavy-lifting builder. They expect teammates to hold a high bar, pull equal weight and respond quickly.",
    answerHints: {
      start: ["right_away", "getting_ahead", "few_days"],
      investment: ["priority"],
      communication: ["constant", "calls", "in_person"],
      meetings: ["often"],
      role: ["leader", "organizer"],
      expectations: ["high_bar", "responsive"],
    },
    colors: { floor: "#eceefe", wall: "#c9ccf5", accent: "#5b5ce2" },
  },
  {
    id: "highlands",
    name: "Highlands",
    tagline: "Steady, easygoing, low-stress.",
    profile:
      "This student works at a relaxed, steady pace and is comfortable starting closer to the deadline without stressing about it. They are happy with a solid B or simply passing, and this project is one of many things in their life rather than a top priority. They prefer occasional, low-pressure updates and meeting only around milestones or when something needs deciding. They work whenever it suits them and happily take whatever role the group needs. They expect teammates to be easygoing and flexible, and they are not picky as long as the work gets done.",
    answerHints: {
      start: ["week_before", "last_minute"],
      investment: ["my_part", "low", "balanced"],
      communication: ["weekly_update"],
      meetings: ["rarely"],
      role: ["flexible", "ideas"],
      expectations: ["flexible_open", "done"],
    },
    colors: { floor: "#eaf5ec", wall: "#c3e2c9", accent: "#2f9e57" },
  },
];

export const BIOME_BY_ID = new Map(BIOMES.map((b) => [b.id, b]));

export function isBiomeId(value: unknown): value is BiomeId {
  return typeof value === "string" && BIOME_BY_ID.has(value as BiomeId);
}

/** How a student ended up in their biome. */
export type SortMethod =
  /** Closest biome by (room-calibrated) vector similarity. */
  | "vector"
  /** Close call or low-signal answers: Gemini picked. */
  | "llm"
  /** Their first choice was full, so they went to their next-best fit. */
  | "rebalanced"
  /** AI unavailable: placed from their multiple-choice answers. */
  | "rules"
  /** Never submitted the quiz: placed in the smallest group. */
  | "filler";

export type Placement = {
  biome: BiomeId;
  method: SortMethod;
  /** One friendly sentence addressed to the student. */
  reason: string;
};

// ── World layout ────────────────────────────────────────────────────────────

/** A square walkable area in world space. */
export type Area = { cx: number; cz: number; half: number };

/** Half-width of each biome area. */
export const BIOME_HALF_SIZE = 12;
/** Distance between biome centers (they sit side by side, far from each other). */
const BIOME_SPACING = 40;

export function biomeArea(id: BiomeId): Area {
  const index = BIOMES.findIndex((b) => b.id === id);
  const offset = (index - (BIOMES.length - 1) / 2) * BIOME_SPACING;
  return { cx: offset, cz: 0, half: BIOME_HALF_SIZE };
}

export function clampToArea(area: Area, x: number, z: number) {
  return {
    x: Math.min(area.cx + area.half, Math.max(area.cx - area.half, x)),
    z: Math.min(area.cz + area.half, Math.max(area.cz - area.half, z)),
  };
}
