import { useLayoutEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Area } from "@unify/shared";
import { Scatter, type Placement } from "./Countryside";
import {
  BAY_WIDTH,
  CHAIR_ANGLES,
  DESK,
  PLANTS,
  ROOM_HALF,
  STACK,
  STACK_BAYS,
  TABLES,
  TABLE_RADIUS,
  WALL_BAYS,
  WALL_SHELF,
  WALL_THICKNESS,
  chairSpot,
  type Bay,
} from "./libraryMap";
import { NOISE_GLSL } from "./noise";
import { createRng } from "./random";
import { useDispose } from "./useDispose";

/**
 * The Library biome: quiet and focused. Rows of bookshelves, round study tables with chairs and
 * reading lamps, and a front desk. Layout lives in libraryMap.
 *
 * `immersive` (a player standing in it) gives it tall walls with high windows, surrounded by
 * darkness; the host's overview gets lower walls so the room can be seen into.
 */
export function Library({ area, immersive = false }: { area: Area; immersive?: boolean }) {
  return (
    <group position={[area.cx, 0, area.cz]}>
      <Floor />
      {immersive ? (
        // Nothing but darkness beyond the walls, the same color as the background.
        <mesh position={[0, -0.05, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[600, 600]} />
          <meshBasicMaterial color="#2a2018" />
        </mesh>
      ) : null}
      <Walls height={immersive ? 6 : WALL_SHELF.height + 0.4} windows={immersive} />
      <Rugs />
      <Shelves />
      <Books />
      <StudyTables />
      <FrontDesk />
      <Plants />
    </group>
  );
}

// ── The room ─────────────────────────────────────────────────────────────────

/** Polished wooden floorboards: each plank has its own shade, with fine grain along it. */
function Floor() {
  const { geometry, material } = useMemo(() => {
    const geometry = new PlaneGeometry(ROOM_HALF * 2, ROOM_HALF * 2).rotateX(-Math.PI / 2);
    const material = new MeshStandardMaterial({ roughness: 0.55 });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uDark = { value: new Color("#7d5231") };
      shader.uniforms.uLight = { value: new Color("#a9774a") };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vFloor;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFloor = position.xz;");
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          varying vec2 vFloor;
          uniform vec3 uDark; uniform vec3 uLight;
          ${NOISE_GLSL}`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          // Rows of planks running along x; each row's joints are staggered.
          float row = floor(vFloor.y / 0.42);
          float along = vFloor.x / 3.2 + cs_hash(vec2(row, 3.0)) * 7.0;
          float plank = floor(along);
          vec3 wood = mix(uDark, uLight, cs_hash(vec2(row, plank)));
          wood *= 0.92 + 0.14 * cs_noise(vec2(vFloor.x * 1.2 + plank * 9.0, vFloor.y * 22.0));
          float seamZ = 1.0 - smoothstep(0.0, 0.016, abs(fract(vFloor.y / 0.42) - 0.5) - 0.48);
          float seamX = 1.0 - smoothstep(0.0, 0.012, 0.5 - abs(fract(along) - 0.5));
          diffuseColor.rgb = wood * (1.0 - 0.45 * max(1.0 - seamZ, seamX));`,
        );
    };
    return { geometry, material };
  }, []);
  useDispose(geometry, material);
  return <mesh geometry={geometry} material={material} receiveShadow />;
}

