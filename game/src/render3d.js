// The 3D renderer (Three.js r128, vendored under game/vendor/). One scene:
// a plan-textured ground, merged-geometry buildings and palms (a handful of
// draw calls, not one per building), neon signs, landmarks, cars, the police
// helicopter with its spotlight, tracers and muzzle flashes. Time of day
// drives the sky, fog and sun through keyframes, so 18:50 really is sunset.
import { ARCHETYPES, DISTRICTS, WORLD } from './config.js';
import { drawPlan } from './city.js';

const THREE = window.THREE;

// Sky keyframes: [minutes, sky, fog, sun color, sun intensity].
const SKY = [
  [0, 0x0b1026, 0x0b1026, 0x8899bb, 0.25],
  [360, 0xff9a8b, 0xe8a2a2, 0xffb347, 0.7],
  [540, 0x87ceeb, 0xa8d8ea, 0xfff2cc, 1.1],
  [780, 0x4da6ff, 0x9fd3f0, 0xffffff, 1.3],
  [1050, 0xffb347, 0xf4a261, 0xff9f1c, 1.15],
  [1130, 0xff5e78, 0xe07a9a, 0xff2e63, 1.05],
  [1185, 0x3b2d5e, 0x4a3b6b, 0x9a7fc0, 0.6],
  [1320, 0x0b1026, 0x0b1026, 0x8899bb, 0.25],
  [1440, 0x0b1026, 0x0b1026, 0x8899bb, 0.25],
];

function skyAt(minutes) {
  let a = SKY[0];
  let b = SKY[SKY.length - 1];
  for (let i = 0; i < SKY.length - 1; i += 1) {
    if (minutes >= SKY[i][0] && minutes <= SKY[i + 1][0]) {
      a = SKY[i];
      b = SKY[i + 1];
      break;
    }
  }
  const t = (minutes - a[0]) / Math.max(1, b[0] - a[0]);
  const mix = (c1, c2) => {
    const A = new THREE.Color(c1);
    const B = new THREE.Color(c2);
    return A.lerp(B, t);
  };
  return { sky: mix(a[1], b[1]), fog: mix(a[2], b[2]), sun: mix(a[3], b[3]), intensity: a[4] + (b[4] - a[4]) * t };
}

// Merge a list of {geometry, matrix} into one BufferGeometry (r128's UMD
// build ships no BufferGeometryUtils, so this is the merge).
function mergeParts(parts) {
  let vCount = 0;
  let iCount = 0;
  const geos = parts.map((p) => {
    const g = p.geometry.clone();
    g.applyMatrix4(p.matrix);
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : 0;
    return g;
  });
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const idx = new Uint32Array(iCount);
  let vOff = 0;
  let iOff = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, vOff * 3);
    nor.set(g.attributes.normal.array, vOff * 3);
    uv.set(g.attributes.uv.array, vOff * 2);
    if (g.index) {
      const arr = g.index.array;
      for (let i = 0; i < arr.length; i += 1) idx[iOff + i] = arr[i] + vOff;
      iOff += arr.length;
    }
    vOff += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

function mat4(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
  m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
  return m;
}

