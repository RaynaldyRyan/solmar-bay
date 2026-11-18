// The city of Solmar Bay: mainland + barrier island + port peninsula, 7
// districts, 2 causeways. buildCity places every building, palm, neon sign and
// collectible from the seed, and drawPlan renders the same plan three ways —
// the 3D ground texture, the circular minimap and the full-screen map — so the
// three can never disagree about where anything is.
import { DISTRICTS, LAND, TAPE_COUNT, WORLD } from './config.js';

// Roads as axis-aligned rectangles (x0,z0,x1,z1). Buildings never overlap them;
// the ground texture, minimap and map all draw from this one list.
export const ROADS = [
  // Island: Ocean Drive (coastal strip road) + Island Ave, full length.
  { x0: 688, z0: -660, x1: 712, z1: 660 },
  { x0: 588, z0: -660, x1: 612, z1: 660 },
  // Causeways over the bay.
  { x0: 300, z0: -312, x1: 560, z1: -278 },
  { x0: 300, z0: 196, x1: 560, z1: 226 },
  // Downtown grid.
  { x0: -388, z0: -260, x1: -372, z1: 180 }, { x0: -268, z0: -260, x1: -252, z1: 180 },
  { x0: -148, z0: -260, x1: -132, z1: 180 }, { x0: -28, z0: -260, x1: -12, z1: 180 },
  { x0: 92, z0: -260, x1: 108, z1: 180 },
  { x0: -420, z0: -208, x1: 120, z1: -192 }, { x0: -420, z0: -88, x1: 120, z1: -72 },
  { x0: -420, z0: 32, x1: 120, z1: 48 }, { x0: -420, z0: 152, x1: 120, z1: 168 },
  // Little Sol grid.
  { x0: -948, z0: -260, x1: -932, z1: 320 }, { x0: -828, z0: -260, x1: -812, z1: 320 },
  { x0: -708, z0: -260, x1: -692, z1: 320 }, { x0: -588, z0: -260, x1: -572, z1: 320 },
  { x0: -468, z0: -260, x1: -452, z1: 320 },
  { x0: -1000, z0: -148, x1: -420, z1: -132 }, { x0: -1000, z0: -28, x1: -420, z1: -12 },
  { x0: -1000, z0: 92, x1: -420, z1: 108 }, { x0: -1000, z0: 212, x1: -420, z1: 228 },
  // Old Town grid.
  { x0: -368, z0: 180, x1: -352, z1: 700 }, { x0: -248, z0: 180, x1: -232, z1: 700 },
  { x0: -128, z0: 180, x1: -112, z1: 700 }, { x0: -8, z0: 180, x1: 8, z1: 700 },
  { x0: 112, z0: 180, x1: 128, z1: 700 }, { x0: 232, z0: 180, x1: 248, z1: 700 },
  { x0: -420, z0: 252, x1: 300, z1: 268 }, { x0: -420, z0: 372, x1: 300, z1: 388 },
  { x0: -420, z0: 492, x1: 300, z1: 508 }, { x0: -420, z0: 612, x1: 300, z1: 628 },
  // North Shore grid.
  { x0: -888, z0: -700, x1: -872, z1: -260 }, { x0: -648, z0: -700, x1: -632, z1: -260 },
  { x0: -408, z0: -700, x1: -392, z1: -260 }, { x0: -168, z0: -700, x1: -152, z1: -260 },
  { x0: 72, z0: -700, x1: 88, z1: -260 },
  { x0: -1000, z0: -588, x1: 300, z1: -572 }, { x0: -1000, z0: -448, x1: 300, z1: -432 },
  { x0: -1000, z0: -328, x1: 300, z1: -312 },
  // Port roads.
  { x0: 372, z0: 280, x1: 390, z1: 700 }, { x0: 452, z0: 280, x1: 470, z1: 700 },
  { x0: 300, z0: 372, x1: 560, z1: 390 }, { x0: 300, z0: 512, x1: 560, z1: 530 },
  { x0: 300, z0: 632, x1: 560, z1: 650 },
  // Marina cross streets.
  { x0: 560, z0: 132, x1: 760, z1: 148 }, { x0: 560, z0: 272, x1: 760, z1: 288 },
  { x0: 560, z0: 412, x1: 760, z1: 428 }, { x0: 560, z0: 552, x1: 760, z1: 568 },
  // Strip cross streets.
  { x0: 560, z0: -588, x1: 760, z1: -572 }, { x0: 560, z0: -448, x1: 760, z1: -432 },
  { x0: 560, z0: -168, x1: 760, z1: -152 }, { x0: 560, z0: -28, x1: 760, z1: -12 },
];

function inRect(x, z, r) {
  return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
}

export function isLand(x, z) {
  for (const key of Object.keys(LAND)) if (inRect(x, z, LAND[key])) return true;
  return false;
}

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (inRect(x, z, d)) return d;
  return null;
}

function overlapsRoad(x0, z0, x1, z1, pad) {
  for (const r of ROADS) {
    if (x0 - pad < r.x1 && x1 + pad > r.x0 && z0 - pad < r.z1 && z1 + pad > r.z0) return true;
  }
  return false;
}

