// Solmar Bay — procedural canvas textures.
// One clear job: every surface pattern (building windows, road markings, sand, water)
// is drawn on a canvas at load time, so the game ships zero image files.

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A building facade: base colour, a grid of lit and dark windows, a darker ground floor.
export function facadeTexture(base, rng, floors = 8, cols = 5) {
  const [c, g] = makeCanvas(128, 256);
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  // Subtle vertical shading.
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.10)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
  grad.addColorStop(1, 'rgba(0,0,0,0.12)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);
  const ww = 128 / cols;
  const wh = 232 / floors;
  for (let f = 0; f < floors; f++) {
    for (let col = 0; col < cols; col++) {
      const lit = rng.chance(0.28);
      g.fillStyle = lit ? '#ffe9a8' : '#2c3e50';
      g.fillRect(col * ww + 4, 8 + f * wh + 4, ww - 8, wh - 9);
      if (!lit) {
        g.fillStyle = 'rgba(255,255,255,0.14)';
        g.fillRect(col * ww + 4, 8 + f * wh + 4, ww - 8, 3);
      }
    }
  }
  // Ground floor: shopfront band.
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.fillRect(0, 236, 128, 20);
  g.fillStyle = '#ffd98a';
  for (let col = 0; col < cols; col++) {
    if (rng.chance(0.6)) g.fillRect(col * ww + 5, 240, ww - 10, 12);
  }
  return toTexture(c);
}

// Asphalt with a dashed centre line and worn edges.
export function roadTexture() {
  const [c, g] = makeCanvas(128, 128);
  g.fillStyle = '#3a3f46';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},${0.03 + Math.random() * 0.05})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  g.fillStyle = '#e8d878';
  g.fillRect(62, 0, 4, 48);
  g.fillStyle = '#c8c8c8';
  g.fillRect(4, 0, 3, 128);
  g.fillRect(121, 0, 3, 128);
  return toTexture(c, 1, 8);
}

// Sidewalk paving slabs.
export function sidewalkTexture() {
  const [c, g] = makeCanvas(128, 128);
  g.fillStyle = '#b9b3a4';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.18)';
  g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i * 32); g.lineTo(128, i * 32); g.stroke();
  }
  return toTexture(c, 6, 6);
}

// Sand with speckles.
export function sandTexture() {
  const [c, g] = makeCanvas(128, 128);
  g.fillStyle = '#e8d29a';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) {
    g.fillStyle = `rgba(120,90,40,${0.05 + Math.random() * 0.1})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  return toTexture(c, 10, 10);
}

// Ocean: gentle moving-looking waves drawn as soft bands.
export function oceanTexture() {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = '#2e7f9e';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.08})`;
    g.lineWidth = 2 + Math.random() * 3;
    g.beginPath();
    const y = Math.random() * 256;
    g.moveTo(0, y);
    g.bezierCurveTo(80, y + 8, 170, y - 8, 256, y);
    g.stroke();
  }
  return toTexture(c, 8, 8);
}

// Grass with tonal patches.
export function grassTexture() {
  const [c, g] = makeCanvas(128, 128);
  g.fillStyle = '#8fae7a';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(${40 + Math.random() * 40},${90 + Math.random() * 50},40,0.25)`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 3, 3);
  }
  return toTexture(c, 12, 12);
}

// A palm frond: a green tapered leaf drawn on a transparent canvas.
export function frondTexture() {
  const [c, g] = makeCanvas(64, 128);
  g.clearRect(0, 0, 64, 128);
  g.strokeStyle = '#2e7a3e';
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(32, 128); g.lineTo(32, 6); g.stroke();
  for (let i = 0; i < 14; i++) {
    const y = 14 + i * 8;
    const w = 26 - i;
    g.strokeStyle = i % 2 ? '#3f8f4f' : '#35804a';
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(32, y); g.lineTo(32 - w, y + 12); g.stroke();
    g.beginPath(); g.moveTo(32, y); g.lineTo(32 + w, y + 12); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A soft round sprite for particles (smoke, glow, muzzle flash).
export function softDiscTexture() {
  const [c, g] = makeCanvas(64, 64);
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
