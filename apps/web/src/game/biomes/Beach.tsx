import { Sky } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Group,
  type Mesh,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Area } from "@unify/shared";
import { poses, useRoom } from "../store";
import { Scatter, type Placement } from "./Countryside";
import { FadeGroup, Fadeable } from "./fade";
import {
  CAMPFIRE,
  HUTS,
  LOGS,
  NET,
  PALMS,
  PARASOLS,
  PIER,
  SHACK,
  SHORE_GLSL,
  SURFBOARDS,
  TOWER,
  VISUAL_HALF,
  WALK_HALF,
  chairSpots,
  groundAt,
  inCameraClearance,
  pierDeckY,
  shoreZ,
  terrainAt,
} from "./beachMap";
import { NOISE_GLSL, fbm } from "./noise";
import { createRng } from "./random";
import { useDispose } from "./useDispose";

/**
 * The Beach biome: warm and social. A cove with moving water, a campfire where the group gathers,
 * parasols and beach chairs, huts, a snack shack and a pier to walk out on. Layout is in beachMap.
 *
 * `immersive` (a player standing in it) adds the sky, open sea, boats, gulls, dune grass and palm
 * groves over the headlands; the host's overview gets just the scenery square.
 */
export function Beach({ area, immersive = false }: { area: Area; immersive?: boolean }) {
  // Fade what stands between the camera and *your* character (players only; world space).
  const head = useMemo(() => new Vector3(), []);
  const fadeTarget = useMemo(
    () => () => {
      if (!immersive) return null;
      const id = useRoom.getState().selfId;
      const pose = id ? poses.get(id) : undefined;
      if (!pose) return null;
      return head.set(pose.x, groundAt(pose.x - area.cx, pose.z - area.cz) + 1.2, pose.z);
    },
    [immersive, head, area.cx, area.cz],
  );

  return (
    <group position={[area.cx, 0, area.cz]}>
      {immersive ? (
        <Sky distance={4500} sunPosition={[120, 45, 60]} turbidity={6} rayleigh={1.2} mieCoefficient={0.004} />
      ) : null}
      <Sand immersive={immersive} />
      <Sea immersive={immersive} />
      <Campfire />
      <Pier />
      <Parasols />
      <Boardwalk />
      <BeachProps immersive={immersive} />
      <Volleyball />
      <FadeGroup target={fadeTarget}>
        {HUTS.map((hut) => (
          <Fadeable key={hut.z}>
            <Hut {...hut} />
          </Fadeable>
        ))}
        <Fadeable>
          <SnackShack />
        </Fadeable>
        <Fadeable>
          <LifeguardTower />
        </Fadeable>
        <NearPalms />
      </FadeGroup>
      {immersive ? (
        <>
          <FarPalms />
          <DuneGrass />
          <Boat x={-14} z={-48} rot={0.7} sail="#ffffff" />
          <Boat x={21} z={-72} rot={-0.5} sail="#f4c95d" />
          <Boat x={-38} z={-105} rot={1.4} sail="#e8694f" />
          <Gulls />
        </>
      ) : null}
    </group>
  );
}

// ── Sand ─────────────────────────────────────────────────────────────────────

const SAND_COLORS = {
  sand: new Color("#efdcae"),
  warm: new Color("#e6c98f"),
  wet: new Color("#b89a6a"),
  bed: new Color("#7c8a6c"),
  dune: new Color("#a9b268"),
  green: new Color("#5f9a48"),
  rock: new Color("#8f8574"),
};

/**
 * The ground mesh. For players it reaches to the horizon, with vertices packed tightly around the
 * walkable area (so feet sit right on it). Waves wash up the sand, leaving it dark and wet.
 */
