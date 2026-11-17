// Seeded random numbers: every run with the same seed builds the same city.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    range(a, b) { return a + (b - a) * next(); },
    int(a, b) { return Math.floor(a + (b - a + 1) * next()); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    chance(p) { return next() < p; },
    sign() { return next() < 0.5 ? -1 : 1; },
  };
}

// Reads ?seed=N from the page URL, default 1. Screenshot runs pass seed=1.
export function seedFromUrl() {
  try {
    const v = new URLSearchParams(window.location.search).get('seed');
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 1;
  } catch (e) { return 1; }
}

export function shotFromUrl() {
  try { return new URLSearchParams(window.location.search).get('shot') || ''; }
  catch (e) { return ''; }
}
