/**
 * Biomes: themed areas that each hold one group.
 *
 * `profile` is written in exactly the same structure and voice as student profiles
 * (see PROFILE_STYLE_GUIDE on the server) because the two are embedded and compared.
 * It describes the ideal member of the biome, not the place.
 */

export type BiomeId = "night_city" | "highlands" | "beach" | "library";

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
      investment: ["priority"],
      communication: ["constant"],
      meetings: ["often"],
      role: ["leader", "organizer"],
      expectations: ["high_bar", "responsive"],
    },
    colors: { floor: "#E9EEF4", wall: "#C2CDDB", accent: "#586E8A" },
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
      investment: ["my_part", "low"],
      communication: ["weekly_update"],
      meetings: ["rarely"],
      role: ["writer", "ideas"],
      expectations: ["done"],
    },
    colors: { floor: "#E8F3E8", wall: "#BFD7BE", accent: "#4F874D" },
    // Grassy hills around a meadow, with a lake at the bottom; the scenery runs a little past.
    walkHalf: 15,
    visualHalf: 20,
  },
  {
    id: "beach",
    name: "The Beach",
    tagline: "Warm, social, all in it together.",
    profile:
      "This student starts within the first few days or about a week before it's due and keeps a steady, unhurried rhythm without much stress. They care about doing well while balancing other commitments, and they value a good group experience as much as the grade. They love working together, preferring in-person meetups and group calls, and are happy to meet about once a week. They do their best work in the afternoons alongside other people and take whatever role the group needs. They expect teammates to be friendly, flexible and open to new ideas.",
    answerHints: {
      start: ["week_before"],
      investment: ["balanced"],
      communication: ["calls", "in_person"],
      meetings: ["weekly"],
      schedule: ["daytime"],
      role: ["flexible", "designer"],
      expectations: ["flexible_open"],
    },
    colors: { floor: "#F8F1E2", wall: "#E4D4B4", accent: "#D1B275" },
    // A sandy cove with the sea to the north; a pier reaches out to the walkable edge.
    walkHalf: 15,
    visualHalf: 20,
  },
  {
    id: "library",
    name: "The Library",
    tagline: "Quiet, focused, high standards.",
    profile:
      "This student starts early and works through the project methodically, finishing ahead of the deadline with time to refine it. They are aiming for an A or A+ and treat this project as a top priority. They prefer to work quietly and independently, with short written updates and as few meetings as possible. They do their best work alone in long, focused sessions, often as the writer or researcher who goes deep on the hard parts. They expect teammates to produce high-quality work, pull equal weight and not need constant check-ins.",
    answerHints: {
      start: ["getting_ahead"],
      investment: ["priority"],
      communication: ["weekly_update"],
      meetings: ["rarely"],
      schedule: ["morning", "late_night"],
      role: ["writer"],
      expectations: ["high_bar"],
    },
    colors: { floor: "#F1E9DF", wall: "#D5C4B1", accent: "#BA4D4D" },
    // A single big room; players stay just inside its walls.
    walkHalf: 15,
    visualHalf: 17,
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

/** Biomes sit in a grid this many wide and tall, filled left to right, top to bottom. */
const GRID_SIZE = 2;
/** Every grid cell fits the largest biome's scenery, so rows and columns line up. */
const CELL_SIZE = Math.max(...BIOMES.map((b) => b.visualHalf)) * 2;
const CELL_PITCH = CELL_SIZE + BIOME_GAP;

/** Biome centers in the grid, which is centered on the world's origin. */
const BIOME_CENTERS: Map<BiomeId, { x: number; z: number }> = (() => {
  const offset = (index: number) => (index - (GRID_SIZE - 1) / 2) * CELL_PITCH;
  return new Map(
    BIOMES.map((b, i) => [
      b.id,
      { x: offset(i % GRID_SIZE), z: offset(Math.floor(i / GRID_SIZE)) },
    ]),
  );
})();

/** The walkable square of a biome, in world space. */
export function biomeArea(id: BiomeId): Area {
  const biome = BIOME_BY_ID.get(id)!;
  const center = BIOME_CENTERS.get(id)!;
  return { cx: center.x, cz: center.z, half: biome.walkHalf };
}

/** Width and depth of the whole grid of biome scenery, including any cells not yet filled. */
export function biomesExtent() {
  const size = GRID_SIZE * CELL_SIZE + (GRID_SIZE - 1) * BIOME_GAP;
  return { width: size, depth: size };
}

export function clampToArea(area: Area, x: number, z: number) {
  return {
    x: Math.min(area.cx + area.half, Math.max(area.cx - area.half, x)),
    z: Math.min(area.cz + area.half, Math.max(area.cz - area.half, z)),
  };
}
