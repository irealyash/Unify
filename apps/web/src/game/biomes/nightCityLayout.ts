import { BIOME_BY_ID } from "@unify/shared";
import type { Rect } from "../collision";
import { createRng } from "./random";

/**
 * Night City layout, in coordinates local to the biome center (x east, z south).
 *
 *   - Main avenue (north–south) and a cross street (east–west) meet at a central plaza
 *     with the neon lattice tower.
 *   - A ring road runs around the edge under the elevated monorail.
 *   - Each quadrant holds three hand-placed buildings of different kinds.
 *   - Beyond the barriers: a ring of taller buildings, then a distant skyline (players only),
 *     with the avenue and cross street continuing into the haze.
 */

export const WALK_HALF = BIOME_BY_ID.get("night_city")!.walkHalf; // 17

/** Half-widths of the street bands. */
export const STREET_HALF = 2.5; // roadway
export const SIDEWALK_OUT = 4; // roadway + sidewalk
export const PLAZA_HALF = 6.5;
/** Ring road: inner sidewalk edge, road center, outer edge (= walk boundary). */
export const RING = { inner: 12.5, road: 14.2, center: 15.25, outer: WALK_HALF };
export const MONORAIL = { half: RING.center, corner: 3, height: 8 };

/**
 * The plaza centerpiece: "東京タワー" by Kenta Imai (CC-BY, via Poly Pizza), cut out of its
 * surrounding town. Measurements are from the model file (units before scaling).
 */
const TOWER_MODEL = {
  height: 83,
  /** Offset that centers the tower on the origin. */
  center: [-0.5, 1.5] as const,
  /** Each foot spans 11..15 from the center on both axes. */
  footFrom: 11,
  footTo: 15,
  /** Keep triangles whose centroid is within this square (drops the town around it). */
  crop: 17.5,
};
const TOWER_SCALE = 20 / TOWER_MODEL.height;
export const TOWER = {
  model: TOWER_MODEL,
  scale: TOWER_SCALE,
  height: TOWER_MODEL.height * TOWER_SCALE,
  footCenter: ((TOWER_MODEL.footFrom + TOWER_MODEL.footTo) / 2) * TOWER_SCALE,
  footSize: (TOWER_MODEL.footTo - TOWER_MODEL.footFrom) * TOWER_SCALE,
};

export type BuildingKind ="block" | "stepped" | "cylinder" | "pagoda" | "hotel" | "shops";

export type BuildingSpec = {
  kind: BuildingKind;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  wall: string;
  glow: string;
  accent: string;
  ring: "core" | "outer";
  seed: number;
  /** Neon sign text for hotels/shops. */
  sign?: string;
};

export const NEON = {
  cyan: "#3ef3ff",
  pink: "#ff4fd8",
  orange: "#ff9a3c",
  lime: "#b6ff3c",
  violet: "#9b6bff",
  red: "#ff3b5c",
};

const WALLS = ["#3b3d8f", "#463a99", "#2f3a86", "#4a2f8a", "#35459c", "#3d3277"];

type Lot = { minX: number; maxX: number; minZ: number; maxZ: number };

/** The three lots of the +x/+z quadrant; the others are mirrors of it. */
const QUADRANT_LOTS: Lot[] = [
  { minX: 8.6, maxX: 12.5, minZ: 8.6, maxZ: 12.5 }, // outer corner: the tall one
  { minX: 7.8, maxX: 12.5, minZ: SIDEWALK_OUT, maxZ: 7.4 }, // along the cross street
  { minX: SIDEWALK_OUT, maxX: 7.4, minZ: 7.8, maxZ: 12.5 }, // along the avenue
  // (1.2-wide alleys separate them from the corner lot.)
];

/** Hand-picked mix per quadrant so every corner of the plaza looks different. */
const QUADRANTS: Array<{
  sx: 1 | -1;
  sz: 1 | -1;
  kinds: [BuildingKind, BuildingKind, BuildingKind];
  heights: [number, number, number];
  signs?: [string?, string?, string?];
}> = [
  { sx: 1, sz: -1, kinds: ["cylinder", "hotel", "stepped"], heights: [22, 9, 11], signs: [undefined, "HOTEL"] },
  { sx: -1, sz: -1, kinds: ["pagoda", "shops", "stepped"], heights: [17, 5, 14], signs: [undefined, "SNACK"] },
  { sx: 1, sz: 1, kinds: ["stepped", "shops", "cylinder"], heights: [12, 5.5, 16] },
  { sx: -1, sz: 1, kinds: ["cylinder", "block", "pagoda"], heights: [20, 8, 12] },
];

