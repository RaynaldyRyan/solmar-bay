// Seeded random numbers (mulberry32) so the world, traffic and screenshots are
// reproducible from a seed. Every system that needs randomness takes one of these.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick one element of an array with the given rng.
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Uniform float in [min, max).
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// Uniform integer in [min, max] inclusive.
export function intRange(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// Read ?seed= from the URL, defaulting to 1.
export function seedFromUrl() {
  const v = new URLSearchParams(location.search).get('seed');
  const n = v === null ? NaN : parseInt(v, 10);
  return Number.isFinite(n) ? n : 1;
}
