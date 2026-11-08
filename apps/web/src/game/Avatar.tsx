import { Outlines } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Group, Mesh, Vector3 } from "three";
import { MOVE_SPEED, type HatId, type MouthId } from "@unify/shared";
import { Hat, hatHeight } from "./Hat";
import { damp } from "./math";
import { Mouth } from "./Mouth";
import { NameTag } from "./NameTag";

type AvatarProps = {
  name: string;
  color: string;
  hat?: HatId;
  mouth?: MouthId;
  isSelf?: boolean;
  /** Being hovered or viewed: brightens the ring on the ground. */
  highlighted?: boolean;
  /** Enlarges the name tag, e.g. for the far-away host camera. */
  labelScale?: number;
};

/** Outline, eye and mouth colour — the palette's dark brown (--background). */
const INK = "#46382f";

/**
 * Proportions measured from the character drawing, as fractions of the body's
 * own width/height, so the figure stays on-model at any size.
 *
 *   body 1.234 w:h, eye 0.058w x 0.136h at 0.345 out, mouth 0.079w wide
 *   and 0.338 below centre, feet 0.239w x 0.130h at 0.469 out
 */
const BODY_HH = 0.58;
/** The drawing's width. Feet are sized off this so narrowing the body below
 *  doesn't shrink them too. */
const BODY_HW_REF = BODY_HH * 1.234;
/** Deliberately narrower than the drawing, then widened back out a touch.
 *  Net effect is a near-circular silhouette rather than the drawing's wide blob. */
const NARROW = 1.2;
const WIDEN = 1.05;
const BODY_HW = (BODY_HW_REF / NARROW) * WIDEN;
/** Depth sits between width and height so it reads as a plump blob, not a disc. */
const BODY_HD = (BODY_HW + BODY_HH) / 2;

/** The body floats just clear of the ground; the feet poke out below it. */
const BODY_BOTTOM = BODY_HH * 2 * 0.058;
const BODY_Y = BODY_BOTTOM + BODY_HH;

const EYE_RX = BODY_HW * 0.058;
const EYE_STRETCH = (BODY_HH * 0.136) / (BODY_HW * 0.058);
const EYE_X = BODY_HW * 0.345;

const MOUTH_DROP = BODY_HH * 0.27;
const MOUTH_HW = BODY_HW * 0.134;
const MOUTH_R = BODY_HW * 0.022;

/** Feet are drawn bigger than the reference, and keyed to the drawing's width
 *  so they stay the same size regardless of how far the body is narrowed. */
const FOOT_SCALE = 1.6;
/** Chunkier than the drawing: taller and rounder from above, same width. */
const FOOT_THICK = 1.45;
/** Extra height again. The foot's underside is pinned to the ground, so this
 *  all grows upward, burying more of each foot in the body. */
const FOOT_REACH = 1.45;
const FOOT_HW = BODY_HW_REF * 0.239 * FOOT_SCALE;
const FOOT_HH = BODY_HH * 0.13 * FOOT_SCALE * FOOT_THICK * FOOT_REACH;
const FOOT_HD = FOOT_HW * 0.95;
/** Tucked in from the drawing's 0.469 so each foot's top is swallowed by the
 *  body, making the pair read as attached rather than as loose nubs. */
const FOOT_X = BODY_HW * 0.51;

/** Surface z of the body ellipsoid at (x, y), so the face hugs the curve. */
const surfaceZ = (x: number, dy: number) =>
  BODY_HD * Math.sqrt(Math.max(0, 1 - (x / BODY_HW) ** 2 - (dy / BODY_HH) ** 2));

const EYE_Z = surfaceZ(EYE_X, 0) + 0.01;
/**
 * Depth for a point `dy` above the mouth's anchor. The face curves away
 * sharply over the mouth's height, so a single flat plane either buries the
 * tall shapes (frown, v) or leaves the low ones (smile) floating — each shape
 * asks for its own z instead.
 */
const mouthDepth = (dy: number) => surfaceZ(0, -MOUTH_DROP + dy) + 0.012;

/** Stride cadence: radians of gait phase per world unit travelled. Drives the
 *  bob, squash and waddle as well as the steps, so they stay in time. */
const STRIDE_PER_UNIT = 2.2;
/** How far a foot slides fore and aft, and how high it lifts, mid-step. Kept
 *  short so a foot never travels out from under the body it's joined to. */
const STEP = BODY_HW * 0.14;
const LIFT = FOOT_HH * 0.5;
/** Vertical travel of the body over a stride. */
const BOB = BODY_HH * 0.0225;
/** Squash and stretch, as a fraction of body height. */
const SQUASH = 0.025;
/** Side-to-side waddle roll at full speed, in radians. */
const WADDLE = 0.016;
/** Forward lean at full speed, in radians. */
const LEAN = 0.07;

/** Clearance between the name tag and whatever is highest — head or hat. */
const NAME_GAP = 0.46;

const tmpWorld = new Vector3();

