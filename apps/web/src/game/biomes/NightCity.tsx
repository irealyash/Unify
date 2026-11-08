import { Instance, Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, memo, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  BackSide,
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  Vector3,
  type CanvasTexture,
  type Group,
  type Material,
} from "three";
import type { Area } from "@unify/shared";
import { poses, useRoom } from "../store";
import { FadeGroup, Fadeable } from "./fade";
import {
  MONORAIL,
  MONORAIL_LENGTH,
  NEON,
  PLAZA_HALF,
  RING,
  SIDEWALK_OUT,
  STREET_HALF,
  WALK_HALF,
  monorailPoint,
  nightCityLayout,
  type BuildingSpec,
} from "./nightCityLayout";
import { createRng } from "./random";
import { TokyoTower } from "./TokyoTower";
import {
  FACADE_GRID,
  createFacadeTexture,
  createNeonTextTexture,
  createPavingTexture,
  createShopfrontTexture,
  createSkylineTexture,
  createStripeTexture,
} from "./textures";

/**
 * Night City: a compact, stylised synthwave district. Purple-lit streets, neon-trimmed
 * buildings of several kinds, a neon Tokyo Tower in the plaza and a monorail looping overhead.
 *
 * `immersive` (a player standing in the city) adds the sky dome, the ring of buildings beyond
 * the barriers and the distant skyline; the host's overview draws just the walkable district.
 */

/** A color pushed above 1.0 so the bloom pass picks it up. */
function glow(hex: string, strength = 3) {
  return new Color(hex).multiplyScalar(strength);
}

export function NightCity({ area, immersive = false }: { area: Area; immersive?: boolean }) {
  const layout = nightCityLayout();
  const textures = useCityTextures();

  // Fade buildings between the camera and *your* character (players only).
  // Poses and the fade bounds are both in world space.
  const head = useMemo(() => new Vector3(), []);
  const fadeTarget = useMemo(
    () => () => {
      if (!immersive) return null;
      const id = useRoom.getState().selfId;
      const pose = id ? poses.get(id) : undefined;
      return pose ? head.set(pose.x, 1.2, pose.z) : null;
    },
    [immersive, head],
  );

  const buildings = useMemo(
    () => (immersive ? layout.buildings : layout.buildings.filter((b) => b.ring === "core")),
    [immersive, layout],
  );

  return (
    <group position={[area.cx, 0, area.cz]}>
      {immersive ? <SkyDome /> : null}
      <Ground immersive={immersive} textures={textures} />
      <Streets immersive={immersive} />
      <PlazaFloor />

      <FadeGroup target={fadeTarget}>
        {buildings.map((b, i) => (
          <Building key={i} spec={b} textures={textures} />
        ))}
      </FadeGroup>
      {/* Not faded: it's an open lattice you can walk under, so it never really hides you. */}
      <Suspense fallback={null}>
        <TokyoTower />
      </Suspense>
      <RoofLights buildings={buildings} />
      {immersive ? <Skyline textures={textures} /> : null}

      <Monorail />
      <StreetLamps />
      <Cars />
      <Barriers textures={textures} />
      <CityLights />
    </group>
  );
}

// ── Textures ─────────────────────────────────────────────────────────────────

type CityTextures = {
  facades: CanvasTexture[];
  shopfronts: CanvasTexture[];
  skyline: CanvasTexture;
  stripes: CanvasTexture;
  paving: CanvasTexture;
};

const WINDOW_PALETTES = [
  ["#ff7be6", "#ffc8f3"],
  ["#7ff3ff", "#c9fbff"],
  ["#ffcf7a", "#ffe9c2"],
  ["#ff7be6", "#7ff3ff", "#ffcf7a"],
];

function useCityTextures(): CityTextures {
  const textures = useMemo<CityTextures>(() => {
    const rng = createRng(31);
    return {
      facades: WINDOW_PALETTES.map((p) => createFacadeTexture(rng, p)),
      shopfronts: [0, 1].map(() => createShopfrontTexture(rng)),
      skyline: createSkylineTexture(rng),
      stripes: createStripeTexture(),
      paving: createPavingTexture(),
    };
  }, []);
  useEffect(
    () => () =>
      [...textures.facades, ...textures.shopfronts, textures.skyline, textures.stripes, textures.paving].forEach(
        (t) => t.dispose(),
      ),
    [textures],
  );
  return textures;
}

// ── Sky and ground ───────────────────────────────────────────────────────────

