// Procedural textures drawn on offscreen canvases: building facades with lit
// windows, road asphalt with lane dashes, sand, grass and water. No image files.
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// A building facade: pastel base, a grid of windows, some lit warm.
export function facadeTexture(base, litRatio, rng) {
  return canvasTexture(128, 256, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 256);
    // subtle vertical shading strips
    g.fillStyle = 'rgba(0,0,0,0.06)';
    for (let x = 0; x < 128; x += 16) g.fillRect(x, 0, 2, 256);
    const cols = 4, rows = 10;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = rng() < litRatio;
        g.fillStyle = lit ? '#ffd98a' : '#2e4a66';
        g.fillRect(10 + c * 28, 12 + r * 24, 18, 14);
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(10 + c * 28, 12 + r * 24, 18, 3);
      }
    }
    // ground-floor shopfront band
    g.fillStyle = 'rgba(20,30,40,0.55)';
    g.fillRect(0, 232, 128, 24);
    g.fillStyle = '#ffd98a';
    g.fillRect(8, 238, 40, 12);
    g.fillRect(72, 238, 48, 12);
  });
}

// Asphalt with a dashed centre line and edge lines.
export function roadTexture() {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = '#3d4148';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 300; i++) {
      g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
    g.fillStyle = '#e8d44d';
    for (let y = 0; y < 128; y += 32) g.fillRect(62, y + 4, 4, 18);
    g.fillStyle = '#d8d8d8';
    g.fillRect(4, 0, 3, 128);
    g.fillRect(121, 0, 3, 128);
  });
}

// Crosswalk stripes.
export function crosswalkTexture() {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = '#3d4148';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#e8e8e8';
    for (let x = 8; x < 128; x += 24) g.fillRect(x, 10, 12, 108);
  });
}

export function sidewalkTexture() {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = '#b9b3a4';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.lineWidth = 2;
    for (let i = 0; i <= 128; i += 32) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
    }
  });
}

export function sandTexture() {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = '#ecd9a0';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(180,150,90,0.35)';
    for (let i = 0; i < 400; i++) {
      g.fillRect(Math.random() * 128, Math.random() * 128, 2, 1);
    }
  });
}

export function grassTexture() {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = '#6fae4e';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 500; i++) {
      g.fillRect(Math.random() * 128, Math.random() * 128, 2, 3);
    }
    g.fillStyle = 'rgba(40,90,30,0.25)';
    for (let i = 0; i < 200; i++) {
      g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
  });
}

export function waterTexture() {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = '#2e7fa8';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const y = Math.random() * 128;
      g.beginPath();
      g.moveTo(Math.random() * 100, y);
      g.quadraticCurveTo(64, y + 6, 128, y);
      g.stroke();
    }
  });
}

// A palm frond sprite (alpha) for cheap leafy trees.
export function palmTexture() {
  return canvasTexture(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    g.strokeStyle = '#3f8f3a';
    g.lineWidth = 7;
    g.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(64, 64);
      g.quadraticCurveTo(
        64 + Math.cos(a) * 40, 64 + Math.sin(a) * 40 - 12,
        64 + Math.cos(a) * 60, 64 + Math.sin(a) * 60 + 14,
      );
      g.stroke();
    }
  });
}
