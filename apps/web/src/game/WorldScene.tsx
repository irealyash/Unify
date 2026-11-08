import { Grid, Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Object3D, Vector3, type DirectionalLight, type PerspectiveCamera } from "three";
import {
  BIOMES,
  LOBBY_AREA,
  biomeArea,
  biomesExtent,
  playerArea,
  type Area,
  type BiomeDef,
  type BiomeId,
  type PlayerState,
  type Stage,
} from "@unify/shared";
import { TokyoTown } from "./biomes/TokyoTown";
import { tokyoTownObstacles } from "./biomes/tokyoTownMap";
import type { Rect } from "./collision";
import type { CameraRig } from "./LocalPlayer";
import { LocalPlayer } from "./LocalPlayer";
import { damp } from "./math";
import { NameTag } from "./NameTag";
import { RemotePlayer } from "./RemotePlayer";
import { useRoom } from "./store";

const WALL_HEIGHT = 1.2;
const WALL_THICKNESS = 0.4;
const BG = "#f3f4f7";

/** Sky, fog and lights. The lobby, the host overview and plain biomes use DEFAULT_ENV. */
type Environment = {
  background: string;
  fog: [color: string, near: number, far: number];
  hemisphere: [sky: string, ground: string, intensity: number];
  sun: { color: string; intensity: number; shadows: boolean };
  /** Optional extras for night scenes. */
  stars?: boolean;
  bloom?: boolean;
};

const DEFAULT_ENV: Environment = {
  background: BG,
  fog: [BG, 30, 70],
  hemisphere: ["#ffffff", "#dfe2e8", 1.4],
  sun: { color: "#ffffff", intensity: 1.6, shadows: true },
};

/** What a player standing in each biome sees. */
const BIOME_ENVS: Partial<Record<BiomeId, Environment>> = {
  // Daytime city: clear sky, light haze on the horizon, warm sun with shadows.
  night_city: {
    background: "#bcdcf5",
    // Matches the sky near the horizon so the far ground and hills melt into it.
    fog: ["#d3e3ec", 45, 230],
    hemisphere: ["#ffffff", "#c9c0a8", 1.15],
    sun: { color: "#fff3df", intensity: 2.3, shadows: true },
  },
};

type BiomeSceneProps = {
  area: Area;
  /** A player is standing inside (vs. the host's overview): draw the full, endless version. */
  immersive?: boolean;
};

/** Biomes with a finished themed scene. Others fall back to a plain tinted room. */
const BIOME_SCENES: Partial<Record<BiomeId, (props: BiomeSceneProps) => React.JSX.Element>> = {
  night_city: TokyoTown,
};

/** Solid footprints (world space) the local player collides with, per biome. */
const BIOME_OBSTACLES: Partial<Record<BiomeId, (area: Area) => Rect[]>> = {
  night_city: (a) => tokyoTownObstacles(a.cx, a.cz),
};
const obstacleCache = new Map<BiomeId, Rect[]>();

/** Biomes whose scenery wants a different follow camera (e.g. a lower view down city streets). */
const BIOME_CAMERAS: Partial<Record<BiomeId, CameraRig>> = {
  night_city: { height: 7, distance: 10, lookHeight: 1.8 },
};
function obstaclesFor(biome: BiomeId): Rect[] | undefined {
  const build = BIOME_OBSTACLES[biome];
  if (!build) return undefined;
  let rects = obstacleCache.get(biome);
  if (!rects) {
    rects = build(biomeArea(biome));
    obstacleCache.set(biome, rects);
  }
  return rects;
}

type WorldSceneProps = {
  /** When set, this player is controlled by WASD and followed by the camera. */
  selfId?: string | null;
  /** Host view: fixed overhead camera, no local player, every biome visible. */
  spectator?: boolean;
  /** Ignore movement keys (quiz panel open, sorting in progress, …). */
  frozen?: boolean;
};