/** Purple gradient sky: deep violet overhead fading to a glowing magenta haze at the horizon. */
function SkyDome() {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new Color("#140a36") },
          mid: { value: new Color("#3b1f78") },
          horizon: { value: new Color("#7a3fae") },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 top; uniform vec3 mid; uniform vec3 horizon;
          varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y, 0.0, 1.0);
            vec3 c = mix(horizon, mid, smoothstep(0.0, 0.22, h));
            c = mix(c, top, smoothstep(0.22, 0.75, h));
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh material={material} renderOrder={-1}>
      <sphereGeometry args={[230, 32, 16]} />
    </mesh>
  );
}

function Ground({ immersive, textures }: { immersive: boolean; textures: CityTextures }) {
  const paving = useMemo(() => {
    const t = textures.paving.clone();
    t.repeat.set(WALK_HALF, WALK_HALF);
    return t;
  }, [textures]);
  useEffect(() => () => paving.dispose(), [paving]);
  return (
    <>
      {/* Far ground, under everything. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={immersive ? [220, 220] : [40, 40]} />
        <meshStandardMaterial color="#2a2152" roughness={0.9} />
      </mesh>
      {/* Paving for the walkable district (sidewalks and plaza); roads are drawn on top. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[WALK_HALF * 2 + 1, WALK_HALF * 2 + 1]} />
        <meshStandardMaterial map={paving} roughness={0.75} />
      </mesh>
    </>
  );
}

type Strip = [x: number, z: number, w: number, d: number];

function Streets({ immersive }: { immersive: boolean }) {
  const { roads, dashes, cyanCurbs, pinkCurbs, orangeCurbs, sidewalks } = useMemo(() => {
    const reach = immersive ? 105 : WALK_HALF + 0.5;
    const ringW = RING.outer - RING.road + 0.1;
    const roads: Strip[] = [];
    const sidewalks: Strip[] = [];
    // Avenue (north–south) and cross street (east–west), outside the plaza.
    for (const s of [-1, 1]) {
      const len = reach - PLAZA_HALF;
      const mid = s * (PLAZA_HALF + len / 2);
      roads.push([0, mid, STREET_HALF * 2, len], [mid, 0, len, STREET_HALF * 2]);
      // Beyond the district the streets keep their sidewalks.
      if (immersive) {
        const far = reach - WALK_HALF;
        const farMid = s * (WALK_HALF + far / 2);
        for (const side of [-1, 1]) {
          const off = side * (STREET_HALF + (SIDEWALK_OUT - STREET_HALF) / 2);
          sidewalks.push(
            [off, farMid, SIDEWALK_OUT - STREET_HALF, far],
            [farMid, off, far, SIDEWALK_OUT - STREET_HALF],
          );
        }
      }
    }
    // Ring road under the monorail.
    const ringMid = (RING.road + RING.outer) / 2;
    const ringLen = RING.outer * 2;
    roads.push([0, -ringMid, ringLen, ringW], [0, ringMid, ringLen, ringW]);
    roads.push([-ringMid, 0, ringW, ringLen], [ringMid, 0, ringW, ringLen]);

    const dashes: Strip[] = [];
    for (let p = PLAZA_HALF + 1; p < reach; p += 2.6) {
      if (Math.abs(p - RING.center) < 2.4) continue;
      for (const s of [-1, 1]) dashes.push([0, s * p, 0.12, 1.2], [s * p, 0, 1.2, 0.12]);
    }
    for (let p = -RING.center + 2; p < RING.center - 2; p += 2.6) {
      if (Math.abs(p) < SIDEWALK_OUT + 0.6) continue;
      for (const s of [-1, 1]) {
        dashes.push([p, s * RING.center, 1.2, 0.12], [s * RING.center, p, 0.12, 1.2]);
      }
    }

    // Glowing curb lines along the streets (cyan on the avenue, pink on the cross street).
    const cyanCurbs: Strip[] = [];
    const pinkCurbs: Strip[] = [];
    const curbLen = (immersive ? reach : RING.road) - PLAZA_HALF;
    for (const s of [-1, 1]) {
      const mid = s * (PLAZA_HALF + curbLen / 2);
      for (const side of [-1, 1]) {
        cyanCurbs.push([side * STREET_HALF, mid, 0.1, curbLen]);
        pinkCurbs.push([mid, side * STREET_HALF, curbLen, 0.1]);
      }
    }
    // Orange line along the ring road's inner curb.
    const orangeCurbs: Strip[] = [];
    for (const s of [-1, 1]) {
      for (const [a, b] of [
        [-RING.road, -SIDEWALK_OUT],
        [SIDEWALK_OUT, RING.road],
      ] as const) {
        const len = b - a;
        const mid = (a + b) / 2;
        orangeCurbs.push([mid, s * RING.road, len, 0.1], [s * RING.road, mid, 0.1, len]);
      }
    }
    return { roads, dashes, cyanCurbs, pinkCurbs, orangeCurbs, sidewalks };
  }, [immersive]);

  return (
    <>
      <StripSet strips={roads} y={0.008} height={0.012}>
        <meshStandardMaterial color="#25213f" roughness={0.55} metalness={0.15} />
      </StripSet>
      {sidewalks.length ? (
        <StripSet strips={sidewalks} y={0.006} height={0.01}>
          <meshStandardMaterial color="#4a3f86" roughness={0.8} />
        </StripSet>
      ) : null}
      <StripSet strips={dashes} y={0.016} height={0.004}>
        <meshStandardMaterial color="#e8e4ff" emissive="#ffffff" emissiveIntensity={0.25} />
      </StripSet>
      <StripSet strips={cyanCurbs} y={0.02} height={0.03}>
        <meshBasicMaterial color={glow(NEON.cyan, 2.6)} toneMapped={false} />
      </StripSet>
      <StripSet strips={pinkCurbs} y={0.02} height={0.03}>
        <meshBasicMaterial color={glow(NEON.pink, 2.4)} toneMapped={false} />
      </StripSet>
      <StripSet strips={orangeCurbs} y={0.02} height={0.03}>
        <meshBasicMaterial color={glow(NEON.orange, 2.4)} toneMapped={false} />
      </StripSet>
    </>
  );
}

/** Thin flat boxes drawn with instancing (roads, dashes, glowing curb lines). */
function StripSet({
  strips,
  y,
  height,
  children,
}: {
  strips: Strip[];
  y: number;
  height: number;
  children: ReactNode;
}) {
  return (
    <Instances limit={strips.length}>
      <boxGeometry args={[1, 1, 1]} />
      {children}
      {strips.map(([x, z, w, d], i) => (
        <Instance key={i} position={[x, y, z]} scale={[w, height, d]} />
      ))}
    </Instances>
  );
}

function PlazaFloor() {
  return (
    <>
      {(
        [
          [5.4, 5.7, NEON.cyan],
          [1.6, 1.8, NEON.pink],
        ] as const
      ).map(([inner, outer, color]) => (
        <mesh key={inner} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[inner, outer, 64]} />
          <meshBasicMaterial color={glow(color, 2.2)} toneMapped={false} />
        </mesh>
      ))}
      {/* Glowing bollards at the plaza corners. */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx},${sz}`} position={[sx * 5.6, 0, sz * 5.6]}>
            <mesh position={[0, 0.45, 0]}>
              <cylinderGeometry args={[0.16, 0.2, 0.9, 10]} />
              <meshStandardMaterial color="#2c2560" />
            </mesh>
            <mesh position={[0, 0.95, 0]}>
              <sphereGeometry args={[0.17, 10, 8]} />
              <meshBasicMaterial color={glow(sx * sz > 0 ? NEON.cyan : NEON.pink, 3)} toneMapped={false} />
            </mesh>
          </group>
        )),
      )}
    </>
  );
}

// ── Buildings ────────────────────────────────────────────────────────────────

type Mats = {
  wall: MeshStandardMaterial;
  roof: MeshStandardMaterial;
  glow: MeshBasicMaterial;
  accent: MeshBasicMaterial;
  box: Material[];
};

function useBuildingMaterials(spec: BuildingSpec, textures: CityTextures): Mats {
  const mats = useMemo(() => {
    const rng = createRng(spec.seed);
    const map = rng.pick(textures.facades).clone();
    map.repeat.set(Math.max(spec.w, spec.d) / FACADE_GRID.tileW, spec.h / FACADE_GRID.tileH);
    map.offset.set(rng.next(), rng.next());
    const wall = new MeshStandardMaterial({
      color: spec.wall,
      roughness: 0.85,
      metalness: 0.05,
      emissive: "#ffffff",
      emissiveMap: map,
      emissiveIntensity: 1.35,
    });
    const roof = new MeshStandardMaterial({
      color: new Color(spec.wall).multiplyScalar(0.7),
      roughness: 0.9,
    });
    return {
      wall,
      roof,
      glow: new MeshBasicMaterial({ color: glow(spec.glow, 3), toneMapped: false }),
      accent: new MeshBasicMaterial({ color: glow(spec.accent, 2.6), toneMapped: false }),
      box: [wall, wall, roof, roof, wall, wall],
    };
  }, [spec, textures]);
  useEffect(
    () => () => {
      mats.wall.emissiveMap?.dispose();
      [mats.wall, mats.roof, mats.glow, mats.accent].forEach((m) => m.dispose());
    },
    [mats],
  );
  return mats;
}

/**
 * Memoized with stable materials: if React re-applied `material` props it would replace the
 * per-building clones <Fadeable> uses for see-through fading.
 */
const Building = memo(function Building({
  spec,
  textures,
}: {
  spec: BuildingSpec;
  textures: CityTextures;
}) {
  const mats = useBuildingMaterials(spec, textures);
  let body: ReactNode;
  switch (spec.kind) {
    case "cylinder":
      body = <CylinderTower spec={spec} mats={mats} />;
      break;
    case "stepped":
      body = <SteppedBlock spec={spec} mats={mats} />;
      break;
    case "pagoda":
      body = <Pagoda spec={spec} mats={mats} />;
      break;
    case "hotel":
      body = <Hotel spec={spec} mats={mats} />;
      break;
    case "shops":
      body = <Shops spec={spec} mats={mats} textures={textures} />;
      break;
    default:
      body = <PlainBlock spec={spec} mats={mats} />;
  }
  return (
    <Fadeable>
      <group position={[spec.x, 0, spec.z]}>{body}</group>
    </Fadeable>
  );
});

/** Neon trim around the top edge of a w×d box at height y. */
function EdgeBand({
  w,
  d,
  y,
  material,
  t = 0.12,
}: {
  w: number;
  d: number;
  y: number;
  material: Material;
  t?: number;
}) {
  return (
    <>
      {[-1, 1].map((s) => (
        <mesh key={`z${s}`} position={[0, y, (s * d) / 2]} material={material}>
          <boxGeometry args={[w + t, t, t]} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`x${s}`} position={[(s * w) / 2, y, 0]} material={material}>
          <boxGeometry args={[t, t, d + t]} />
        </mesh>
      ))}
    </>
  );
}

/** Vertical neon strips up the four corners. */
function CornerStrips({
  w,
  d,
  y0,
  y1,
  material,
}: {
  w: number;
  d: number;
  y0: number;
  y1: number;
  material: Material;
}) {
  return (
    <>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx},${sz}`} position={[(sx * w) / 2, (y0 + y1) / 2, (sz * d) / 2]} material={material}>
            <boxGeometry args={[0.12, y1 - y0, 0.12]} />
          </mesh>
        )),
      )}
    </>
  );
}