/** North, east and west walls, and a low south wall with a doorway so the camera can see in. */
function Walls({ height, windows }: { height: number; windows: boolean }) {
  const outer = ROOM_HALF + WALL_THICKNESS / 2;
  const length = ROOM_HALF * 2 + WALL_THICKNESS * 2;
  const wall = "#d9cbb2";
  const lowLength = ROOM_HALF - 2.5;
  return (
    <>
      <mesh position={[0, height / 2, -outer]} castShadow receiveShadow>
        <boxGeometry args={[length, height, WALL_THICKNESS]} />
        <meshStandardMaterial color={wall} roughness={0.9} />
      </mesh>
      <mesh position={[-outer, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[WALL_THICKNESS, height, length]} />
        <meshStandardMaterial color={wall} roughness={0.9} />
      </mesh>
      {/* The sun comes from the east, so this wall doesn't cast a shadow over the room. */}
      <mesh position={[outer, height / 2, 0]} receiveShadow>
        <boxGeometry args={[WALL_THICKNESS, height, length]} />
        <meshStandardMaterial color={wall} roughness={0.9} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (2.5 + lowLength / 2), 0.55, outer]} receiveShadow>
          <boxGeometry args={[lowLength + WALL_THICKNESS, 1.1, WALL_THICKNESS]} />
          <meshStandardMaterial color="#6e4a2c" roughness={0.7} />
        </mesh>
      ))}
      {windows ? <Windows /> : null}
    </>
  );
}

const WINDOW_SPOTS = [-12, -6, 0, 6, 12];

