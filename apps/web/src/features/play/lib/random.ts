/**
 * The RNG used by the play feature. Tests can install a deterministic
 * generator (see `createSeededRng`).
 */
let current: () => number = Math.random;

export function setRng(next: () => number): void {
  current = next;
}

export function rng(): number {
  return current();
}

/** Small deterministic PRNG (mulberry32) for tests. */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
