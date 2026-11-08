/** Axis-aligned footprint of something solid (a building), in world space. */
export type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };

/** Everything a player can't walk through in a biome, in world space. */
export type Obstacles = {
  rects: readonly Rect[];
  /** Ground that isn't walkable, like water. */
  blocked?: (x: number, z: number) => boolean;
};

/** Ground height (world space) under a point, for biomes that aren't flat. */
export type GroundHeight = (x: number, z: number) => number;

/** Roughly the avatar's capsule radius. */
export const PLAYER_RADIUS = 0.45;

export const NO_OBSTACLES: Obstacles = { rects: [] };

function hits(x: number, z: number, obstacles: Obstacles, r: number) {
  for (const b of obstacles.rects) {
    if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return true;
  }
  return obstacles.blocked?.(x, z) ?? false;
}

/**
 * Moves from `from` toward `to`, one axis at a time, so a blocked axis is dropped and the
 * player slides along walls instead of sticking to them.
 */
export function moveWithCollisions(
  from: { x: number; z: number },
  to: { x: number; z: number },
  obstacles: Obstacles,
  radius = PLAYER_RADIUS,
) {
  if (obstacles.rects.length === 0 && !obstacles.blocked) return to;
  const x = hits(to.x, from.z, obstacles, radius) ? from.x : to.x;
  const z = hits(x, to.z, obstacles, radius) ? from.z : to.z;
  return { x, z };
}

/**
 * If a point is inside an obstacle (e.g. spawned there), moves it to the closest free spot,
 * searching outward in rings so it can't get stuck bouncing between neighbouring buildings.
 */
export function pushOut(p: { x: number; z: number }, obstacles: Obstacles, radius = PLAYER_RADIUS) {
  if (!hits(p.x, p.z, obstacles, radius)) return p;
  for (let r = 0.5; r <= 20; r += 0.5) {
    const steps = Math.max(8, Math.ceil(r * 6));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      if (!hits(x, z, obstacles, radius)) return { x, z };
    }
  }
  return p;
}
