// Procedural canvas textures: facades with lit windows and neon trim, asphalt
// with lane markings, sand, ocean shimmer, neon signs and the striped sun.
// Everything is generated at load, so the game needs no image files.
import { PALETTE } from './config.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// A building facade: pastel base, a grid of windows (some glowing warm at
// dusk), a darker ground floor with a shopfront, and a neon trim strip.
export function makeFacadeTexture(rng, base, trim) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  // subtle vertical shading so the wall is not one flat tone
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.14)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.06)'); grad.addColorStop(1, 'rgba(0,0,0,0.14)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  // window grid
  const cols = 5, rows = 6, ww = 30, wh = 26, gx = 14, gy = 12, sx = 44, sy = 34;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = gx + col * sx, y = gy + r * sy;
      const lit = rng.chance(0.55);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x - 2, y - 2, ww + 4, wh + 4);
      if (lit) {
        g.fillStyle = rng.pick(['#ffd97a', '#ffe9b0', '#ffb46b', '#fff3c4']);
        g.fillRect(x, y, ww, wh);
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x, y, ww, 5);
      } else {
        g.fillStyle = '#1d2b45'; g.fillRect(x, y, ww, wh);
        g.fillStyle = 'rgba(140,190,255,0.35)'; g.fillRect(x, y, ww, 8);
      }
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x + ww / 2 - 1, y, 2, wh);
    }
  }
  // ground floor shopfront
  g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, 224, 256, 32);
  g.fillStyle = trim; g.fillRect(0, 220, 256, 4);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fillRect(20, 232, 60, 18); g.fillRect(100, 232, 60, 18); g.fillRect(180, 232, 56, 18);
  // neon roofline trim
  g.fillStyle = trim; g.fillRect(0, 0, 256, 5);
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(0, 5, 256, 1);
  return toTexture(c);
}

// Dark asphalt with a dashed center line and edge lines.
export function makeAsphaltTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = PALETTE.road; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.25)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  g.fillStyle = '#f5c542'; g.fillRect(62, 8, 4, 44); g.fillRect(62, 76, 4, 44);
  g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(4, 0, 3, 128); g.fillRect(121, 0, 3, 128);
  return toTexture(c, [1, 1]);
}

export function makeSidewalkTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = PALETTE.sidewalk; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i * 32); g.lineTo(128, i * 32); g.stroke();
  }
  for (let i = 0; i < 300; i++) {
    g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  return toTexture(c, [1, 1]);
}

export function makeSandTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = PALETTE.sand; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1200; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(180,140,80,0.25)' : 'rgba(255,255,255,0.25)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 1);
  }
  return toTexture(c, [8, 8]);
}

export function makeOceanTexture() {
  const [c, g] = canvas(256, 256);
  const grad = g.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#274b8f'); grad.addColorStop(0.5, '#1a3a6b'); grad.addColorStop(1, '#2b1d5e');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = `rgba(150,200,255,${0.05 + Math.random() * 0.16})`;
    g.lineWidth = 1 + Math.random() * 2;
    const x = Math.random() * 256, y = Math.random() * 256, w = 12 + Math.random() * 40;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke();
  }
  return toTexture(c, [10, 10]);
}

// A neon sign: glowing text on a dark panel. Used as an emissive map too.
export function makeNeonSignTexture(text, color) {
  const [c, g] = canvas(256, 96);
  g.fillStyle = '#12081f'; g.fillRect(0, 0, 256, 96);
  g.strokeStyle = color; g.lineWidth = 3; g.strokeRect(4, 4, 248, 88);
  g.font = 'bold 34px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 18;
  g.fillStyle = '#ffffff';
  g.fillText(text, 128, 50);
  g.shadowBlur = 8; g.fillStyle = color;
  g.fillText(text, 128, 50);
  return toTexture(c);
}

// The synthwave sun: a striped gradient disc.
export function makeSunTexture() {
  const [c, g] = canvas(256, 256);
  const grad = g.createLinearGradient(0, 20, 0, 236);
  grad.addColorStop(0, '#ffe259'); grad.addColorStop(0.45, '#ff7e5f'); grad.addColorStop(1, '#ff2e88');
  g.fillStyle = grad;
  g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.fill();
  // horizontal slits, wider toward the bottom
  g.globalCompositeOperation = 'destination-out';
  let y = 150, h = 4;
  while (y < 250) { g.fillRect(0, y, 256, h); y += h + 12; h += 3; }
  g.globalCompositeOperation = 'source-over';
  return toTexture(c);
}

// Soft radial glow sprite (for lamps, headlights, the sun halo).
export function makeGlowTexture() {
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return toTexture(c);
}

// A palm frond: a tapered green blade with a center rib.
export function makeFrondTexture() {
  const [c, g] = canvas(64, 128);
  g.clearRect(0, 0, 64, 128);
  g.fillStyle = '#1f7a3d';
  g.beginPath();
  g.moveTo(32, 0);
  g.quadraticCurveTo(60, 50, 34, 128);
  g.quadraticCurveTo(32, 120, 30, 128);
  g.quadraticCurveTo(4, 50, 32, 0);
  g.fill();
  g.strokeStyle = '#2fae5f'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(32, 4); g.lineTo(32, 126); g.stroke();
  return toTexture(c);
}
