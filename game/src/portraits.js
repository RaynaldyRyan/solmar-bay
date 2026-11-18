// Character portraits: 6 original characters, drawn with canvas vector
// shapes (no images, no network). Each portrait is a face with distinct hair,
// skin tone, clothing and one accessory — sunglasses, a cap, hoop earrings, a
// gold chain, a headset, a fedora — so the start screen and the dialogue box
// can show who is talking.
export const PORTRAITS = [
  { id: 'maya', name: 'Maya Reyes', role: 'You — driver & fixer', skin: '#c68642', hair: '#1a1a1a', hairStyle: 'bob', shirt: '#e91e8c', accessory: 'shades' },
  { id: 'dizzy', name: "Danny 'Dizzy' Cruz", role: 'Wheelman', skin: '#8d5524', hair: '#3b2314', hairStyle: 'mohawk', shirt: '#ffd166', accessory: 'cap' },
  { id: 'vera', name: 'Vera Solano', role: 'Fixer', skin: '#f1c27d', hair: '#b5651d', hairStyle: 'long', shirt: '#4cc9f0', accessory: 'earrings' },
  { id: 'rico', name: 'Rico Vega', role: 'Rival racer', skin: '#a67c52', hair: '#111111', hairStyle: 'slick', shirt: '#f72585', accessory: 'chain' },
  { id: 'kwan', name: 'Det. Ana Kwan', role: 'Solmar PD', skin: '#ffdbac', hair: '#2b2b2b', hairStyle: 'bun', shirt: '#4361ee', accessory: 'headset' },
  { id: 'sal', name: "Sal 'The Anchor' Marino", role: 'Harbor boss', skin: '#e0ac69', hair: '#d3d3d3', hairStyle: 'bald', shirt: '#6c757d', accessory: 'fedora' },
];

export function portraitById(id) {
  return PORTRAITS.find((p) => p.id === id) || PORTRAITS[0];
}

// Draw one portrait into a 2D context at (x, y) with the given size.
export function drawPortrait(ctx, id, x, y, size) {
  const p = portraitById(id);
  const u = size / 100;
  ctx.save();
  ctx.translate(x, y);
  // Backdrop: a neon gradient disc.
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#2b1055');
  grad.addColorStop(1, '#7597de');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(50 * u, 50 * u, 49 * u, 0, Math.PI * 2);
  ctx.fill();
  // Shoulders / shirt.
  ctx.fillStyle = p.shirt;
  ctx.beginPath();
  ctx.ellipse(50 * u, 96 * u, 38 * u, 22 * u, 0, Math.PI, 0);
  ctx.fill();
  // Neck + face.
  ctx.fillStyle = p.skin;
  ctx.fillRect(44 * u, 62 * u, 12 * u, 14 * u);
  ctx.beginPath();
  ctx.ellipse(50 * u, 44 * u, 26 * u, 30 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hair.
  ctx.fillStyle = p.hair;
  if (p.hairStyle === 'bob') {
    ctx.beginPath();
    ctx.ellipse(50 * u, 30 * u, 29 * u, 20 * u, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(21 * u, 28 * u, 8 * u, 30 * u);
    ctx.fillRect(71 * u, 28 * u, 8 * u, 30 * u);
  } else if (p.hairStyle === 'mohawk') {
    ctx.beginPath();
    ctx.moveTo(44 * u, 22 * u);
    ctx.lineTo(50 * u, 2 * u);
    ctx.lineTo(56 * u, 22 * u);
    ctx.closePath();
    ctx.fill();
  } else if (p.hairStyle === 'long') {
    ctx.beginPath();
    ctx.ellipse(50 * u, 32 * u, 30 * u, 22 * u, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(19 * u, 30 * u, 10 * u, 52 * u);
    ctx.fillRect(71 * u, 30 * u, 10 * u, 52 * u);
  } else if (p.hairStyle === 'slick') {
    ctx.beginPath();
    ctx.ellipse(52 * u, 22 * u, 26 * u, 12 * u, 0, Math.PI, 0);
    ctx.fill();
  } else if (p.hairStyle === 'bun') {
    ctx.beginPath();
    ctx.ellipse(50 * u, 28 * u, 27 * u, 16 * u, 0, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(50 * u, 10 * u, 8 * u, 0, Math.PI * 2);
    ctx.fill();
  }
  // Eyes.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(40 * u, 44 * u, 5 * u, 4 * u, 0, 0, Math.PI * 2);
  ctx.ellipse(60 * u, 44 * u, 5 * u, 4 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(41 * u, 44 * u, 2.4 * u, 0, Math.PI * 2);
  ctx.arc(61 * u, 44 * u, 2.4 * u, 0, Math.PI * 2);
  ctx.fill();
  // Mouth.
  ctx.strokeStyle = '#7a3b2e';
  ctx.lineWidth = 2.4 * u;
  ctx.beginPath();
  ctx.arc(50 * u, 58 * u, 8 * u, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  // Accessory.
  if (p.accessory === 'shades') {
    ctx.fillStyle = '#111111';
    ctx.fillRect(32 * u, 40 * u, 16 * u, 8 * u);
    ctx.fillRect(52 * u, 40 * u, 16 * u, 8 * u);
    ctx.fillRect(47 * u, 42 * u, 6 * u, 3 * u);
  } else if (p.accessory === 'cap') {
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.ellipse(50 * u, 24 * u, 28 * u, 12 * u, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(22 * u, 24 * u, 56 * u, 4 * u);
  } else if (p.accessory === 'earrings') {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(23 * u, 56 * u, 3.4 * u, 0, Math.PI * 2);
    ctx.arc(77 * u, 56 * u, 3.4 * u, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.accessory === 'chain') {
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    ctx.arc(50 * u, 72 * u, 14 * u, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (p.accessory === 'headset') {
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    ctx.arc(50 * u, 40 * u, 28 * u, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.fillStyle = '#222222';
    ctx.fillRect(20 * u, 44 * u, 6 * u, 12 * u);
  } else if (p.accessory === 'fedora') {
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.ellipse(50 * u, 22 * u, 26 * u, 9 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(36 * u, 6 * u, 28 * u, 16 * u);
  }
  ctx.restore();
}

// A portrait as a data URL (for <img> tags on the start screen).
export function portraitURL(id, size = 120) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  drawPortrait(c.getContext('2d'), id, 0, 0, size);
  return c.toDataURL('image/png');
}