function Box({ w, h, d, y = 0, mats }: { w: number; h: number; d: number; y?: number; mats: Mats }) {
  return (
    <mesh position={[0, y + h / 2, 0]} material={mats.box}>
      <boxGeometry args={[w, h, d]} />
    </mesh>
  );
}

function RoofClutter({ w, d, y, seed }: { w: number; d: number; y: number; seed: number }) {
  const units = useMemo(() => {
    const rng = createRng(seed + 5);
    return Array.from({ length: 1 + Math.floor(rng.next() * 2) }, () => ({
      x: rng.range(-w / 2 + 0.6, w / 2 - 0.6),
      z: rng.range(-d / 2 + 0.6, d / 2 - 0.6),
    }));
  }, [w, d, seed]);
  return (
    <>
      {units.map((u, i) => (
        <group key={i} position={[u.x, y, u.z]}>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[0.9, 0.6, 0.9]} />
            <meshStandardMaterial color="#6f6aa8" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.61, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.32, 16]} />
            <meshStandardMaterial color="#2a2552" />
          </mesh>
        </group>
      ))}
    </>
  );
}

function PlainBlock({ spec, mats }: { spec: BuildingSpec; mats: Mats }) {
  const { w, d, h } = spec;
  return (
    <>
      <Box w={w} h={h} d={d} mats={mats} />
      <EdgeBand w={w} d={d} y={h} material={mats.glow} />
      <EdgeBand w={w} d={d} y={h * 0.5} material={mats.accent} t={0.08} />
      <CornerStrips w={w} d={d} y0={0.4} y1={h} material={mats.accent} />
      <RoofClutter w={w} d={d} y={h} seed={spec.seed} />
    </>
  );
}

