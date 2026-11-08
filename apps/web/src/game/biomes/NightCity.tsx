import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  Color,
  DoubleSide,
  MeshStandardMaterial,
  type CanvasTexture,
  type Group,
  type Material,
  type Mesh,
  type MeshBasicMaterial,
} from "three";
import type { Area } from "@unify/shared";
import { createRng } from "./random";
import { createNeonTextTexture, createWindowTexture } from "./textures";

/**
 * Night City: a small neon downtown block for fast-paced, ambitious groups.
 *
 * Everything is in local coordinates around the biome's center; players walk within
 * ±area.half. Tall buildings only line the back and sides so the follow camera (which
 * sits in front of the player, toward +z) never ends up inside one.
 */

const NEON = {
  pink: "#ff3cac",
  cyan: "#2de2ff",
  violet: "#8b5cff",
  amber: "#ffb347",
  red: "#ff3b4e",
};

/** A neon color pushed above 1.0 so the bloom pass picks it up. */
function glow(hex: string, strength = 3) {
  return new Color(hex).multiplyScalar(strength);
}

const ROAD_HALF = 3;
const GROUND_SIZE = 44;

export function NightCity({ area }: { area: Area }) {
  const edge = area.half + 1.2; // buildings start just outside the walkable square
  return (
    <group position={[area.cx, 0, area.cz]}>
      <Streets />
      <Skyline edge={edge} />
      <Signs edge={edge} />
      {(
        [
          [-9.6, -9.6],
          [9.6, -9.6],
          [-9.6, 9.6],
          [9.6, 9.6],
        ] as const
      ).map(([x, z]) => (
        <StreetLamp key={`${x},${z}`} position={[x, 0, z]} facing={x < 0 ? 1 : -1} />
      ))}
      <Car position={[-8.5, 0, -1.6]} rotation={0} color="#ff3cac" />
      <Car position={[7.5, 0, 1.6]} rotation={Math.PI} color="#e8ecff" />
      <Car position={[1.6, 0, -8]} rotation={-Math.PI / 2} color="#2de2ff" />
      <VendingMachine position={[-11.4, 0, -11.6]} color={NEON.cyan} />
      <VendingMachine position={[11.4, 0, -11.6]} color={NEON.pink} />
      <Hologram />
    </group>
  );
}

// ── Ground ───────────────────────────────────────────────────────────────────

function Streets() {
  const dashes: Array<[number, number, number, number]> = [];
  for (let p = -20; p <= 20; p += 2.6) {
    if (Math.abs(p) < ROAD_HALF + 2) continue;
    dashes.push([p, 0, 1.2, 0.14]); // along the x road
    dashes.push([0, p, 0.14, 1.2]); // along the z road
  }

  const crosswalk: Array<[number, number, number, number]> = [];
  for (let s = -ROAD_HALF + 0.5; s <= ROAD_HALF - 0.4; s += 0.85) {
    for (const side of [-1, 1]) {
      crosswalk.push([side * (ROAD_HALF + 1.2), s, 1.5, 0.45]);
      crosswalk.push([s, side * (ROAD_HALF + 1.2), 0.45, 1.5]);
    }
  }

  const blocks = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx, sz] as const));
  const blockSize = 11;
  const blockCenter = ROAD_HALF + 0.5 + blockSize / 2;

  return (
    <>
      {/* Wet-looking asphalt: a bit metallic so lamps and neon reflect softly. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshStandardMaterial color="#171a2e" roughness={0.45} metalness={0.35} />
      </mesh>

      {blocks.map(([sx, sz]) => (
        <group key={`${sx},${sz}`} position={[sx * blockCenter, 0, sz * blockCenter]}>
          <mesh position={[0, 0.03, 0]} receiveShadow>
            <boxGeometry args={[blockSize, 0.06, blockSize]} />
            <meshStandardMaterial color="#252943" roughness={0.85} />
          </mesh>
          {/* Curb lines facing the roads. */}
          <mesh position={[(-sx * blockSize) / 2, 0.07, 0]}>
            <boxGeometry args={[0.18, 0.04, blockSize]} />
            <meshStandardMaterial color="#4a5080" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.07, (-sz * blockSize) / 2]}>
            <boxGeometry args={[blockSize, 0.04, 0.18]} />
            <meshStandardMaterial color="#4a5080" roughness={0.6} />
          </mesh>
        </group>
      ))}

      {dashes.map(([x, z, w, d], i) => (
        <mesh key={`d${i}`} position={[x, 0.012, z]}>
          <boxGeometry args={[w, 0.01, d]} />
          <meshStandardMaterial color="#ffcf5a" emissive="#ffb020" emissiveIntensity={0.35} />
        </mesh>
      ))}
      {crosswalk.map(([x, z, w, d], i) => (
        <mesh key={`c${i}`} position={[x, 0.012, z]}>
          <boxGeometry args={[w, 0.01, d]} />
          <meshStandardMaterial color="#d9dcf0" emissive="#ffffff" emissiveIntensity={0.08} />
        </mesh>
      ))}
    </>
  );
}