const GLOWS = [NEON.cyan, NEON.pink, NEON.orange, NEON.lime, NEON.violet];

export type CityLayout = {
  buildings: BuildingSpec[];
  backdrop: Array<{ x: number; z: number; w: number; d: number; h: number; tint: number; round: boolean }>;
  obstacles: Rect[];
  monorailPillars: Array<[number, number]>;
  lamps: Array<[number, number]>;
  cars: Array<{ x: number; z: number; rot: number; color: string }>;
};

let cached: CityLayout | null = null;

export function nightCityLayout(): CityLayout {
  if (cached) return cached;
  const rng = createRng(77);
  const buildings: BuildingSpec[] = [];

  // Core: 4 quadrants × 3 lots.
  for (const q of QUADRANTS) {
    QUADRANT_LOTS.forEach((lot, i) => {
      const xs = [lot.minX * q.sx, lot.maxX * q.sx];
      const zs = [lot.minZ * q.sz, lot.maxZ * q.sz];
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minZ = Math.min(...zs);
      const maxZ = Math.max(...zs);
      buildings.push({
        kind: q.kinds[i]!,
        x: (minX + maxX) / 2,
        z: (minZ + maxZ) / 2,
        w: maxX - minX,
        d: maxZ - minZ,
        h: q.heights[i]!,
        wall: rng.pick(WALLS),
        glow: rng.pick(GLOWS),
        accent: rng.pick(GLOWS),
        ring: "core",
        seed: Math.floor(rng.next() * 1e6),
        sign: q.signs?.[i],
      });
    });
  }

  // Outer ring: a wall of taller buildings just beyond the barriers, open where the
  // avenue and cross street leave the city.
  const ringIn = WALK_HALF + 0.6;
  const ringOut = WALK_HALF + 7;
  const outerKinds: BuildingKind[] = ["block", "stepped", "cylinder", "pagoda", "block", "stepped"];
  for (const side of ["n", "s", "e", "w"] as const) {
    for (let a = -ringOut; a < ringOut; ) {
      const len = rng.range(4, 6.5);
      const mid = a + len / 2;
      a += len + rng.range(0.3, 0.9);
      if (Math.abs(mid) < SIDEWALK_OUT + len / 2) continue; // keep the street open
      const depth = rng.range(4.5, 6.5);
      const across = side === "n" || side === "w" ? -(ringIn + depth / 2) : ringIn + depth / 2;
      const horizontal = side === "n" || side === "s";
      // Corners are covered by the n/s rows; e/w rows stop short of them.
      if (!horizontal && Math.abs(mid) > ringIn - 1) continue;
      buildings.push({
        kind: rng.pick(outerKinds),
        x: horizontal ? mid : across,
        z: horizontal ? across : mid,
        w: horizontal ? len : depth,
        d: horizontal ? depth : len,
        h: rng.range(12, 28),
        wall: rng.pick(WALLS),
        glow: rng.pick(GLOWS),
        accent: rng.pick(GLOWS),
        ring: "outer",
        seed: Math.floor(rng.next() * 1e6),
      });
    }
  }

  // Distant skyline in four quadrants, leaving the two streets running off into the haze.
  const backdrop: CityLayout["backdrop"] = [];
  for (let i = 0; i < 170; i++) {
    const angle = rng.next() * Math.PI * 2;
    const dist = rng.range(WALK_HALF + 11, 75);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (Math.abs(x) < 6 || Math.abs(z) < 6) continue;
    const round = rng.next() < 0.22;
    const w = rng.range(3, 7);
    backdrop.push({
      x,
      z,
      w,
      d: round ? w : rng.range(3, 7),
      h: rng.range(14, 34) + (dist - 28) * rng.range(0.2, 0.6),
      tint: rng.next(),
      round,
    });
  }

  // Monorail pillars stand on the ring road, clear of the two street exits.
  const monorailPillars: Array<[number, number]> = [];
  for (const along of [-10, -5.5, 5.5, 10]) {
    monorailPillars.push(
      [along, -MONORAIL.half],
      [along, MONORAIL.half],
      [-MONORAIL.half, along],
      [MONORAIL.half, along],
    );
  }

  const lamps: Array<[number, number]> = [];
  for (const p of [-10.5, 10.5]) {
    for (const s of [-1, 1]) {
      lamps.push([s * (STREET_HALF + 0.6), p], [p, s * (STREET_HALF + 0.6)]);
    }
  }

  const cars: CityLayout["cars"] = [
    { x: 1.3, z: -10.5, rot: Math.PI / 2, color: "#2a3fbf" },
    { x: -1.3, z: 9.5, rot: -Math.PI / 2, color: "#1c2148" },
    { x: 10, z: 1.3, rot: Math.PI, color: "#3a2a8a" },
    { x: -9.5, z: -1.3, rot: 0, color: "#1d3a7a" },
    { x: 8, z: 14.9, rot: 0, color: "#232a5c" },
    { x: -14.9, z: 7, rot: -Math.PI / 2, color: "#3b1f6e" },
  ];

  const solid = (b: { x: number; z: number; w: number; d: number }): Rect => ({
    minX: b.x - b.w / 2,
    maxX: b.x + b.w / 2,
    minZ: b.z - b.d / 2,
    maxZ: b.z + b.d / 2,
  });
  const obstacles: Rect[] = [
    ...buildings.filter((b) => b.ring === "core").map(solid),
    // Tokyo Tower: only its four feet are solid; you can walk under the arch.
    ...[-1, 1].flatMap((sx) =>
      [-1, 1].map((sz) =>
        solid({ x: sx * TOWER.footCenter, z: sz * TOWER.footCenter, w: TOWER.footSize, d: TOWER.footSize }),
      ),
    ),
    ...monorailPillars.map(([x, z]) => solid({ x, z, w: 0.7, d: 0.7 })),
  ];

  cached = { buildings, backdrop, obstacles, monorailPillars, lamps, cars };
  return cached;
}