function SteppedBlock({ spec, mats }: { spec: BuildingSpec; mats: Mats }) {
  const { w, d, h } = spec;
  const tiers = [
    { w, d, h: h * 0.55, y: 0 },
    { w: w * 0.78, d: d * 0.78, h: h * 0.28, y: h * 0.55 },
    { w: w * 0.52, d: d * 0.52, h: h * 0.17, y: h * 0.83 },
  ];
  return (
    <>
      {tiers.map((t, i) => (
        <group key={i}>
          <Box w={t.w} h={t.h} d={t.d} y={t.y} mats={mats} />
          <EdgeBand w={t.w} d={t.d} y={t.y + t.h} material={i % 2 ? mats.accent : mats.glow} />
        </group>
      ))}
      <RoofClutter w={tiers[1]!.w} d={tiers[1]!.d} y={tiers[0]!.h} seed={spec.seed} />
      <mesh position={[0, h + 1.4, 0]}>
        <cylinderGeometry args={[0.05, 0.08, 2.8, 6]} />
        <meshStandardMaterial color="#8a84c8" />
      </mesh>
    </>
  );
}

function CylinderTower({ spec, mats }: { spec: BuildingSpec; mats: Mats }) {
  const { w, d, h } = spec;
  const r = (Math.min(w, d) / 2) * 0.86;
  const panels = 8;
  const podium = 2.2;
  return (
    <>
      <Box w={w} h={podium} d={d} mats={mats} />
      <EdgeBand w={w} d={d} y={podium} material={mats.accent} />
      <mesh position={[0, podium + (h - podium) / 2, 0]} material={mats.wall}>
        <cylinderGeometry args={[r, r, h - podium, 20]} />
      </mesh>
      {/* Tall glowing light panels around the drum (the look of the reference towers). */}
      {Array.from({ length: panels }, (_, i) => {
        const a = (i / panels) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.sin(a) * (r + 0.04), podium + (h - podium) / 2, Math.cos(a) * (r + 0.04)]}
            rotation={[0, a, 0]}
            material={mats.glow}
          >
            <boxGeometry args={[0.34, h - podium - 2.4, 0.06]} />
          </mesh>
        );
      })}
      {[podium + 0.6, podium + (h - podium) * 0.5, h - 0.4].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={mats.accent}>
          <cylinderGeometry args={[r + 0.12, r + 0.12, 0.16, 24]} />
        </mesh>
      ))}
      <mesh position={[0, h + 0.5, 0]} material={mats.roof}>
        <cylinderGeometry args={[r * 0.65, r * 0.8, 1, 16]} />
      </mesh>
      <mesh position={[0, h + 1.15, 0]} material={mats.glow}>
        <cylinderGeometry args={[r * 0.9, r * 0.9, 0.18, 20]} />
      </mesh>
      <mesh position={[0, h + 2.6, 0]}>
        <cylinderGeometry args={[0.05, 0.09, 3, 6]} />
        <meshStandardMaterial color="#8a84c8" />
      </mesh>
    </>
  );
}

