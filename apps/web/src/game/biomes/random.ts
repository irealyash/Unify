/**
 * Small seeded PRNG (mulberry32). Biome layouts use it so every player, and the host,
 * sees exactly the same city without the server having to send any layout data.
 */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min: number, max: number) => min + next() * (max - min),
    pick: <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)]!,
  };
}

export type Rng = ReturnType<typeof createRng>;