// Keep-out spots for buildings: the respray garage, the marina combat
// staging, the dealer and the safehouse must never have a building on top.
const KEEP_CLEAR = [[675, -160, 34], [672, 412, 22], [700, 420, 30], [-700, 60, 26], [640, -120, 24]];
export const RACE_ROUTE = [
  [700, -520], [700, -200], [700, 120], [700, 420], [640, 520], [600, 300],
  [600, 0], [600, -300], [640, -520],
];

export function buildCity(rng) {
  const buildings = [];
  const palms = [];
  const signs = [];
  const tapes = [];

  // Buildings: a jittered grid per district, skipping roads, water and the
  // landmark plot. Downtown towers; the Strip's hotel row; low-rise elsewhere.
  for (const d of DISTRICTS) {
    const tall = d.id === 'downtown';
    const hotel = d.id === 'strip';
    const step = tall ? 62 : hotel ? 46 : 52;
    for (let gx = d.x0 + 26; gx < d.x1 - 26; gx += step) {
      for (let gz = d.z0 + 26; gz < d.z1 - 26; gz += step) {
        if (rng.chance(0.22)) continue;
        const w = rng.range(16, tall ? 30 : 24);
        const dep = rng.range(16, tall ? 30 : 24);
        const x = gx + rng.range(-6, 6);
        const z = gz + rng.range(-6, 6);
        if (overlapsRoad(x - w / 2, z - dep / 2, x + w / 2, z + dep / 2, 4)) continue;
        if (!isLand(x - w / 2, z - dep / 2) || !isLand(x + w / 2, z + dep / 2)) continue;
        let clear = true;
        for (const [kx, kz, kr] of KEEP_CLEAR) {
          if (Math.hypot(x - kx, z - kz) < kr) {
            clear = false;
            break;
          }
        }
        if (!clear) continue;
        const lm = d.landmarkAt;
        if (Math.abs(x - lm[0]) < 45 && Math.abs(z - lm[1]) < 45) continue;
        const h = tall ? rng.range(28, 95) : hotel ? rng.range(14, 42) : rng.range(7, 20);
        buildings.push({ x, z, w, d: dep, h, color: rng.pick(d.palette), district: d.id });
      }
    }
  }
  // The Solmar Tower: the city's tallest landmark, downtown.
  buildings.push({ x: -150, z: -40, w: 42, d: 42, h: 150, color: '#1c2541', district: 'downtown', tower: true });

  // Palms: both sides of Ocean Drive, the beach edge, causeways and plazas.
  for (let z = -640; z <= 640; z += 32) {
    if (rng.chance(0.25)) continue;
    palms.push({ x: 682 + rng.range(-3, 3), z: z + rng.range(-4, 4), s: rng.range(0.8, 1.25) });
    if (rng.chance(0.6)) palms.push({ x: 720 + rng.range(-3, 3), z: z + rng.range(-4, 4), s: rng.range(0.8, 1.25) });
  }
  for (let i = 0; i < 40; i += 1) {
    palms.push({ x: rng.range(300, 560), z: rng.pick([-295, 210]) + rng.range(-6, 6), s: rng.range(0.7, 1.1) });
  }
  for (let i = 0; i < 26; i += 1) {
    palms.push({ x: -60 + rng.range(-40, 40), z: 440 + rng.range(-40, 40), s: rng.range(0.8, 1.2) });
  }

  // Neon signs on the Strip + port + downtown (canvas textures in render3d).
  const signDefs = [
    { text: 'NEON PIER', x: 706, z: -300, color: '#ff2e88', big: true },
    { text: 'FLAMINGO', x: 664, z: -420, color: '#ff5d8f', big: true },
    { text: 'SOLMAR', x: -150, z: -62, color: '#4cc9f0', big: true },
    { text: 'TAPES', x: 640, z: -120, color: '#ffd166', big: false },
    { text: 'MARINA', x: 700, z: 420, color: '#4cc9f0', big: false },
    { text: 'PORT', x: 430, z: 490, color: '#adb5bd', big: false },
    { text: 'HOTEL PALMS', x: 700, z: -180, color: '#ffb3c1', big: false },
    { text: 'TIKI BAR', x: 664, z: -180, color: '#ff9f1c', big: false },
    { text: 'ARCADE', x: 706, z: -540, color: '#4cc9f0', big: false },
    { text: 'STADIUM', x: -650, z: -480, color: '#a7c957', big: false },
  ];
  for (const s of signDefs) signs.push(s);

  // 20 Sunset Tapes, seeded on land near roads and landmarks.
  const tapeSpots = [
    [-150, -70], [-650, -470], [-710, 50], [-60, 430], [700, -310], [720, 610],
    [430, 480], [640, -120], [700, 410], [660, -410], [-380, -190], [-940, -140],
    [-240, 500], [100, 160], [600, -560], [600, 560], [380, 380], [-880, -580],
    [200, 620], [-40, -260],
  ];
  for (let i = 0; i < TAPE_COUNT; i += 1) {
    const s = tapeSpots[i];
    tapes.push({ id: i, x: s[0] + rng.range(-8, 8), z: s[1] + rng.range(-8, 8) });
  }

  return { buildings, palms, signs, tapes, roads: ROADS, districts: DISTRICTS };
}