function Pagoda({ spec, mats }: { spec: BuildingSpec; mats: Mats }) {
  const { w, d, h } = spec;
  const slabs: number[] = [];
  for (let y = 2.2; y < h; y += 2.3) slabs.push(y);
  return (
    <>
      <Box w={w * 0.72} h={h} d={d * 0.72} mats={mats} />
      {slabs.map((y, i) => (
        <group key={y}>
          <mesh position={[0, y, 0]} material={mats.roof}>
            <boxGeometry args={[w, 0.32, d]} />
          </mesh>
          <EdgeBand w={w} d={d} y={y} material={i % 2 ? mats.accent : mats.glow} t={0.1} />
        </group>
      ))}
      <mesh position={[0, h + 1, 0]} material={mats.roof}>
        <coneGeometry args={[Math.min(w, d) * 0.3, 2, 4]} />
      </mesh>
    </>
  );
}

function Hotel({ spec, mats }: { spec: BuildingSpec; mats: Mats }) {
  const { w, d, h } = spec;
  const facing = spec.z < 0 ? 1 : -1; // the sign faces the cross street
  return (
    <>
      <Box w={w} h={h} d={d} mats={mats} />
      {[h * 0.33, h * 0.66, h].map((y, i) => (
        <EdgeBand key={y} w={w} d={d} y={y} material={i === 2 ? mats.glow : mats.accent} t={0.1} />
      ))}
      {/* Scaffold on the roof holding the sign. */}
      <group position={[0, h, (facing * d) / 2 - facing * 0.6]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[(s * w) / 2.6, 1.4, 0]}>
            <boxGeometry args={[0.1, 2.8, 0.1]} />
            <meshStandardMaterial color="#5a55a0" />
          </mesh>
        ))}
        <NeonText
          text={spec.sign ?? "HOTEL"}
          color={NEON.cyan}
          height={1.9}
          position={[0, 1.6, facing * 0.12]}
          rotationY={facing > 0 ? 0 : Math.PI}
        />
      </group>
    </>
  );
}

