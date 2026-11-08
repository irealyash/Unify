import { Sky } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
  type Material,
} from "three";
import type { Area } from "@unify/shared";
import { poses, useRoom } from "../store";
import { Scatter, type Placement } from "./Countryside";
import { FadeGroup, Fadeable } from "./fade";
import {
  BUSHES,
  LAKE,
  LILY_PADS,
  OAK_LEAVES,
  PINE_LEAVES,
  REEDS,
  STONES,
  TRAIL_HALF_WIDTH,
  TRAIL_SEGMENTS,
  TREES,
  VISUAL_HALF,
  WALK_HALF,
  WATER_Y,
  heightAt,
  inCameraClearance,
  inWater,
  trailDistance,
  type Tree,
} from "./highlandsMap";
import { NOISE_GLSL, fbm } from "./noise";
import { createRng } from "./random";
import { useDispose } from "./useDispose";

/**
 * The Highlands biome: grassy hills with a lone tree on the summit, groves of oaks and pines,
 * shrubs, and a small lake at the bottom with reeds and lily pads. Layout lives in highlandsMap.
 *
 * `immersive` (a player standing in it) adds the sky, grass, and the wooded hills that roll
 * on to the horizon; the host's overview gets just the scenery square.
 */
export function Highlands({ area, immersive = false }: { area: Area; immersive?: boolean }) {
  // Fade trees between the camera and *your* character (players only; world space).
  const head = useMemo(() => new Vector3(), []);
  const fadeTarget = useMemo(
    () => () => {
      if (!immersive) return null;
      const id = useRoom.getState().selfId;
      const pose = id ? poses.get(id) : undefined;
      if (!pose) return null;
      return head.set(pose.x, heightAt(pose.x - area.cx, pose.z - area.cz) + 1.2, pose.z);
    },
    [immersive, head, area.cx, area.cz],
  );

  return (
    <group position={[area.cx, 0, area.cz]}>
      {immersive ? (
        <Sky distance={4500} sunPosition={[120, 70, 60]} turbidity={5} rayleigh={1.4} mieCoefficient={0.004} />
      ) : null}
      <Terrain immersive={immersive} />
      <Lake />
      <FadeGroup target={fadeTarget}>
        <NearTrees />
      </FadeGroup>
      <Forest immersive={immersive} />
      <Shrubs />
      <Stones />
      <Shore />
      {immersive ? <Meadow /> : null}
    </group>
  );
}

// ── Terrain ──────────────────────────────────────────────────────────────────

const GROUND_COLORS = {
  grassDark: new Color("#4f8a3a"),
  grassLight: new Color("#86b85a"),
  dry: new Color("#aeb062"),
  earth: new Color("#8f7656"),
  trail: new Color("#b09670"),
  sand: new Color("#d4c39a"),
  lakebed: new Color("#5d6a4a"),
};

const TRAILS_GLSL = /* glsl */ `
  float hl_segment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a; vec2 ba = b - a;
    return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
  }
  float hl_trailDistance(vec2 p) {
    float d = 1e4;
    ${TRAIL_SEGMENTS.map(
      ([ax, az, bx, bz]) =>
        `d = min(d, hl_segment(p, vec2(${ax.toFixed(2)}, ${az.toFixed(2)}), vec2(${bx.toFixed(2)}, ${bz.toFixed(2)})));`,
    ).join("\n    ")}
    return d;
  }
`;

/**
 * The ground mesh. For players it reaches to the horizon, with vertices packed tightly around
 * the walkable area (so feet sit right on it) and spread out toward the edges.
 */
