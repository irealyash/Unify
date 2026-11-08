/** Frame-rate independent smoothing factor for `lerp(current, target, factor)`. */
export function damp(lambda: number, delta: number) {
  return 1 - Math.exp(-lambda * delta);
}

/** Lerps between two angles along the shortest way around the circle. */
export function lerpAngle(from: number, to: number, t: number) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
}
