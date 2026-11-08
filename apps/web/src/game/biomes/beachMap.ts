import { BIOME_BY_ID } from "@unify/shared";
import type { GroundHeight, Obstacles, Rect } from "../collision";
import { fbm, smoothstep } from "./noise";

/**
 * The Beach: a sandy cove with the sea to the north (the way the follow camera looks), a campfire
 * in the middle where groups gather, parasols and beach chairs, huts and a walkable pier.
 * Coordinates are relative to the biome's center. The water's surface is at y = 0.
 */

const BIOME = BIOME_BY_ID.get("beach")!;
export const WALK_HALF = BIOME.walkHalf;
export const VISUAL_HALF = BIOME.visualHalf;

// ── Shoreline and terrain ────────────────────────────────────────────────────

/** Where the sand meets the sea at a given x. It curves north at the sides, forming a cove. */
export function shoreZ(x: number) {
  const side = Math.max(0, Math.abs(x) - 11);
  return -9 + 1.2 * Math.sin(x * 0.13 + 0.5) + 0.7 * Math.sin(x * 0.31 + 1.7) - 0.028 * side * side;
}

/** GLSL twin of shoreZ, for the sand and water shaders. */
export const SHORE_GLSL = /* glsl */ `
  float b_shoreZ(float x) {
    float side = max(0.0, abs(x) - 11.0);
    return -9.0 + 1.2 * sin(x * 0.13 + 0.5) + 0.7 * sin(x * 0.31 + 1.7) - 0.028 * side * side;
  }
`;

/** Sand and seabed height: shallow water, a gentle beach, dunes behind it, headlands at the sides. */
export function terrainAt(x: number, z: number) {
  const d = z - shoreZ(x); // Positive on land, negative out to sea.
  if (d < 0) return Math.max(-4, d * 0.18);
  let h = 1.4 * (1 - Math.exp(-d * 0.09));
  h += (fbm(x * 0.14 + 3, z * 0.14) - 0.45) * 0.45 * smoothstep(1, 6, d);
  h += Math.max(0, fbm(x * 0.06 + 9, z * 0.06) - 0.3) * 6 * smoothstep(13, 32, d);
  h += Math.max(0, d - 45) * 0.12 * (0.5 + fbm(x * 0.02, z * 0.02 + 4));
  const headland = smoothstep(19, 45, Math.abs(x)) * smoothstep(0, 10, d);
  return h + headland * 14 * (0.5 + fbm(x * 0.04 + 2, z * 0.04));
}

// ── The pier ─────────────────────────────────────────────────────────────────

const PIER_X = 8;
export const PIER = {
  x: PIER_X,
  halfWidth: 1.4,
  /** Where it leaves the sand, and where it ends out over the water. */
  startZ: shoreZ(PIER_X) + 4.2,
  endZ: -15.6,
  deckY: 0.55,
};

function onPier(x: number, z: number) {
  return Math.abs(x - PIER.x) < PIER.halfWidth && z < PIER.startZ && z > PIER.endZ;
}

/** Deck height along the pier, easing up from the sand over its first stretch. */
export function pierDeckY(z: number) {
  const onto = smoothstep(PIER.startZ, PIER.startZ - 1.5, z);
  return terrainAt(PIER.x, z) + (PIER.deckY - terrainAt(PIER.x, z)) * onto;
}

/** What players stand on: the pier where there is one, otherwise the sand. */
export function groundAt(x: number, z: number) {
  return onPier(x, z) ? pierDeckY(z) : terrainAt(x, z);
}

// ── Things on the beach ──────────────────────────────────────────────────────

export const CAMPFIRE = { x: 0, z: 0 };
/** Log benches around the campfire. */
export const LOGS = [0.4, 1.97, 3.54, 5.11].map((angle) => ({
  x: CAMPFIRE.x + Math.cos(angle) * 2.3,
  z: CAMPFIRE.z + Math.sin(angle) * 2.3,
  rot: -angle + Math.PI / 2,
}));

export const HUTS = [
  { z: -3.5, color: "#e8694f" },
  { z: 0, color: "#f4c95d" },
  { z: 3.5, color: "#5bb8c9" },
  { z: 7, color: "#f29ebc" },
  { z: 10.5, color: "#8fcf8a" },
].map((hut) => ({ ...hut, x: -13.2 }));

export const SHACK = { x: 12.3, z: 8 };
export const TOWER = { x: 12.5, z: -2 };
/** The volleyball net runs along x between these points. */
export const NET = { fromX: -8.5, toX: -3.5, z: -4.2 };

