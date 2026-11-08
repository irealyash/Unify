import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  type BufferGeometry,
} from "three";
import { createRng } from "./random";

/**
 * The ground a town sits on, and the countryside around it:
 *   - inside the town: a tiled floor and a paved plaza
 *     (players walk here, buildings stand on it)
 *   - a ragged dirt/gravel edge where the town meets the fields
 *   - grass outside, rolling gently and rising into hills, with dirt footpaths heading out
 *   - a belt of trees, rocks, scattered tufts of grass and a few flowers
 * Sizes are in world units around the town's center; halfX/halfZ are its half-extents.
 */

/** What to paint on a town's floor. */
export type TownGround = {
  plaza: { x: number; z: number; radius: number };
};

export function Countryside({
  halfX,
  halfZ,
  immersive,
  town,
}: {
  halfX: number;
  halfZ: number;
  /** Players get the full surroundings; the host's overview just gets the town's ground. */
  immersive: boolean;
  town?: TownGround;
}) {
  const terrain = useMemo(() => makeTerrain(halfX, halfZ), [halfX, halfZ]);
  return (
    <>
      <Ground terrain={terrain} town={town} size={immersive ? 700 : Math.max(halfX, halfZ) * 2 + 3} />
      {immersive ? (
        <>
          <Trees terrain={terrain} />
          <Rocks terrain={terrain} />
          <Undergrowth terrain={terrain} />
        </>
      ) : null}
    </>
  );
}

// ── Terrain ──────────────────────────────────────────────────────────────────

