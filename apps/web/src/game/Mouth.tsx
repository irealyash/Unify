import type { MouthId } from "@unify/shared";

/** Shared ink colour with the rest of the character. */
const INK = "#46382f";

/**
 * The cat mouth is two arcs joined end to end, so each lobe is only half as
 * wide as the mouth. It tracks the base width directly now that the base is
 * wide enough for the lobes to stay taller than the stroke is thick.
 */
const CAT_WIDEN = 1;
/** The smile reads better a little broader than the other strokes. */
const SMILE_WIDEN = 1.25;
/** The open "o" is a ring, so it needs less span than a stroke to read. */
const CIRCLE_R = 0.6;

type MouthProps = {
  mouth: MouthId;
  /** Half the mouth's width. */
  w: number;
  /** Stroke thickness (radius of the tube/capsule). */
  r: number;
  /**
   * Front surface of the face, `dy` above the mouth's anchor. Each shape
   * places itself at the depth matching its own height: the face curves away
   * fast enough across the mouth that one flat plane would either bury the
   * tall shapes or leave the low ones floating.
   */
  depth: (dy: number) => number;
};

/**
 * The character's mouth, drawn in the XY plane so it can be dropped straight
 * onto the face group (which already faces +Z).
 *
 * Curved mouths are partial torii: `torusGeometry` sweeps counter-clockwise
 * from +X, so each one is rotated to centre its arc where we want the bulge.
 *
 * Multi-arc mouths use a sweep of exactly PI. That puts both endpoints of
 * every arc back on the baseline (y = 0), which is what lets neighbouring
 * arcs meet flush instead of stepping past each other.
 */
export function Mouth({ mouth, w, r, depth }: MouthProps) {
  switch (mouth) {
    // An arc bulging downward: ends lift, middle dips.
    case "smile": {
      const rad = w * SMILE_WIDEN;
      return (
        <group position={[0, 0, depth(-rad * 0.79)]}>
          <Arc radius={rad} tube={r} sweep={Math.PI * 0.62} center={-Math.PI / 2} />
        </group>
      );
    }

    // The same arc flipped to bulge upward.
    case "frown":
      return (
        <group position={[0, 0, depth(w * 0.79)]}>
          <Arc radius={w} tube={r} sweep={Math.PI * 0.62} center={Math.PI / 2} />
        </group>
      );

    case "flat":
      return (
        <mesh position={[0, 0, depth(0)]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[r, Math.max(0.001, w * 1.7 - r * 2), 3, 8]} />
          <meshStandardMaterial color={INK} roughness={0.5} />
        </mesh>
      );

    // A small open "o". A ring rather than a disc, to match the other mouths,
    // which are all strokes.
    case "circle": {
      const rad = w * CIRCLE_R;
      return (
        <mesh position={[0, -rad, depth(-rad)]}>
          <torusGeometry args={[rad, r, 8, 28]} />
          <meshStandardMaterial color={INK} roughness={0.5} />
        </mesh>
      );
    }

    // Two half-circles side by side, like a cat's "w".
    case "cat": {
      const half = w * CAT_WIDEN;
      const rad = half / 2;
      return (
        <group position={[0, 0, depth(-rad * 0.5)]}>
          {[-1, 1].map((side) => (
            <group key={side} position={[(side * half) / 2, 0, 0]}>
              <Arc radius={rad} tube={r} sweep={Math.PI} center={-Math.PI / 2} />
            </group>
          ))}
        </group>
      );
    }

    // Two strokes meeting in a soft V.
    case "v":
    default: {
      const h = w * 1.1;
      const arm = Math.hypot(w, h);
      const tilt = Math.atan2(w, h);
      return (
        <group position={[0, 0, depth(h * 0.5)]}>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[(side * w) / 2, h / 2, 0]} rotation={[0, 0, -side * tilt]}>
              <capsuleGeometry args={[r, Math.max(0.001, arm - r * 2), 3, 8]} />
              <meshStandardMaterial color={INK} roughness={0.5} />
            </mesh>
          ))}
        </group>
      );
    }
  }
}

/**
 * A length of stroke bent into an arc. `center` is the angle the arc's middle
 * points toward, so -PI/2 bulges downward and +PI/2 upward.
 */
function Arc({
  radius,
  tube,
  sweep,
  center,
}: {
  radius: number;
  tube: number;
  sweep: number;
  center: number;
}) {
  return (
    <mesh rotation={[0, 0, center - sweep / 2]}>
      <torusGeometry args={[radius, tube, 8, 24, sweep]} />
      <meshStandardMaterial color={INK} roughness={0.5} />
    </mesh>
  );
}
