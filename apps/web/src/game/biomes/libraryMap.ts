import type { Obstacles, Rect } from "../collision";

/**
 * The Library: an ordinary quiet library, open at the top so the follow camera can see in. Rows
 * of bookshelves fill the wings, and round study tables run down the middle. Shelves point away
 * from the camera (-z is "north"), so you look along the aisles instead of being hidden by them.
 * Coordinates are relative to the biome's center, and the floor is flat at y = 0.
 */

/** Inside face of the walls. */
export const ROOM_HALF = 16;
export const WALL_THICKNESS = 0.4;

/** One section of shelving: `rot` turns it about y, and its open face looks along local +z. */
export type Bay = { x: number; z: number; rot: number };

export const BAY_WIDTH = 2;

/** Free-standing shelves: lower, and with books on both sides. */
export const STACK = { height: 2.8, depth: 1.3, levels: 4 };
/** Shelves against the walls: taller, with books facing into the room. */
export const WALL_SHELF = { height: 4, depth: 0.6, levels: 6 };

const WING_ROWS = [7.6, 10.4, 13.2];
/** Each row of shelves is broken in two by a cross aisle through the middle of the room. */
const WING_BLOCKS: Array<[number, number]> = [
  [-13.5, -1.5],
  [1.5, 13.5],
];

export const STACK_BAYS: Bay[] = [-1, 1].flatMap((side) =>
  WING_ROWS.flatMap((row) =>
    WING_BLOCKS.flatMap(([from, to]) => {
      const bays: Bay[] = [];
      for (let z = from + BAY_WIDTH / 2; z < to; z += BAY_WIDTH) {
        bays.push({ x: side * row, z, rot: Math.PI / 2 });
      }
      return bays;
    }),
  ),
);

const wallOffset = ROOM_HALF - WALL_SHELF.depth / 2;
export const WALL_BAYS: Bay[] = [
  // North wall, looking back down the room.
  ...Array.from({ length: 16 }, (_, i) => ({ x: -15 + i * BAY_WIDTH, z: -wallOffset, rot: 0 })),
  // East and west walls, looking inward.
  ...[-1, 1].flatMap((side) =>
    Array.from({ length: 14 }, (_, i) => ({
      x: side * wallOffset,
      z: -13 + i * BAY_WIDTH,
      rot: (-side * Math.PI) / 2,
    })),
  ),
];

/** Round study tables, in two columns either side of the central walkway. */
export const TABLES = [-10, -3.5, 3].flatMap((z) => [
  { x: -3.7, z },
  { x: 3.7, z },
]);
export const TABLE_RADIUS = 1.35;
/** Chairs sit around each table at these angles (diagonals leave the walkway clear). */
export const CHAIR_ANGLES = [0.25, 1.82, 3.39, 4.96];
export const CHAIR_DISTANCE = 1.82;

/** Where each chair at a table stands. */
export function chairSpot(table: { x: number; z: number }, angle: number) {
  return { x: table.x + Math.cos(angle) * CHAIR_DISTANCE, z: table.z + Math.sin(angle) * CHAIR_DISTANCE };
}

export const DESK = { x: 0, z: 12.7, halfWidth: 2.6, halfDepth: 0.6 };

export const PLANTS = [
  { x: -15, z: 14.8 },
  { x: 15, z: 14.8 },
  { x: -4.6, z: 14.9 },
  { x: 4.6, z: 14.9 },
];

const box = (x: number, z: number, rx: number, rz = rx): Rect => ({
  minX: x - rx,
  maxX: x + rx,
  minZ: z - rz,
  maxZ: z + rz,
});

const SOLIDS: Rect[] = [
  // Each row of shelves is one long solid block.
  ...[-1, 1].flatMap((side) =>
    WING_ROWS.flatMap((row) =>
      WING_BLOCKS.map(([from, to]) => ({
        minX: side * row - STACK.depth / 2,
        maxX: side * row + STACK.depth / 2,
        minZ: from,
        maxZ: to,
      })),
    ),
  ),
  // The shelves against the walls.
  { minX: -ROOM_HALF, maxX: ROOM_HALF, minZ: -ROOM_HALF, maxZ: -ROOM_HALF + WALL_SHELF.depth },
  { minX: -ROOM_HALF, maxX: -ROOM_HALF + WALL_SHELF.depth, minZ: -ROOM_HALF, maxZ: 14 },
  { minX: ROOM_HALF - WALL_SHELF.depth, maxX: ROOM_HALF, minZ: -ROOM_HALF, maxZ: 14 },
  ...TABLES.flatMap((table) => [
    box(table.x, table.z, TABLE_RADIUS * 0.9),
    ...CHAIR_ANGLES.map((angle) => {
      const chair = chairSpot(table, angle);
      return box(chair.x, chair.z, 0.38);
    }),
  ]),
  box(DESK.x, DESK.z, DESK.halfWidth, DESK.halfDepth),
  ...PLANTS.map((plant) => box(plant.x, plant.z, 0.3)),
];

/** Shelves, tables and the desk, in world space for the biome centered at (cx, cz). */
export function libraryObstacles(cx: number, cz: number): Obstacles {
  return {
    rects: SOLIDS.map((r) => ({ minX: r.minX + cx, maxX: r.maxX + cx, minZ: r.minZ + cz, maxZ: r.maxZ + cz })),
  };
}
