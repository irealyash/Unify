import { Outlines } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import type { HatId } from "@unify/shared";

/** Shared ink colour with the rest of the character. */
const INK = "#46382f";
const OUTLINE = 0.024;

type HatProps = {
  hat: HatId;
  /** Body half-width — hats are sized against this so they scale with the character. */
  hw: number;
  /** Body half-height. */
  hh: number;
  /** Body half-depth. */
  hd: number;
  /** Height of the body's centre, in the body's local space. */
  cy: number;
};

/**
 * Headwear, sized relative to the body so every piece stays in proportion.
 * Rendered inside the squashing group so hats squash along with the head.
 * Local +Z is the character's front.
 *
 * The body is a wide ellipsoid rather than a sphere, so anything that hugs
 * the skull (the headphone band, the propeller dome) is built round and then
 * scaled by hh/hw to sit on the real silhouette.
 */
export function Hat({ hat, hw, hh, hd, cy }: HatProps) {
  const top = cy + hh;
  const squash = hh / hw;
  /** Front surface of the body at (x, dy) — used to sit flat accessories on it. */
  const surfaceZ = (x: number, dy: number) =>
    hd * Math.sqrt(Math.max(0, 1 - (x / hw) ** 2 - (dy / hh) ** 2));

  switch (hat) {
    case "headphones": {
      const cupR = hh * 0.3;
      return (
        <group>
          {/* Band, bent round the skull */}
          <mesh position={[0, cy, 0]} scale={[1, squash, 1]}>
            <torusGeometry args={[hw * 1.04, hw * 0.05, 8, 40, Math.PI]} />
            <meshStandardMaterial color="#9aa0a8" roughness={0.5} metalness={0.2} />
            <Outlines thickness={OUTLINE} color={INK} />
          </mesh>
          {/* Ear cups, lying on their sides */}
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[side * hw * 0.99, cy - hh * 0.08, 0]}
              rotation={[0, 0, Math.PI / 2]}
              scale={[1, 1, 0.78]}
              castShadow
            >
              <cylinderGeometry args={[cupR, cupR, hw * 0.17, 20]} />
              <meshStandardMaterial color="#b4b9c0" roughness={0.6} />
              <Outlines thickness={OUTLINE} color={INK} />
            </mesh>
          ))}
        </group>
      );
    }

    case "bow": {
      const loop = hw * 0.3;
      return (
        <group position={[-hw * 0.44, top - hh * 0.02, hw * 0.14]} rotation={[0, 0, 0.35]}>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[side * loop * 0.85, 0, 0]}
              rotation={[0, 0, side * 0.55]}
              scale={[loop, loop * 0.72, loop * 0.5]}
              castShadow
            >
              <sphereGeometry args={[1, 18, 14]} />
              <meshStandardMaterial color="#f4a7c0" roughness={0.65} />
              <Outlines thickness={OUTLINE} color={INK} />
            </mesh>
          ))}
          {/* Trailing ribbons */}
          {[-1, 1].map((side) => (
            <mesh
              key={`tail-${side}`}
              position={[side * loop * 0.52, -loop * 0.8, 0]}
              rotation={[0, 0, side * 0.42]}
              scale={[loop * 0.3, loop * 0.6, loop * 0.3]}
              castShadow
            >
              <sphereGeometry args={[1, 14, 10]} />
              <meshStandardMaterial color="#efa0bb" roughness={0.65} />
              <Outlines thickness={OUTLINE} color={INK} />
            </mesh>
          ))}
          <mesh castShadow>
            <sphereGeometry args={[loop * 0.33, 16, 12]} />
            <meshStandardMaterial color="#e58aa9" roughness={0.65} />
            <Outlines thickness={OUTLINE} color={INK} />
          </mesh>
        </group>
      );
    }

    case "propeller": {
      // Four coloured panels make the dome; each is a quarter of a hemisphere.
      const panels = ["#c0392b", "#e8c252", "#3d7fd1", "#e8c252"];
      const domeR = (hw * 0.66) / 1.4;
      return (
        <group position={[0, top - hh * 0.06, 0]}>
          {panels.map((c, i) => (
            <mesh key={i} scale={[1, squash * 1.25, 1]} castShadow>
              <sphereGeometry
                args={[domeR, 16, 12, (i * Math.PI) / 2, Math.PI / 2, 0, Math.PI / 2]}
              />
              <meshStandardMaterial color={c} roughness={0.6} />
            </mesh>
          ))}
          {/* Bill. A real cap peak is a scoop projecting forward from the
              front of the crown, not a band round the head — as a ring it
              just read as two nubs at the sides. A half-disc swept across
              the front (-PI/2..PI/2 puts the flat edge at the back),
              squeezed in x so it is head-width rather than circular, and
              tipped so the tip rides up (negative Rx lifts the +Z edge). */}
          <group position={[0, domeR * 0.1, 0]} rotation={[-0.16, 0, 0]}>
            <mesh scale={[0.72, 1, 1]} castShadow>
              <cylinderGeometry
                args={[domeR * 1.5, domeR * 1.5, hw * 0.045, 28, 1, false, -Math.PI / 2, Math.PI]}
              />
              <meshStandardMaterial color="#2e8b3d" roughness={0.6} />
              <Outlines thickness={OUTLINE} color={INK} />
            </mesh>
          </group>
          <Propeller r={hw / 1.4} y={domeR * squash * 1.25 + hh * 0.04} />
        </group>
      );
    }

    case "flower": {
      const petal = hw * 0.21;
      // Anchor it to the actual surface: at 0.72 out it was sitting ~0.19
      // behind the skin and vanished entirely.
      const fx = -hw * 0.578;
      const fdy = hh * 0.45;
      const fz = surfaceZ(fx, fdy);
      return (
        <group
          position={[fx, cy + fdy, fz]}
          rotation={[0, Math.atan2(fx, fz), 0]}
        >
          {Array.from({ length: 5 }, (_, i) => {
            const a = (i / 5) * Math.PI * 2;
            return (
              <mesh
                key={i}
                position={[Math.cos(a) * petal * 1.0, Math.sin(a) * petal * 1.0, 0]}
                scale={[petal, petal, petal * 0.5]}
                castShadow
              >
                <sphereGeometry args={[1, 14, 10]} />
                <meshStandardMaterial color="#a78bfa" roughness={0.7} />
                <Outlines thickness={OUTLINE} color={INK} />
              </mesh>
            );
          })}
          <mesh position={[0, 0, petal * 0.3]} castShadow>
            <sphereGeometry args={[petal * 0.44, 14, 10]} />
            <meshStandardMaterial color="#f5f1ed" roughness={0.7} />
            <Outlines thickness={OUTLINE} color={INK} />
          </mesh>
        </group>
      );
    }

    case "party": {
      // Alternating wedges give the cone its stripes.
      const wedges = 6;
      const coneR = (hw * 0.4) / 1.15;
      const coneH = (hh * 1.0) / 1.15;
      return (
        <group position={[0, top - hh * 0.08, 0]} rotation={[0.1, 0, 0.12]}>
          {Array.from({ length: wedges }, (_, i) => (
            <mesh key={i} position={[0, coneH / 2, 0]} castShadow>
              <coneGeometry
                args={[coneR, coneH, 8, 1, false, (i * Math.PI * 2) / wedges, (Math.PI * 2) / wedges]}
              />
              <meshStandardMaterial color={i % 2 === 0 ? "#3d9fd1" : "#f5f1ed"} roughness={0.6} />
            </mesh>
          ))}
          {/* Star: three crossed bars read as a sparkle from any angle */}
          {[0, 1, 2].map((i) => (
            <mesh key={`s-${i}`} position={[0, coneH + hh * 0.08, 0]} rotation={[0, 0, (i * Math.PI) / 3]}>
              <boxGeometry args={[hw * 0.28, hw * 0.07, hw * 0.07]} />
              <meshStandardMaterial color="#f5f1ed" roughness={0.5} />
              <Outlines thickness={OUTLINE} color={INK} />
            </mesh>
          ))}
        </group>
      );
    }

    case "grad": {
      const board = hw * 0.95;
      const capR = hw * 0.46;
      return (
        <group position={[0, top - hh * 0.1, 0]}>
          {/* Skull cap under the board */}
          <mesh scale={[1, squash * 0.8, 1]} castShadow>
            <sphereGeometry args={[capR, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#3a3f55" roughness={0.7} />
            <Outlines thickness={OUTLINE} color={INK} />
          </mesh>
          {/* Mortarboard */}
          <mesh position={[0, capR * squash * 0.8, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <boxGeometry args={[board, hh * 0.07, board]} />
            <meshStandardMaterial color="#3a3f55" roughness={0.7} />
            <Outlines thickness={OUTLINE} color={INK} />
          </mesh>
          {/* Tassel: a button, a cord over the edge, then the tuft */}
          <mesh position={[0, capR * squash * 0.8 + hh * 0.06, 0]}>
            <sphereGeometry args={[hw * 0.06, 12, 8]} />
            <meshStandardMaterial color="#d8a93c" roughness={0.4} metalness={0.4} />
          </mesh>
          <mesh
            position={[board * 0.3, capR * squash * 0.8 + hh * 0.03, board * 0.3]}
            rotation={[0, 0, 0]}
          >
            <cylinderGeometry args={[hw * 0.02, hw * 0.02, hh * 0.1, 8]} />
            <meshStandardMaterial color="#d8a93c" roughness={0.4} metalness={0.4} />
          </mesh>
          <mesh position={[board * 0.42, capR * squash * 0.8 - hh * 0.16, board * 0.42]} castShadow>
            <cylinderGeometry args={[hw * 0.07, hw * 0.05, hh * 0.26, 10]} />
            <meshStandardMaterial color="#d8a93c" roughness={0.45} metalness={0.3} />
            <Outlines thickness={OUTLINE} color={INK} />
          </mesh>
        </group>
      );
    }

    case "none":
    default:
      return null;
  }
}

/** Two blades on a post, turning slowly. */
function Propeller({ r, y }: { r: number; y: number }) {
  const spin = useRef<Group>(null);
  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * 2.4;
  });

  return (
    <group position={[0, y, 0]}>
      <mesh>
        <cylinderGeometry args={[r * 0.035, r * 0.035, r * 0.14, 8]} />
        <meshStandardMaterial color="#555b66" roughness={0.5} />
      </mesh>
      <group ref={spin} position={[0, r * 0.09, 0]}>
        {[0, 1].map((i) => {
          const a = i * Math.PI;
          return (
            <mesh
              key={i}
              position={[Math.sin(a) * r * 0.3, 0, Math.cos(a) * r * 0.3]}
              rotation={[0, -a, 0]}
              scale={[r * 0.09, r * 0.028, r * 0.33]}
              castShadow
            >
              <sphereGeometry args={[1, 12, 8]} />
              <meshStandardMaterial color="#2f7fd0" roughness={0.55} />
              <Outlines thickness={OUTLINE} color={INK} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

/**
 * How far above the top of the head each hat reaches. The name tag sits a
 * fixed gap above this, so a tall hat (party cone, propeller) pushes the tag
 * up instead of being skewered by it.
 *
 * These mirror the geometry in `Hat` above — keep them in step when a hat's
 * proportions change.
 */
export function hatHeight(hat: HatId, hw: number, hh: number): number {
  const squash = hh / hw;
  switch (hat) {
    // Band is a torus of radius hw*1.04 (+ tube) squashed onto the skull.
    case "headphones":
      return Math.max(0, hw * 1.09 * squash - hh);
    // Loops sit just under the crown and reach up by about one loop.
    case "bow":
      return -hh * 0.02 + hw * 0.3 * 1.01;
    // Dome, then the post and blades on top of it.
    case "propeller": {
      const domeR = (hw * 0.66) / 1.4;
      return -hh * 0.06 + domeR * squash * 1.25 + hh * 0.04 + (hw / 1.4) * 0.12;
    }
    // Petals sit on the side of the head, below the crown.
    case "flower":
      return Math.max(0, hh * 0.45 + hw * 0.42 - hh);
    // The tallest by far: full cone plus the star above it.
    case "party":
      return -hh * 0.08 + hh / 1.15 + hh * 0.08 + hw * 0.14;
    // Skull cap, board, and the tassel button on top.
    case "grad":
      return -hh * 0.1 + hw * 0.46 * squash * 0.8 + hh * 0.07 + hw * 0.06;
    case "none":
    default:
      return 0;
  }
}