/** The whole 3D world: the shared lobby before sorting, then one area per biome. */
export function WorldScene({ selfId, spectator, frozen }: WorldSceneProps) {
  const stage = useRoom((s) => s.stage);
  const players = useRoom((s) => s.players);
  const self = selfId ? players[selfId] : undefined;
  const inBiomes = stage === "biomes";

  // Which biomes to draw: all for the host, only your own for a player.
  const biomes: BiomeDef[] = !inBiomes
    ? []
    : spectator
      ? BIOMES
      : BIOMES.filter((b) => b.id === self?.placement?.biome);

  const visible = Object.values(players).filter((p) => {
    if (!p.connected && p.id !== selfId) return false;
    if (!inBiomes) return true;
    if (!p.placement) return false;
    return spectator || p.placement.biome === self?.placement?.biome;
  });

  const shadowExtent = inBiomes && spectator ? 70 : 22;
  // Players see their biome's own sky and lighting; the host's overview uses the default.
  const myBiome = inBiomes && !spectator ? self?.placement?.biome : undefined;
  const env = (myBiome && BIOME_ENVS[myBiome]) || DEFAULT_ENV;
  // Keep the sun's shadows centered on whatever this viewer is looking at.
  const focus = myBiome ? biomeArea(myBiome) : { cx: 0, cz: 0 };

  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      camera={{ position: spectator ? [0, 26, 22] : [0, 9, 11], fov: spectator ? 45 : 50 }}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
    >
      <color attach="background" args={[env.background]} />
      <fog attach="fog" args={spectator ? [BG, 120, 260] : env.fog} />
      <hemisphereLight args={env.hemisphere} />
      {env.stars ? (
        <Stars radius={170} depth={50} count={3000} factor={5} saturation={0.4} fade speed={0.4} />
      ) : null}
      <Sun focusX={focus.cx} focusZ={focus.cz} extent={shadowExtent} {...env.sun} />

      {spectator ? <SpectatorCamera wide={inBiomes} /> : null}

      {inBiomes ? (
        biomes.map((b) => {
          const Scene = BIOME_SCENES[b.id];
          return Scene ? (
            <Scene key={b.id} area={biomeArea(b.id)} immersive={!spectator} />
          ) : (
            <Room
              key={b.id}
              area={biomeArea(b.id)}
              floor={b.colors.floor}
              wall={b.colors.wall}
              grid={b.colors.wall}
              label={b.name}
              labelColor={b.colors.accent}
            />
          );
        })
      ) : (
        <Room area={LOBBY_AREA} floor="#ffffff" wall="#e4e6ec" grid="#d3d7e0" />
      )}

      {visible.map((p) => renderPlayer(p, { selfId, spectator, frozen, stage }))}

      {env.bloom ? (
        // Neon and lit windows (colors pushed above 1.0) glow; everything else is untouched.
        <EffectComposer>
          <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.85} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      ) : null}
    </Canvas>
  );
}

/** Directional sun aimed at (and casting shadows around) the area being viewed. */
function Sun({
  focusX,
  focusZ,
  extent,
  color,
  intensity,
  shadows,
}: {
  focusX: number;
  focusZ: number;
  extent: number;
  color: string;
  intensity: number;
  shadows: boolean;
}) {
  const light = useRef<DirectionalLight>(null);
  const target = useMemo(() => new Object3D(), []);
  useEffect(() => {
    target.position.set(focusX, 0, focusZ);
    target.updateMatrixWorld();
    if (light.current) light.current.target = target;
  }, [target, focusX, focusZ]);
  return (
    <directionalLight
      ref={light}
      key={`${extent}:${focusX}:${focusZ}`}
      position={[focusX + 14, 24, focusZ + 10]}
      color={color}
      intensity={intensity}
      castShadow={shadows}
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.03}
      shadow-camera-left={-extent}
      shadow-camera-right={extent}
      shadow-camera-top={extent}
      shadow-camera-bottom={-extent}
      shadow-camera-far={80}
    />
  );
}