function textTexture(text, color, big) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = big ? 128 : 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, c.width - 12, c.height - 12);
  ctx.font = `bold ${big ? 64 : 52}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  ctx.fillStyle = color;
  ctx.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export function createRenderer(canvas, city) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x9fd3f0, 160, 950);
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.5, 2400);

  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  scene.add(sun);
  // Strong fill: without it the sunset/dusk shots go nearly black (the
  // road texture is dark and the sun is low). The ambient lifts the
  // deepest shadows so black cars still read against the asphalt.
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x5a4a3a, 1.15));
  scene.add(new THREE.AmbientLight(0x8a7a9a, 0.5));
  // Police light wash: one light that rides the nearest cruiser and
  // alternates red/blue, so the chase reads as a chase, not a night drive.
  const copGlow = new THREE.PointLight(0xff2222, 0, 48, 1);
  scene.add(copGlow);
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(60, 24),
    new THREE.MeshBasicMaterial({ color: 0xffdd88, fog: false, transparent: true, opacity: 0.95 }),
  );
  scene.add(sunDisc);

  // Ground: the city plan as one texture.
  const planCanvas = document.createElement('canvas');
  planCanvas.width = 2048;
  planCanvas.height = 1434;
  drawPlan(planCanvas.getContext('2d'), 2048, 1434, { labels: false });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.maxX - WORLD.minX, WORLD.maxZ - WORLD.minZ),
    new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(planCanvas) }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  // Water: a dark plane under everything (the plan already paints ocean, this
  // catches the horizon past the world edge).
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(6000, 6000),
    new THREE.MeshLambertMaterial({ color: 0x0a3558 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.6;
  scene.add(water);

  // Buildings, merged by color.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const byColor = new Map();
  for (const b of city.buildings) {
    if (!byColor.has(b.color)) byColor.set(b.color, []);
    byColor.get(b.color).push({ geometry: boxGeo, matrix: mat4(b.x, b.h / 2, b.z, 0, b.w, b.h, b.d) });
  }
  for (const [color, parts] of byColor) {
    const mesh = new THREE.Mesh(mergeParts(parts), new THREE.MeshLambertMaterial({ color: new THREE.Color(color) }));
    scene.add(mesh);
  }
  // Rooftop water towers on a few downtown towers (merged, dark).
  const towerParts = [];
  for (const b of city.buildings) {
    if (b.district === 'downtown' && b.h > 50) {
      towerParts.push({ geometry: new THREE.CylinderGeometry(2.5, 2.5, 5, 6), matrix: mat4(b.x, b.h + 3, b.z) });
    }
  }
  if (towerParts.length) scene.add(new THREE.Mesh(mergeParts(towerParts), new THREE.MeshLambertMaterial({ color: 0x5a4632 })));

  // Lit windows: merged quads on every building face (warm at dusk, dim
  // at midday). This is what stops the facades reading as flat coloured
  // monoliths. Lit/dark is a deterministic hash of the building, so the
  // same seed always shows the same windows.
  const litParts = [];
  const darkParts = [];
  const winGeo = new THREE.PlaneGeometry(1.7, 2.3);
  for (const b of city.buildings) {
    if (b.h < 10) continue;
    const colsX = Math.max(1, Math.min(4, Math.floor(b.w / 5)));
    const colsZ = Math.max(1, Math.min(4, Math.floor(b.d / 5)));
    const rows = Math.max(1, Math.min(4, Math.floor(b.h / 6)));
    const faces = [
      { n: [0, 1], along: b.w, cols: colsX, off: [0, b.d / 2 + 0.15] },
      { n: [0, -1], along: b.w, cols: colsX, off: [0, -b.d / 2 - 0.15] },
      { n: [1, 0], along: b.d, cols: colsZ, off: [b.w / 2 + 0.15, 0] },
      { n: [-1, 0], along: b.d, cols: colsZ, off: [-b.w / 2 - 0.15, 0] },
    ];
    for (const f of faces) {
      const ry = f.n[0] === 1 ? Math.PI / 2 : f.n[0] === -1 ? -Math.PI / 2 : f.n[1] === -1 ? Math.PI : 0;
      for (let c = 0; c < f.cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const u = (c - (f.cols - 1) / 2) * (f.along / Math.max(1, f.cols));
          const y = 3.5 + r * ((b.h - 6) / Math.max(1, rows));
          const x = b.x + f.off[0] + (f.n[0] === 0 ? u : 0);
          const z = b.z + f.off[1] + (f.n[0] !== 0 ? u : 0);
          const lit = ((c * 7 + r * 3 + Math.abs(Math.floor(b.x))) % 5) < 3;
          (lit ? litParts : darkParts).push({ geometry: winGeo, matrix: mat4(x, y, z, ry) });
        }
      }
    }
  }
  const litWinMat = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9 });
  if (litParts.length) scene.add(new THREE.Mesh(mergeParts(litParts), litWinMat));
  if (darkParts.length) scene.add(new THREE.Mesh(mergeParts(darkParts), new THREE.MeshBasicMaterial({ color: 0x141c2e })));

  // Palms: merged trunks + merged fronds.
  const trunkParts = [];
  const frondParts = [];
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 7, 5);
  const frondGeo = new THREE.PlaneGeometry(7, 1.6);
  for (const p of city.palms) {
    trunkParts.push({ geometry: trunkGeo, matrix: mat4(p.x, 3.5 * p.s, p.z, 0, p.s, p.s, p.s) });
    for (let i = 0; i < 4; i += 1) {
      const m = new THREE.Matrix4();
      const e = new THREE.Euler(-0.5, (i / 4) * Math.PI * 2, 0);
      m.compose(new THREE.Vector3(p.x, 7 * p.s, p.z), new THREE.Quaternion().setFromEuler(e), new THREE.Vector3(p.s, p.s, p.s));
      frondParts.push({ geometry: frondGeo, matrix: m });
    }
  }
  scene.add(new THREE.Mesh(mergeParts(trunkParts), new THREE.MeshLambertMaterial({ color: 0x6b4a2b })));
  const frondMesh = new THREE.Mesh(mergeParts(frondParts), new THREE.MeshLambertMaterial({ color: 0x2f9e44, side: THREE.DoubleSide }));
  scene.add(frondMesh);

  // Neon signs (emissive planes facing the street).
  const signMeshes = [];
  for (const s of city.signs) {
    const tex = textTexture(s.text, s.color, s.big);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(s.big ? 30 : 16, s.big ? 7.5 : 4.5),
      new THREE.MeshBasicMaterial({ map: tex, transparent: false }),
    );
    m.position.set(s.x, s.big ? 14 : 9, s.z);
    m.rotation.y = s.x > 500 ? -Math.PI / 2 : 0;
    scene.add(m);
    signMeshes.push(m);
  }

  // Landmarks: lighthouse (cylinder + light), stadium (low cylinder), pier
  // (deck on posts), port cranes (boxes), fountain (cylinder + disc).
  const lm = new THREE.Group();
  const lighthouse = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.5, 34, 10), new THREE.MeshLambertMaterial({ color: 0xf8f9fa }));
  lighthouse.position.set(720, 17, 620);
  lm.add(lighthouse);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
  lamp.position.set(720, 35, 620);
  lm.add(lamp);
  const stadium = new THREE.Mesh(new THREE.CylinderGeometry(52, 56, 14, 24), new THREE.MeshLambertMaterial({ color: 0x8a9a7b }));
  stadium.position.set(-650, 7, -480);
  lm.add(stadium);
  const pier = new THREE.Mesh(new THREE.BoxGeometry(60, 1.5, 10), new THREE.MeshLambertMaterial({ color: 0x8b6f47 }));
  pier.position.set(730, 1.2, -300);
  lm.add(pier);
  for (let i = 0; i < 3; i += 1) {
    const crane = new THREE.Group();
    const leg = new THREE.Mesh(new THREE.BoxGeometry(4, 40, 4), new THREE.MeshLambertMaterial({ color: 0xd62828 }));
    leg.position.y = 20;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(46, 3, 3), new THREE.MeshLambertMaterial({ color: 0xd62828 }));
    arm.position.y = 40;
    crane.add(leg, arm);
    crane.position.set(400 + i * 34, 0, 470);
    lm.add(crane);
  }
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(16, 18, 2, 20), new THREE.MeshLambertMaterial({ color: 0x9ec5e8 }));
  fountain.position.set(-60, 1, 440);
  lm.add(fountain);
  // Respray garage: drive in with heat and $500 to clear it.
  const garage = new THREE.Mesh(new THREE.BoxGeometry(24, 8, 18), new THREE.MeshLambertMaterial({ color: 0x2b2d42 }));
  garage.position.set(675, 4, -160);
  lm.add(garage);
  const garageSign = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 4),
    new THREE.MeshBasicMaterial({ map: textTexture('RESPRAY', '#ffd166', false) }),
  );
  garageSign.position.set(675, 10, -150);
  garageSign.rotation.y = Math.PI; // face north: oncoming southbound drivers read it
  lm.add(garageSign);
  scene.add(lm);

  // Street dressing: lamp posts along Ocean Drive, beach umbrellas on the
  // sand — the street furniture the first screenshots were missing.
  const poleParts = [];
  const lampParts = [];
  const poleGeo = new THREE.CylinderGeometry(0.18, 0.24, 7, 5);
  const lampGeo = new THREE.BoxGeometry(1.6, 0.35, 0.5);
  for (let z = -640; z <= 640; z += 64) {
    for (const x of [683, 717]) {
      poleParts.push({ geometry: poleGeo, matrix: mat4(x, 3.5, z) });
      lampParts.push({ geometry: lampGeo, matrix: mat4(x + (x < 700 ? 0.8 : -0.8), 7, z) });
    }
  }
  scene.add(new THREE.Mesh(mergeParts(poleParts), new THREE.MeshLambertMaterial({ color: 0x2b2d42 })));
  scene.add(new THREE.Mesh(mergeParts(lampParts), new THREE.MeshBasicMaterial({ color: 0xfff3b0 })));
  const umbPoleParts = [];
  const umbTopParts = [];
  const umbPoleGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.4, 4);
  const umbTopGeo = new THREE.ConeGeometry(1.8, 0.9, 8);
  for (let i = 0; i < 12; i += 1) {
    const ux = 750 + (i % 3) * 2;
    const uz = -560 + i * 100;
    umbPoleParts.push({ geometry: umbPoleGeo, matrix: mat4(ux, 1.2, uz) });
    umbTopParts.push({ geometry: umbTopGeo, matrix: mat4(ux, 2.8, uz) });
  }
  scene.add(new THREE.Mesh(mergeParts(umbPoleParts), new THREE.MeshLambertMaterial({ color: 0x6b4a2b })));
  scene.add(new THREE.Mesh(mergeParts(umbTopParts), new THREE.MeshLambertMaterial({ color: 0xff5d8f })));

  // Marina dressing: dock crates (kept to the sides so they never block
  // the firefight sightline), moored boats and floodlights — the dock
  // needs a dock to happen on, not an empty car park.
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x8b6f47 });
  const crateSpots = [[682, 412, 2.2], [686, 422, 1.8], [712, 428, 2.0], [716, 418, 1.6], [690, 436, 2.4], [706, 438, 1.9]];
  for (const [cx, cz, cs] of crateSpots) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(cs, cs, cs), crateMat);
    crate.position.set(cx, cs / 2, cz);
    crate.rotation.y = ((cx * 7 + cz * 3) % 10) / 10;
    scene.add(crate);
  }
  for (const [bx, bz, bc] of [[778, 395, 0xe63946], [790, 425, 0x4cc9f0], [772, 450, 0xf8f9fa]]) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(7, 1.6, 2.6), new THREE.MeshLambertMaterial({ color: 0xf8f9fa }));
    hull.position.y = 0.4;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 2), new THREE.MeshLambertMaterial({ color: bc }));
    cabin.position.set(-0.5, 1.8, 0);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 4), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    mast.position.set(1.5, 3.5, 0);
    boat.add(hull, cabin, mast);
    boat.position.set(bx, -0.4, bz);
    boat.rotation.y = 0.4 + (bx % 3) * 0.2;
    scene.add(boat);
  }
  for (const [fx, fz] of [[678, 392], [714, 448]]) {
    const fpole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 11, 5), new THREE.MeshLambertMaterial({ color: 0x2b2d42 }));
    fpole.position.set(fx, 5.5, fz);
    scene.add(fpole);
    const fhead = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.9), new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
    fhead.position.set(fx, 11, fz);
    scene.add(fhead);
    const fl = new THREE.PointLight(0xffe8b0, 1.6, 70, 1);
    fl.position.set(fx, 10, fz);
    scene.add(fl);
  }

  // Mission beacon: a tall light pillar at the active job.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3, 120, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  beacon.visible = false;
  scene.add(beacon);

  // Checkpoint gate for the street race: a ring on two posts, so it reads
  // as a gate, not a floating circle. (The old 18 m ring clipped the
  // respray sign behind it.)
  const ringGroup = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(6.5, 0.55, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xff9f1c }),
  );
  ring.position.y = 3.4;
  const postGeo = new THREE.CylinderGeometry(0.22, 0.22, 3.4, 6);
  const postMat = new THREE.MeshBasicMaterial({ color: 0xff9f1c });
  const postL = new THREE.Mesh(postGeo, postMat);
  postL.position.set(-6.5, 1.7, 0);
  const postR = new THREE.Mesh(postGeo, postMat);
  postR.position.set(6.5, 1.7, 0);
  ringGroup.add(ring, postL, postR);
  ringGroup.visible = false;
  scene.add(ringGroup);

  // Sunset Tapes: small gold spinning boxes.
  const tapeMeshes = city.tapes.map((t) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.5), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    m.position.set(t.x, 2, t.z);
    scene.add(m);
    return m;
  });

  // Cars: one group per car, parts merged (body / wheels / extras).
  const carGroups = new Map();
  const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 8);
  const hubGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.1, 8);
  function buildCarGroup(type) {
    const arch = ARCHETYPES[type];
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: arch.color });
    const bodyParts = [
      { geometry: boxGeo, matrix: mat4(0, 0.75, 0, 0, arch.wid, 0.85, arch.len) },
      { geometry: boxGeo, matrix: mat4(0, 1.45, -0.2, 0, arch.wid * 0.85, 0.7, arch.len * 0.5) },
    ];
    if (arch.wing) {
      bodyParts.push({ geometry: boxGeo, matrix: mat4(0, 1.55, arch.len / 2 - 0.3, 0, arch.wid + 0.3, 0.12, 0.7) });
      bodyParts.push({ geometry: boxGeo, matrix: mat4(-0.6, 1.25, arch.len / 2 - 0.3, 0, 0.12, 0.5, 0.12) });
      bodyParts.push({ geometry: boxGeo, matrix: mat4(0.6, 1.25, arch.len / 2 - 0.3, 0, 0.12, 0.5, 0.12) });
    }
    if (type === 'van') bodyParts[1].matrix = mat4(0, 1.7, 0.4, 0, arch.wid * 0.9, 1.4, arch.len * 0.62);
    if (type === 'pickup') bodyParts[1].matrix = mat4(0, 1.45, -0.9, 0, arch.wid * 0.85, 0.7, arch.len * 0.32);
    if (type === 'convertible') bodyParts[1].matrix = mat4(0, 1.2, -0.2, 0, arch.wid * 0.8, 0.35, arch.len * 0.42);
    g.add(new THREE.Mesh(mergeParts(bodyParts), bodyMat));
    // Wheels sit proud of the bodywork (from behind, the old inset wheels
    // were invisible) with pale hubcaps; taillights + headlights are
    // emissive so the car reads at dusk.
    const wheelParts = [];
    const hubParts = [];
    for (const [wx, wz] of [[-1, 1.4], [1, 1.4], [-1, -1.4], [1, -1.4]]) {
      const m = new THREE.Matrix4();
      m.compose(new THREE.Vector3(wx * (arch.wid / 2 + 0.04), 0.5, wz * (arch.len / 4.4)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), new THREE.Vector3(1, 1, 1));
      wheelParts.push({ geometry: wheelGeo, matrix: m });
      const hm = new THREE.Matrix4();
      hm.compose(new THREE.Vector3(wx * (arch.wid / 2 + 0.2), 0.5, wz * (arch.len / 4.4)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), new THREE.Vector3(1, 1, 1));
      hubParts.push({ geometry: hubGeo, matrix: hm });
    }
    g.add(new THREE.Mesh(mergeParts(wheelParts), new THREE.MeshLambertMaterial({ color: 0x111111 })));
    g.add(new THREE.Mesh(mergeParts(hubParts), new THREE.MeshLambertMaterial({ color: 0x9a9a9a })));
    const tailParts = [];
    const headParts = [];
    for (const lx of [-0.6, 0.6]) {
      // Model +z points along the heading (the direction of travel), so
      // the tail is the -z face and the headlights sit on +z.
      tailParts.push({ geometry: boxGeo, matrix: mat4(lx * (arch.wid / 1.8), 0.85, -arch.len / 2 - 0.02, 0, 0.45, 0.16, 0.06) });
      headParts.push({ geometry: boxGeo, matrix: mat4(lx * (arch.wid / 1.8), 0.85, arch.len / 2 + 0.02, 0, 0.45, 0.16, 0.06) });
    }
    g.add(new THREE.Mesh(mergeParts(tailParts), new THREE.MeshBasicMaterial({ color: 0xff2e2e })));
    g.add(new THREE.Mesh(mergeParts(headParts), new THREE.MeshBasicMaterial({ color: 0xfff3b0 })));
    // Windshield: a dark glass panel on the cabin's front (+z) face.
    if (type !== 'convertible') {
      const shield = new THREE.Mesh(new THREE.BoxGeometry(arch.wid * 0.8, 0.55, 0.06), new THREE.MeshLambertMaterial({ color: 0x0d1b2a }));
      shield.position.set(0, 1.5, -0.2 + arch.len * 0.25);
      g.add(shield);
    } else {
      // The convertible is open-top: a driver silhouette in the cabin.
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.4), new THREE.MeshLambertMaterial({ color: 0x222222 }));
      torso.position.set(0, 1.35, -0.2);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), new THREE.MeshLambertMaterial({ color: 0xc68642 }));
      head.position.set(0, 1.85, -0.2);
      g.add(torso, head);
    }
    if (type === 'cruiser') {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
      bar.position.set(-0.35, 1.95, -0.2);
      const bar2 = bar.clone();
      bar2.material = new THREE.MeshBasicMaterial({ color: 0x0044ff });
      bar2.position.x = 0.35;
      g.add(bar, bar2);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(arch.wid + 0.05, 0.3, arch.len * 0.9), new THREE.MeshLambertMaterial({ color: 0xf8f9fa }));
      stripe.position.y = 0.95;
      g.add(stripe);
    }
    if (type === 'taxi') {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.4), new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
      sign.position.set(0, 1.95, -0.2);
      g.add(sign);
    }
    return g;
  }

  function carGroupFor(key, type) {
    let g = carGroups.get(key);
    if (!g) {
      g = buildCarGroup(type);
      carGroups.set(key, g);
      scene.add(g);
    }
    return g;
  }

  function syncCar(key, car) {
    const g = carGroupFor(key, car.type);
    g.position.set(car.x, 0, car.z);
    g.rotation.y = car.heading;
    g.visible = true;
  }

  // Parked cars on the road's edge lanes (never inside a building: the
  // road is clear by construction). Static: built directly, never
  // registered in carGroups, so the per-frame sync leaves them be.
  const parked = [
    ['sedan', 691, -420, 0], ['taxi', 709, -360, Math.PI], ['pickup', 691, -40, 0],
    ['van', 709, 120, Math.PI], ['convertible', 691, 240, 0], ['sedan', 709, 480, Math.PI],
    ['taxi', 691, 560, 0], ['pickup', 691, 340, 0],
  ];
  for (const [type, x, z, ry] of parked) {
    const pg = buildCarGroup(type);
    pg.position.set(x, 0, z);
    pg.rotation.y = ry;
    scene.add(pg);
  }

  // Helicopter: body, tail, spinning rotor, spotlight cone + real SpotLight.
  const heliGroup = new THREE.Group();
  const heliBody = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2, 6), new THREE.MeshLambertMaterial({ color: 0x1d3557 }));
  const heliTail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 5), new THREE.MeshLambertMaterial({ color: 0x1d3557 }));
  heliTail.position.set(0, 0.4, -5);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  rotor.position.y = 1.4;
  const spotCone = new THREE.Mesh(
    new THREE.ConeGeometry(8, 60, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff8c0, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
  );
  spotCone.position.y = -30;
  const spotLight = new THREE.SpotLight(0xfff2b0, 1.4, 160, 0.35, 0.5, 1);
  spotLight.position.set(0, -1, 0);
  heliGroup.add(heliBody, heliTail, rotor, spotCone, spotLight);
  heliGroup.scale.set(1.5, 1.5, 1.5);
  heliGroup.visible = false;
  scene.add(heliGroup);
  const heliTarget = new THREE.Object3D();
  scene.add(heliTarget);
  spotLight.target = heliTarget;

  // People: a figure that reads as a person from behind — arms (the right
  // one raised, aiming the gun forward), a cap, a belt. The old armless
  // block read as a rendering bug next to the ON FOOT indicator.
  function buildFigure(shirt, pants) {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5), new THREE.MeshLambertMaterial({ color: shirt }));
    torso.position.y = 1.25;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), new THREE.MeshLambertMaterial({ color: 0xc68642 }));
    head.position.y = 2.1;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.14, 0.6), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    cap.position.y = 2.42;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.3), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    brim.position.set(0, 2.36, 0.4);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.12, 0.52), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    belt.position.y = 0.78;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 0.4), new THREE.MeshLambertMaterial({ color: pants }));
    legL.position.set(-0.25, 0.45, 0);
    const legR = legL.clone();
    legR.position.x = 0.25;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.95, 0.3), new THREE.MeshLambertMaterial({ color: shirt }));
    armL.position.set(-0.58, 1.2, 0);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.95), new THREE.MeshLambertMaterial({ color: shirt }));
    armR.position.set(0.55, 1.5, 0.45);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 1.1), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.55, 1.5, 0.95);
    g.add(torso, head, cap, brim, belt, legL, legR, armL, armR, gun);
    return g;
  }
  const playerFigure = buildFigure(0xe91e8c, 0x222222);
  scene.add(playerFigure);
  const guardFigures = [];
  for (let i = 0; i < 6; i += 1) {
    const f = buildFigure(0x7f1d1d, 0x333333);
    f.visible = false;
    scene.add(f);
    guardFigures.push(f);
  }

  // Tracers: a pool of thin glowing boxes, stretched between shot and hit.
  // (Three.js lines are always 1px — invisible in a screenshot.)
  const tracerMeshes = [];
  const tracerGeo = new THREE.BoxGeometry(0.09, 0.09, 1);
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 24; i += 1) {
    const m = new THREE.Mesh(tracerGeo, tracerMat);
    m.visible = false;
    scene.add(m);
    tracerMeshes.push(m);
  }
  // Muzzle flash: three crossed billboards (yellow halo, orange mid, white
  // core) + a point light, moved to the latest shot. The old single small
  // plane read as a floating yellow cone.
  const flashGroup = new THREE.Group();
  const flashHalo = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), new THREE.MeshBasicMaterial({ color: 0xffdd55, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  const flashMid = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  const flashCore = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  flashGroup.add(flashHalo, flashMid, flashCore);
  flashGroup.visible = false;
  scene.add(flashGroup);
  const flashLight = new THREE.PointLight(0xffcc66, 0, 45);
  scene.add(flashLight);
  // Drift smoke: a pool of soft puffs that spawn at the rear wheels while
  // the car slides, then rise, grow and fade. The chase camera follows the
  // car's heading, so without smoke a drift is invisible.
  const smokeTex = (() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g2 = c.getContext('2d');
    const grad = g2.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g2.fillStyle = grad;
    g2.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const smokePool = [];
  for (let i = 0; i < 24; i += 1) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: smokeTex, transparent: true, opacity: 0, depthWrite: false }),
    );
    m.visible = false;
    scene.add(m);
    smokePool.push({ mesh: m, age: 99, life: 0.8 });
  }
  let smokeCursor = 0;

  const camPos = new THREE.Vector3(0, 30, 60);
  const camLook = new THREE.Vector3(0, 0, 0);
  let orbitT = 0;

  // Unproject a screen point onto the ground plane (y=0) for mouse aim.
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function screenToGround(sx, sy) {
    const nx = (sx / window.innerWidth) * 2 - 1;
    const ny = -(sy / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera({ x: nx, y: ny }, camera);
    const hit = new THREE.Vector3();
    return raycaster.ray.intersectPlane(groundPlane, hit) ? hit : null;
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  function draw(state, dt, screen, now) {
    const minutes = state.time.minutes;
    const sky = skyAt(minutes);
    scene.background = sky.sky;
    scene.fog.color.copy(sky.fog);
    sun.color.copy(sky.sun);
    sun.intensity = sky.intensity;
    // Sun path: rises 06:00 east, sets 19:30 west.
    const dayT = (minutes - 360) / (19.5 * 60 - 360);
    const sunAngle = Math.PI * Math.max(0, Math.min(1, dayT));
    sun.position.set(Math.cos(sunAngle) * 400, Math.sin(sunAngle) * 300 + 20, 180);
    sunDisc.position.set(Math.cos(sunAngle) * 1400, Math.sin(sunAngle) * 700 + 40, 500);
    sunDisc.lookAt(camera.position);
    sunDisc.material.opacity = minutes > 360 && minutes < 1170 ? 0.95 : 0;
    const neonGlow = minutes >= 1080 || minutes < 420 ? 1 : 0.55;
    for (const m of signMeshes) m.material.opacity = neonGlow;
    litWinMat.opacity = neonGlow;

    // Sync cars.
    for (const g of carGroups.values()) g.visible = false;
    if (state.mode === 'car' && state.car) syncCar('player', state.car);
    if (state.mode === 'foot' && state.car) syncCar('player', state.car);
    state.traffic.forEach((c, i) => syncCar(`traffic${i}`, c));
    state.rivals.forEach((c, i) => syncCar(`rival${i}`, c));
    state.police.units.forEach((u, i) => syncCar(`cop${i}`, u.car));
    state.police.roadblock.forEach((r, i) => syncCar(`block${i}`, r.car));

    // Helicopter.
    if (state.police.heli) {
      const h = state.police.heli;
      heliGroup.visible = true;
      heliGroup.position.set(h.x, h.y, h.z);
      heliGroup.rotation.y = h.heading;
      rotor.rotation.y += dt * 22;
      heliTarget.position.set(state.player.x, 0, state.player.z);
    } else {
      heliGroup.visible = false;
    }

    // People.
    if (state.mode === 'foot') {
      playerFigure.visible = true;
      playerFigure.position.set(state.player.x, 0, state.player.z);
      playerFigure.rotation.y = state.player.heading;
    } else {
      playerFigure.visible = false;
    }
    state.combat.guards.forEach((g, i) => {
      const f = guardFigures[i];
      if (!f) return;
      f.visible = g.alive;
      f.position.set(g.x, 0, g.z);
      f.rotation.y = g.heading;
      // A badly hurt guard staggers — tilted, lower — so the firefight
      // reads as hits landing, not mannequins standing still.
      const hurt = g.health < 60;
      f.rotation.z = hurt ? 0.32 : 0;
      f.rotation.x = hurt ? 0.12 : 0;
      f.position.y = hurt ? -0.12 : 0;
    });

    // Tracers + muzzle flashes.
    state.combat.tracers.forEach((t, i) => {
      const m = tracerMeshes[i];
      if (!m) return;
      const dx = t.x1 - t.x0;
      const dz = t.z1 - t.z0;
      const len = Math.max(0.5, Math.hypot(dx, dz));
      m.visible = true;
      m.position.set((t.x0 + t.x1) / 2, 1.5, (t.z0 + t.z1) / 2);
      m.scale.set(1, 1, len);
      m.lookAt(t.x1, 1.5, t.z1);
    });
    for (let i = state.combat.tracers.length; i < tracerMeshes.length; i += 1) tracerMeshes[i].visible = false;
    const flash = state.combat.flashes[state.combat.flashes.length - 1];
    if (flash && now < flash.until) {
      flashGroup.visible = true;
      flashGroup.position.set(flash.x + Math.sin(flash.angle) * 1.5, 1.5, flash.z + Math.cos(flash.angle) * 1.5);
      flashGroup.lookAt(camera.position);
      flashLight.position.copy(flashGroup.position);
      flashLight.intensity = 3.5;
    } else {
      flashGroup.visible = false;
      flashLight.intensity = 0;
    }
    // Drift smoke: spawn at both rear wheels while sliding, age the pool.
    if (state.mode === 'car' && state.car && state.car.sliding) {
      for (const side of [-0.9, 0.9]) {
        const c = state.car;
        const px2 = c.x - Math.sin(c.heading) * 1.6 + Math.cos(c.heading) * side;
        const pz2 = c.z - Math.cos(c.heading) * 1.6 - Math.sin(c.heading) * side;
        const puff = smokePool[smokeCursor % smokePool.length];
        smokeCursor += 1;
        puff.age = 0;
        puff.mesh.visible = true;
        puff.mesh.position.set(px2, 0.6, pz2);
        puff.mesh.scale.set(2, 2, 1);
      }
    }
    for (const puff of smokePool) {
      if (puff.age >= puff.life) {
        puff.mesh.visible = false;
        continue;
      }
      puff.age += dt;
      puff.mesh.position.y += dt * 1.4;
      const s = 2 + puff.age * 4;
      puff.mesh.scale.set(s, s, 1);
      puff.mesh.material.opacity = 0.65 * (1 - puff.age / puff.life);
      puff.mesh.lookAt(camera.position);
    }
    // Cop light wash follows the nearest cruiser, alternating red/blue.
    if (state.police.units.length > 0) {
      let best = null;
      let bestD = Infinity;
      for (const u of state.police.units) {
        const d = Math.hypot(u.car.x - state.player.x, u.car.z - state.player.z);
        if (d < bestD) {
          bestD = d;
          best = u.car;
        }
      }
      copGlow.position.set(best.x, 3, best.z);
      copGlow.color.setHex(Math.floor(now / 220) % 2 === 0 ? 0xff2222 : 0x2255ff);
      copGlow.intensity = 2.4;
    } else {
      copGlow.intensity = 0;
    }

    // Tapes spin; collected ones hide.
    city.tapes.forEach((t, i) => {
      const m = tapeMeshes[i];
      m.visible = !state.tapesFound.has(t.id);
      m.rotation.y += dt * 2;
      m.position.y = 2 + Math.sin(now * 0.002 + i) * 0.4;
    });

    // Mission beacon + race gate. The beacon hides when a shot stages its
    // combat right on the job marker (it would fill the frame otherwise).
    if (state.mission.active && !state.beaconOff) {
      beacon.visible = true;
      beacon.position.set(state.mission.active.at[0], 60, state.mission.active.at[1]);
    } else beacon.visible = false;
    if (state.race && state.race.next) {
      ringGroup.visible = true;
      ringGroup.position.set(state.race.next[0], 0, state.race.next[1]);
    } else ringGroup.visible = false;

    // Camera: title orbits the city; play chases the player.
    if (screen === 'title') {
      orbitT += dt * 0.02;
      const cx = 660 + Math.sin(orbitT) * 120;
      const cz = -100 + Math.cos(orbitT) * 120;
      camera.position.set(cx, 90, cz);
      camera.lookAt(700, 0, -100);
      camera.fov = 55;
      camera.updateProjectionMatrix();
    } else {
      const p = state.player;
      const back = state.mode === 'car' ? 9 : 7;
      const up = state.mode === 'car' ? 4 : 3.4;
      const tx = p.x - Math.sin(p.heading) * back;
      const tz = p.z - Math.cos(p.heading) * back;
      // Snap when far away (first frame, teleports, shot staging): lerping
      // from the spawn point would leave the camera behind for seconds.
      if (Math.hypot(tx - camPos.x, up - camPos.y, tz - camPos.z) > 40) {
        camPos.set(tx, up, tz);
        camLook.set(p.x, 1.2, p.z);
      }
      const k = Math.min(1, dt * 5);
      camPos.x += (tx - camPos.x) * k;
      camPos.y += (up - camPos.y) * k;
      camPos.z += (tz - camPos.z) * k;
      // Look slightly up in the car so the sky (and the helicopter) stays in
      // frame; on foot the aim point stays lower.
      const lookY = state.mode === 'car' ? 2.5 : 1.2;
      camLook.x += (p.x - camLook.x) * Math.min(1, dt * 8);
      camLook.y += (lookY - camLook.y) * Math.min(1, dt * 8);
      camLook.z += (p.z - camLook.z) * Math.min(1, dt * 8);
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      const boosting = state.mode === 'car' && state.car && state.car.nitro < 99 && state.boosting;
      const targetFov = boosting ? 72 : 62;
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
      camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);
  }

  return { draw, resize, screenToGround };
}