/** Smooth 2D value noise in [0, 1] (deterministic, so every client builds the same hills). */
function valueNoise(x: number, z: number) {
  const hash = (i: number, j: number) => {
    const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbm(x: number, z: number) {
  let value = 0;
  let amp = 0.5;
  for (let i = 0; i < 4; i++) {
    value += amp * valueNoise(x, z);
    x *= 2.03;
    z *= 2.03;
    amp *= 0.5;
  }
  return value;
}

// ── Footpaths ────────────────────────────────────────────────────────────────

/**
 * Dirt footpaths leaving the town on each side and wandering off across the fields. The same
 * formula drives the ground shader (generated below) and keeps trees, rocks and grass off them.
 * A path runs along `along`, starting at the town's edge on `side`, centered on `offset`.
 */
const PATHS = [
  { along: "x", side: -1, offset: -5, phase: 0.3 },
  { along: "x", side: 1, offset: 4, phase: 1.9 },
  { along: "z", side: -1, offset: -1, phase: 2.7 },
  { along: "z", side: 1, offset: -9, phase: 4.1 },
] as const;
const PATH_HALF_WIDTH = 0.85;

function pathCenter(a: number, offset: number, phase: number) {
  return offset + 3 * Math.sin(a * 0.09 + phase) + 1.2 * Math.sin(a * 0.23 + phase * 2);
}

/** Distance from a point to the nearest footpath's center line (Infinity where there's none). */
function pathDistance(x: number, z: number, halfX: number, halfZ: number) {
  let best = Infinity;
  for (const path of PATHS) {
    const along = path.along === "x" ? x : z;
    const across = path.along === "x" ? z : x;
    const half = path.along === "x" ? halfX : halfZ;
    if (along * path.side < half - 1) continue;
    best = Math.min(best, Math.abs(across - pathCenter(along, path.offset, path.phase)));
  }
  return best;
}

/** GLSL twin of pathDistance. */
const PATHS_GLSL = /* glsl */ `
  float cs_pathDistance(vec2 p) {
    float best = 1e4;
    ${PATHS.map((path) => {
      const along = path.along === "x" ? "p.x" : "p.y";
      const across = path.along === "x" ? "p.y" : "p.x";
      const half = path.along === "x" ? "uHalf.x" : "uHalf.y";
      const f = (n: number) => n.toFixed(3);
      return `if (${along} * ${f(path.side)} >= ${half} - 1.0) {
      best = min(best, abs(${across} - (${f(path.offset)} + 3.0 * sin(${along} * 0.09 + ${f(path.phase)})
        + 1.2 * sin(${along} * 0.23 + ${f(path.phase * 2)}))));
    }`;
    }).join("\n    ")}
    return best;
  }
`;

type Terrain = {
  halfX: number;
  halfZ: number;
  /** How far outside the town a point is (negative inside). */
  outside: (x: number, z: number) => number;
  height: (x: number, z: number) => number;
  /** Distance to the nearest footpath. */
  path: (x: number, z: number) => number;
};

/** Flat over the town and a margin around it, then rolling fields that rise into hills. */
function makeTerrain(halfX: number, halfZ: number): Terrain {
  const outside = (x: number, z: number) => Math.max(Math.abs(x) - halfX, Math.abs(z) - halfZ);
  const smooth = (e0: number, e1: number, v: number) => {
    const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  const height = (x: number, z: number) => {
    const d = outside(x, z);
    if (d < 4) return 0;
    const rolling = (fbm(x * 0.035, z * 0.035) - 0.35) * 7 * smooth(4, 30, d);
    const rise = Math.max(0, d - 45) * 0.16 * (0.6 + fbm(x * 0.012 + 5, z * 0.012));
    return Math.max(0, rolling) + rise;
  };
  const path = (x: number, z: number) => pathDistance(x, z, halfX, halfZ);
  return { halfX, halfZ, outside, height, path };
}

// ── Ground ───────────────────────────────────────────────────────────────────

const GROUND_COLORS = {
  grassDark: new Color("#4f7f3a"),
  grassLight: new Color("#7fae55"),
  dry: new Color("#a7a85d"),
  paving: new Color("#c4beb2"),
  dirt: new Color("#9f8a68"),
  path: new Color("#b09670"),
  sidewalk: new Color("#d2ccc0"),
  curb: new Color("#eeeae2"),
  plaza: new Color("#ddd1ba"),
  plazaLine: new Color("#b09d7e"),
};

/** GLSL noise matching the terrain's look (used only for coloring). */
const NOISE_GLSL = /* glsl */ `
  float cs_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float cs_noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(cs_hash(i), cs_hash(i + vec2(1.0, 0.0)), u.x),
               mix(cs_hash(i + vec2(0.0, 1.0)), cs_hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float cs_fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * cs_noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
`;

function Ground({ terrain, size, town }: { terrain: Terrain; size: number; town?: TownGround }) {
  const geometry = useMemo(() => {
    const segments = Math.min(220, Math.max(8, Math.round(size / 3)));
    const g = new PlaneGeometry(size, size, segments, segments);
    g.rotateX(-Math.PI / 2);
    const pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i++) pos.setY(i, terrain.height(pos.getX(i), pos.getZ(i)) - 0.02);
    g.computeVertexNormals();
    return g;
  }, [terrain, size]);

  const material = useMemo(() => {
    const m = new MeshStandardMaterial({ roughness: 1 });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uHalf = { value: [terrain.halfX, terrain.halfZ] };
      shader.uniforms.uHasTown = { value: town ? 1 : 0 };
      shader.uniforms.uPlaza = { value: town ? [town.plaza.x, town.plaza.z, town.plaza.radius] : [0, 0, 0] };
      for (const [name, color] of Object.entries(GROUND_COLORS)) shader.uniforms[`u_${name}`] = { value: color };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vGround;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGround = position;");
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          varying vec3 vGround;
          uniform vec2 uHalf;
          uniform vec3 u_grassDark; uniform vec3 u_grassLight; uniform vec3 u_dry;
          uniform vec3 u_paving; uniform vec3 u_dirt; uniform vec3 u_path;
          uniform vec3 u_sidewalk; uniform vec3 u_curb;
          uniform vec3 u_plaza; uniform vec3 u_plazaLine;
          uniform float uHasTown; uniform vec3 uPlaza;
          ${NOISE_GLSL}
          ${PATHS_GLSL}`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          vec2 p = vGround.xz;
          // How far outside the town, with a ragged (noisy) edge rather than a straight line.
          float d = max(abs(p.x) - uHalf.x, abs(p.y) - uHalf.y) + (cs_fbm(p * 0.35) - 0.5) * 2.2;

          vec3 grass = mix(u_grassDark, u_grassLight, smoothstep(0.25, 0.75, cs_fbm(p * 0.045)));
          grass = mix(grass, u_dry, smoothstep(0.58, 0.78, cs_fbm(p * 0.07 + 7.0)) * 0.55);
          grass *= 0.9 + 0.2 * cs_fbm(p * 0.7 + 13.0);
          // Fine grain so the grass has texture close to the camera.
          grass *= 0.9 + 0.2 * cs_noise(p * 7.0 + 3.0);
          // Hilltops a touch lighter, hollows a touch darker.
          grass *= 0.94 + clamp(vGround.y * 0.012, 0.0, 0.12);

          vec3 paving = u_paving * (0.93 + 0.12 * cs_fbm(p * 1.1));
          paving = mix(paving, paving * 0.86, smoothstep(0.62, 0.8, cs_fbm(p * 0.25 + 3.0)) * 0.6);

          if (uHasTown > 0.5) {
            // A tiled floor everywhere: square slabs, each a slightly different shade.
            vec2 tf = fract(p * 1.25);
            float joint = max(step(0.94, tf.x), step(0.94, tf.y));
            vec3 streets = u_sidewalk * (0.95 + 0.08 * cs_noise(floor(p * 1.25) * 3.1)) * (1.0 - 0.1 * joint);

            // The plaza under the tower: stone rings and spokes inside a pale border.
            vec2 pc = p - uPlaza.xy;
            float pr = length(pc);
            // Distance (in ring periods) to the nearest ring line, every 1/0.6 units.
            float rings = (1.0 - smoothstep(0.025, 0.05, abs(fract(pr * 0.6 + 0.5) - 0.5))) * step(0.9, pr);
            float spokes = smoothstep(0.985, 0.998, abs(cos(atan(pc.y, pc.x) * 8.0))) * step(1.6, pr);
            vec3 plaza = u_plaza * (0.96 + 0.07 * cs_noise(p * 3.0));
            plaza = mix(plaza, u_plazaLine, max(rings, spokes) * 0.6);
            streets = mix(plaza, streets, smoothstep(uPlaza.z - 0.1, uPlaza.z + 0.1, pr));
            streets = mix(streets, u_curb, (1.0 - smoothstep(0.08, 0.16, abs(pr - uPlaza.z))) * 0.85);

            // Fade into the old paving toward the town's edge so the dirt blend still works.
            paving = mix(streets, paving, smoothstep(-0.8, 0.2, d));
          }

          vec3 dirt = u_dirt * (0.8 + 0.3 * cs_fbm(p * 1.6 + 21.0)) * (0.92 + 0.16 * cs_noise(p * 9.0));

          vec3 ground = paving;
          ground = mix(ground, dirt, smoothstep(-0.4, 0.5, d));
          ground = mix(ground, grass, smoothstep(1.1, 2.1, d));

          // Footpaths through the grass, with soft, slightly ragged edges.
          float pd = cs_pathDistance(p) + (cs_noise(p * 1.7) - 0.5) * 0.35;
          float onPath = 1.0 - smoothstep(${(PATH_HALF_WIDTH * 0.6).toFixed(3)}, ${PATH_HALF_WIDTH.toFixed(3)}, pd);
          vec3 path = u_path * (0.84 + 0.26 * cs_fbm(p * 2.2 + 41.0)) * (0.93 + 0.14 * cs_noise(p * 10.0));
          ground = mix(ground, path, onPath * smoothstep(0.8, 2.0, d));
          diffuseColor.rgb = ground;`,
        );
    };
    return m;
  }, [terrain, town]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <mesh geometry={geometry} material={material} receiveShadow />;
}

// ── Scattered things (trees, rocks, tufts, flowers) ──────────────────────────

export type Placement = { x: number; y: number; z: number; s: number; rot: number; color: string };

/** One instanced mesh for many copies (thousands of tufts without thousands of components). */
export function Scatter({
  geometry,
  material,
  items,
  yOffset = 0,
  castShadow,
}: {
  geometry: BufferGeometry;
  material: MeshStandardMaterial;
  items: Placement[];
  yOffset?: number;
  castShadow?: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new Object3D();
    const color = new Color();
    items.forEach((it, i) => {
      dummy.position.set(it.x, it.y + yOffset * it.s, it.z);
      dummy.rotation.set(0, it.rot, 0);
      dummy.scale.setScalar(it.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.set(it.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, yOffset]);
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, Math.max(items.length, 1)]}
      count={items.length}
      castShadow={castShadow}
      receiveShadow
    />
  );
}

/** Open lawn south of the town, deep enough to fit the follow camera. */
const CAMERA_CLEARANCE = 12;
const LEAVES = ["#3f7d3a", "#4a8a3f", "#5a9a45", "#367034", "#6aa84f"];

function inCameraClearance(terrain: Terrain, x: number, z: number) {
  return z > terrain.halfZ && z < terrain.halfZ + CAMERA_CLEARANCE && Math.abs(x) < terrain.halfX + 4;
}

/** A dense belt of trees right outside the town, thinning out over the hills. */
function Trees({ terrain }: { terrain: Terrain }) {
  const { trunks, cones, rounds, geometry, materials } = useMemo(() => {
    const rng = createRng(77);
    const trunks: Placement[] = [];
    const cones: Placement[] = [];
    const rounds: Placement[] = [];
    const place = (from: number, to: number, spacing: number, keep: number) => {
      const reach = Math.max(terrain.halfX, terrain.halfZ) + to;
      for (let x = -reach; x <= reach; x += spacing) {
        for (let z = -reach; z <= reach; z += spacing) {
          const px = x + rng.range(-spacing * 0.45, spacing * 0.45);
          const pz = z + rng.range(-spacing * 0.45, spacing * 0.45);
          const d = terrain.outside(px, pz);
          if (d < from || d > to) continue;
          // The follow camera sits ~10 units south (+z) of the player: keep that side open.
          if (inCameraClearance(terrain, px, pz)) continue;
          if (rng.next() > keep) continue;
          if (terrain.path(px, pz) < PATH_HALF_WIDTH + 1.3) continue;
          const tree: Placement = {
            x: px,
            y: terrain.height(px, pz),
            z: pz,
            s: rng.range(0.8, 1.5),
            rot: rng.range(0, Math.PI * 2),
            color: rng.pick(LEAVES),
          };
          trunks.push({ ...tree, color: "#6b4a2f" });
          (rng.next() < 0.45 ? rounds : cones).push(tree);
        }
      }
    };
    place(2.4, 16, 2.3, 0.85); // the belt
    place(16, 110, 5.5, 0.45); // scattered over the fields and hills
    return {
      trunks,
      cones,
      rounds,
      geometry: {
        trunk: new CylinderGeometry(0.16, 0.22, 1.2, 6),
        cone: new ConeGeometry(1.1, 3, 7),
        round: new IcosahedronGeometry(1.25, 0),
      },
      materials: {
        trunk: new MeshStandardMaterial({ roughness: 1 }),
        leaves: new MeshStandardMaterial({ roughness: 0.9, flatShading: true }),
      },
    };
  }, [terrain]);

  useEffect(
    () => () => {
      Object.values(geometry).forEach((g) => g.dispose());
      Object.values(materials).forEach((m) => m.dispose());
    },
    [geometry, materials],
  );

  return (
    <>
      <Scatter geometry={geometry.trunk} material={materials.trunk} items={trunks} yOffset={0.6} castShadow />
      <Scatter geometry={geometry.cone} material={materials.leaves} items={cones} yOffset={2.7} castShadow />
      <Scatter geometry={geometry.round} material={materials.leaves} items={rounds} yOffset={2.2} castShadow />
    </>
  );
}

const ROCK_GREYS = ["#8d8a85", "#9c9890", "#7d7a76", "#a6a29a", "#85827c"];

/** Low-poly rocks over the fields: pebbles everywhere, some boulders, a few beside the paths. */
function Rocks({ terrain }: { terrain: Terrain }) {
  const { rocks, geometry, material } = useMemo(() => {
    const rng = createRng(404);
    const rocks: Placement[] = [];
    const reach = Math.max(terrain.halfX, terrain.halfZ) + 70;
    for (let i = 0; i < 6000 && rocks.length < 240; i++) {
      const x = rng.range(-reach, reach);
      const z = rng.range(-reach, reach);
      const d = terrain.outside(x, z);
      if (d < 2.6 || d > 70) continue;
      const toPath = terrain.path(x, z);
      if (toPath < PATH_HALF_WIDTH + 0.25) continue;
      // Boulders stay out of the camera's lawn; pebbles are fine there.
      const big = rng.next() < (d < 20 ? 0.3 : 0.15);
      if (big && inCameraClearance(terrain, x, z)) continue;
      // Denser along the footpaths' edges, sparse elsewhere.
      if (toPath > 2.2 && rng.next() < 0.5) continue;
      const s = big ? rng.range(1.1, 2.3) : rng.range(0.3, 0.8);
      rocks.push({
        x,
        y: terrain.height(x, z) - 0.1 * s,
        z,
        s,
        rot: rng.range(0, Math.PI * 2),
        color: rng.pick(ROCK_GREYS),
      });
    }
    const geometry = new DodecahedronGeometry(0.5, 0);
    geometry.scale(1.15, 0.6, 0.9);
    return { rocks, geometry, material: new MeshStandardMaterial({ roughness: 0.95, flatShading: true }) };
  }, [terrain]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <Scatter geometry={geometry} material={material} items={rocks} yOffset={0.2} castShadow />;
}

const TUFT_GREENS = ["#5d8f42", "#6f9f4c", "#7cab55", "#567f3c", "#8ab45e"];
const FLOWERS = ["#fff7e6", "#ffe066", "#ffb3c7", "#c9b6ff", "#ffffff"];

/** Clumps of tall grass and a sprinkle of flowers on the fields near town. */
function Undergrowth({ terrain }: { terrain: Terrain }) {
  const { tufts, flowers, geometry, material } = useMemo(() => {
    const rng = createRng(31);
    const tufts: Placement[] = [];
    const flowers: Placement[] = [];
    const reach = Math.max(terrain.halfX, terrain.halfZ) + 40;
    for (let i = 0; i < 30000 && tufts.length < 12000; i++) {
      const x = rng.range(-reach, reach);
      const z = rng.range(-reach, reach);
      const d = terrain.outside(x, z);
      if (d < 2.4 || d > 40) continue;
      // Thicker near town, where you can actually see them.
      if (rng.next() > 1.1 - d / 40) continue;
      if (terrain.path(x, z) < PATH_HALF_WIDTH + 0.1) continue;
      // Clumps: three blades around a point.
      const y = terrain.height(x, z);
      for (let k = 0; k < 3; k++) {
        tufts.push({
          x: x + rng.range(-0.18, 0.18),
          y,
          z: z + rng.range(-0.18, 0.18),
          s: rng.range(0.7, 1.4),
          rot: rng.range(0, Math.PI * 2),
          color: rng.pick(TUFT_GREENS),
        });
      }
      if (rng.next() < 0.08) {
        flowers.push({ x: x + 0.3, y, z: z - 0.2, s: rng.range(0.8, 1.2), rot: 0, color: rng.pick(FLOWERS) });
      }
    }
    return {
      tufts,
      flowers,
      geometry: { blade: new ConeGeometry(0.07, 0.42, 4), flower: new SphereGeometry(0.07, 6, 5) },
      material: new MeshStandardMaterial({ roughness: 1 }),
    };
  }, [terrain]);

  useEffect(
    () => () => {
      Object.values(geometry).forEach((g) => g.dispose());
      material.dispose();
    },
    [geometry, material],
  );

  return (
    <>
      <Scatter geometry={geometry.blade} material={material} items={tufts} yOffset={0.19} />
      <Scatter geometry={geometry.flower} material={material} items={flowers} yOffset={0.36} />
    </>
  );
}
