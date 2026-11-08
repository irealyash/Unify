import { BIOME_BY_ID } from "@unify/shared";
import type { GroundHeight, Obstacles, Rect } from "../collision";
import { fbm, smoothstep } from "./noise";
import { createRng } from "./random";

/**
 * The Highlands: grassy hills around a meadow, a big hill with a lone tree on its summit, and
 * a small lake at the bottom. Everything is generated from fixed seeds, so every player and the
 * host see the same place. Coordinates are relative to the biome's center; -z is "north", away
 * from the follow camera.
 */

const BIOME = BIOME_BY_ID.get("highlands")!;
export const WALK_HALF = BIOME.walkHalf;
export const VISUAL_HALF = BIOME.visualHalf;

// ── Terrain ──────────────────────────────────────────────────────────────────

const HILLS = [
  { x: -6, z: -10, height: 8.5, spread: 6.2 }, // the big hill
  { x: 11, z: -13, height: 4.2, spread: 5 }, // a knoll behind the lake
  { x: 15, z: -2, height: 2.2, spread: 4.5 },
  { x: -11, z: 9, height: 1.8, spread: 6 },
  { x: 12, z: 8, height: 1.2, spread: 5 },
];
export const SUMMIT = { x: HILLS[0]!.x, z: HILLS[0]!.z };
export const LAKE = { x: 7, z: -4.5, radius: 4 };
/** The open meadow in the middle, where groups appear. */
const MEADOW = { x: 0, z: 0.5, radius: 6 };

/** Hills, gentle bumps, and the ring of higher, wooded hills beyond the walkable square. */
function baseHeight(x: number, z: number) {
  let h = 0;
  for (const hill of HILLS) {
    h += hill.height * Math.exp(-((x - hill.x) ** 2 + (z - hill.z) ** 2) / (2 * hill.spread ** 2));
  }
  h += (fbm(x * 0.08 + 3, z * 0.08 - 2) - 0.45) * 1.3;

  const d = Math.max(Math.abs(x), Math.abs(z)) - WALK_HALF;
  // Lower to the south, where the follow camera sits behind the player.
  const south = smoothstep(WALK_HALF - 2, WALK_HALF + 4, z) * (1 - smoothstep(WALK_HALF + 18, WALK_HALF + 40, z));
  const ring =
    smoothstep(-4, 14, d) * 5 * (0.55 + fbm(x * 0.05 + 11, z * 0.05)) +
    Math.max(0, d - 14) * 0.28 * (0.5 + fbm(x * 0.02, z * 0.02 + 4)) +
    Math.max(0, fbm(x * 0.03 + 5, z * 0.03) - 0.4) * 10 * smoothstep(4, 40, d);
  return h + ring * (1 - 0.75 * south);
}

/** Distance from the lake's center, wobbled so the shoreline isn't a perfect circle. */
function lakeDistance(x: number, z: number) {
  return Math.hypot(x - LAKE.x, z - LAKE.z) + (fbm(x * 0.35 + 7, z * 0.35) - 0.5) * 1.6;
}

/** The level the ground around the lake is evened out to. */
const LAKE_BED = baseHeight(LAKE.x, LAKE.z);
export const WATER_Y = LAKE_BED - 0.45;

/** Ground height at a point (local coordinates). */
export function heightAt(x: number, z: number) {
  let h = baseHeight(x, z);
  const d = lakeDistance(x, z);
  // Level the ground around the lake, then scoop the lake out of it.
  h += (LAKE_BED - h) * (1 - smoothstep(LAKE.radius, LAKE.radius * 2.3, d));
  h -= 1.7 * (1 - smoothstep(0, LAKE.radius * 1.5, d));
  // Past the shore the ground always rises out of the water, even where the land is low.
  if (d > LAKE.radius) h = Math.max(h, WATER_Y + 0.4 * smoothstep(LAKE.radius, LAKE.radius * 1.5, d));
  return h;
}

/** Underwater, or too close to the edge to stand. */
export function inWater(x: number, z: number) {
  return heightAt(x, z) < WATER_Y + 0.1;
}

// ── Trails ───────────────────────────────────────────────────────────────────

/** Dirt trails: from the south edge up through the meadow to the summit, and down to the lake. */
const TRAILS: Array<Array<[number, number]>> = [
  [[-2, 22], [-1.5, 15], [-1.2, 10], [-0.5, 4.5], [-1.5, 0], [-3, -4], [-4.2, -7], [-5, -8.6]],
  [[-1.2, 1.2], [1.6, -0.9], [3.3, -2.3]],
];
export const TRAIL_HALF_WIDTH = 0.7;

/** Every trail as straight segments [ax, az, bx, bz]. */
export const TRAIL_SEGMENTS: Array<[number, number, number, number]> = TRAILS.flatMap((trail) =>
  trail.slice(1).map((b, i) => [trail[i]![0], trail[i]![1], b[0], b[1]] as [number, number, number, number]),
);