function Terrain({ immersive }: { immersive: boolean }) {
  const geometry = useMemo(() => {
    const segments = immersive ? 300 : 150;
    // Maps -1..1 to world units: ~0.3 apart in the middle, growing to ~300 units out.
    const spread = immersive ? (u: number) => 45 * u + 255 * u ** 5 : (u: number) => VISUAL_HALF * u;
    const g = new PlaneGeometry(2, 2, segments, segments);
    g.rotateX(-Math.PI / 2);
    const pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const x = spread(pos.getX(i));
      const z = spread(pos.getZ(i));
      pos.setXYZ(i, x, heightAt(x, z), z);
    }
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }, [immersive]);

  const material = useMemo(() => {
    const m = new MeshStandardMaterial({ roughness: 1 });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uWater = { value: WATER_Y };
      shader.uniforms.uLake = { value: [LAKE.x, LAKE.z, LAKE.radius] };
      for (const [name, color] of Object.entries(GROUND_COLORS)) shader.uniforms[`u_${name}`] = { value: color };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vGround;\nvarying float vSlope;")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvGround = position;\nvSlope = 1.0 - normalize(normal).y;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          varying vec3 vGround;
          varying float vSlope;
          uniform float uWater; uniform vec3 uLake;
          uniform vec3 u_grassDark; uniform vec3 u_grassLight; uniform vec3 u_dry;
          uniform vec3 u_earth; uniform vec3 u_trail; uniform vec3 u_sand; uniform vec3 u_lakebed;
          ${NOISE_GLSL}
          ${TRAILS_GLSL}`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          vec2 p = vGround.xz;
          float h = vGround.y;

          vec3 grass = mix(u_grassDark, u_grassLight, smoothstep(0.25, 0.75, cs_fbm(p * 0.05)));
          grass = mix(grass, u_dry, smoothstep(0.6, 0.8, cs_fbm(p * 0.08 + 7.0)) * 0.45);
          grass *= 0.9 + 0.2 * cs_fbm(p * 0.7 + 13.0);
          grass *= 0.9 + 0.2 * cs_noise(p * 7.0 + 3.0);
          // Sunny hilltops a little lighter.
          grass = mix(grass, u_grassLight * 1.04, clamp((h - 2.5) * 0.07, 0.0, 0.3));
          // Steep banks show bare earth.
          vec3 earth = u_earth * (0.85 + 0.3 * cs_fbm(p * 1.3 + 5.0));
          vec3 ground = mix(grass, earth, smoothstep(0.32, 0.55, vSlope + (cs_noise(p * 2.0) - 0.5) * 0.15));

          // The lake: a sandy strip at the waterline and a darker bed under the water.
          float nearLake = 1.0 - smoothstep(uLake.z * 1.5, uLake.z * 2.0, length(p - uLake.xy));
          float above = h - uWater;
          vec3 sand = u_sand * (0.9 + 0.15 * cs_noise(p * 6.0));
          vec3 bed = mix(u_sand * 0.85, u_lakebed, smoothstep(0.05, 0.8, -above));
          ground = mix(ground, sand, nearLake * (1.0 - smoothstep(0.1, 0.32 + cs_noise(p * 1.5) * 0.15, above)));
          ground = mix(ground, bed, nearLake * (1.0 - smoothstep(-0.06, 0.04, above)));

          // Dirt trails with soft, ragged edges.
          float td = hl_trailDistance(p) + (cs_noise(p * 1.8) - 0.5) * 0.3;
          float onTrail = 1.0 - smoothstep(${(TRAIL_HALF_WIDTH * 0.55).toFixed(3)}, ${TRAIL_HALF_WIDTH.toFixed(3)}, td);
          vec3 trail = u_trail * (0.85 + 0.25 * cs_fbm(p * 2.2 + 41.0)) * (0.93 + 0.14 * cs_noise(p * 10.0));
          ground = mix(ground, trail, onTrail * smoothstep(0.0, 0.15, above));
          diffuseColor.rgb = ground;`,
        );
    };
    return m;
  }, []);

  useDispose(geometry, material);
  return <mesh geometry={geometry} material={material} receiveShadow />;
}

// ── Lake ─────────────────────────────────────────────────────────────────────

