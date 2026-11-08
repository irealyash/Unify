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
  /** How far players may walk from the center (half-width of a square). */
  walkHalf: number;
  /**
   * How far the scenery the host sees reaches from the center. Biomes are laid out side by
   * side using this so their scenery never overlaps.
   */
  visualHalf: number;
};

export const BIOMES: BiomeDef[] = [
  {
    id: "night_city",
    name: "The City",
    tagline: "Fast-paced, ambitious, always on.",
    profile:
      "This student starts work right away and moves fast, finishing well ahead of deadlines with time left to improve it. They are aiming for an A or A+ and treat this project as a top priority. They want an active group chat with quick replies and frequent meetings to keep momentum high. They put in long hours, often into the evening, and naturally take charge as an organizer or a heavy-lifting builder. They expect teammates to hold a high bar, pull equal weight and respond quickly.",
    answerHints: {
      start: ["right_away", "few_days"],
      grade: ["top", "a_range"],
      investment: ["priority"],
      communication: ["constant", "calls"],
      meetings: ["often", "weekly"],
      role: ["leader", "builder"],
      expectations: ["high_bar", "reliable"],
    },
    colors: { floor: "#eceefe", wall: "#c9ccf5", accent: "#5b5ce2" },
    // The "Tokyo Tower" town model, about 34 × 34 world units; players stay just inside it.
    walkHalf: 16.6,
    visualHalf: 18,
  },
  {
    id: "highlands",
    name: "Highlands",
    tagline: "Steady, easygoing, low-stress.",
    profile:
      "This student works at a relaxed, steady pace and is comfortable starting closer to the deadline without stressing about it. They are happy with a solid B or simply passing, and this project is one of many things in their life rather than a top priority. They prefer occasional, low-pressure updates and meeting only around milestones or when something needs deciding. They work whenever it suits them and happily take whatever role the group needs. They expect teammates to be easygoing and flexible, and they are not picky as long as the work gets done.",
    answerHints: {
      start: ["week_before", "last_minute"],
      grade: ["b_range", "pass"],
      investment: ["my_part", "low", "balanced"],
      communication: ["async", "minimal"],
      meetings: ["milestones", "rarely"],
      role: ["flexible", "ideas", "polisher"],
      expectations: ["chill", "done"],
    },
    colors: { floor: "#eaf5ec", wall: "#c3e2c9", accent: "#2f9e57" },
    // Grassy hills around a meadow, with a lake at the bottom; the scenery runs a little past.
    walkHalf: 15,
    visualHalf: 20,
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

/** Empty space between neighbouring biomes' scenery. */
const BIOME_GAP = 6;

/** Biome centers along x: side by side, each as wide as its scenery, centered on 0. */
const BIOME_CENTERS: Map<BiomeId, number> = (() => {
  const total =
    BIOMES.reduce((sum, b) => sum + b.visualHalf * 2, 0) + BIOME_GAP * (BIOMES.length - 1);
  const centers = new Map<BiomeId, number>();
  let left = -total / 2;
  for (const b of BIOMES) {
    centers.set(b.id, left + b.visualHalf);
    left += b.visualHalf * 2 + BIOME_GAP;
  }
  return centers;
})();

/** The walkable square of a biome, in world space. */
export function biomeArea(id: BiomeId): Area {
  const biome = BIOME_BY_ID.get(id)!;
  return { cx: BIOME_CENTERS.get(id)!, cz: 0, half: biome.walkHalf };
}

/** World-space x range covered by all biome scenery, and the deepest biome's half-depth. */
export function biomesExtent() {
  const first = BIOMES[0]!;
  const last = BIOMES[BIOMES.length - 1]!;
  return {
    minX: BIOME_CENTERS.get(first.id)! - first.visualHalf,
    maxX: BIOME_CENTERS.get(last.id)! + last.visualHalf,
    halfDepth: Math.max(...BIOMES.map((b) => b.visualHalf)),
  };
}

export function clampToArea(area: Area, x: number, z: number) {
  return {
    x: Math.min(area.cx + area.half, Math.max(area.cx - area.half, x)),
    z: Math.min(area.cz + area.half, Math.max(area.cz - area.half, z)),
  };
}