/** Collision footprints in world space for a biome centered at (cx, cz). */
export function nightCityObstacles(cx: number, cz: number): Rect[] {
  return nightCityLayout().obstacles.map((r) => ({
    minX: r.minX + cx,
    maxX: r.maxX + cx,
    minZ: r.minZ + cz,
    maxZ: r.maxZ + cz,
  }));
}

/** A point and heading along the monorail loop (a rounded square), t in [0, 1). */
export function monorailPoint(t: number) {
  const { half, corner } = MONORAIL;
  const straight = (half - corner) * 2;
  const arc = (Math.PI / 2) * corner;
  const total = 4 * (straight + arc);
  let d = (((t % 1) + 1) % 1) * total;
  // Four sides, each: a straight then a corner arc. Start at the north side heading east.
  const sides = [
    { start: [-(half - corner), -half], dir: [1, 0], center: [half - corner, -(half - corner)], a0: -Math.PI / 2 },
    { start: [half, -(half - corner)], dir: [0, 1], center: [half - corner, half - corner], a0: 0 },
    { start: [half - corner, half], dir: [-1, 0], center: [-(half - corner), half - corner], a0: Math.PI / 2 },
    { start: [-half, half - corner], dir: [0, -1], center: [-(half - corner), -(half - corner)], a0: Math.PI },
  ] as const;
  for (const s of sides) {
    if (d <= straight) {
      return {
        x: s.start[0] + s.dir[0] * d,
        z: s.start[1] + s.dir[1] * d,
        heading: Math.atan2(s.dir[0], s.dir[1]),
      };
    }
    d -= straight;
    if (d <= arc) {
      const a = s.a0 + d / corner;
      return {
        x: s.center[0] + Math.cos(a) * corner,
        z: s.center[1] + Math.sin(a) * corner,
        heading: Math.atan2(-Math.sin(a), Math.cos(a)),
      };
    }
    d -= arc;
  }
  return { x: -(half - corner), z: -half, heading: Math.PI / 2 };
}

export const MONORAIL_LENGTH = 4 * ((MONORAIL.half - MONORAIL.corner) * 2 + (Math.PI / 2) * MONORAIL.corner);
