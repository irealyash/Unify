import { Grid, Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Vector3, type PerspectiveCamera } from "three";
import {
  BIOMES,
  LOBBY_AREA,
  biomeArea,
  playerArea,
  type Area,
  type BiomeDef,
  type BiomeId,
  type PlayerState,
  type Stage,
} from "@unify/shared";
import { NightCity } from "./biomes/NightCity";
import { LocalPlayer } from "./LocalPlayer";
import { damp } from "./math";
import { NameTag } from "./NameTag";
import { RemotePlayer } from "./RemotePlayer";
import { useRoom } from "./store";

const WALL_HEIGHT = 1.2;
const WALL_THICKNESS = 0.4;
const BG = "#f3f4f7";
const NIGHT_BG = "#070816";

/** Biomes with a finished themed scene. Others fall back to a plain tinted room. */
const BIOME_SCENES: Partial<Record<BiomeId, (props: { area: Area }) => React.JSX.Element>> = {
  night_city: NightCity,
};

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

  const shadowExtent = inBiomes && spectator ? 48 : 22;
  // Players standing in Night City see it at night; the host's overview stays in daylight.
  const night = inBiomes && !spectator && self?.placement?.biome === "night_city";
  const background = night ? NIGHT_BG : BG;

  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      camera={{ position: spectator ? [0, 26, 22] : [0, 9, 11], fov: spectator ? 45 : 50 }}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
    >
      <color attach="background" args={[background]} />
      <fog
        attach="fog"
        args={spectator ? [BG, 90, 200] : night ? [NIGHT_BG, 24, 62] : [BG, 30, 70]}
      />

      {night ? (
        <>
          <hemisphereLight args={["#6a7bff", "#151833", 0.85]} />
          <Stars radius={90} depth={40} count={2500} factor={3.5} saturation={0.4} fade speed={0.4} />
        </>
      ) : (
        <hemisphereLight args={["#ffffff", "#dfe2e8", 1.4]} />
      )}
      <directionalLight
        key={`${shadowExtent}:${night}`}
        position={[10, 18, 8]}
        color={night ? "#9fb4ff" : "#ffffff"}
        intensity={night ? 0.55 : 1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
      />

      {spectator ? <SpectatorCamera wide={inBiomes} /> : null}

      {inBiomes ? (
        biomes.map((b) => {
          const Scene = BIOME_SCENES[b.id];
          return Scene ? (
            <Scene key={b.id} area={biomeArea(b.id)} />
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

      {night ? (
        // Neon and lit windows (colors pushed above 1.0) glow; everything else is untouched.
        <EffectComposer>
          <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.85} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      ) : null}
    </Canvas>
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
  const first = biomeArea(BIOMES[0]!.id);
  const last = biomeArea(BIOMES[BIOMES.length - 1]!.id);
  return {
    width: last.cx - first.cx + BIOME_VISUAL_HALF * 2,
    depth: BIOME_VISUAL_HALF * 2,
  };
}

/**
 * How far a biome's scenery (ground, buildings, trees) reaches from its center. Larger than
 * the walkable area; biome scenes should stay within this so they don't overlap neighbours.
 */
const BIOME_VISUAL_HALF = 21;

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