function Sand({ immersive }: { immersive: boolean }) {
  const time = useMemo(() => ({ value: 0 }), []);
  const geometry = useMemo(() => {
    const segments = immersive ? 300 : 150;
    const spread = immersive ? (u: number) => 45 * u + 255 * u ** 5 : (u: number) => VISUAL_HALF * u;
    const g = new PlaneGeometry(2, 2, segments, segments);
    g.rotateX(-Math.PI / 2);
    const pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const x = spread(pos.getX(i));
      const z = spread(pos.getZ(i));
      pos.setXYZ(i, x, terrainAt(x, z), z);
    }
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }, [immersive]);

  const material = useMemo(() => {
    const m = new MeshStandardMaterial({ roughness: 1 });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = time;
      for (const [name, color] of Object.entries(SAND_COLORS)) shader.uniforms[`u_${name}`] = { value: color };
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
          uniform float uTime;
          uniform vec3 u_sand; uniform vec3 u_warm; uniform vec3 u_wet; uniform vec3 u_bed;
          uniform vec3 u_dune; uniform vec3 u_green; uniform vec3 u_rock;
          ${NOISE_GLSL}
          ${SHORE_GLSL}`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          vec2 p = vGround.xz;
          float d = p.y - b_shoreZ(p.x);

          vec3 sand = mix(u_sand, u_warm, smoothstep(0.3, 0.7, cs_fbm(p * 0.12)));
          sand *= (0.94 + 0.1 * cs_fbm(p * 0.9)) * (0.95 + 0.1 * cs_noise(p * 9.0));
          // Ripples the tide left behind.
          sand *= 1.0 + 0.035 * sin(p.y * 3.0 + cs_noise(p * 0.8) * 5.0) * (1.0 - smoothstep(2.0, 10.0, d));

          // Dune grass, then green hills, then bare rock on steep headlands.
          float grow = smoothstep(12.0, 26.0, d + (cs_fbm(p * 0.2 + 4.0) - 0.5) * 14.0);
          vec3 plants = mix(u_dune, u_green, smoothstep(20.0, 45.0, d)) * (0.85 + 0.3 * cs_fbm(p * 0.7));
          vec3 ground = mix(sand, plants, grow);
          ground = mix(ground, u_rock * (0.8 + 0.35 * cs_fbm(p * 0.8)), smoothstep(0.3, 0.5, vSlope));

          // Waves wash up and back, leaving wet sand and a line of foam.
          float front = 0.7 + 0.55 * sin(uTime * 0.6 + p.x * 0.22) + 0.25 * sin(uTime * 0.37 - p.x * 0.5);
          ground = mix(ground, u_wet * (0.92 + 0.14 * cs_noise(p * 7.0)), (1.0 - smoothstep(front, front + 1.8, d)) * 0.85);
          float edge = cs_noise(vec2(p.x * 1.4, uTime * 0.25)) * 0.35;
          ground = mix(ground, vec3(0.98), (1.0 - smoothstep(0.0, 0.16, abs(d - front - edge))) * 0.85);

          // The seabed, seen through the water.
          ground = mix(ground, mix(u_wet, u_bed, smoothstep(0.0, 5.0, -d)), step(d, 0.0));
          diffuseColor.rgb = ground;`,
        );
    };
    return m;
  }, [time]);

  useFrame(({ clock }) => {
    time.value = clock.elapsedTime;
  });
  useDispose(geometry, material);
  return <mesh geometry={geometry} material={material} receiveShadow />;
}

// ── Sea ──────────────────────────────────────────────────────────────────────