function Shops({ spec, mats, textures }: { spec: BuildingSpec; mats: Mats; textures: CityTextures }) {
  const { w, d, h } = spec;
  const front = useMemo(() => {
    const map = textures.shopfronts[spec.seed % textures.shopfronts.length]!.clone();
    map.repeat.set(Math.max(w, d) / 5, 1);
    return new MeshStandardMaterial({
      color: "#2a1f55",
      emissive: "#ffffff",
      emissiveMap: map,
      emissiveIntensity: 1.5,
    });
  }, [textures, spec.seed, w, d]);
  const sides = useMemo<Material[]>(() => [front, front, mats.roof, mats.roof, front, front], [front, mats.roof]);
  useEffect(
    () => () => {
      front.emissiveMap?.dispose();
      front.dispose();
    },
    [front],
  );
  const facing = spec.z < 0 ? 1 : -1;
  return (
    <>
      <mesh position={[0, 1.4, 0]} material={sides}>
        <boxGeometry args={[w, 2.8, d]} />
      </mesh>
      <Box w={w} h={h - 2.8} d={d} y={2.8} mats={mats} />
      <EdgeBand w={w} d={d} y={2.8} material={mats.glow} />
      <EdgeBand w={w} d={d} y={h} material={mats.accent} />
      {/* Awning over the shopfront. */}
      <mesh position={[0, 3.05, facing * (d / 2 + 0.5)]} rotation={[facing * 0.35, 0, 0]}>
        <boxGeometry args={[w * 0.9, 0.08, 1.1]} />
        <meshStandardMaterial color="#ff8a3c" emissive="#ff6a1f" emissiveIntensity={0.6} />
      </mesh>
      {spec.sign ? (
        <NeonText
          text={spec.sign}
          color={NEON.lime}
          height={1.3}
          position={[0, h - 0.9, facing * (d / 2 + 0.08)]}
          rotationY={facing > 0 ? 0 : Math.PI}
        />
      ) : null}
      <RoofClutter w={w} d={d} y={h} seed={spec.seed} />
    </>
  );
}