export function trailDistance(x: number, z: number) {
  let best = Infinity;
  for (const [ax, az, bx, bz] of TRAIL_SEGMENTS) {
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

// ── Things standing on the ground ────────────────────────────────────────────

export type TreeKind = "oak" | "pine";
export type Tree = { x: number; y: number; z: number; kind: TreeKind; scale: number; rot: number; leaves: string };
export type Bush = { x: number; y: number; z: number; scale: number; rot: number; color: string; flowers: string | null };
export type Stone = { x: number; y: number; z: number; scale: number; rot: number; color: string };

export const OAK_LEAVES = ["#4a8a3f", "#5a9a45", "#3f7d3a", "#6aa84f", "#78b04f"];
export const PINE_LEAVES = ["#2f6b3a", "#367034", "#3d7a40", "#2a5e36"];
const BUSH_GREENS = ["#4f8f3f", "#5c9c46", "#457f3a", "#6aa84f", "#3d7337"];
const BUSH_FLOWERS = ["#ffffff", "#ffb7d0", "#ffd85a", "#c9a7ff", "#ff8fa3"];
const STONE_GREYS = ["#8d8a85", "#9c9890", "#7d7a76", "#a6a29a", "#85827c"];

/** The follow camera sits ~11 units south of the player: nothing tall in that strip. */
export function inCameraClearance(x: number, z: number) {
  return z > WALK_HALF + 0.5 && z < WALK_HALF + 13 && Math.abs(x) < WALK_HALF + 5;
}

/** Room for something of the given clearance: off the trails, out of the lake and the meadow. */
function clear(x: number, z: number, margin: number, meadow: number) {
  if (trailDistance(x, z) < TRAIL_HALF_WIDTH + margin) return false;
  if (lakeDistance(x, z) < LAKE.radius + margin + 0.6 || heightAt(x, z) < WATER_Y + 0.35) return false;
  if (Math.hypot(x - MEADOW.x, z - MEADOW.z) < meadow) return false;
  return true;
}

/** Trees within the scenery square: groves on the slopes, denser toward the edges. */
export const TREES: Tree[] = (() => {
  const rng = createRng(2024);
  const trees: Tree[] = [];
  const step = 2.6;
  for (let gx = -VISUAL_HALF; gx <= VISUAL_HALF; gx += step) {
    for (let gz = -VISUAL_HALF; gz <= VISUAL_HALF; gz += step) {
      const x = gx + rng.range(-1.1, 1.1);
      const z = gz + rng.range(-1.1, 1.1);
      if (Math.max(Math.abs(x), Math.abs(z)) > VISUAL_HALF - 0.8) continue;
      const grove = fbm(x * 0.09 + 20, z * 0.09);
      const edge = Math.max(Math.abs(x), Math.abs(z)) > WALK_HALF - 3;
      const keep = grove > 0.55 ? 0.6 : edge ? 0.45 : 0.04;
      if (rng.next() > keep) continue;
      if (!clear(x, z, 1.4, MEADOW.radius + 0.5)) continue;
      // Keep the big hill's upper slopes open grass around its lone tree.
      if (Math.hypot(x - SUMMIT.x, z - SUMMIT.z) < 6) continue;
      if (inCameraClearance(x, z)) continue;
      const pine = rng.next() < (heightAt(x, z) > 3 ? 0.6 : 0.3);
      trees.push({
        x,
        y: heightAt(x, z),
        z,
        kind: pine ? "pine" : "oak",
        scale: rng.range(0.8, 1.25),
        rot: rng.range(0, Math.PI * 2),
        leaves: rng.pick(pine ? PINE_LEAVES : OAK_LEAVES),
      });
    }
  }
  // The lone old tree on the summit.
  trees.push({
    x: SUMMIT.x - 0.4,
    y: heightAt(SUMMIT.x - 0.4, SUMMIT.z - 0.6) - 0.05,
    z: SUMMIT.z - 0.6,
    kind: "oak",
    scale: 1.8,
    rot: 0.6,
    leaves: "#5a9a45",
  });
  return trees;
})();

/** Shrubs: along the groves, by the lake and dotted over the slopes; some in flower. */
export const BUSHES: Bush[] = (() => {
  const rng = createRng(77);
  const bushes: Bush[] = [];
  const reach = WALK_HALF + 4;
  for (let i = 0; i < 1500 && bushes.length < 75; i++) {
    const x = rng.range(-reach, reach);
    const z = rng.range(-reach, reach);
    const grove = fbm(x * 0.09 + 20, z * 0.09);
    const byLake = Math.abs(lakeDistance(x, z) - LAKE.radius - 2) < 1.2;
    if (rng.next() > (grove > 0.48 || byLake ? 0.6 : 0.12)) continue;
    if (!clear(x, z, 0.8, 4.5)) continue;
    if (TREES.some((t) => Math.hypot(t.x - x, t.z - z) < 1.3 * t.scale)) continue;
    if (bushes.some((b) => Math.hypot(b.x - x, b.z - z) < 1.4)) continue;
    bushes.push({
      x,
      y: heightAt(x, z),
      z,
      scale: rng.range(0.65, 1.2),
      rot: rng.range(0, Math.PI * 2),
      color: rng.pick(BUSH_GREENS),
      flowers: rng.next() < 0.35 ? rng.pick(BUSH_FLOWERS) : null,
    });
  }
  return bushes;
})();

/** Boulders on the slopes and by the water, and pebbles scattered through the grass. */
export const STONES: { boulders: Stone[]; pebbles: Stone[] } = (() => {
  const rng = createRng(909);
  const boulders: Stone[] = [];
  const pebbles: Stone[] = [];
  const reach = VISUAL_HALF - 0.8;
  for (let i = 0; i < 2000 && (boulders.length < 14 || pebbles.length < 70); i++) {
    const x = rng.range(-reach, reach);
    const z = rng.range(-reach, reach);
    const big = boulders.length < 14 && rng.next() < 0.3;
    if (!clear(x, z, big ? 1 : 0.2, big ? 5 : 1)) continue;
    if (big && (TREES.some((t) => Math.hypot(t.x - x, t.z - z) < 1.6) || BUSHES.some((b) => Math.hypot(b.x - x, b.z - z) < 1.3))) continue;
    // Boulders favor the hillsides.
    if (big && heightAt(x, z) < 1.2 && rng.next() < 0.6) continue;
    if (!big && pebbles.length >= 70) continue;
    const scale = big ? rng.range(0.7, 1.4) : rng.range(0.18, 0.4);
    (big ? boulders : pebbles).push({
      x,
      y: heightAt(x, z) - 0.12 * scale,
      z,
      scale,
      rot: rng.range(0, Math.PI * 2),
      color: rng.pick(STONE_GREYS),
    });
  }
  return { boulders, pebbles };
})();

/** Clumps of reeds along the shore (leaving the trail's way down to the water open). */
export const REEDS: Array<{ x: number; z: number; y: number; count: number; seed: number }> = (() => {
  const rng = createRng(5150);
  const clumps: Array<{ x: number; z: number; y: number; count: number; seed: number }> = [];
  for (let i = 0; i < 600 && clumps.length < 26; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(LAKE.radius * 0.7, LAKE.radius * 1.25);
    const x = LAKE.x + Math.cos(a) * r;
    const z = LAKE.z + Math.sin(a) * r;
    const h = heightAt(x, z);
    if (h < WATER_Y - 0.35 || h > WATER_Y + 0.15) continue;
    if (trailDistance(x, z) < 1.8) continue;
    if (clumps.some((c) => Math.hypot(c.x - x, c.z - z) < 0.9)) continue;
    clumps.push({ x, z, y: Math.max(h, WATER_Y - 0.3), count: 5 + Math.floor(rng.next() * 5), seed: i });
  }
  return clumps;
})();

/** Lily pads floating out in the deeper water. */
export const LILY_PADS: Array<{ x: number; z: number; scale: number; rot: number; flower: boolean }> = (() => {
  const rng = createRng(4242);
  const pads: Array<{ x: number; z: number; scale: number; rot: number; flower: boolean }> = [];
  for (let i = 0; i < 400 && pads.length < 16; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(0.6, LAKE.radius * 0.75);
    const x = LAKE.x + Math.cos(a) * r;
    const z = LAKE.z + Math.sin(a) * r;
    if (heightAt(x, z) > WATER_Y - 0.4) continue;
    if (pads.some((p) => Math.hypot(p.x - x, p.z - z) < 0.75)) continue;
    pads.push({ x, z, scale: rng.range(0.7, 1.25), rot: rng.range(0, Math.PI * 2), flower: rng.next() < 0.3 });
  }
  return pads;
})();

// ── Collision and ground for players ─────────────────────────────────────────

const SOLIDS: Rect[] = (() => {
  const square = (x: number, z: number, r: number): Rect => ({ minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r });
  const reachable = (x: number, z: number) => Math.max(Math.abs(x), Math.abs(z)) < WALK_HALF + 1.5;
  return [
    ...TREES.filter((t) => reachable(t.x, t.z)).map((t) => square(t.x, t.z, 0.3 * t.scale)),
    ...BUSHES.filter((b) => reachable(b.x, b.z)).map((b) => square(b.x, b.z, 0.4 * b.scale)),
    ...STONES.boulders.filter((s) => reachable(s.x, s.z)).map((s) => square(s.x, s.z, 0.45 * s.scale)),
  ];
})();

/** Trees, shrubs, boulders and the lake, in world space for the biome centered at (cx, cz). */
export function highlandsObstacles(cx: number, cz: number): Obstacles {
  return {
    rects: SOLIDS.map((r) => ({ minX: r.minX + cx, maxX: r.maxX + cx, minZ: r.minZ + cz, maxZ: r.maxZ + cz })),
    blocked: (x, z) => inWater(x - cx, z - cz),
  };
}

/** Ground height in world space for the biome centered at (cx, cz). */
export function highlandsGround(cx: number, cz: number): GroundHeight {
  return (x, z) => heightAt(x - cx, z - cz);
}