function renderPlayer(
  p: PlayerState,
  ctx: { selfId?: string | null; spectator?: boolean; frozen?: boolean; stage: Stage },
) {
  if (p.id === ctx.selfId && !ctx.spectator) {
    const stage = ctx.stage === "biomes" ? "biomes" : "lobby";
    const area = playerArea(stage, p.placement);
    // Remount when moving into a biome so the player and camera jump to the new spawn.
    return (
      <LocalPlayer
        key={`${p.id}:${stage}:${p.placement?.biome ?? ""}`}
        player={p}
        area={area}
        obstacles={stage === "biomes" && p.placement ? obstaclesFor(p.placement.biome) : undefined}
        rig={stage === "biomes" && p.placement ? BIOME_CAMERAS[p.placement.biome] : undefined}
        frozen={ctx.frozen || ctx.stage === "sorting"}
      />
    );
  }
  return (
    <RemotePlayer
      key={`${p.id}:${p.placement?.biome ?? "lobby"}`}
      player={p}
      labelScale={ctx.spectator ? 2.4 : 1}
    />
  );
}

/** Width and depth (world units) the host camera must fit, including walls. */
function worldExtent(wide: boolean) {
  if (!wide) return { width: LOBBY_AREA.half * 2 + 2, depth: LOBBY_AREA.half * 2 + 2 };
  const { minX, maxX, halfDepth } = biomesExtent();
  return { width: maxX - minX, depth: halfDepth * 2, centerX: (minX + maxX) / 2 };
}

/** Viewing direction for the host camera: high and slightly in front. */
const SPECTATOR_DIRECTION = new Vector3(0, 1, 0.85).normalize();

/** Host camera: frames the lobby, then pulls back so every biome fits on screen. */
function SpectatorCamera({ wide }: { wide: boolean }) {
  const { camera, size } = useThree();
  const target = useRef(new Vector3());
  useFrame((_, delta) => {
    const { width, depth } = worldExtent(wide);
    const vfov = ((camera as PerspectiveCamera).fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (size.width / size.height));
    // Far enough that the whole width and depth fit, with a little breathing room.
    const distance =
      1.25 * Math.max(width / 2 / Math.tan(hfov / 2), depth / 2 / Math.tan(vfov / 2) + depth / 2);
    target.current.copy(SPECTATOR_DIRECTION).multiplyScalar(distance);
    camera.position.lerp(target.current, damp(2.5, Math.min(delta, 0.1)));
    camera.lookAt(0, 0, 0);
  });
  return null;
}

type RoomProps = {
  area: Area;
  floor: string;
  wall: string;
  grid: string;
  /** Big floating sign at the back of the room. */
  label?: string;
  labelColor?: string;
};

/** A plain walled square. Phase 4 swaps biome rooms for fully themed scenes. */
function Room({ area, floor, wall, grid, label, labelColor }: RoomProps) {
  const size = area.half * 2 + 2;
  const half = size / 2;
  const walls: Array<{ pos: [number, number, number]; dims: [number, number, number] }> = [
    { pos: [0, WALL_HEIGHT / 2, -half], dims: [size, WALL_HEIGHT, WALL_THICKNESS] },
    { pos: [0, WALL_HEIGHT / 2, half], dims: [size, WALL_HEIGHT, WALL_THICKNESS] },
    { pos: [-half, WALL_HEIGHT / 2, 0], dims: [WALL_THICKNESS, WALL_HEIGHT, size] },
    { pos: [half, WALL_HEIGHT / 2, 0], dims: [WALL_THICKNESS, WALL_HEIGHT, size] },
  ];
  return (
    <group position={[area.cx, 0, area.cz]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color={floor} roughness={1} />
      </mesh>
      <Grid
        position={[0, 0.01, 0]}
        args={[size, size]}
        cellSize={1}
        cellThickness={0.6}
        cellColor={grid}
        sectionSize={5}
        sectionThickness={1}
        sectionColor={grid}
        fadeDistance={80}
        infiniteGrid={false}
      />
      {walls.map((w, i) => (
        <mesh key={i} position={w.pos} castShadow receiveShadow>
          <boxGeometry args={w.dims} />
          <meshStandardMaterial color={wall} roughness={0.9} />
        </mesh>
      ))}
      {label ? (
        <NameTag
          text={label}
          color={labelColor ?? "#0f1222"}
          textColor="#ffffff"
          highlight
          y={4.5}
          z={-half + 1}
          scale={4}
        />
      ) : null}
    </group>
  );
}