/** A row of high windows above the shelves, bright with daylight. */
function Windows() {
  const z = -ROOM_HALF + 0.02;
  return (
    <>
      {WINDOW_SPOTS.map((x) => (
        <group key={x} position={[x, 5, z]}>
          <mesh position={[0, 0, 0.01]}>
            <boxGeometry args={[3.5, 1.5, 0.06]} />
            <meshStandardMaterial color="#6e4a2c" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <planeGeometry args={[3.2, 1.25]} />
            <meshBasicMaterial color="#f2f6e8" />
          </mesh>
          {[-1.07, 0, 1.07].map((bar) => (
            <mesh key={bar} position={[bar, 0, 0.07]}>
              <boxGeometry args={[0.06, 1.25, 0.03]} />
              <meshStandardMaterial color="#6e4a2c" roughness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

/** A long runner down the walkway, and a round rug under each study table. */
function Rugs() {
  const { runner, circles, geometry, materials } = useMemo(() => {
    const circles: Placement[] = TABLES.map((t, i) => ({
      x: t.x,
      y: 0.012,
      z: t.z,
      s: 1,
      rot: 0,
      color: i % 2 ? "#7c3f3a" : "#3f5a6e",
    }));
    return {
      runner: { width: 2, from: -13.5, to: 9 },
      circles,
      geometry: new CylinderGeometry(2.6, 2.6, 0.012, 48),
      materials: new MeshStandardMaterial({ roughness: 1 }),
    };
  }, []);
  useDispose(geometry, materials);
  const length = runner.to - runner.from;
  const midZ = (runner.from + runner.to) / 2;
  return (
    <>
      <Scatter geometry={geometry} material={materials} items={circles} />
      <mesh position={[0, 0.012, midZ]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[runner.width, length]} />
        <meshStandardMaterial color="#6e2f30" roughness={1} />
      </mesh>
      <mesh position={[0, 0.016, midZ]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[runner.width - 0.32, length - 0.32]} />
        <meshStandardMaterial color="#8a3f3c" roughness={1} />
      </mesh>
    </>
  );
}

// ── Shelves and books ────────────────────────────────────────────────────────

/** One bay of shelving, standing on the floor: chunky sides, shelves and a panel down the middle. */
function shelfFrame(height: number, depth: number, levels: number) {
  const side = 0.09;
  const width = BAY_WIDTH;
  const parts: BufferGeometry[] = [
    new BoxGeometry(side, height, depth).translate(-width / 2 + side / 2, height / 2, 0),
    new BoxGeometry(side, height, depth).translate(width / 2 - side / 2, height / 2, 0),
    new BoxGeometry(width, height, 0.04).translate(0, height / 2, 0),
    new BoxGeometry(width + 0.06, 0.1, depth + 0.06).translate(0, height + 0.05, 0),
  ];
  for (let level = 0; level < levels; level++) {
    parts.push(new BoxGeometry(width, 0.07, depth).translate(0, shelfY(height, levels, level), 0));
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

/** Height of the board under a given level of books. */
function shelfY(height: number, levels: number, level: number) {
  return 0.1 + ((height - 0.1) / levels) * level;
}

const WOODS = ["#6e4a2c", "#74502f", "#68452a"];

function Shelves() {
  const { stacks, walls, geometry, material } = useMemo(() => {
    const rng = createRng(8);
    const at = (bay: Bay): Placement => ({ x: bay.x, y: 0, z: bay.z, s: 1, rot: bay.rot, color: rng.pick(WOODS) });
    return {
      stacks: STACK_BAYS.map(at),
      walls: WALL_BAYS.map(at),
      geometry: {
        stack: shelfFrame(STACK.height, STACK.depth, STACK.levels),
        wall: shelfFrame(WALL_SHELF.height, WALL_SHELF.depth, WALL_SHELF.levels),
      },
      material: new MeshStandardMaterial({ roughness: 0.75 }),
    };
  }, []);
  useDispose(geometry.stack, geometry.wall, material);
  return (
    <>
      <Scatter geometry={geometry.stack} material={material} items={stacks} castShadow />
      <Scatter geometry={geometry.wall} material={material} items={walls} castShadow />
    </>
  );
}

/** Old, faded book colors: mostly leather and paper, with a little dusty color. */
const SPINES = [
  "#6b4a32", "#7d5a3c", "#5f4330", "#8f7050", "#a88d68", "#c2ae8a", "#d3c6a8", "#4a3a2c",
  "#3f4a55", "#4f5f6b", "#6d7378", "#6a3a32", "#4d5544", "#34302c", "#8a8478",
];

/**
 * Books are placed the way shelves really fill up, not one random color at a time. Each section
 * of shelving leans toward a few colors, and books come in runs of matching sizes and color (a
 * series, a set of old journals). Between runs there are gaps, leaning books and flat piles.
 */
function Books() {
  const ref = useRef<InstancedMesh>(null);
  const { matrices, colors, geometry, material } = useMemo(() => {
    const rng = createRng(1984);
    const dummy = new Object3D();
    const tint = new Color();
    const matrices: number[] = [];
    const colors: number[] = [];

    const fill = (bay: Bay, shelf: { height: number; depth: number; levels: number }, facing: number) => {
      const levelHeight = (shelf.height - 0.1) / shelf.levels;
      const cos = Math.cos(bay.rot);
      const sin = Math.sin(bay.rot);
      const clearDepth = shelf.depth / 2 - 0.05;
      // This section's favorite colors.
      const section = [rng.pick(SPINES), rng.pick(SPINES), rng.pick(SPINES)];

      const addBook = (
        localX: number,
        y: number,
        width: number,
        tall: number,
        deep: number,
        color: string,
        lean: number,
        turn = 0,
      ) => {
        const localZ = facing * (shelf.depth / 2 - deep / 2 - 0.04);
        dummy.position.set(bay.x + localX * cos + localZ * sin, y, bay.z - localX * sin + localZ * cos);
        dummy.rotation.set(0, bay.rot + turn, lean);
        dummy.scale.set(width, tall, deep);
        dummy.updateMatrix();
        matrices.push(...dummy.matrix.elements);
        tint.set(color).multiplyScalar(rng.range(0.8, 1.12));
        colors.push(tint.r, tint.g, tint.b);
      };

      for (let level = 0; level < shelf.levels; level++) {
        const floor = shelfY(shelf.height, shelf.levels, level) + 0.035;
        const right = BAY_WIDTH / 2 - 0.1;
        let along = -BAY_WIDTH / 2 + 0.1;
        while (along < right - 0.1) {
          const roll = rng.next();
          if (roll < 0.12) {
            // A gap, sometimes with the last book slumped into it.
            const gap = rng.range(0.14, 0.42);
            if (rng.next() < 0.5 && along + gap < right) {
              const tall = levelHeight * rng.range(0.6, 0.76);
              const width = rng.range(0.09, 0.14);
              addBook(along + gap * 0.5, floor + tall * 0.47, width, tall, Math.min(clearDepth, 0.34), rng.pick(section), -0.3);
            }
            along += gap;
            continue;
          }
          if (roll < 0.2 && along + 0.42 < right) {
            // A pile lying flat.
            const pile = 2 + Math.floor(rng.next() * 3);
            let y = floor;
            for (let i = 0; i < pile; i++) {
              const thick = rng.range(0.06, 0.09);
              addBook(along + 0.2, y + thick / 2, rng.range(0.32, 0.38), thick, Math.min(clearDepth, 0.3), rng.pick(section), 0, rng.range(-0.08, 0.08));
              y += thick;
            }
            along += 0.44;
            continue;
          }
          // A run of matching books.
          const color = rng.next() < 0.72 ? rng.pick(section) : rng.pick(SPINES);
          const run = 2 + Math.floor(rng.next() * 4);
          const baseWidth = rng.range(0.085, 0.16);
          const baseTall = levelHeight * rng.range(0.6, 0.82);
          const deep = Math.min(clearDepth, rng.range(0.28, 0.42));
          for (let i = 0; i < run && along < right - 0.08; i++) {
            const width = baseWidth * rng.range(0.85, 1.15);
            const tall = baseTall * rng.range(0.92, 1.08);
            addBook(along + width / 2, floor + tall / 2, width, tall, deep, color, 0);
            along += width + 0.012;
          }
        }
      }
    };

    for (const bay of STACK_BAYS) {
      fill(bay, STACK, 1);
      fill(bay, STACK, -1);
    }
    for (const bay of WALL_BAYS) {
      fill(bay, WALL_SHELF, 1);
    }
    return {
      matrices: new Float32Array(matrices),
      colors: new Float32Array(colors),
      geometry: new BoxGeometry(1, 1, 1),
      material: new MeshStandardMaterial({ roughness: 0.9 }),
    };
  }, []);

  const count = matrices.length / 16;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const color = new Color();
    for (let i = 0; i < count; i++) {
      mesh.instanceMatrix.array.set(matrices.subarray(i * 16, i * 16 + 16), i * 16);
      mesh.setColorAt(i, color.setRGB(colors[i * 3]!, colors[i * 3 + 1]!, colors[i * 3 + 2]!));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices, colors, count]);
  useDispose(geometry, material);

  return <instancedMesh ref={ref} args={[geometry, material, count]} receiveShadow />;
}

// ── Study tables and chairs ──────────────────────────────────────────────────

/** Height of a study table's top: about waist height on a character. */
const TABLE_TOP = 1;

/** A round wooden table on a single pedestal. */
function tableGeometry() {
  const parts: BufferGeometry[] = [
    new CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS, 0.09, 40).translate(0, TABLE_TOP - 0.045, 0),
    new CylinderGeometry(0.12, 0.15, TABLE_TOP - 0.1, 12).translate(0, (TABLE_TOP - 0.1) / 2 + 0.03, 0),
    new CylinderGeometry(0.6, 0.68, 0.07, 20).translate(0, 0.04, 0),
  ];
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

/** A wooden chair big enough for a character, with its back on the +z side. */
function chairGeometry() {
  const seat = 0.62;
  const leg = seat - 0.04;
  const parts: BufferGeometry[] = [
    new BoxGeometry(0.68, 0.07, 0.66).translate(0, seat, 0),
    new BoxGeometry(0.64, 0.48, 0.06).translate(0, seat + 0.42, 0.3),
    ...[-0.28, 0.28].map((x) => new BoxGeometry(0.06, leg, 0.06).translate(x, leg / 2, -0.28)),
    ...[-0.28, 0.28].map((x) => new BoxGeometry(0.06, seat + 0.2, 0.06).translate(x, (seat + 0.2) / 2, 0.3)),
  ];
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

const TABLE_WOODS = ["#7b5230", "#855a35", "#744c2c"];
const COVERS = ["#6a3a32", "#3f4a55", "#4d5544", "#8f7050", "#34302c"];

function StudyTables() {
  const { tables, chairs, bases, shades, bulbs, papers, stacked, geometry, materials } = useMemo(() => {
    const rng = createRng(33);
    const tables: Placement[] = [];
    const chairs: Placement[] = [];
    const bases: Placement[] = [];
    const shades: Placement[] = [];
    const bulbs: Placement[] = [];
    const papers: Placement[] = [];
    const stacked: Placement[] = [];
    const top = TABLE_TOP;
    const items = 1.35;
    for (const table of TABLES) {
      tables.push({ x: table.x, y: 0, z: table.z, s: 1, rot: 0, color: rng.pick(TABLE_WOODS) });
      for (const angle of CHAIR_ANGLES) {
        const spot = chairSpot(table, angle);
        chairs.push({
          x: spot.x,
          y: 0,
          z: spot.z,
          s: 1,
          // Backs face away from the table, a little askew like chairs really are.
          rot: Math.atan2(Math.cos(angle), Math.sin(angle)) + rng.range(-0.16, 0.16),
          color: "#6e4a2c",
        });
      }
      // A reading lamp in the middle.
      bases.push({ x: table.x, y: top, z: table.z, s: items, rot: 0, color: "#b08d4f" });
      shades.push({ x: table.x, y: top, z: table.z, s: items, rot: 0, color: "#3f6650" });
      bulbs.push({ x: table.x, y: top, z: table.z, s: items, rot: 0, color: "#ffffff" });
      // Open books and a little stack, in front of a couple of the seats.
      for (const angle of [CHAIR_ANGLES[0]!, CHAIR_ANGLES[2]!]) {
        const a = angle + rng.range(-0.2, 0.2);
        papers.push({
          x: table.x + Math.cos(a) * 0.82,
          y: top + 0.015,
          z: table.z + Math.sin(a) * 0.82,
          s: items,
          rot: -a + Math.PI / 2,
          color: "#f2ecdc",
        });
      }
      const a = CHAIR_ANGLES[1]! + rng.range(-0.3, 0.3);
      for (let level = 0; level < 3; level++) {
        stacked.push({
          x: table.x + Math.cos(a) * 0.8,
          y: top + 0.035 + level * 0.07,
          z: table.z + Math.sin(a) * 0.8,
          s: items * (1 - level * 0.08),
          rot: rng.range(-0.3, 0.3),
          color: rng.pick(COVERS),
        });
      }
    }
    const lampBase = [
      new CylinderGeometry(0.09, 0.11, 0.03, 12).translate(0, 0.015, 0),
      new CylinderGeometry(0.018, 0.018, 0.32, 8).translate(0, 0.17, 0),
    ];
    const base = mergeGeometries(lampBase.map((p) => p.toNonIndexed()))!;
    lampBase.forEach((p) => p.dispose());
    return {
      tables,
      chairs,
      bases,
      shades,
      bulbs,
      papers,
      stacked,
      geometry: {
        table: tableGeometry(),
        chair: chairGeometry(),
        base,
        shade: new ConeGeometry(0.19, 0.15, 16, 1, true).translate(0, 0.38, 0),
        bulb: new IcosahedronGeometry(0.05, 1).translate(0, 0.33, 0),
        paper: new BoxGeometry(0.42, 0.02, 0.3),
        book: new BoxGeometry(0.32, 0.05, 0.24),
      },
      materials: {
        wood: new MeshStandardMaterial({ roughness: 0.6 }),
        plain: new MeshStandardMaterial({ roughness: 0.8 }),
        shade: new MeshStandardMaterial({ roughness: 0.4, side: DoubleSide }),
        bulb: new MeshStandardMaterial({ color: "#fff1c4", emissive: "#ffd98a", emissiveIntensity: 1.6 }),
      },
    };
  }, []);
  useDispose(...Object.values(geometry), ...Object.values(materials));

  return (
    <>
      <Scatter geometry={geometry.table} material={materials.wood} items={tables} castShadow />
      <Scatter geometry={geometry.chair} material={materials.wood} items={chairs} castShadow />
      <Scatter geometry={geometry.base} material={materials.plain} items={bases} castShadow />
      <Scatter geometry={geometry.shade} material={materials.shade} items={shades} castShadow />
      <Scatter geometry={geometry.bulb} material={materials.bulb} items={bulbs} />
      <Scatter geometry={geometry.paper} material={materials.plain} items={papers} />
      <Scatter geometry={geometry.book} material={materials.plain} items={stacked} />
    </>
  );
}

// ── The front desk and plants ────────────────────────────────────────────────

/** The librarian's desk by the door, with a lamp and returned books waiting to be shelved. */
function FrontDesk() {
  const width = DESK.halfWidth * 2;
  const returned = [
    { x: -1.5, y: 1.13, rot: 0.1, color: "#6a3a32" },
    { x: -1.47, y: 1.18, rot: -0.2, color: "#3f4a55" },
    { x: -1.5, y: 1.23, rot: 0.25, color: "#8f7050" },
    { x: 0.7, y: 1.13, rot: -0.1, color: "#4d5544" },
  ];
  return (
    <group position={[DESK.x, 0, DESK.z]}>
      <mesh position={[0, 0.52, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 1.04, DESK.halfDepth * 2]} />
        <meshStandardMaterial color="#5f3f26" roughness={0.65} />
      </mesh>
      <mesh position={[0, 1.07, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.2, 0.07, DESK.halfDepth * 2 + 0.2]} />
        <meshStandardMaterial color="#8a5f38" roughness={0.45} />
      </mesh>
      {returned.map((book, i) => (
        <mesh key={i} position={[book.x, book.y, 0]} rotation-y={book.rot} castShadow>
          <boxGeometry args={[0.34, 0.05, 0.25]} />
          <meshStandardMaterial color={book.color} roughness={0.8} />
        </mesh>
      ))}
      <group position={[1.7, 1.1, 0]}>
        <mesh position={[0, 0.17, 0]} castShadow>
          <cylinderGeometry args={[0.018, 0.1, 0.34, 10]} />
          <meshStandardMaterial color="#b08d4f" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.38, 0]} castShadow>
          <coneGeometry args={[0.2, 0.15, 16, 1, true]} />
          <meshStandardMaterial color="#2f6b4f" roughness={0.4} side={DoubleSide} />
        </mesh>
        <mesh position={[0, 0.33, 0]}>
          <icosahedronGeometry args={[0.05, 1]} />
          <meshStandardMaterial color="#fff1c4" emissive="#ffd98a" emissiveIntensity={1.6} />
        </mesh>
      </group>
    </group>
  );
}

/** A few potted plants by the door and in the corners. */
function Plants() {
  return (
    <>
      {PLANTS.map((plant, i) => (
        <group key={i} position={[plant.x, 0, plant.z]} rotation-y={i * 1.7}>
          <mesh position={[0, 0.24, 0]} castShadow>
            <cylinderGeometry args={[0.26, 0.19, 0.48, 12]} />
            <meshStandardMaterial color="#a3603d" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.82, 0]} scale={[0.5, 0.72, 0.5]} castShadow>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color="#4a7d46" roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0.2, 1.24, 0.1]} scale={[0.32, 0.45, 0.32]} castShadow>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color="#5a9150" roughness={0.9} flatShading />
          </mesh>
        </group>
      ))}
    </>
  );
}