/** Clear turquoise at the shore, deep blue further out, with rolling foam and moving ripples. */
function Sea({ immersive }: { immersive: boolean }) {
  const time = useMemo(() => ({ value: 0 }), []);
  // Open sea for players; for the host, just the part of the scenery square north of the sand.
  const geometry = useMemo(
    () =>
      immersive
        ? new PlaneGeometry(1800, 1800)
        : new PlaneGeometry(VISUAL_HALF * 2, VISUAL_HALF - 2).translate(0, (VISUAL_HALF + 2) / 2, 0),
    [immersive],
  );
  const material = useMemo(() => {
    const m = new MeshStandardMaterial({ roughness: 0.15, metalness: 0.05, transparent: true, depthWrite: false });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = time;
      shader.uniforms.uShallow = { value: new Color("#7fe3d4") };
      shader.uniforms.uMid = { value: new Color("#2fa8c9") };
      shader.uniforms.uDeep = { value: new Color("#1c6fa6") };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vSea;")
        // The plane is laid flat, so its local y runs along world -z.
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSea = vec2(position.x, -position.y);");
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          varying vec2 vSea;
          uniform float uTime; uniform vec3 uShallow; uniform vec3 uMid; uniform vec3 uDeep;
          ${NOISE_GLSL}
          ${SHORE_GLSL}`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float depth = b_shoreZ(vSea.x) - vSea.y;
          vec3 sea = mix(uShallow, uMid, smoothstep(0.0, 7.0, depth));
          sea = mix(sea, uDeep, smoothstep(7.0, 40.0, depth));
          sea *= 0.95 + 0.1 * cs_fbm(vSea * 0.15 + uTime * 0.03);
          // Lines of foam rolling toward the shore, and a soft white edge where they break.
          float roll = fract(depth * 0.35 + uTime * 0.12 + cs_noise(vSea * 0.25) * 0.6);
          float foam = smoothstep(0.95, 1.0, roll) * (1.0 - smoothstep(0.5, 6.0, depth));
          foam = max(foam, 1.0 - smoothstep(0.0, 0.4, depth));
          diffuseColor.rgb = mix(sea, vec3(1.0), foam * 0.8);
          diffuseColor.a = max(mix(0.5, 0.96, smoothstep(0.0, 5.0, depth)), foam * 0.85);`,
        )
        .replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>
          vec2 ripple = vec2(
            cos(vSea.x * 0.9 + uTime * 0.9) * 0.5 + cos((vSea.x + vSea.y) * 1.7 - uTime * 1.3) * 0.35,
            cos(vSea.y * 1.2 - uTime * 0.8) * 0.5 + cos((vSea.x - vSea.y) * 1.4 + uTime * 1.1) * 0.35) * 0.09;
          normal = normalize(normal + (viewMatrix * vec4(ripple.x, 0.0, ripple.y, 0.0)).xyz);`,
        );
    };
    return m;
  }, [time]);

  useFrame(({ clock }) => {
    time.value = clock.elapsedTime;
  });
  useDispose(geometry, material);
  return <mesh geometry={geometry} material={material} rotation-x={-Math.PI / 2} receiveShadow />;
}

// ── The campfire ─────────────────────────────────────────────────────────────

const STONE_RING = Array.from({ length: 11 }, (_, i) => {
  const angle = (i / 11) * Math.PI * 2;
  return { x: Math.cos(angle) * 0.85, z: Math.sin(angle) * 0.85, rot: angle * 2.3, s: 0.8 + (i % 3) * 0.14 };
});
const FLAMES = [
  { x: 0, z: 0, r: 0.34, h: 1.25, color: "#ff7a1a", speed: 9 },
  { x: 0.16, z: 0.1, r: 0.24, h: 0.9, color: "#ffa12e", speed: 12 },
  { x: -0.14, z: 0.08, r: 0.22, h: 0.78, color: "#ffc445", speed: 14 },
  { x: 0.02, z: -0.14, r: 0.18, h: 0.62, color: "#ffe27a", speed: 16 },
];

/** Where the group gathers: a stone ring, flickering flames, drifting smoke and log benches. */
function Campfire() {
  const y = groundAt(CAMPFIRE.x, CAMPFIRE.z);
  const flames = useRef<Array<Mesh | null>>([]);
  const smoke = useRef<Array<Mesh | null>>([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    flames.current.forEach((flame, i) => {
      if (!flame) return;
      const f = FLAMES[i]!;
      const flicker = 1 + Math.sin(t * f.speed + i * 2) * 0.12 + Math.sin(t * f.speed * 1.7 + i) * 0.08;
      flame.scale.set(1 + Math.sin(t * f.speed * 0.8 + i) * 0.08, flicker, 1 + Math.cos(t * f.speed * 0.8 + i) * 0.08);
      flame.position.y = 0.2 + (f.h * flicker) / 2;
    });
    smoke.current.forEach((puff, i) => {
      if (!puff) return;
      const life = (t * 0.22 + i / 5) % 1;
      puff.position.set(Math.sin(life * 7 + i) * 0.35 * life, 1.3 + life * 3.2, Math.cos(life * 5 + i) * 0.25 * life);
      puff.scale.setScalar(0.5 + life * 1.3);
      (puff.material as MeshStandardMaterial).opacity = 0.24 * (1 - life);
    });
  });

  return (
    <>
      <group position={[CAMPFIRE.x, y, CAMPFIRE.z]}>
        <mesh position={[0, 0.05, 0]} rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[0.8, 20]} />
          <meshStandardMaterial color="#3d3029" roughness={1} />
        </mesh>
        {STONE_RING.map((stone, i) => (
          <mesh key={i} position={[stone.x, 0.1, stone.z]} rotation-y={stone.rot} scale={[stone.s, stone.s * 0.75, stone.s]} castShadow>
            <dodecahedronGeometry args={[0.2, 0]} />
            <meshStandardMaterial color="#8d8a85" roughness={0.95} flatShading />
          </mesh>
        ))}
        {[0.5, 1.6, 2.7].map((rot) => (
          <mesh key={rot} position={[0, 0.18, 0]} rotation={[0, rot, Math.PI / 2 - 0.12]} castShadow>
            <cylinderGeometry args={[0.07, 0.09, 1.15, 7]} />
            <meshStandardMaterial color="#5d3f28" roughness={1} />
          </mesh>
        ))}
        {FLAMES.map((f, i) => (
          <mesh
            key={i}
            ref={(mesh) => {
              flames.current[i] = mesh;
            }}
            position={[f.x, 0.2 + f.h / 2, f.z]}
          >
            <coneGeometry args={[f.r, f.h, 7]} />
            <meshStandardMaterial color={f.color} emissive={f.color} emissiveIntensity={0.65} roughness={1} flatShading />
          </mesh>
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh
            key={i}
            ref={(mesh) => {
              smoke.current[i] = mesh;
            }}
          >
            <sphereGeometry args={[0.2, 7, 6]} />
            <meshStandardMaterial color="#cfcac2" transparent opacity={0.2} depthWrite={false} roughness={1} />
          </mesh>
        ))}
      </group>
      {LOGS.map((log, i) => (
        <mesh
          key={i}
          position={[log.x, groundAt(log.x, log.z) + 0.2, log.z]}
          rotation={[0, log.rot, Math.PI / 2]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[0.2, 0.23, 1.5, 9]} />
          <meshStandardMaterial color="#7a5637" roughness={1} />
        </mesh>
      ))}
    </>
  );
}

// ── Parasols and beach chairs ────────────────────────────────────────────────

/** A parasol's canopy is alternating wedges, so the same geometry makes every stripe color. */
function canopyWedges(offset: number) {
  const wedges = 6;
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < wedges; i++) {
    const width = Math.PI / wedges;
    parts.push(new ConeGeometry(1.35, 0.55, 3, 1, true, (i * Math.PI * 2) / wedges + offset * width, width));
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

/** A lounger facing north (out to sea): a frame with its backrest raised at the south end. */
function chairGeometry() {
  const seat = new BoxGeometry(0.6, 0.05, 0.9).translate(0, 0.24, -0.2);
  const back = new BoxGeometry(0.6, 0.05, 0.65).rotateX(0.65).translate(0, 0.42, 0.48);
  const legs = [
    [-0.26, -0.58],
    [0.26, -0.58],
    [-0.26, 0.22],
    [0.26, 0.22],
  ].map(([x, z]) => new BoxGeometry(0.05, 0.24, 0.05).translate(x!, 0.12, z!));
  const parts = [seat, back, ...legs];
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

const CHAIR_COLORS = ["#ffffff", "#f7e6c4", "#bfe3ea", "#f6c6c0"];

function Parasols() {
  const { canopies, stripes, poles, chairs, towels, geometry, materials } = useMemo(() => {
    const rng = createRng(88);
    const at = (x: number, z: number, y: number, color: string, rot = 0): Placement => ({ x, y, z, s: 1, rot, color });
    const canopies: Placement[] = [];
    const stripes: Placement[] = [];
    const poles: Placement[] = [];
    const chairs: Placement[] = [];
    const towels: Placement[] = [];
    for (const p of PARASOLS) {
      const y = groundAt(p.x, p.z);
      const rot = rng.range(0, Math.PI);
      canopies.push(at(p.x, p.z, y + 2.25, p.color, rot));
      stripes.push(at(p.x, p.z, y + 2.25, "#fff8ec", rot));
      poles.push(at(p.x, p.z, y, "#e9e2d4"));
      for (const chair of chairSpots(p)) {
        chairs.push(at(chair.x, chair.z, groundAt(chair.x, chair.z), rng.pick(CHAIR_COLORS), rng.range(-0.12, 0.12)));
      }
      // A towel laid out in the sun nearby.
      const tx = p.x + (p.x > 0 ? 2.1 : -2.1);
      const tz = p.z + rng.range(-0.4, 0.4);
      towels.push(at(tx, tz, groundAt(tx, tz) + 0.03, p.color, rng.range(-0.5, 0.5)));
    }
    return {
      canopies,
      stripes,
      poles,
      chairs,
      towels,
      geometry: {
        canopy: canopyWedges(0),
        stripe: canopyWedges(1),
        pole: new CylinderGeometry(0.035, 0.045, 2.5, 7).translate(0, 1.25, 0),
        chair: chairGeometry(),
        towel: new BoxGeometry(0.75, 0.02, 1.5),
      },
      materials: {
        cloth: new MeshStandardMaterial({ roughness: 0.85, side: DoubleSide }),
        solid: new MeshStandardMaterial({ roughness: 0.8 }),
      },
    };
  }, []);
  useDispose(...Object.values(geometry), ...Object.values(materials));

  return (
    <>
      <Scatter geometry={geometry.canopy} material={materials.cloth} items={canopies} castShadow />
      <Scatter geometry={geometry.stripe} material={materials.cloth} items={stripes} castShadow />
      <Scatter geometry={geometry.pole} material={materials.solid} items={poles} castShadow />
      <Scatter geometry={geometry.chair} material={materials.solid} items={chairs} castShadow />
      <Scatter geometry={geometry.towel} material={materials.cloth} items={towels} />
    </>
  );
}

// ── The pier and boardwalk ───────────────────────────────────────────────────

const WOOD = ["#a9825a", "#9c7650", "#b48c62", "#8f6c49"];

/** A plank deck on posts, with railings, that players can walk out on over the water. */
function Pier() {
  const { planks, posts, geometry, materials } = useMemo(() => {
    const rng = createRng(12);
    const planks: Placement[] = [];
    const posts: Placement[] = [];
    for (let z = PIER.startZ; z > PIER.endZ; z -= 0.42) {
      planks.push({ x: PIER.x, y: pierDeckY(z) - 0.03, z, s: 1, rot: rng.range(-0.012, 0.012), color: rng.pick(WOOD) });
    }
    for (let z = PIER.startZ - 1.5; z >= PIER.endZ; z -= 2.2) {
      for (const side of [-1, 1]) {
        const x = PIER.x + side * PIER.halfWidth;
        posts.push({ x, y: PIER.deckY - 0.45, z, s: 1, rot: 0, color: "#7a5a3d" });
      }
    }
    return {
      planks,
      posts,
      geometry: {
        plank: new BoxGeometry(PIER.halfWidth * 2 + 0.1, 0.07, 0.38),
        post: new CylinderGeometry(0.08, 0.1, 5, 7).translate(0, -1.2, 0),
      },
      materials: { wood: new MeshStandardMaterial({ roughness: 0.95 }) },
    };
  }, []);
  useDispose(geometry.plank, geometry.post, materials.wood);

  const railLength = PIER.startZ - 1.5 - PIER.endZ;
  const railZ = PIER.endZ + railLength / 2;
  return (
    <>
      <Scatter geometry={geometry.plank} material={materials.wood} items={planks} castShadow />
      <Scatter geometry={geometry.post} material={materials.wood} items={posts} yOffset={1.3} castShadow />
      {[-1, 1].map((side) => (
        <mesh key={side} position={[PIER.x + side * PIER.halfWidth, PIER.deckY + 0.72, railZ]} castShadow>
          <boxGeometry args={[0.07, 0.07, railLength]} />
          <meshStandardMaterial color="#8f6c49" roughness={0.95} />
        </mesh>
      ))}
    </>
  );
}

/** Planks along the front of the huts. */
function Boardwalk() {
  const { planks, geometry, material } = useMemo(() => {
    const rng = createRng(45);
    const planks: Placement[] = [];
    for (let z = -5.4; z < 12.6; z += 0.4) {
      const x = -10.7;
      planks.push({ x, y: groundAt(x, z) + 0.04, z, s: 1, rot: rng.range(-0.02, 0.02), color: rng.pick(WOOD) });
    }
    return {
      planks,
      geometry: new BoxGeometry(1.8, 0.06, 0.36),
      material: new MeshStandardMaterial({ roughness: 0.95 }),
    };
  }, []);
  useDispose(geometry, material);
  return <Scatter geometry={geometry} material={material} items={planks} />;
}

// ── Buildings ────────────────────────────────────────────────────────────────

/** A little painted beach hut with its door facing east, toward the sand. */
function Hut({ x, z, color }: { x: number; z: number; color: string }) {
  return (
    <group position={[x, groundAt(x, z) - 0.05, z]}>
      <mesh position={[0, 1.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 2.3, 2.7]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <mesh position={[0, 2.85, 0]} rotation-y={Math.PI / 4} scale={[1, 1, 1]} castShadow>
        <coneGeometry args={[2.25, 1.15, 4]} />
        <meshStandardMaterial color="#fff5e4" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[1.22, 0.85, 0]}>
        <boxGeometry args={[0.06, 1.7, 0.85]} />
        <meshStandardMaterial color="#fff8ec" roughness={0.8} />
      </mesh>
      <mesh position={[1.26, 1.6, 0]}>
        <boxGeometry args={[0.03, 0.42, 0.5]} />
        <meshStandardMaterial color="#35566b" roughness={0.3} />
      </mesh>
    </group>
  );
}

/** The snack shack, with a striped awning and stools at its counter. */
function SnackShack() {
  const stripes = [-1.6, -0.96, -0.32, 0.32, 0.96, 1.6];
  return (
    <group position={[SHACK.x, groundAt(SHACK.x, SHACK.z) - 0.05, SHACK.z]}>
      <mesh position={[0, 1.3, 0.2]} castShadow receiveShadow>
        <boxGeometry args={[3.8, 2.6, 2.6]} />
        <meshStandardMaterial color="#d9a066" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.75, 0.2]} castShadow>
        <boxGeometry args={[4.2, 0.26, 3]} />
        <meshStandardMaterial color="#7f5a3a" roughness={1} />
      </mesh>
      <mesh position={[0, 1.65, -1.12]}>
        <boxGeometry args={[3.2, 0.95, 0.06]} />
        <meshStandardMaterial color="#3a2a20" roughness={1} />
      </mesh>
      <mesh position={[0, 1.05, -1.3]} castShadow>
        <boxGeometry args={[3.6, 0.1, 0.42]} />
        <meshStandardMaterial color="#f7e6c4" roughness={0.8} />
      </mesh>
      {stripes.map((x, i) => (
        <mesh key={x} position={[x, 2.32, -1.55]} rotation-x={-0.42} castShadow>
          <boxGeometry args={[0.64, 0.05, 1.05]} />
          <meshStandardMaterial color={i % 2 ? "#fff8ec" : "#e8694f"} roughness={0.85} />
        </mesh>
      ))}
      {[-1.1, 0, 1.1].map((x) => (
        <group key={x} position={[x, 0, -1.95]}>
          <mesh position={[0, 0.36, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.05, 0.72, 7]} />
            <meshStandardMaterial color="#7f5a3a" roughness={1} />
          </mesh>
          <mesh position={[0, 0.74, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 0.07, 12]} />
            <meshStandardMaterial color="#3f9fc9" roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** A lifeguard's lookout on stilts, with a ladder and a red flag. */
function LifeguardTower() {
  const corners: Array<[number, number]> = [
    [-0.75, -0.75],
    [0.75, -0.75],
    [-0.75, 0.75],
    [0.75, 0.75],
  ];
  return (
    <group position={[TOWER.x, groundAt(TOWER.x, TOWER.z), TOWER.z]}>
      {corners.map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, 1, z]} castShadow>
          <boxGeometry args={[0.13, 2, 0.13]} />
          <meshStandardMaterial color="#f3ede0" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 2.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 0.12, 1.9]} />
        <meshStandardMaterial color="#c9a26f" roughness={0.95} />
      </mesh>
      <mesh position={[0, 2.75, 0.1]} castShadow>
        <boxGeometry args={[1.4, 1.3, 1.25]} />
        <meshStandardMaterial color="#e9594a" roughness={0.8} />
      </mesh>
      <mesh position={[0, 2.95, -0.53]}>
        <boxGeometry args={[1.05, 0.55, 0.03]} />
        <meshStandardMaterial color="#35566b" roughness={0.3} />
      </mesh>
      <mesh position={[0, 3.5, 0.1]} castShadow>
        <boxGeometry args={[1.9, 0.12, 1.8]} />
        <meshStandardMaterial color="#fff5e4" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1, 1.25]} rotation-x={0.42} castShadow>
        <boxGeometry args={[0.7, 2.3, 0.07]} />
        <meshStandardMaterial color="#f3ede0" roughness={0.9} />
      </mesh>
      <mesh position={[0.85, 4.05, 0.85]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 1.1, 6]} />
        <meshStandardMaterial color="#d9d3c7" />
      </mesh>
      <mesh position={[1.12, 4.4, 0.85]} castShadow>
        <boxGeometry args={[0.52, 0.32, 0.02]} />
        <meshStandardMaterial color="#e9594a" side={DoubleSide} />
      </mesh>
    </group>
  );
}

/** A net strung between two poles, with the court marked out by a rope in the sand. */
function Volleyball() {
  const width = NET.toX - NET.fromX;
  const midX = (NET.fromX + NET.toX) / 2;
  const y = groundAt(midX, NET.z);
  return (
    <group position={[midX, y, NET.z]}>
      {[-width / 2, width / 2].map((x) => (
        <mesh key={x} position={[x, 1.2, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 2.4, 8]} />
          <meshStandardMaterial color="#f3ede0" />
        </mesh>
      ))}
      <mesh position={[0, 1.85, 0]}>
        <planeGeometry args={[width, 0.8, 18, 3]} />
        <meshStandardMaterial color="#ffffff" wireframe transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 2.25, 0]}>
        <boxGeometry args={[width, 0.06, 0.02]} />
        <meshStandardMaterial color="#e8694f" />
      </mesh>
      {/* A ball, left waiting in the sand. */}
      <mesh position={[1.1, 0.2, 1.3]} castShadow>
        <sphereGeometry args={[0.2, 12, 10]} />
        <meshStandardMaterial color="#f7d84a" roughness={0.6} />
      </mesh>
    </group>
  );
}

// ── Small things in the sand ─────────────────────────────────────────────────

const SHELLS = ["#fff4e6", "#ffd9c7", "#f6c1b5", "#e8e0d0"];

/** Surfboards, a sandcastle, beach balls, shells and rocks in the water. */
function BeachProps({ immersive }: { immersive: boolean }) {
  const { boards, shells, rocks, towers, balls, geometry, materials } = useMemo(() => {
    const rng = createRng(731);
    const boards: Placement[] = SURFBOARDS.map((b) => ({ x: b.x, y: groundAt(b.x, b.z) + 0.8, z: b.z, s: 1, rot: b.rot, color: b.color }));
    const shells: Placement[] = [];
    for (let i = 0; i < 90; i++) {
      const x = rng.range(-WALK_HALF, WALK_HALF);
      const z = shoreZ(x) + rng.range(0.6, 7);
      shells.push({ x, y: terrainAt(x, z) + 0.02, z, s: rng.range(0.5, 1.2), rot: rng.range(0, 6), color: rng.pick(SHELLS) });
    }
    const rocks: Placement[] = [];
    for (let i = 0; i < 60; i++) {
      const x = rng.range(-46, 46);
      if (Math.abs(x - PIER.x) < 3) continue;
      const z = shoreZ(x) + rng.range(-5, 1.5);
      // Nothing on the sand or in the shallows where players walk: rocks aren't solid.
      if (Math.abs(x) < WALK_HALF + 1.5 && terrainAt(x, z) > -0.5) continue;
      // The host's overview ends at the scenery square; nothing may float past its edge.
      if (!immersive && Math.max(Math.abs(x), Math.abs(z)) > VISUAL_HALF - 1) continue;
      rocks.push({ x, y: terrainAt(x, z), z, s: rng.range(0.7, 2.3), rot: rng.range(0, 6), color: rng.pick(["#857f73", "#756f65", "#918a7c"]) });
    }
    const castle = { x: 1.2, z: -6.2 };
    const castleY = groundAt(castle.x, castle.z);
    const towers: Placement[] = [
      { x: castle.x, y: castleY, z: castle.z, s: 1.25, rot: 0, color: "#e6c98f" },
      { x: castle.x - 0.42, y: castleY, z: castle.z + 0.28, s: 0.85, rot: 0, color: "#e2c388" },
      { x: castle.x + 0.42, y: castleY, z: castle.z + 0.26, s: 0.9, rot: 0, color: "#e2c388" },
      { x: castle.x + 0.05, y: castleY, z: castle.z - 0.42, s: 0.8, rot: 0, color: "#e6c98f" },
    ];
    const balls: Placement[] = [
      { x: 6.4, y: groundAt(6.4, 1.2) + 0.24, z: 1.2, s: 1, rot: 0, color: "#e8694f" },
      { x: -3.4, y: groundAt(-3.4, 7.8) + 0.24, z: 7.8, s: 1, rot: 0, color: "#3f9fc9" },
    ];
    return {
      boards,
      shells,
      rocks,
      towers,
      balls,
      geometry: {
        board: new CapsuleGeometry(0.22, 1.4, 4, 12).scale(1, 1, 0.16),
        shell: new SphereGeometry(0.07, 6, 4).scale(1, 0.45, 0.8),
        rock: new DodecahedronGeometry(0.6, 0).scale(1.2, 0.72, 0.95),
        tower: new ConeGeometry(0.24, 0.48, 9).translate(0, 0.24, 0),
        ball: new SphereGeometry(0.24, 12, 10),
      },
      materials: {
        soft: new MeshStandardMaterial({ roughness: 0.75 }),
        rough: new MeshStandardMaterial({ roughness: 0.95, flatShading: true }),
      },
    };
  }, [immersive]);
  useDispose(...Object.values(geometry), ...Object.values(materials));

  return (
    <>
      <Scatter geometry={geometry.board} material={materials.soft} items={boards} castShadow />
      <Scatter geometry={geometry.shell} material={materials.soft} items={shells} />
      <Scatter geometry={geometry.rock} material={materials.rough} items={rocks} yOffset={0.18} castShadow />
      <Scatter geometry={geometry.tower} material={materials.rough} items={towers} castShadow />
      <Scatter geometry={geometry.ball} material={materials.soft} items={balls} castShadow />
    </>
  );
}

// ── Palms ────────────────────────────────────────────────────────────────────

const TRUNK = "#8b6b47";
const PALM_TOP = new Vector3(0.9, 4.2, 0);

/** A leaning, curved trunk with a couple of coconuts (the top is at PALM_TOP). */
function palmTrunk() {
  const parts: BufferGeometry[] = [];
  const point = (t: number) => new Vector3(PALM_TOP.x * t * t, PALM_TOP.y * t, 0);
  const segments = 6;
  for (let i = 0; i < segments; i++) {
    const a = point(i / segments);
    const b = point((i + 1) / segments);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const radius = (t: number) => 0.2 - 0.1 * t;
    parts.push(
      new CylinderGeometry(radius((i + 1) / segments), radius(i / segments), a.distanceTo(b) + 0.03, 7)
        .rotateZ(-Math.atan2(b.x - a.x, b.y - a.y))
        .translate(mid.x, mid.y, mid.z),
    );
  }
  for (const [x, z] of [[-0.14, 0.12], [0.12, -0.14], [0.14, 0.14]] as const) {
    parts.push(new SphereGeometry(0.12, 7, 6).translate(PALM_TOP.x + x, PALM_TOP.y - 0.12, z));
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

/** A crown of long, arching, tapered fronds. */
function palmFronds() {
  const parts: BufferGeometry[] = [];
  const count = 9;
  const length = 2.5;
  for (let k = 0; k < count; k++) {
    const frond = new PlaneGeometry(0.62, length, 1, 6);
    const pos = frond.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const along = pos.getY(i) / length + 0.5;
      const width = pos.getX(i) * (1 - along ** 1.6 * 0.88);
      pos.setXYZ(i, along * length, 0.75 * Math.sin(along * 1.7) - 1.25 * along * along, width);
    }
    frond.rotateY((k / count) * Math.PI * 2 + (k % 2) * 0.16);
    frond.translate(PALM_TOP.x, PALM_TOP.y, 0);
    frond.computeVertexNormals();
    parts.push(frond);
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

function usePalmParts() {
  const parts = useMemo(() => ({ trunk: palmTrunk(), fronds: palmFronds() }), []);
  useDispose(parts.trunk, parts.fronds);
  return parts;
}

/** Palms within reach, one by one, so they can fade when they hide you. */
function NearPalms() {
  const parts = usePalmParts();
  return (
    <>
      {PALMS.map((palm, i) => (
        <Fadeable key={i}>
          <group position={[palm.x, groundAt(palm.x, palm.z) - 0.05, palm.z]} rotation-y={palm.rot} scale={palm.scale}>
            <mesh geometry={parts.trunk} castShadow>
              <meshStandardMaterial color={TRUNK} roughness={1} />
            </mesh>
            <mesh geometry={parts.fronds} castShadow>
              <meshStandardMaterial color={palm.leaves} roughness={0.9} side={DoubleSide} flatShading />
            </mesh>
          </group>
        </Fadeable>
      ))}
    </>
  );
}

const FAR_LEAVES = ["#4f9a3f", "#5fa945", "#458f3a", "#3d8236", "#6db34e"];

/** Palm groves over the dunes and headlands, out to the horizon. */
function FarPalms() {
  const parts = usePalmParts();
  const { trunks, fronds, materials } = useMemo(() => {
    const rng = createRng(2718);
    const trunks: Placement[] = [];
    const fronds: Placement[] = [];
    const step = 5;
    const reach = 150;
    for (let gx = -reach; gx <= reach; gx += step) {
      for (let gz = -reach; gz <= reach; gz += step) {
        const x = gx + rng.range(-2.2, 2.2);
        const z = gz + rng.range(-2.2, 2.2);
        if (z - shoreZ(x) < 5 || Math.max(Math.abs(x), Math.abs(z)) < WALK_HALF + 2.5) continue;
        if (inCameraClearance(x, z)) continue;
        if (rng.next() > (fbm(x * 0.04 + 8, z * 0.04) > 0.48 ? 0.7 : 0.14)) continue;
        const place = { x, y: terrainAt(x, z) - 0.05, z, s: rng.range(0.9, 1.6), rot: rng.range(0, Math.PI * 2) };
        trunks.push({ ...place, color: TRUNK });
        fronds.push({ ...place, color: rng.pick(FAR_LEAVES) });
      }
    }
    return {
      trunks,
      fronds,
      materials: {
        trunk: new MeshStandardMaterial({ roughness: 1 }),
        fronds: new MeshStandardMaterial({ roughness: 0.9, side: DoubleSide, flatShading: true }),
      },
    };
  }, []);
  useDispose(materials.trunk, materials.fronds);

  return (
    <>
      <Scatter geometry={parts.trunk} material={materials.trunk} items={trunks} castShadow />
      <Scatter geometry={parts.fronds} material={materials.fronds} items={fronds} castShadow />
    </>
  );
}

const GRASS = ["#a3ad5e", "#8f9d52", "#b5b86c", "#7f9149"];

/** Tufts of beach grass, thickening over the dunes behind the sand. */
function DuneGrass() {
  const { tufts, geometry, material } = useMemo(() => {
    const rng = createRng(1999);
    const tufts: Placement[] = [];
    const reach = WALK_HALF + 25;
    for (let i = 0; i < 30000 && tufts.length < 9000; i++) {
      const x = rng.range(-reach, reach);
      const z = rng.range(-reach, reach);
      const d = z - shoreZ(x);
      if (d < 7 || rng.next() > (d - 7) / 14) continue;
      const y = terrainAt(x, z);
      for (let k = 0; k < 3; k++) {
        tufts.push({
          x: x + rng.range(-0.2, 0.2),
          y,
          z: z + rng.range(-0.2, 0.2),
          s: rng.range(0.7, 1.5),
          rot: rng.range(0, Math.PI * 2),
          color: rng.pick(GRASS),
        });
      }
    }
    return {
      tufts,
      geometry: new ConeGeometry(0.06, 0.5, 4),
      material: new MeshStandardMaterial({ roughness: 1 }),
    };
  }, []);
  useDispose(geometry, material);
  return <Scatter geometry={geometry} material={material} items={tufts} yOffset={0.23} />;
}

// ── Out at sea ───────────────────────────────────────────────────────────────

/** A little sailboat, rocking on the swell. */
function Boat({ x, z, rot, sail }: { x: number; z: number; rot: number; sail: string }) {
  const boat = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!boat.current) return;
    const t = clock.elapsedTime + x;
    boat.current.position.y = Math.sin(t * 0.9) * 0.12;
    boat.current.rotation.z = Math.sin(t * 0.7) * 0.05;
    boat.current.rotation.x = Math.cos(t * 0.8) * 0.04;
  });
  return (
    <group position={[x, 0, z]} rotation-y={rot}>
      <group ref={boat} scale={1.6}>
        <mesh position={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[1, 0.55, 3]} />
          <meshStandardMaterial color="#fff8ec" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.2, -1.75]} rotation-x={Math.PI / 2} scale={[0.72, 0.8, 0.39]}>
          <coneGeometry args={[0.7, 1, 4]} />
          <meshStandardMaterial color="#fff8ec" roughness={0.6} flatShading />
        </mesh>
        <mesh position={[0, 2.3, 0.1]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 3.8, 6]} />
          <meshStandardMaterial color="#7a5a3d" />
        </mesh>
        <mesh position={[0, 2.25, 0.75]} rotation-y={Math.PI / 2} scale={[0.04, 1, 1]} castShadow>
          <coneGeometry args={[0.72, 3.2, 3]} />
          <meshStandardMaterial color={sail} roughness={0.8} side={DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

/** A few gulls wheeling over the water. */
function Gulls() {
  const gulls = useRef<Array<Group | null>>([]);
  const wings = useRef<Array<Group | null>>([]);
  const flock = useMemo(
    () => Array.from({ length: 6 }, (_, i) => ({ radius: 9 + i * 2.6, height: 8 + (i % 3) * 1.5, speed: 0.22 - i * 0.015, phase: i * 1.3 })),
    [],
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    flock.forEach((gull, i) => {
      const body = gulls.current[i];
      if (!body) return;
      const angle = t * gull.speed + gull.phase;
      body.position.set(3 + Math.cos(angle) * gull.radius, gull.height + Math.sin(angle * 2) * 0.5, -19 + Math.sin(angle) * gull.radius * 0.6);
      body.rotation.y = -angle;
      wings.current[i * 2]!.rotation.z = 0.15 + Math.sin(t * 5 + i) * 0.4;
      wings.current[i * 2 + 1]!.rotation.z = -0.15 - Math.sin(t * 5 + i) * 0.4;
    });
  });
  return (
    <>
      {flock.map((_, i) => (
        <group
          key={i}
          ref={(g) => {
            gulls.current[i] = g;
          }}
        >
          <mesh rotation-x={Math.PI / 2}>
            <capsuleGeometry args={[0.07, 0.32, 3, 6]} />
            <meshStandardMaterial color="#f7f7f2" />
          </mesh>
          {[-1, 1].map((side, w) => (
            <group
              key={side}
              ref={(g) => {
                wings.current[i * 2 + w] = g;
              }}
            >
              <mesh position={[side * 0.34, 0, 0]}>
                <boxGeometry args={[0.66, 0.015, 0.2]} />
                <meshStandardMaterial color="#e6e6e0" />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </>
  );
}