// ── Buildings ────────────────────────────────────────────────────────────────

type Building = {
  x: number;
  z: number;
  sx: number;
  sz: number;
  h: number;
  wall: string;
  windows: CanvasTexture;
};

const WALL_COLORS = ["#1b1e36", "#20213a", "#191c30", "#24223f", "#1c2238"];

function layoutBuildings(edge: number): Building[] {
  const rng = createRng(7);
  const baseTextures = [0, 1, 2].map(() => createWindowTexture(rng));
  const out: Building[] = [];

  const add = (x: number, z: number, sx: number, sz: number, h: number) => {
    const windows = rng.pick(baseTextures).clone();
    windows.needsUpdate = true;
    windows.repeat.set(Math.max(sx, sz) / 2.6, h / 3.2);
    windows.offset.set(rng.next(), rng.next());
    out.push({ x, z, sx, sz, h, wall: rng.pick(WALL_COLORS), windows });
  };

  // Back row: the tall skyline you face when you arrive.
  for (let x = -edge - 6; x < edge + 6; ) {
    const w = rng.range(3, 5.2);
    const d = rng.range(4, 6.5);
    add(x + w / 2, -(edge + d / 2), w, d, rng.range(10, 24));
    x += w + rng.range(0.2, 0.6);
  }

  // Sides: shorter toward the front so the camera can see over them.
  for (const side of [-1, 1]) {
    for (let z = -edge; z < edge * 0.45; ) {
      const len = rng.range(3, 5);
      const d = rng.range(4, 6);
      const toFront = (z + edge) / (edge * 1.45);
      add(side * (edge + d / 2), z + len / 2, d, len, rng.range(6, 15) * (1 - toFront * 0.55));
      z += len + rng.range(0.2, 0.6);
    }
  }
  return out;
}

function Skyline({ edge }: { edge: number }) {
  const buildings = useMemo(() => layoutBuildings(edge), [edge]);
  const roof = useMemo(() => new MeshStandardMaterial({ color: "#14162a", roughness: 0.9 }), []);
  const materials = useMemo(
    () =>
      buildings.map((b) => {
        const facade = new MeshStandardMaterial({
          color: b.wall,
          roughness: 0.75,
          metalness: 0.1,
          emissive: "#ffffff",
          emissiveMap: b.windows,
          emissiveIntensity: 1.25,
        });
        // Box faces: +x, -x, +y (roof), -y, +z, -z.
        return [facade, facade, roof, roof, facade, facade] as Material[];
      }),
    [buildings, roof],
  );

  useEffect(
    () => () => {
      buildings.forEach((b) => b.windows.dispose());
      materials.forEach((m) => m[0]!.dispose());
      roof.dispose();
    },
    [buildings, materials, roof],
  );

  const tallest = buildings.reduce((a, b) => (b.h > a.h ? b : a));

  return (
    <>
      {buildings.map((b, i) => (
        <mesh
          key={i}
          position={[b.x, b.h / 2, b.z]}
          material={materials[i]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[b.sx, b.h, b.sz]} />
        </mesh>
      ))}
      <Antenna position={[tallest.x, tallest.h, tallest.z]} />
    </>
  );
}

