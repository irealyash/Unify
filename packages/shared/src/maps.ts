import type { BiomeId } from "./biomes";
import tokyoTown from "./maps/tokyoTown.json";

/**
 * Map data shared by the server (spawn spots) and the browser (collision, splitting the model
 * into buildings). Generated from the 3D model by `npm run footprints -w @unify/web`.
 */
export const TOKYO_TOWN = {
  data: tokyoTown,
  /** World units per model unit: the town (about 123 × 121 model units) becomes ~34 × 34. */
  scale: 0.28,
};

/**
 * Where the n-th member of a group appears, relative to their biome's center. Biomes built
 * from a model use its precomputed open spots; plain ones use a sunflower spiral.
 */
export function spawnOffset(biome: BiomeId, slot: number): { x: number; z: number } {
  if (biome === "night_city") {
    const spots = TOKYO_TOWN.data.spawns;
    const [x, z] = spots[slot % spots.length]!;
    // Past the list's end, reuse spots with a small nudge rather than stacking exactly.
    const lap = Math.floor(slot / spots.length);
    return { x: x! * TOKYO_TOWN.scale + lap * 0.35, z: z! * TOKYO_TOWN.scale + lap * 0.35 };
  }
  const angle = slot * 2.4;
  const radius = 2 + Math.sqrt(slot) * 1.4;
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}