/** A parasol with beach chairs either side of it, looking out to sea. */
export const PARASOLS = [
  { x: 3.6, z: -4.6, color: "#e8694f", chairs: 2 },
  { x: -1.4, z: -5.4, color: "#3f9fc9", chairs: 2 },
  { x: 4.6, z: 4.4, color: "#f4c95d", chairs: 2 },
  { x: -6.2, z: 5.2, color: "#e85d8a", chairs: 1 },
  { x: 2.4, z: 9.4, color: "#3fb8a0", chairs: 2 },
  { x: -6.6, z: 10.4, color: "#f2894a", chairs: 2 },
  { x: 13.4, z: 2.8, color: "#7a78e0", chairs: 1 },
];

/** Where each parasol's chairs stand, relative to its pole. */
export function chairSpots(parasol: (typeof PARASOLS)[number]) {
  const sides = parasol.chairs === 2 ? [-0.8, 0.8] : [0.8];
  return sides.map((side) => ({ x: parasol.x + side, z: parasol.z + 0.45 }));
}

export const SURFBOARDS = [
  { x: 10.1, z: 10.6, rot: 0.3, color: "#e8694f" },
  { x: 10.9, z: 10.9, rot: -0.2, color: "#f4c95d" },
  { x: 11.7, z: 11, rot: 0.5, color: "#3f9fc9" },
  { x: -10.3, z: -5.8, rot: 1.2, color: "#f29ebc" },
];

export const PALMS = [
  { x: -15.6, z: -6, scale: 1.1, rot: 2.6, leaves: "#4f9a3f" },
  { x: -15.8, z: 1.8, scale: 1, rot: 3.5, leaves: "#5fa945" },
  { x: -15.7, z: 8.8, scale: 1.2, rot: 2.2, leaves: "#458f3a" },
  { x: -10.6, z: 14, scale: 1.05, rot: 4.1, leaves: "#5fa945" },
  { x: -3, z: 14.6, scale: 1.25, rot: 4.8, leaves: "#4f9a3f" },
  { x: 5, z: 13.8, scale: 1, rot: 5.4, leaves: "#458f3a" },
  { x: 15.7, z: 12.8, scale: 1.2, rot: 5.9, leaves: "#5fa945" },
  { x: 16, z: 5, scale: 1.1, rot: 0.2, leaves: "#4f9a3f" },
  { x: 16.2, z: -3.5, scale: 1, rot: 0.6, leaves: "#458f3a" },
];

/** The follow camera sits ~11 units south of the player: nothing tall in that strip. */
export function inCameraClearance(x: number, z: number) {
  return z > WALK_HALF + 0.5 && z < WALK_HALF + 13 && Math.abs(x) < WALK_HALF + 5;
}

// ── Collision and ground for players ─────────────────────────────────────────

/** Past this depth it's too deep to wade (players can paddle in the shallows). */
const WADE_DEPTH = 0.34;

const SOLIDS: Rect[] = (() => {
  const box = (x: number, z: number, rx: number, rz = rx): Rect => ({
    minX: x - rx,
    maxX: x + rx,
    minZ: z - rz,
    maxZ: z + rz,
  });
  return [
    box(CAMPFIRE.x, CAMPFIRE.z, 0.75),
    ...LOGS.map((log) => box(log.x, log.z, 0.45)),
    ...HUTS.map((hut) => box(hut.x, hut.z, 1.3, 1.45)),
    box(SHACK.x, SHACK.z, 2.05, 1.65),
    box(TOWER.x, TOWER.z, 1),
    { minX: NET.fromX, maxX: NET.toX, minZ: NET.z - 0.04, maxZ: NET.z + 0.04 },
    ...PARASOLS.flatMap((p) => [
      box(p.x, p.z, 0.1),
      ...chairSpots(p).map((chair) => box(chair.x, chair.z + 0.05, 0.3, 0.68)),
    ]),
    ...SURFBOARDS.map((board) => box(board.x, board.z, 0.2)),
    ...PALMS.map((palm) => box(palm.x, palm.z, 0.25 * palm.scale)),
    // The pier's railings, so it's only reached from the sand end.
    { minX: PIER.x - PIER.halfWidth - 0.05, maxX: PIER.x - PIER.halfWidth + 0.05, minZ: PIER.endZ, maxZ: PIER.startZ },
    { minX: PIER.x + PIER.halfWidth - 0.05, maxX: PIER.x + PIER.halfWidth + 0.05, minZ: PIER.endZ, maxZ: PIER.startZ },
  ];
})();

/** Everything solid, plus water too deep to wade, in world space for the biome at (cx, cz). */
export function beachObstacles(cx: number, cz: number): Obstacles {
  return {
    rects: SOLIDS.map((r) => ({ minX: r.minX + cx, maxX: r.maxX + cx, minZ: r.minZ + cz, maxZ: r.maxZ + cz })),
    blocked: (x, z) => terrainAt(x - cx, z - cz) < -WADE_DEPTH && !onPier(x - cx, z - cz),
  };
}

/** Ground height in world space for the biome centered at (cx, cz). */
export function beachGround(cx: number, cz: number): GroundHeight {
  return (x, z) => groundAt(x - cx, z - cz);
}
