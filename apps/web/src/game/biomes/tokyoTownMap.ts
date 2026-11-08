import { TOKYO_TOWN } from "@unify/shared";
import type { Rect } from "../collision";

const footprints = TOKYO_TOWN.data;

/**
 * The city biome's map: "東京タワー" by Kenta Imai (CC-BY, via Poly Pizza), a small town around
 * Tokyo Tower, used whole with its original colors.
 *
 * Footprints (what you collide with, and which triangles belong to which building) come from
 * `npm run footprints -w @unify/web`, which reads the model from above. Re-run it if the model
 * changes. All footprint values are in the model's own units.
 */

export const TOWN_MODEL_URL = "/models/tokyo-tower.glb";

/** World units per model unit (the town becomes about 34 × 34). */
export const TOWN_SCALE = TOKYO_TOWN.scale;

/** Half-size of the model's extent, in world units. */
export const TOWN_HALF = {
  x: (Math.max(Math.abs(footprints.minX), Math.abs(footprints.maxX)) * TOWN_SCALE),
  z: (Math.max(Math.abs(footprints.minZ), Math.abs(footprints.maxZ)) * TOWN_SCALE),
};

/** Below this (model units) a triangle is ground: never part of a building. */
export const GROUND_LEVEL = footprints.threshold;

/** Building label per footprint cell (0 = open ground), decoded once. */
const labelGrid: Int32Array = (() => {
  const grid = new Int32Array(footprints.cols * footprints.rows);
  let at = 0;
  for (let i = 0; i < footprints.labels.length; i += 2) {
    grid.fill(footprints.labels[i]!, at, at + footprints.labels[i + 1]!);
    at += footprints.labels[i + 1]!;
  }
  return grid;
})();

/** Which building (1..n) a model-space point belongs to, searching a little around it. */
export function buildingAt(x: number, z: number, search = 2): number {
  const c = Math.floor((x - footprints.minX) / footprints.cell);
  const r = Math.floor((z - footprints.minZ) / footprints.cell);
  for (let d = 0; d <= search; d++) {
    for (let dr = -d; dr <= d; dr++) {
      for (let dc = -d; dc <= d; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== d) continue;
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= footprints.rows || cc >= footprints.cols) continue;
        const label = labelGrid[rr * footprints.cols + cc]!;
        if (label) return label;
      }
    }
  }
  return 0;
}

export const BUILDING_COUNT = footprints.buildings;

/** Building footprints in world units around the town's center. */
const BUILDING_RECTS: Rect[] = footprints.rects.map(([minX, minZ, maxX, maxZ]) => ({
  minX: minX! * TOWN_SCALE,
  maxX: maxX! * TOWN_SCALE,
  minZ: minZ! * TOWN_SCALE,
  maxZ: maxZ! * TOWN_SCALE,
}));

/** Distance (world units) from a point to the nearest building footprint. */
export function distanceToBuildings(x: number, z: number) {
  let best = Infinity;
  for (const b of BUILDING_RECTS) {
    const dx = Math.max(b.minX - x, 0, x - b.maxX);
    const dz = Math.max(b.minZ - z, 0, z - b.maxZ);
    best = Math.min(best, Math.hypot(dx, dz));
  }
  return best;
}

/** The decorative plaza under the tower. */
export const PLAZA = { x: -0.14, z: 0.42, radius: 6.2 };

/**
 * Lampposts along the sidewalks: just off the buildings, spread out, clear of the plaza and of
 * the spots where groups spawn.
 */
export const LAMPS: Array<[number, number]> = (() => {
  const spawns = footprints.spawns.map(([x, z]) => [x! * TOWN_SCALE, z! * TOWN_SCALE] as const);
  const lamps: Array<[number, number]> = [];
  const limit = Math.min(TOWN_HALF.x, TOWN_HALF.z) - 0.8;
  for (let z = -limit; z <= limit; z += 0.5) {
    for (let x = -limit; x <= limit; x += 0.5) {
      const d = distanceToBuildings(x, z);
      if (d < 0.65 || d > 0.85) continue;
      if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.radius + 0.6) continue;
      if (spawns.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 1.4)) continue;
      if (lamps.some(([lx, lz]) => Math.hypot(lx - x, lz - z) < 5.5)) continue;
      lamps.push([x, z]);
    }
  }
  return lamps;
})();

const LAMP_RADIUS = 0.15;

/** Collision footprints (buildings + lampposts) in world space for the town at (cx, cz). */
export function tokyoTownObstacles(cx: number, cz: number): Rect[] {
  return [
    ...BUILDING_RECTS,
    ...LAMPS.map(([x, z]) => ({ minX: x - LAMP_RADIUS, maxX: x + LAMP_RADIUS, minZ: z - LAMP_RADIUS, maxZ: z + LAMP_RADIUS })),
  ].map((r) => ({ minX: r.minX + cx, maxX: r.maxX + cx, minZ: r.minZ + cz, maxZ: r.maxZ + cz }));
}