/** Clear water: deep blue in the middle, see-through at the edges, with moving ripples. */
function Lake() {
  const time = useMemo(() => ({ value: 0 }), []);
  const material = useMemo(() => {
    const m = new MeshStandardMaterial({ roughness: 0.12, metalness: 0.05, transparent: true });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = time;
      shader.uniforms.uRadius = { value: LAKE.radius };
      shader.uniforms.uDeep = { value: new Color("#2e6f96") };
      shader.uniforms.uShallow = { value: new Color("#6fb6cf") };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWorld;\nvarying vec2 vLocal;")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvLocal = position.xy;\nvWorld = (modelMatrix * vec4(position, 1.0)).xyz;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          varying vec3 vWorld; varying vec2 vLocal;
          uniform float uTime; uniform float uRadius; uniform vec3 uDeep; uniform vec3 uShallow;`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float r = length(vLocal) / uRadius;
          diffuseColor.rgb = mix(uDeep, uShallow, smoothstep(0.15, 1.05, r));
          diffuseColor.a = mix(0.92, 0.5, smoothstep(0.45, 1.1, r));`,
        )
        .replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>
          vec2 wp = vWorld.xz;
          vec2 ripple = vec2(
            cos(wp.x * 1.6 + uTime * 1.2) * 0.5 + cos((wp.x + wp.y) * 2.7 - uTime * 1.7) * 0.35,
            cos(wp.y * 1.9 - uTime * 1.0) * 0.5 + cos((wp.x - wp.y) * 2.3 + uTime * 1.4) * 0.35) * 0.08;
          normal = normalize(normal + (viewMatrix * vec4(ripple.x, 0.0, ripple.y, 0.0)).xyz);`,
        );
    };
    return m;
  }, [time]);

  useFrame(({ clock }) => {
    time.value = clock.elapsedTime;
  });
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh position={[LAKE.x, WATER_Y, LAKE.z]} rotation-x={-Math.PI / 2} material={material} receiveShadow>
      <circleGeometry args={[LAKE.radius * 1.9, 72]} />
    </mesh>
  );
}

// ── Trees ────────────────────────────────────────────────────────────────────

const TRUNK = "#6b4a2f";

/** Shared tree parts. Oaks are a trunk with a few leafy blobs; pines are stacked cones. */
function useTreeParts() {
  const parts = useMemo(
    () => ({
      oakTrunk: new CylinderGeometry(0.16, 0.26, 1.8, 7).translate(0, 0.9, 0),
      pineTrunk: new CylinderGeometry(0.13, 0.2, 1.1, 6).translate(0, 0.55, 0),
      blob: new IcosahedronGeometry(1, 0),
      cone: new ConeGeometry(1, 1, 7),
    }),
    [],
  );
  useEffect(() => () => Object.values(parts).forEach((g) => g.dispose()), [parts]);
  return parts;
}

/** Where each leafy piece of a tree goes: [x, y, z, scaleX, scaleY] in tree units. */
const OAK_CROWN: Array<[number, number, number, number, number]> = [
  [0, 2.5, 0, 1.25, 1.05],
  [0.65, 2.2, 0.25, 0.85, 0.8],
  [-0.55, 2.25, -0.3, 0.9, 0.8],
  [0.1, 3.15, -0.1, 0.8, 0.75],
];
const PINE_CROWN: Array<[number, number, number, number, number]> = [
  [0, 1.9, 0, 1.15, 2.0],
  [0, 2.9, 0, 0.85, 1.7],
  [0, 3.75, 0, 0.5, 1.2],
];

/** Trees inside the walkable area, one by one, so they can fade when they hide you. */
function NearTrees() {
  const parts = useTreeParts();
  const near = useMemo(
    () => TREES.filter((t) => Math.max(Math.abs(t.x), Math.abs(t.z)) < WALK_HALF + 2.5),
    [],
  );
  // One material per color; Fadeable clones them per tree.
  const materials = useMemo(() => {
    const map = new Map<string, Material>();
    for (const color of [TRUNK, ...OAK_LEAVES, ...PINE_LEAVES]) {
      map.set(color, new MeshStandardMaterial({ color, roughness: 0.9, flatShading: color !== TRUNK }));
    }
    return map;
  }, []);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  return (
    <>
      {near.map((tree, i) => (
        <Fadeable key={i}>
          <TreeMeshes tree={tree} parts={parts} materials={materials} />
        </Fadeable>
      ))}
    </>
  );
}

function TreeMeshes({
  tree,
  parts,
  materials,
}: {
  tree: Tree;
  parts: ReturnType<typeof useTreeParts>;
  materials: Map<string, Material>;
}) {
  const oak = tree.kind === "oak";
  const crown = oak ? OAK_CROWN : PINE_CROWN;
  return (
    <group position={[tree.x, tree.y, tree.z]} rotation-y={tree.rot} scale={tree.scale}>
      <mesh geometry={oak ? parts.oakTrunk : parts.pineTrunk} material={materials.get(TRUNK)} castShadow />
      {crown.map(([x, y, z, s, sy], i) => (
        <mesh
          key={i}
          geometry={oak ? parts.blob : parts.cone}
          material={materials.get(tree.leaves)}
          position={[x, y, z]}
          scale={[s, sy, s]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

/**
 * Every other tree, instanced: the rest of the scenery square, and for players, woods rolling
 * over the hills to the horizon.
 */
function Forest({ immersive }: { immersive: boolean }) {
  const { trunks, oaks, pines, geometry, materials } = useMemo(() => {
    const trees: Tree[] = TREES.filter((t) => Math.max(Math.abs(t.x), Math.abs(t.z)) >= WALK_HALF + 2.5);
    if (immersive) {
      const rng = createRng(31337);
      const step = 4.2;
      const reach = VISUAL_HALF + 110;
      for (let gx = -reach; gx <= reach; gx += step) {
        for (let gz = -reach; gz <= reach; gz += step) {
          if (Math.max(Math.abs(gx), Math.abs(gz)) < VISUAL_HALF + 1) continue;
          const x = gx + rng.range(-1.8, 1.8);
          const z = gz + rng.range(-1.8, 1.8);
          const grove = fbm(x * 0.03 + 8, z * 0.03);
          if (rng.next() > (grove > 0.5 ? 0.85 : 0.25)) continue;
          if (inCameraClearance(x, z) || trailDistance(x, z) < 1.6) continue;
          const pine = rng.next() < 0.55;
          trees.push({
            x,
            y: heightAt(x, z),
            z,
            kind: pine ? "pine" : "oak",
            scale: rng.range(0.9, 1.6),
            rot: rng.range(0, Math.PI * 2),
            leaves: rng.pick(pine ? PINE_LEAVES : OAK_LEAVES),
          });
        }
      }
    }
    const at = (t: Tree, color: string): Placement => ({ x: t.x, y: t.y, z: t.z, s: t.scale, rot: t.rot, color });
    return {
      trunks: trees.map((t) => at(t, TRUNK)),
      oaks: trees.filter((t) => t.kind === "oak").map((t) => at(t, t.leaves)),
      pines: trees.filter((t) => t.kind === "pine").map((t) => at(t, t.leaves)),
      geometry: {
        trunk: new CylinderGeometry(0.16, 0.24, 1.6, 6),
        oak: new IcosahedronGeometry(1.35, 0).scale(1, 0.95, 1),
        pine: new ConeGeometry(1.15, 3.4, 7),
      },
      materials: {
        trunk: new MeshStandardMaterial({ roughness: 1 }),
        leaves: new MeshStandardMaterial({ roughness: 0.9, flatShading: true }),
      },
    };
  }, [immersive]);
  useDispose(...Object.values(geometry), ...Object.values(materials));

  return (
    <>
      <Scatter geometry={geometry.trunk} material={materials.trunk} items={trunks} yOffset={0.8} castShadow />
      <Scatter geometry={geometry.oak} material={materials.leaves} items={oaks} yOffset={2.5} castShadow />
      <Scatter geometry={geometry.pine} material={materials.leaves} items={pines} yOffset={2.6} castShadow />
    </>
  );
}

// ── Shrubs, stones, shore ────────────────────────────────────────────────────

/** Each shrub is a few squashed leafy balls; flowering ones get dots of color on top. */
function Shrubs() {
  const { leaves, flowers, geometry, materials } = useMemo(() => {
    const rng = createRng(606);
    const leaves: Placement[] = [];
    const flowers: Placement[] = [];
    for (const b of BUSHES) {
      const balls = 2 + Math.floor(rng.next() * 3);
      for (let k = 0; k < balls; k++) {
        const a = rng.range(0, Math.PI * 2);
        const r = k === 0 ? 0 : rng.range(0.25, 0.45) * b.scale;
        const x = b.x + Math.cos(a) * r;
        const z = b.z + Math.sin(a) * r;
        const s = b.scale * (k === 0 ? 1 : rng.range(0.6, 0.85));
        leaves.push({ x, y: heightAt(x, z), z, s, rot: rng.range(0, Math.PI * 2), color: b.color });
        if (!b.flowers) continue;
        for (let f = 0; f < 4; f++) {
          // Dots over the top half of the ball (radius 0.5 × s, squashed to 0.75 high).
          const fa = rng.range(0, Math.PI * 2);
          const up = rng.range(0.35, 1);
          const out = Math.sqrt(1 - up * up) * 0.5 * s;
          flowers.push({
            x: x + Math.cos(fa) * out,
            y: heightAt(x, z) + 0.33 * s + up * 0.38 * s,
            z: z + Math.sin(fa) * out,
            s: 1,
            rot: 0,
            color: b.flowers,
          });
        }
      }
    }
    return {
      leaves,
      flowers,
      geometry: { ball: new IcosahedronGeometry(0.5, 1).scale(1, 0.75, 1), flower: new SphereGeometry(0.06, 6, 5) },
      materials: {
        leaves: new MeshStandardMaterial({ roughness: 0.95, flatShading: true }),
        flower: new MeshStandardMaterial({ roughness: 0.7 }),
      },
    };
  }, []);
  useDispose(...Object.values(geometry), ...Object.values(materials));

  return (
    <>
      <Scatter geometry={geometry.ball} material={materials.leaves} items={leaves} yOffset={0.3} castShadow />
      <Scatter geometry={geometry.flower} material={materials.flower} items={flowers} />
    </>
  );
}

function Stones() {
  const { boulders, pebbles, geometry, material } = useMemo(() => {
    const at = (s: (typeof STONES.boulders)[number]): Placement => ({ ...s, s: s.scale });
    return {
      boulders: STONES.boulders.map(at),
      pebbles: STONES.pebbles.map(at),
      geometry: new DodecahedronGeometry(0.5, 0).scale(1.15, 0.65, 0.9),
      material: new MeshStandardMaterial({ roughness: 0.95, flatShading: true }),
    };
  }, []);
  useDispose(geometry, material);
  return (
    <>
      <Scatter geometry={geometry} material={material} items={boulders} yOffset={0.22} castShadow />
      <Scatter geometry={geometry} material={material} items={pebbles} yOffset={0.22} />
    </>
  );
}

const REED_GREENS = ["#5f8a3a", "#6d9842", "#4f7a33", "#7a9f4a"];

/** Reeds and cattails along the shore, lily pads (some flowering) on the water. */
function Shore() {
  const { reeds, heads, pads, lilies, geometry, materials } = useMemo(() => {
    const reeds: Placement[] = [];
    const heads: Placement[] = [];
    for (const clump of REEDS) {
      const rng = createRng(clump.seed + 1);
      for (let k = 0; k < clump.count; k++) {
        const x = clump.x + rng.range(-0.3, 0.3);
        const z = clump.z + rng.range(-0.3, 0.3);
        const s = rng.range(0.75, 1.3);
        reeds.push({ x, y: clump.y, z, s, rot: rng.range(0, Math.PI * 2), color: rng.pick(REED_GREENS) });
        if (rng.next() < 0.35) heads.push({ x, y: clump.y + 1.05 * s, z, s: 1, rot: 0, color: "#6b4a2b" });
      }
    }
    const pads: Placement[] = [];
    const lilies: Placement[] = [];
    for (const p of LILY_PADS) {
      pads.push({ x: p.x, y: WATER_Y + 0.012, z: p.z, s: p.scale, rot: p.rot, color: "#4f8f3a" });
      if (p.flower) lilies.push({ x: p.x + 0.05, y: WATER_Y + 0.06, z: p.z, s: p.scale, rot: p.rot, color: "#ffc2d6" });
    }
    return {
      reeds,
      heads,
      pads,
      lilies,
      geometry: {
        reed: new ConeGeometry(0.035, 1.2, 4),
        head: new CylinderGeometry(0.05, 0.05, 0.24, 6),
        // A pad with a notch cut out, like a real lily pad.
        pad: new CylinderGeometry(0.32, 0.32, 0.02, 14, 1, false, 0.35, Math.PI * 2 - 0.35),
        lily: new ConeGeometry(0.09, 0.1, 6),
      },
      materials: {
        plant: new MeshStandardMaterial({ roughness: 0.9 }),
        pad: new MeshStandardMaterial({ roughness: 0.55 }),
      },
    };
  }, []);
  useDispose(...Object.values(geometry), ...Object.values(materials));

  return (
    <>
      <Scatter geometry={geometry.reed} material={materials.plant} items={reeds} yOffset={0.6} castShadow />
      <Scatter geometry={geometry.head} material={materials.plant} items={heads} />
      <Scatter geometry={geometry.pad} material={materials.pad} items={pads} />
      <Scatter geometry={geometry.lily} material={materials.plant} items={lilies} />
    </>
  );
}

const TUFT_GREENS = ["#5d8f42", "#6f9f4c", "#7cab55", "#567f3c", "#8ab45e"];
const WILDFLOWERS = ["#fff7e6", "#ffe066", "#ffb3c7", "#c9b6ff", "#ffffff", "#ff9f80"];

/** Tall grass and wildflowers over the meadow and slopes (players only). */
function Meadow() {
  const { tufts, flowers, geometry, material } = useMemo(() => {
    const rng = createRng(1234);
    const tufts: Placement[] = [];
    const flowers: Placement[] = [];
    const reach = WALK_HALF + 14;
    for (let i = 0; i < 40000 && tufts.length < 15000; i++) {
      const x = rng.range(-reach, reach);
      const z = rng.range(-reach, reach);
      if (inWater(x, z) || heightAt(x, z) < WATER_Y + 0.3) continue;
      if (trailDistance(x, z) < TRAIL_HALF_WIDTH + 0.05) continue;
      const y = heightAt(x, z);
      for (let k = 0; k < 3; k++) {
        tufts.push({
          x: x + rng.range(-0.18, 0.18),
          y,
          z: z + rng.range(-0.18, 0.18),
          s: rng.range(0.7, 1.5),
          rot: rng.range(0, Math.PI * 2),
          color: rng.pick(TUFT_GREENS),
        });
      }
      if (rng.next() < 0.1) {
        flowers.push({ x: x + 0.3, y, z: z - 0.2, s: rng.range(0.8, 1.2), rot: 0, color: rng.pick(WILDFLOWERS) });
      }
    }
    return {
      tufts,
      flowers,
      geometry: { blade: new ConeGeometry(0.07, 0.42, 4), flower: new SphereGeometry(0.07, 6, 5) },
      material: new MeshStandardMaterial({ roughness: 1 }),
    };
  }, []);
  useDispose(geometry.blade, geometry.flower, material);

  return (
    <>
      <Scatter geometry={geometry.blade} material={material} items={tufts} yOffset={0.19} />
      <Scatter geometry={geometry.flower} material={material} items={flowers} yOffset={0.36} />
    </>
  );
}
