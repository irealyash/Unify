/**
 * Deterministic value noise, so every player (and the host) builds the same hills, plus a
 * GLSL twin for coloring ground in shaders.
 */

/** Smooth 2D value noise in [0, 1]. */
export function valueNoise(x: number, z: number) {
  const hash = (i: number, j: number) => {
    const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

/** Four octaves of value noise, roughly in [0, 1]. */
export function fbm(x: number, z: number) {
  let value = 0;
  let amp = 0.5;
  for (let i = 0; i < 4; i++) {
    value += amp * valueNoise(x, z);
    x *= 2.03;
    z *= 2.03;
    amp *= 0.5;
  }
  return value;
}

/** Hermite step between e0 and e1, like GLSL's smoothstep. */
export function smoothstep(e0: number, e1: number, v: number) {
  const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** GLSL noise for coloring (cs_noise, cs_fbm). */
export const NOISE_GLSL = /* glsl */ `
  float cs_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float cs_noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(cs_hash(i), cs_hash(i + vec2(1.0, 0.0)), u.x),
               mix(cs_hash(i + vec2(0.0, 1.0)), cs_hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float cs_fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * cs_noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
`;
