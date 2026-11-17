// Solmar Bay — sun, sky and the day cycle.
// One clear job: move the sun across the sky, tint the light and fog with the hour,
// and keep the golden-hour look the screenshots are taken in.

import { DAY } from './config.js';

const SKY_STOPS = [
  // [hour, sky colour, fog colour, sun colour, sun intensity, ambient intensity]
  [0, 0x0d1526, 0x0d1526, 0x8a9ac0, 0.12, 0.35],
  [5, 0x1a2440, 0x2a3550, 0xc09080, 0.25, 0.4],
  [7, 0x9ab8d8, 0xd8b898, 0xffd9a0, 0.9, 0.6],
  [12, 0x7fb2e5, 0xcfe0ee, 0xfff4d8, 1.25, 0.85],
  [16, 0x8ab4e0, 0xf0d0a0, 0xffe0a8, 1.15, 0.8],
  [17.5, 0x9ab8e0, 0xf2c48d, 0xffd9a0, 1.05, 0.75],
  [19, 0xe8906a, 0xe8a878, 0xffb070, 0.7, 0.55],
  [20.5, 0x3a2a55, 0x4a3550, 0xd88070, 0.3, 0.4],
  [24, 0x0d1526, 0x0d1526, 0x8a9ac0, 0.12, 0.35],
];

function hexLerp(a, b, t) {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

export class DayCycle {
  constructor(scene) {
    this.scene = scene;
    this.hour = DAY.START_HOUR;
    this.sun = new THREE.DirectionalLight(0xffe3b0, 1.05);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -180;
    this.sun.shadow.camera.right = 180;
    this.sun.shadow.camera.top = 180;
    this.sun.shadow.camera.bottom = -180;
    this.sun.shadow.camera.far = 600;
    this.sun.shadow.bias = -0.0004;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.ambient = new THREE.AmbientLight(0xbfd4e8, 0.75);
    scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0xbcd8ff, 0x8a7a5a, 0.5);
    scene.add(this.hemi);
    scene.fog = new THREE.Fog(0xf2c48d, 120, 420);
    this.apply();
  }

  setHour(h) {
    this.hour = ((h % 24) + 24) % 24;
    this.apply();
  }

  update(dt) {
    this.hour += (dt / DAY.DAY_LENGTH_SEC) * 24;
    if (this.hour >= 24) this.hour -= 24;
    this.apply();
  }

  apply() {
    const h = this.hour;
    let i = 0;
    while (i < SKY_STOPS.length - 2 && SKY_STOPS[i + 1][0] < h) i++;
    const a = SKY_STOPS[i];
    const b = SKY_STOPS[i + 1];
    const t = Math.min(1, Math.max(0, (h - a[0]) / (b[0] - a[0])));
    const sky = hexLerp(a[1], b[1], t);
    const fog = hexLerp(a[2], b[2], t);
    const sunCol = hexLerp(a[3], b[3], t);
    this.scene.background = new THREE.Color(sky);
    this.scene.fog.color.setHex(fog);
    this.sun.color.setHex(sunCol);
    this.sun.intensity = a[4] + (b[4] - a[4]) * t;
    this.ambient.intensity = a[5] + (b[5] - a[5]) * t;
    // Sun angle: rises east (x+), sets west; golden hour hangs low in the west.
    const ang = ((h - 6) / 12) * Math.PI;
    const r = 320;
    this.sun.position.set(
      Math.cos(ang) * r,
      Math.max(28, Math.sin(ang) * r * 0.9 + 40),
      90 + Math.sin(ang * 0.5) * 60,
    );
    this.sun.target.position.set(0, 0, 0);
  }

  clockText() {
    const h = Math.floor(this.hour);
    const m = Math.floor((this.hour - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  isNight() {
    return this.hour < 5.5 || this.hour > 20;
  }
}
