// Day cycle: the clock starts at dusk (18:24) so the neon reads, then rolls
// through night, dawn and a full day. Exposes the sun direction and the
// light colors the renderer and sky use each frame.
import { CFG, clamp, lerp } from './config.js';

const KEYFRAMES = [
  // hour, sun elevation (deg), sun color, sky top, sky horizon, fog, ambient
  { h: 0,  el: -25, sun: 0x334466, top: 0x0b1026, hor: 0x1b2340, fog: 0x141a2e, amb: 0.35 },
  { h: 5,  el: -8,  sun: 0x8877aa, top: 0x1a2040, hor: 0x4a3a6b, fog: 0x2a2440, amb: 0.4 },
  { h: 7,  el: 12,  sun: 0xffb36b, top: 0x3a6ea5, hor: 0xff9e7d, fog: 0xc98a7a, amb: 0.6 },
  { h: 12, el: 62,  sun: 0xfff2cc, top: 0x2f7fc4, hor: 0x9fd8ef, fog: 0xa8d4e8, amb: 0.85 },
  { h: 17, el: 28,  sun: 0xffd27a, top: 0x3a6fc0, hor: 0xff8a7a, fog: 0xd8b28e, amb: 0.8 },
  { h: 18.4, el: 8, sun: 0xff8a5c, top: 0x2b2a6b, hor: 0xf24d8a, fog: 0x74486b, amb: 0.62 },
  { h: 19.5, el: -4, sun: 0xff5c8a, top: 0x1a1440, hor: 0xd6457d, fog: 0x4a2a55, amb: 0.5 },
  { h: 21, el: -16, sun: 0x445588, top: 0x0d1230, hor: 0x2a2050, fog: 0x1c1838, amb: 0.42 },
  { h: 24, el: -25, sun: 0x334466, top: 0x0b1026, hor: 0x1b2340, fog: 0x141a2e, amb: 0.35 },
];

function sample(hour) {
  let a = KEYFRAMES[0], b = KEYFRAMES[KEYFRAMES.length - 1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (hour >= KEYFRAMES[i].h && hour <= KEYFRAMES[i + 1].h) { a = KEYFRAMES[i]; b = KEYFRAMES[i + 1]; break; }
  }
  const t = b.h === a.h ? 0 : clamp((hour - a.h) / (b.h - a.h), 0, 1);
  const mix = (ca, cb) => {
    const A = new THREE.Color(ca), B = new THREE.Color(cb);
    return A.lerp(B, t);
  };
  return {
    elevation: lerp(a.el, b.el, t),
    sunColor: mix(a.sun, b.sun),
    skyTop: mix(a.top, b.top),
    skyHorizon: mix(a.hor, b.hor),
    fogColor: mix(a.fog, b.fog),
    ambient: lerp(a.amb, b.amb, t),
  };
}

export function createDayCycle(startHour) {
  let hour = startHour !== undefined ? startHour : CFG.DAY_START_HOUR;
  return {
    get hour() { return hour; },
    set hour(h) { hour = ((h % 24) + 24) % 24; },
    clockText() {
      const h = Math.floor(hour), m = Math.floor((hour - h) * 60);
      return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    },
    update(dt) {
      hour += dt * (24 / CFG.DAY_LENGTH_SEC);
      if (hour >= 24) hour -= 24;
    },
    // Sun direction: rises in the east (+x, over the ocean), sets west.
    sunDirection() {
      const s = sample(hour);
      const az = (hour / 24) * Math.PI * 2 - Math.PI / 2;
      const el = s.elevation * Math.PI / 180;
      return {
        dir: new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el) * 0.4),
        ...s,
      };
    },
    isNight() { return hour < 6 || hour >= 19.5; },
    isDusk() { return hour >= 17.5 && hour < 20; },
  };
}