/**
 * Squishy blob character. Local +Z is the front (where the face is).
 *
 * The walk cycle is driven by the avatar's own measured world speed rather
 * than a prop, so local players (keyboard-driven) and remote players
 * (interpolated toward a network pose) animate through the same path.
 */
export function Avatar({
  name,
  color,
  hat = "none",
  mouth = "v",
  isSelf,
  highlighted,
  labelScale = 1,
}: AvatarProps) {
  const root = useRef<Group>(null);
  const rig = useRef<Group>(null);
  const squish = useRef<Group>(null);
  const footL = useRef<Mesh>(null);
  const footR = useRef<Mesh>(null);

  const phase = useRef(0);
  const speed = useRef(0);
  const last = useRef<Vector3 | null>(null);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    if (!root.current || delta <= 0) return;

    // Measure how fast we're actually travelling through the world.
    root.current.getWorldPosition(tmpWorld);
    if (!last.current) {
      last.current = tmpWorld.clone();
      return;
    }
    const travelled = Math.hypot(tmpWorld.x - last.current.x, tmpWorld.z - last.current.z);
    last.current.copy(tmpWorld);

    // Smooth it: network interpolation arrives in uneven steps.
    speed.current += (travelled / delta - speed.current) * damp(10, delta);
    const gait = Math.min(speed.current / MOVE_SPEED, 1);

    // Cadence rises with speed, so a slow drift doesn't look like sprinting.
    phase.current += speed.current * STRIDE_PER_UNIT * delta;
    const p = phase.current;
    const step = Math.sin(p) * gait;

    // Stubby feet shuffle fore and aft, lifting only on the forward half.
    if (footL.current) {
      footL.current.position.z = step * STEP;
      footL.current.position.y = FOOT_HH + Math.max(0, step) * LIFT;
    }
    if (footR.current) {
      footR.current.position.z = -step * STEP;
      footR.current.position.y = FOOT_HH + Math.max(0, -step) * LIFT;
    }

    // Two footfalls per stride, so the body peaks at midstance and dips as the
    // feet split — twice the stride frequency.
    const beat = Math.cos(p * 2) * gait;
    if (rig.current) {
      rig.current.position.y = beat * BOB;
      rig.current.rotation.z = Math.sin(p) * WADDLE * gait;
      rig.current.rotation.x = gait * LEAN;
    }

    if (squish.current) {
      // Squash and stretch: tall at the top of the bounce, flattened at the
      // bottom, widening as it flattens so the volume reads as constant.
      // Standing still, breathe instead.
      const idle = (1 - gait) * Math.sin(state.clock.elapsedTime * 1.1) * 0.005;
      const s = beat * SQUASH + idle;
      squish.current.scale.set(1 - s * 0.6, 1 + s, 1 - s * 0.6);
    }
  });

  return (
    <group ref={root}>
      <group ref={rig}>
        {/* Pivoted at the body's underside so squashing flattens it onto the
            ground rather than sinking it through. */}
        <group ref={squish} position={[0, BODY_BOTTOM, 0]}>
          <mesh position={[0, BODY_HH, 0]} scale={[BODY_HW, BODY_HH, BODY_HD]} castShadow>
            <sphereGeometry args={[1, 48, 32]} />
            <meshStandardMaterial color={color} roughness={0.7} />
            <Outlines thickness={0.035} color={INK} />
          </mesh>

          {[-EYE_X, EYE_X].map((x) => (
            <mesh key={x} position={[x, BODY_HH, EYE_Z]} scale={[1, EYE_STRETCH, 0.5]}>
              <sphereGeometry args={[EYE_RX, 20, 16]} />
              <meshStandardMaterial color={INK} roughness={0.5} />
            </mesh>
          ))}

          <group position={[0, BODY_HH - MOUTH_DROP, 0]}>
            <Mouth mouth={mouth} w={MOUTH_HW} r={MOUTH_R} depth={mouthDepth} />
          </group>

          <Hat hat={hat} hw={BODY_HW} hh={BODY_HH} hd={BODY_HD} cy={BODY_HH} />
        </group>

        {[
          { ref: footL, x: -FOOT_X },
          { ref: footR, x: FOOT_X },
        ].map(({ ref, x }) => (
          <mesh
            key={x}
            ref={ref}
            position={[x, FOOT_HH, 0]}
            scale={[FOOT_HW, FOOT_HH, FOOT_HD]}
            castShadow
          >
            <sphereGeometry args={[1, 20, 14]} />
            <meshStandardMaterial color={color} roughness={0.7} />
            <Outlines thickness={0.035} color={INK} />
          </mesh>
        ))}
      </group>

      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[BODY_HW * 1.08, BODY_HW * 1.32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={isSelf || highlighted ? 0.9 : 0.35} />
      </mesh>

      <NameTag
        text={isSelf ? `${name} (you)` : name}
        color={color}
        highlight={isSelf}
        scale={labelScale}
        y={BODY_Y + BODY_HH + hatHeight(hat, BODY_HW, BODY_HH) + NAME_GAP + (labelScale - 1) * 0.3}
      />
    </group>
  );
}