function Antenna({ position }: { position: [number, number, number] }) {
  const light = useRef<MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!light.current) return;
    const on = Math.sin(clock.elapsedTime * 3) > 0.2;
    light.current.color.copy(on ? glow(NEON.red, 5) : glow(NEON.red, 0.4));
  });
  return (
    <group position={position}>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.05, 0.08, 3.2, 6]} />
        <meshStandardMaterial color="#3a3f60" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3.3, 0]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshBasicMaterial ref={light} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ── Neon ─────────────────────────────────────────────────────────────────────

function NeonText({
  text,
  color,
  height,
  vertical,
  ...props
}: {
  text: string;
  color: string;
  height: number;
  vertical?: boolean;
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  const { texture, aspect } = useMemo(
    () => createNeonTextTexture(text, color, vertical),
    [text, color, vertical],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh {...props}>
      <planeGeometry args={[height * aspect, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        side={DoubleSide}
        toneMapped={false}
        color={glow("#ffffff", 2.2)}
      />
    </mesh>
  );
}

function NeonStrip({
  color,
  size,
  position,
}: {
  color: string;
  size: [number, number, number];
  position: [number, number, number];
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshBasicMaterial color={glow(color, 3.2)} toneMapped={false} />
    </mesh>
  );
}

function Signs({ edge }: { edge: number }) {
  const front = -edge + 0.08; // just in front of the back row
  return (
    <>
      {/* The biome's name, on a dark billboard above the back street. */}
      <group position={[0, 5.4, front + 0.3]}>
        <mesh position={[0, 0, -0.08]}>
          <boxGeometry args={[11.5, 3, 0.12]} />
          <meshStandardMaterial color="#0c0e1d" roughness={0.6} />
        </mesh>
        <NeonText text="NIGHT CITY" color={NEON.pink} height={2.4} position={[0, 0, 0]} />
        <NeonStrip color={NEON.cyan} size={[11.5, 0.08, 0.06]} position={[0, -1.55, 0]} />
        <NeonStrip color={NEON.cyan} size={[11.5, 0.08, 0.06]} position={[0, 1.55, 0]} />
        {/* Legs so the billboard reads as standing on the street, not floating. */}
        {[-4.8, 4.8].map((x) => (
          <mesh key={x} position={[x, -3.2, -0.1]}>
            <boxGeometry args={[0.18, 3.4, 0.18]} />
            <meshStandardMaterial color="#2c3150" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
      </group>

      <NeonText
        text="NOODLES"
        color={NEON.amber}
        height={4.6}
        vertical
        position={[-edge + 0.1, 4.6, -6]}
        rotation={[0, Math.PI / 2, 0]}
      />
      <NeonText
        text="24/7"
        color={NEON.cyan}
        height={1.4}
        position={[edge - 0.1, 3.6, -3.5]}
        rotation={[0, -Math.PI / 2, 0]}
      />
      <NeonText
        text="ARCADE"
        color={NEON.violet}
        height={1.3}
        position={[-8.5, 3.2, front]}
      />
      <NeonText
        text="OPEN"
        color={NEON.red}
        height={0.9}
        position={[8.8, 2.4, front]}
      />

      {/* Vertical accent strips along a few facades. */}
      <NeonStrip color={NEON.violet} size={[0.1, 9, 0.1]} position={[-4.5, 4.5, front]} />
      <NeonStrip color={NEON.cyan} size={[0.1, 12, 0.1]} position={[5.2, 6, front]} />
      <NeonStrip color={NEON.pink} size={[0.1, 6, 0.1]} position={[edge - 0.05, 3, -9]} />
      <NeonStrip color={NEON.cyan} size={[0.1, 6, 0.1]} position={[-edge + 0.05, 3, -1]} />
    </>
  );
}

// ── Street furniture ─────────────────────────────────────────────────────────

function StreetLamp({
  position,
  facing,
}: {
  position: [number, number, number];
  /** +1 if the arm points toward +x, -1 toward -x. */
  facing: 1 | -1;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 2.2, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.1, 4.4, 8]} />
        <meshStandardMaterial color="#2c3150" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[facing * 0.5, 4.35, 0]}>
        <boxGeometry args={[1.1, 0.08, 0.12]} />
        <meshStandardMaterial color="#2c3150" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[facing * 0.95, 4.22, 0]}>
        <boxGeometry args={[0.45, 0.12, 0.3]} />
        <meshBasicMaterial color={glow("#ffd9a0", 4)} toneMapped={false} />
      </mesh>
      <pointLight
        position={[facing * 0.95, 3.9, 0]}
        color="#ffcf9a"
        intensity={22}
        distance={11}
        decay={1.6}
      />
    </group>
  );
}

function Car({
  position,
  rotation,
  color,
}: {
  position: [number, number, number];
  rotation: number;
  color: string;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.48, 0]} castShadow>
        <boxGeometry args={[2.5, 0.55, 1.15]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[-0.15, 0.95, 0]} castShadow>
        <boxGeometry args={[1.35, 0.45, 1.02]} />
        <meshStandardMaterial color="#10132a" metalness={0.8} roughness={0.15} />
      </mesh>
      {[-0.8, 0.8].flatMap((x) =>
        [-0.55, 0.55].map((z) => (
          <mesh key={`${x},${z}`} position={[x, 0.22, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.16, 12]} />
            <meshStandardMaterial color="#0a0b14" roughness={0.9} />
          </mesh>
        )),
      )}
      {[-0.38, 0.38].map((z) => (
        <group key={z}>
          <mesh position={[1.26, 0.52, z]}>
            <boxGeometry args={[0.04, 0.12, 0.26]} />
            <meshBasicMaterial color={glow("#f2f6ff", 4)} toneMapped={false} />
          </mesh>
          <mesh position={[-1.26, 0.55, z]}>
            <boxGeometry args={[0.04, 0.1, 0.28]} />
            <meshBasicMaterial color={glow(NEON.red, 3)} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function VendingMachine({
  position,
  color,
}: {
  position: [number, number, number];
  color: string;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[1, 2, 0.8]} />
        <meshStandardMaterial color="#1d2140" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.15, 0.41]}>
        <planeGeometry args={[0.8, 1.4]} />
        <meshBasicMaterial color={glow(color, 1.6)} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Spinning holographic centerpiece floating above the intersection. */
function Hologram() {
  const outer = useRef<Mesh>(null);
  const inner = useRef<Mesh>(null);
  const group = useRef<Group>(null);
  useFrame(({ clock }, delta) => {
    if (outer.current) outer.current.rotation.y += delta * 0.4;
    if (inner.current) {
      inner.current.rotation.x += delta * 0.7;
      inner.current.rotation.y -= delta * 0.5;
    }
    if (group.current) group.current.position.y = 4.4 + Math.sin(clock.elapsedTime * 1.2) * 0.18;
  });
  return (
    <>
      <group ref={group} position={[0, 4.4, 0]}>
        <mesh ref={outer}>
          <icosahedronGeometry args={[1.15, 0]} />
          <meshBasicMaterial color={glow(NEON.cyan, 2.5)} wireframe toneMapped={false} />
        </mesh>
        <mesh ref={inner}>
          <octahedronGeometry args={[0.5, 0]} />
          <meshBasicMaterial color={glow(NEON.pink, 2.5)} toneMapped={false} />
        </mesh>
      </group>
      {/* Soft beam down to a glowing ring on the street. */}
      <mesh position={[0, 2.1, 0]}>
        <cylinderGeometry args={[0.35, 0.9, 4.2, 24, 1, true]} />
        <meshBasicMaterial
          color={NEON.cyan}
          transparent
          opacity={0.08}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.3, 1.5, 48]} />
        <meshBasicMaterial color={glow(NEON.cyan, 2)} toneMapped={false} />
      </mesh>
      {/* Lights the plaza where groups spawn, so avatars read clearly at night. */}
      <pointLight position={[0, 3.6, 0]} color="#8fe9ff" intensity={30} distance={14} decay={1.4} />
    </>
  );
}