function NeonText({
  text,
  color,
  height,
  position,
  rotationY = 0,
}: {
  text: string;
  color: string;
  height: number;
  position: [number, number, number];
  rotationY?: number;
}) {
  const { texture, aspect } = useMemo(() => createNeonTextTexture(text, color), [text, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <planeGeometry args={[height * aspect, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        side={DoubleSide}
        toneMapped={false}
        color={glow("#ffffff", 2)}
      />
    </mesh>
  );
}

/** Blinking red lights on top of the tall buildings (one shared material). */
function RoofLights({ buildings }: { buildings: BuildingSpec[] }) {
  const material = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), []);
  const points = useMemo(
    () =>
      buildings
        .filter((b) => b.kind === "cylinder" || b.kind === "stepped")
        .map((b) => [b.x, b.h + (b.kind === "cylinder" ? 4.15 : 2.85), b.z] as [number, number, number]),
    [buildings],
  );
  const on = useMemo(() => glow(NEON.red, 5), []);
  const off = useMemo(() => glow(NEON.red, 0.35), []);
  useFrame(({ clock }) => {
    material.color.copy(Math.sin(clock.elapsedTime * 2.6) > 0.3 ? on : off);
  });
  useEffect(() => () => material.dispose(), [material]);
  return (
    <Instances limit={Math.max(points.length, 1)} material={material}>
      <sphereGeometry args={[0.15, 10, 8]} />
      {points.map((p, i) => (
        <Instance key={i} position={p} />
      ))}
    </Instances>
  );
}

// ── Landmarks ────────────────────────────────────────────────────────────────

/** Elevated monorail loop over the ring road, with a little glowing train running on it. */
function Monorail() {
  const { monorailPillars } = nightCityLayout();
  const segments = useMemo(() => {
    const n = 96;
    const out: Array<{ p: [number, number, number]; heading: number; len: number }> = [];
    for (let i = 0; i < n; i++) {
      const a = monorailPoint(i / n);
      const b = monorailPoint((i + 1) / n);
      out.push({
        p: [(a.x + b.x) / 2, MONORAIL.height, (a.z + b.z) / 2],
        heading: Math.atan2(b.x - a.x, b.z - a.z),
        len: Math.hypot(b.x - a.x, b.z - a.z) + 0.05,
      });
    }
    return out;
  }, []);
  const rails = useMemo(
    () =>
      segments.flatMap((s) =>
        [-1, 1].map((side) => ({
          p: [
            s.p[0] + Math.cos(s.heading) * 0.58 * side,
            MONORAIL.height + 0.18,
            s.p[2] - Math.sin(s.heading) * 0.58 * side,
          ] as [number, number, number],
          heading: s.heading,
          len: s.len,
        })),
      ),
    [segments],
  );

  return (
    <>
      <Instances limit={segments.length}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#3d3486" roughness={0.6} />
        {segments.map((s, i) => (
          <Instance key={i} position={s.p} rotation={[0, s.heading, 0]} scale={[1.15, 0.45, s.len]} />
        ))}
      </Instances>
      <Instances limit={rails.length}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={glow(NEON.cyan, 2.4)} toneMapped={false} />
        {rails.map((r, i) => (
          <Instance key={i} position={r.p} rotation={[0, r.heading, 0]} scale={[0.07, 0.07, r.len]} />
        ))}
      </Instances>
      <Instances limit={monorailPillars.length}>
        <cylinderGeometry args={[0.28, 0.34, MONORAIL.height, 10]} />
        <meshStandardMaterial color="#4a3f8f" roughness={0.6} />
        {monorailPillars.map(([x, z], i) => (
          <Instance key={i} position={[x, MONORAIL.height / 2, z]} />
        ))}
      </Instances>
      <Train />
    </>
  );
}

const TRAIN_SPEED = 5;
const CAR_GAP = 2.75;

function Train() {
  const cars = useRef<Array<Group | null>>([]);
  useFrame(({ clock }) => {
    const head = (clock.elapsedTime * TRAIN_SPEED) / MONORAIL_LENGTH;
    cars.current.forEach((car, i) => {
      if (!car) return;
      const p = monorailPoint(head - (i * CAR_GAP) / MONORAIL_LENGTH);
      car.position.set(p.x, MONORAIL.height + 0.85, p.z);
      car.rotation.y = p.heading;
    });
  });
  return (
    <>
      {[0, 1, 2].map((i) => (
        <group
          key={i}
          ref={(g) => {
            cars.current[i] = g;
          }}
        >
          <mesh>
            <boxGeometry args={[1.25, 1.05, 2.5]} />
            <meshStandardMaterial color="#d9d6ff" roughness={0.4} metalness={0.2} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.64, 0.12, 0]}>
              <boxGeometry args={[0.03, 0.34, 2.1]} />
              <meshBasicMaterial color={glow(i % 2 ? NEON.pink : NEON.cyan, 2.6)} toneMapped={false} />
            </mesh>
          ))}
          <mesh position={[0, -0.47, 0]}>
            <boxGeometry args={[1.28, 0.08, 2.52]} />
            <meshBasicMaterial color={glow(NEON.violet, 2.4)} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ── Street life ──────────────────────────────────────────────────────────────

function StreetLamps() {
  const { lamps } = nightCityLayout();
  return (
    <>
      <Instances limit={lamps.length}>
        <cylinderGeometry args={[0.06, 0.09, 4.2, 6]} />
        <meshStandardMaterial color="#5a55a0" metalness={0.4} roughness={0.5} />
        {lamps.map(([x, z], i) => (
          <Instance key={i} position={[x, 2.1, z]} />
        ))}
      </Instances>
      <Instances limit={lamps.length}>
        <boxGeometry args={[0.5, 0.16, 0.5]} />
        <meshBasicMaterial color={glow("#d9f8ff", 3.5)} toneMapped={false} />
        {lamps.map(([x, z], i) => (
          <Instance key={i} position={[x, 4.25, z]} />
        ))}
      </Instances>
    </>
  );
}

/** Neon-outlined cars parked along the streets. */
function Cars() {
  const { cars } = nightCityLayout();
  const outline = useMemo(() => new MeshBasicMaterial({ color: glow(NEON.cyan, 2.6), toneMapped: false }), []);
  const wheel = useMemo(() => new MeshBasicMaterial({ color: glow(NEON.pink, 2.4), toneMapped: false }), []);
  useEffect(
    () => () => {
      outline.dispose();
      wheel.dispose();
    },
    [outline, wheel],
  );
  return (
    <>
      {cars.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]} rotation={[0, c.rot, 0]}>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[2.5, 0.55, 1.2]} />
            <meshStandardMaterial color={c.color} roughness={0.4} metalness={0.3} />
          </mesh>
          <mesh position={[-0.15, 0.98, 0]}>
            <boxGeometry args={[1.4, 0.45, 1.05]} />
            <meshStandardMaterial color="#141033" roughness={0.2} metalness={0.6} />
          </mesh>
          <EdgeBand w={2.5} d={1.2} y={0.77} material={outline} t={0.05} />
          <EdgeBand w={1.4} d={1.05} y={1.2} material={outline} t={0.04} />
          {[-0.8, 0.8].flatMap((x) =>
            [-0.6, 0.6].map((z) => (
              <mesh key={`${x},${z}`} position={[x, 0.26, z]} rotation={[Math.PI / 2, 0, 0]} material={wheel}>
                <cylinderGeometry args={[0.26, 0.26, 0.16, 14]} />
              </mesh>
            )),
          )}
          {[-0.4, 0.4].map((z) => (
            <mesh key={z} position={[1.26, 0.55, z]}>
              <boxGeometry args={[0.04, 0.12, 0.26]} />
              <meshBasicMaterial color={glow("#f2f6ff", 4)} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

/** Striped barricades where the avenue and cross street leave the district. */
function Barriers({ textures }: { textures: CityTextures }) {
  const board = useMemo(() => {
    const map = textures.stripes.clone();
    map.repeat.set(4, 1);
    return new MeshStandardMaterial({ map, roughness: 0.6, emissive: "#ff6a00", emissiveIntensity: 0.15 });
  }, [textures]);
  const light = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), []);
  const bright = useMemo(() => glow(NEON.orange, 4.5), []);
  const dim = useMemo(() => glow(NEON.orange, 0.4), []);
  useFrame(({ clock }) => {
    light.color.copy(Math.sin(clock.elapsedTime * 4) > 0 ? bright : dim);
  });
  useEffect(
    () => () => {
      board.map?.dispose();
      board.dispose();
      light.dispose();
    },
    [board, light],
  );
  const at = WALK_HALF + 0.3;
  const span = SIDEWALK_OUT * 2;
  const spots = [
    { x: 0, z: -at, rot: 0 },
    { x: 0, z: at, rot: 0 },
    { x: -at, z: 0, rot: Math.PI / 2 },
    { x: at, z: 0, rot: Math.PI / 2 },
  ];
  return (
    <>
      {spots.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]} rotation={[0, s.rot, 0]}>
          {[0.55, 1.05].map((y) => (
            <mesh key={y} position={[0, y, 0]} material={board}>
              <boxGeometry args={[span, 0.3, 0.08]} />
            </mesh>
          ))}
          {[-span / 2 + 0.3, 0, span / 2 - 0.3].map((x) => (
            <group key={x} position={[x, 0, 0]}>
              <mesh position={[0, 0.6, 0]}>
                <boxGeometry args={[0.1, 1.2, 0.3]} />
                <meshStandardMaterial color="#e8e8ee" />
              </mesh>
              <mesh position={[0, 1.32, 0]} material={light}>
                <sphereGeometry args={[0.11, 10, 8]} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </>
  );
}

/** Colored washes of real light on the streets (most of the glow comes from bloom). */
function CityLights() {
  const lights: Array<{ p: [number, number, number]; c: string; i: number; d: number }> = [
    { p: [-6, 3.5, -6], c: NEON.cyan, i: 22, d: 13 },
    { p: [6, 3.5, -6], c: NEON.violet, i: 22, d: 13 },
    { p: [6, 3.5, 6], c: NEON.orange, i: 18, d: 13 },
    { p: [-6, 3.5, 6], c: NEON.pink, i: 22, d: 13 },
    { p: [0, 4, -12], c: "#9fd8ff", i: 20, d: 14 },
    { p: [0, 4, 12], c: NEON.pink, i: 18, d: 14 },
  ];
  return (
    <>
      {lights.map((l, i) => (
        <pointLight key={i} position={l.p} color={l.c} intensity={l.i} distance={l.d} decay={1.5} />
      ))}
    </>
  );
}

// ── Beyond the barriers ──────────────────────────────────────────────────────

/** Distant skyline: lit towers fading into the purple haze (instanced). */
function Skyline({ textures }: { textures: CityTextures }) {
  const { backdrop } = nightCityLayout();
  const material = useMemo(() => {
    const map = textures.skyline.clone();
    map.repeat.set(1.5, 3);
    return new MeshStandardMaterial({
      color: "#ffffff",
      roughness: 0.8,
      emissive: "#ffffff",
      emissiveMap: map,
      emissiveIntensity: 1.2,
    });
  }, [textures]);
  useEffect(
    () => () => {
      material.emissiveMap?.dispose();
      material.dispose();
    },
    [material],
  );
  const tints = ["#3a3189", "#2f3a86", "#45338f", "#30296e"];
  const boxes = backdrop.filter((b) => !b.round);
  const rounds = backdrop.filter((b) => b.round);
  return (
    <>
      <Instances limit={boxes.length} material={material}>
        <boxGeometry args={[1, 1, 1]} />
        {boxes.map((b, i) => (
          <Instance
            key={i}
            position={[b.x, b.h / 2, b.z]}
            scale={[b.w, b.h, b.d]}
            color={tints[Math.floor(b.tint * tints.length)]}
          />
        ))}
      </Instances>
      <Instances limit={Math.max(rounds.length, 1)} material={material}>
        <cylinderGeometry args={[0.5, 0.5, 1, 16]} />
        {rounds.map((b, i) => (
          <Instance
            key={i}
            position={[b.x, b.h / 2, b.z]}
            scale={[b.w, b.h, b.w]}
            color={tints[Math.floor(b.tint * tints.length)]}
          />
        ))}
      </Instances>
    </>
  );
}