// Circle vs building footprints: the one collision query every mover uses.
export function hitBuilding(city, x, z, radius) {
  for (const b of city.buildings) {
    if (x > b.x - b.w / 2 - radius && x < b.x + b.w / 2 + radius && z > b.z - b.d / 2 - radius && z < b.z + b.d / 2 + radius) {
      return b;
    }
  }
  return null;
}

// World <-> plan coordinates (the plan spans WORLD exactly).
export function worldToPlan(x, z, w, h) {
  return [(x - WORLD.minX) / (WORLD.maxX - WORLD.minX) * w, (z - WORLD.minZ) / (WORLD.maxZ - WORLD.minZ) * h];
}

// One plan-drawing function for the ground texture, the minimap and the map.
// opts: labels (district names), water (ocean color), detail (blocks/parks).
export function drawPlan(ctx, w, h, opts = {}) {
  const sx = w / (WORLD.maxX - WORLD.minX);
  const sz = h / (WORLD.maxZ - WORLD.minZ);
  const px = (x) => (x - WORLD.minX) * sx;
  const pz = (z) => (z - WORLD.minZ) * sz;
  const pw = (dx) => dx * sx;
  const ph = (dz) => dz * sz;

  // Ocean.
  const ocean = ctx.createLinearGradient(0, 0, w, h);
  ocean.addColorStop(0, opts.water || '#0b3d66');
  ocean.addColorStop(1, '#062a49');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, w, h);

  // Beach sand along the island's east edge and the south shore.
  ctx.fillStyle = '#ecd9a0';
  ctx.fillRect(px(742), 0, pw(20), h);
  ctx.fillRect(0, ph(688), w, ph(12));

  // Land masses.
  for (const key of Object.keys(LAND)) {
    const r = LAND[key];
    ctx.fillStyle = key === 'island' ? '#2e4038' : key === 'port' ? '#3a3f44' : '#33402f';
    ctx.fillRect(px(r.x0), pz(r.z0), pw(r.x1 - r.x0), ph(r.z1 - r.z0));
  }
  // District tint washes.
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.palette[0] + '22';
    ctx.fillRect(px(d.x0), pz(d.z0), pw(d.x1 - d.x0), ph(d.z1 - d.z0));
  }
  // Parks (North Shore + Old Town).
  ctx.fillStyle = '#4a7c3a';
  ctx.fillRect(px(-900), pz(-620), pw(180), ph(120));
  ctx.fillRect(px(-140), pz(400), pw(160), ph(90));

  // Roads (lighter than the first draft: the near-black asphalt was
  // swallowing the cars at sunset in the 3D view).
  ctx.fillStyle = '#262b31';
  for (const r of ROADS) ctx.fillRect(px(r.x0), pz(r.z0), pw(r.x1 - r.x0), ph(r.z1 - r.z0));
  // Beachfront promenade along the island's east edge.
  ctx.fillRect(px(732), 0, pw(10), h);
  // Diagonal boulevard across Downtown (scenic: it breaks the grid on the
  // map; cars don't route on it, so it stays out of ROADS).
  ctx.strokeStyle = '#262b31';
  ctx.lineWidth = Math.max(6, pw(20));
  ctx.beginPath();
  ctx.moveTo(px(-420), pz(-260));
  ctx.lineTo(px(120), pz(180));
  ctx.stroke();
  ctx.strokeStyle = '#e8e8a0';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(px(-420), pz(-260));
  ctx.lineTo(px(120), pz(180));
  ctx.stroke();
  ctx.setLineDash([]);
  // Centre dashes on the two island avenues.
  ctx.fillStyle = '#e8e8a0';
  for (const rx of [700, 600]) {
    for (let z = -640; z < 640; z += 28) ctx.fillRect(px(rx) - 1, pz(z), 2, ph(12));
  }
  // Causeway edges.
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 2;
  for (const cz of [-295, 210]) {
    ctx.beginPath();
    ctx.moveTo(px(300), pz(cz - 15));
    ctx.lineTo(px(560), pz(cz - 15));
    ctx.moveTo(px(300), pz(cz + 15));
    ctx.lineTo(px(560), pz(cz + 15));
    ctx.stroke();
  }
  // Pier + docks.
  ctx.fillStyle = '#8b6f47';
  ctx.fillRect(px(700), pz(-310), pw(60), ph(10));
  for (let i = 0; i < 5; i += 1) ctx.fillRect(px(700 + i * 12), pz(360), pw(6), ph(60));
  // Stadium oval + lighthouse dot.
  ctx.fillStyle = '#5a7d4a';
  ctx.beginPath();
  ctx.ellipse(px(-650), pz(-480), pw(55), ph(35), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px(720), pz(620), 6, 0, Math.PI * 2);
  ctx.fill();

  if (opts.labels) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `bold ${Math.max(11, w / 90)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      ctx.fillText(d.name.toUpperCase(), px((d.x0 + d.x1) / 2), pz((d.z0 + d.z1) / 2));
    }
  }
}
