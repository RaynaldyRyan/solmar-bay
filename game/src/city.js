// The city: an 8x8 grid of art-deco blocks, a neon boulevard facing the
// beach, plaza, park, harbor warehouses, pier, ferris wheel and lighthouse.
// Roads and markings are drawn into one big ground texture; buildings get
// procedural facades with lit windows and neon roofline trim.
import { CFG, PALETTE, NEON_SIGNS, clamp } from './config.js';
import {
  makeFacadeTexture, makeSidewalkTexture, makeSandTexture, makeOceanTexture,
  makeNeonSignTexture, makeGlowTexture, makeFrondTexture,
} from './textures.js';

const P = CFG.PITCH, HALF = CFG.ROAD_HALF;

// One 1024px texture for the whole street grid: asphalt roads with dashed
// center lines and crosswalks, sidewalk-colored block interiors.
function makeGroundTexture() {
  const S = 1024, c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d');
  const worldToPx = (v) => ((v + 214) / 428) * S;
  g.fillStyle = PALETTE.sidewalk; g.fillRect(0, 0, S, S);
  // block interiors: slightly varied sidewalk tones
  for (let i = -4; i < 4; i++) {
    for (let j = -4; j < 4; j++) {
      g.fillStyle = (i + j) % 2 === 0 ? '#9d97ab' : '#948ea1';
      g.fillRect(worldToPx(i * P + HALF), worldToPx(j * P + HALF), worldToPx(P - 2 * HALF) - worldToPx(0), worldToPx(P - 2 * HALF) - worldToPx(0));
    }
  }
  // roads
  g.fillStyle = PALETTE.road;
  for (let k = -4; k <= 4; k++) {
    g.fillRect(worldToPx(k * P - HALF), 0, worldToPx(2 * HALF) - worldToPx(0), S);
    g.fillRect(0, worldToPx(k * P - HALF), S, worldToPx(2 * HALF) - worldToPx(0));
  }
  // dashed center lines (yellow) along every road
  g.fillStyle = '#e8b93a';
  for (let k = -4; k <= 4; k++) {
    for (let d = -204; d < 204; d += 12) {
      g.fillRect(worldToPx(k * P) - 1, worldToPx(d), 2, worldToPx(6) - worldToPx(0));
      g.fillRect(worldToPx(d), worldToPx(k * P) - 1, worldToPx(6) - worldToPx(0), 2);
    }
  }
  // crosswalks at every intersection
  g.fillStyle = 'rgba(255,255,255,0.6)';
  for (let a = -4; a <= 4; a++) {
    for (let b = -4; b <= 4; b++) {
      for (let s = -1; s <= 1; s++) {
        g.fillRect(worldToPx(a * P - HALF + 1), worldToPx(b * P + s * 4 - 1), worldToPx(2 * HALF - 2) - worldToPx(0), 2);
        g.fillRect(worldToPx(a * P + s * 4 - 1), worldToPx(b * P - HALF + 1), 2, worldToPx(2 * HALF - 2) - worldToPx(0));
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 8;
  return t;
}

export function buildCity(scene, rng) {
  const colliders = []; // {minX, maxX, minZ, maxZ}
  const obstacles = []; // {x, z, r} circles
  const glowTex = makeGlowTexture();
  const frondTex = makeFrondTexture();
  const animated = { ferris: null, cabins: [], beam: null, oceanTex: null, boats: [], signs: [] };

  // --- ground ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(428, 428),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 0.9, metalness: 0.05 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // outer apron (grass) under everything
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600),
    new THREE.MeshStandardMaterial({ color: 0x4a6741, roughness: 1 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.15;
  apron.receiveShadow = true;
  scene.add(apron);

  // --- shared materials / geometries ---
  const facadeTex = [];
  for (let i = 0; i < 8; i++) {
    facadeTex.push(makeFacadeTexture(rng, rng.pick(PALETTE.facades), rng.pick(PALETTE.trim)));
  }
  const facadeMats = facadeTex.map((t) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.75, metalness: 0.05 }));
  const roofMats = PALETTE.roofs.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
  const sidewalkMat = new THREE.MeshStandardMaterial({ map: makeSidewalkTexture(), roughness: 0.95 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2a33, roughness: 0.8 });

  function addBox(mat, x, y, z, w, h, d, cast = true, recv = true) {
    const m = new THREE.Mesh(boxGeo, mat);
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    m.castShadow = cast; m.receiveShadow = recv;
    scene.add(m);
    return m;
  }

  // --- blocks ---
  const SPECIAL = { '0,0': 'plaza', '-3,-3': 'park', '3,3': 'harbor', '2,2': 'garage' };
  const landmarks = {};
  for (let i = -4; i < 4; i++) {
    for (let j = -4; j < 4; j++) {
      const kind = SPECIAL[i + ',' + j] || 'buildings';
      const bx0 = i * P + HALF, bz0 = j * P + HALF;
      const cx = bx0 + CFG.BLOCK / 2, cz = bz0 + CFG.BLOCK / 2;
      // sidewalk base for the block
      addBox(sidewalkMat, cx, 0.06, cz, CFG.BLOCK, 0.12, CFG.BLOCK, false, true);
      if (kind === 'plaza') { landmarks.plaza = { x: cx, z: cz }; continue; }
      if (kind === 'park') { landmarks.park = { x: cx, z: cz }; continue; }
      if (kind === 'harbor') { landmarks.harbor = { x: cx, z: cz }; continue; }
      if (kind === 'garage') { landmarks.garageBlock = { x: cx, z: cz }; continue; }
      // buildings: one tower, or two side by side
      const nearBoulevard = i === 3;
      const tall = nearBoulevard || rng.chance(0.35);
      if (rng.chance(0.55)) {
        const w = CFG.BLOCK - rng.range(6, 12), d = CFG.BLOCK - rng.range(6, 12);
        const h = tall ? rng.range(26, 58) : rng.range(12, 26);
        addBuilding(cx, cz, w, h, d, nearBoulevard);
      } else {
        const h1 = tall ? rng.range(24, 50) : rng.range(10, 22);
        const h2 = tall ? rng.range(20, 44) : rng.range(10, 20);
        addBuilding(cx - 10, cz, 18, h1, CFG.BLOCK - 8, nearBoulevard);
        addBuilding(cx + 10, cz, 18, h2, CFG.BLOCK - 8, nearBoulevard);
      }
    }
  }

  function addBuilding(x, z, w, h, d, neonFace) {
    const mat = rng.pick(facadeMats);
    const b = addBox(mat, x, 0.12 + h / 2, z, w, h, d);
    // roof cap + rooftop clutter
    addBox(rng.pick(roofMats), x, 0.12 + h + 0.4, z, w * 0.96, 0.8, d * 0.96);
    if (rng.chance(0.7)) addBox(darkMat, x + rng.range(-w / 4, w / 4), 0.12 + h + 1.2, z + rng.range(-d / 4, d / 4), 3, 1.6, 2.4);
    if (rng.chance(0.4)) addBox(darkMat, x + rng.range(-w / 4, w / 4), 0.12 + h + 1.0, z + rng.range(-d / 4, d / 4), 2, 1.2, 2);
    colliders.push({ minX: x - w / 2 - 0.5, maxX: x + w / 2 + 0.5, minZ: z - d / 2 - 0.5, maxZ: z + d / 2 + 0.5 });
    // neon sign on the boulevard-facing (east) wall
    if (neonFace && rng.chance(0.75)) {
      const sign = rng.pick(NEON_SIGNS);
      const tex = makeNeonSignTexture(sign.text, sign.color);
      const sm = new THREE.Mesh(
        new THREE.PlaneGeometry(9, 3.4),
        new THREE.MeshBasicMaterial({ map: tex, transparent: false }),
      );
      sm.position.set(x + w / 2 + 0.15, rng.range(6, 12), z);
      sm.rotation.y = Math.PI / 2;
      scene.add(sm);
      animated.signs.push(sm);
    }
    return b;
  }

  // --- plaza: fountain, benches, palms ---
  const plaza = landmarks.plaza;
  const fountainBase = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 1.2, 24), new THREE.MeshStandardMaterial({ color: 0xd8d2e8, roughness: 0.6 }));
  fountainBase.position.set(plaza.x, 0.7, plaza.z);
  fountainBase.castShadow = fountainBase.receiveShadow = true;
  scene.add(fountainBase);
  const fountainWater = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.4, 0.3, 24), new THREE.MeshStandardMaterial({ color: 0x35c4e8, roughness: 0.15, metalness: 0.4 }));
  fountainWater.position.set(plaza.x, 1.25, plaza.z);
  scene.add(fountainWater);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 3.2, 10), new THREE.MeshStandardMaterial({ color: 0xe8e2f5, roughness: 0.5 }));
  spout.position.set(plaza.x, 2.6, plaza.z);
  spout.castShadow = true;
  scene.add(spout);
  const spray = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xbfefff, transparent: true, opacity: 0.7, depthWrite: false }));
  spray.scale.set(7, 5, 1);
  spray.position.set(plaza.x, 4.6, plaza.z);
  scene.add(spray);
  obstacles.push({ x: plaza.x, z: plaza.z, r: 8.5 });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    addBox(darkMat, plaza.x + Math.cos(a) * 12, 0.6, plaza.z + Math.sin(a) * 12, 2.6, 0.5, 0.9);
  }

  // --- park: grass, round trees, palms, paths ---
  const park = landmarks.park;
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(38, 38), new THREE.MeshStandardMaterial({ color: 0x5d8a4a, roughness: 1 }));
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(park.x, 0.14, park.z);
  grass.receiveShadow = true;
  scene.add(grass);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.9 });
  for (let k = 0; k < 7; k++) {
    const tx = park.x + rng.range(-16, 16), tz = park.z + rng.range(-16, 16);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3, 6), trunkMat);
    trunk.position.set(tx, 1.6, tz); trunk.castShadow = true;
    scene.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(rng.range(2.2, 3.4), 10, 8), leafMat);
    crown.position.set(tx, 4.6, tz); crown.scale.y = 0.8; crown.castShadow = true;
    scene.add(crown);
    obstacles.push({ x: tx, z: tz, r: 0.8 });
  }

  // --- harbor warehouses + crates ---
  const harbor = landmarks.harbor;
  const whMat = new THREE.MeshStandardMaterial({ color: 0xb0a89a, roughness: 0.85 });
  addBox(whMat, harbor.x - 8, 4, harbor.z, 20, 8, 30);
  addBox(whMat, harbor.x + 12, 3, harbor.z - 6, 14, 6, 16);
  colliders.push({ minX: harbor.x - 18, maxX: harbor.x + 2, minZ: harbor.z - 15, maxZ: harbor.z + 15 });
  colliders.push({ minX: harbor.x + 5, maxX: harbor.x + 19, minZ: harbor.z - 14, maxZ: harbor.z + 2 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x9a7b4f, roughness: 1 });
  for (let k = 0; k < 10; k++) {
    addBox(crateMat, harbor.x + rng.range(-16, 16), 1, harbor.z + rng.range(8, 18), 2, 2, 2);
  }

  // --- garage (Spray & Save) ---
  const gb = landmarks.garageBlock;
  const garageMat = new THREE.MeshStandardMaterial({ color: 0x3d5a80, roughness: 0.7 });
  addBox(garageMat, gb.x, 2.6, gb.z - 6, 22, 5, 16);
  colliders.push({ minX: gb.x - 11, maxX: gb.x + 11, minZ: gb.z - 14, maxZ: gb.z + 2 });
  const garageSign = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 3),
    new THREE.MeshBasicMaterial({ map: makeNeonSignTexture('SPRAY & SAVE', '#00ff9d') }),
  );
  garageSign.position.set(gb.x, 6.2, gb.z + 2.2);
  scene.add(garageSign);
  landmarks.garage = { x: gb.x, z: gb.z + 8 };

  // --- palms ---
  const palmTrunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 7, 7);
  const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 });
  const frondGeo = new THREE.PlaneGeometry(1.4, 5.5);
  const frondMat = new THREE.MeshStandardMaterial({ map: frondTex, transparent: true, side: THREE.DoubleSide, roughness: 0.9, alphaTest: 0.3 });
  function addPalm(x, z, scale) {
    const palm = new THREE.Group();
    const lean = rng.range(-0.12, 0.12);
    const trunk = new THREE.Mesh(palmTrunkGeo, palmTrunkMat);
    trunk.position.y = 3.5;
    trunk.rotation.z = lean;
    trunk.castShadow = true;
    palm.add(trunk);
    const topY = 7, topX = -Math.sin(lean) * 7;
    for (let f = 0; f < 7; f++) {
      const pivot = new THREE.Group();
      pivot.position.set(topX, topY, 0);
      pivot.rotation.y = (f / 7) * Math.PI * 2;
      const fr = new THREE.Mesh(frondGeo, frondMat);
      // frond plane's long axis is Y with the tip at +Y; tip it outward
      // and drooping down (positive X rotation swings +Y toward +Z and down)
      fr.position.set(0, 1.0, 1.6);
      fr.rotation.x = 2.2;
      fr.castShadow = true;
      pivot.add(fr);
      palm.add(pivot);
    }
    const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 }));
    nuts.position.set(topX, topY - 0.5, 0);
    palm.add(nuts);
    palm.position.set(x, 0, z);
    palm.scale.setScalar(scale || 1);
    palm.rotation.y = rng.range(0, Math.PI * 2);
    scene.add(palm);
    obstacles.push({ x, z, r: 0.7 });
  }
  // boulevard rows
  for (let z = -195; z <= 195; z += 26) {
    addPalm(200, z + rng.range(-2, 2), rng.range(0.9, 1.15));
    if (rng.chance(0.7)) addPalm(216, z + 13, rng.range(0.9, 1.1));
  }
  // plaza + park + beach palms
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    addPalm(plaza.x + Math.cos(a) * 17, plaza.z + Math.sin(a) * 17, 1);
  }
  for (let k = 0; k < 6; k++) addPalm(park.x + rng.range(-17, 17), park.z + rng.range(-17, 17), rng.range(0.9, 1.1));
  for (let z = -180; z <= 180; z += 30) addPalm(224 + rng.range(-2, 4), z, rng.range(1, 1.25));

  // --- street lamps with glow ---
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x33333d, roughness: 0.6, metalness: 0.6 });
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  function addLamp(x, z) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 6), lampPoleMat);
    pole.position.set(x, 3.5, z);
    pole.castShadow = false;
    scene.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), lampHeadMat);
    head.position.set(x, 7.2, z);
    scene.add(head);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd97a, transparent: true, opacity: 0.5, depthWrite: false }));
    glow.scale.set(6, 6, 1);
    glow.position.set(x, 7.2, z);
    scene.add(glow);
    obstacles.push({ x, z, r: 0.4 });
  }
  for (const k of [-4, -2, 0, 2, 4]) {
    for (let d = -182; d <= 182; d += 52) {
      addLamp(k * P + HALF + 1.5, d);
      addLamp(d, k * P + HALF + 1.5);
    }
  }
  for (let z = -182; z <= 182; z += 26) addLamp(201, z + 13);

  // --- beach, ocean, pier ---
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(38, 428), new THREE.MeshStandardMaterial({ map: makeSandTexture(), roughness: 1 }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(233, 0.05, 0);
  sand.receiveShadow = true;
  scene.add(sand);
  const oceanTex = makeOceanTexture();
  animated.oceanTex = oceanTex;
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 1600),
    new THREE.MeshStandardMaterial({ map: oceanTex, color: 0x9db8e8, roughness: 0.22, metalness: 0.55 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(252 + 350, -0.25, 0);
  scene.add(ocean);
  // beach umbrellas
  const umbColors = [0xff2e88, 0x00e5ff, 0xffea00, 0xff6b35];
  for (let k = 0; k < 8; k++) {
    const ux = 224 + rng.range(0, 12), uz = -160 + k * 46 + rng.range(-8, 8);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 5), lampPoleMat);
    pole.position.set(ux, 1.3, uz);
    scene.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.9, 8), new THREE.MeshStandardMaterial({ color: rng.pick(umbColors), roughness: 0.8, side: THREE.DoubleSide }));
    top.position.set(ux, 2.9, uz);
    top.castShadow = true;
    scene.add(top);
    obstacles.push({ x: ux, z: uz, r: 0.5 });
  }
  // pier
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 });
  for (let x = 216; x <= 306; x += 6) {
    addBox(pierMat, x, 0.8, 0, 6, 0.5, 8, true, true);
    addBox(pierMat, x, -0.4, -3.6, 0.5, 2.4, 0.5);
    addBox(pierMat, x, -0.4, 3.6, 0.5, 2.4, 0.5);
  }
  addBox(pierMat, 308, 1.6, 0, 8, 3.2, 10);
  const pierSign = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.4), new THREE.MeshBasicMaterial({ map: makeNeonSignTexture('PIER 9', '#00e5ff') }));
  pierSign.position.set(308, 4.4, 0);
  pierSign.rotation.y = -Math.PI / 2;
  scene.add(pierSign);
  landmarks.pier = { x: 306, z: 0 };
  obstacles.push({ x: 308, z: 0, r: 6 });

  // --- ferris wheel ---
  const fw = new THREE.Group();
  fw.position.set(238, 0, 64);
  const legMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5, metalness: 0.3 });
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 24, 6), legMat);
    leg.position.set(0, 12, s * 5);
    leg.rotation.x = s * 0.22;
    leg.castShadow = true;
    fw.add(leg);
  }
  const wheel = new THREE.Group();
  wheel.position.y = 21;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(17, 0.5, 8, 40), legMat);
  rim.castShadow = true;
  wheel.add(rim);
  for (let s = 0; s < 8; s++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 34, 5), legMat);
    spoke.rotation.z = (s / 8) * Math.PI;
    wheel.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2e88 }));
  wheel.add(hub);
  // neon rim lights
  const rimGlow = new THREE.Mesh(new THREE.TorusGeometry(17, 0.28, 6, 40), new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
  rimGlow.position.z = 0.6;
  wheel.add(rimGlow);
  fw.add(wheel);
  scene.add(fw);
  animated.ferris = wheel;
  const cabinColors = [0xff2e88, 0x00e5ff, 0xffea00, 0xb537f2];
  for (let s = 0; s < 8; s++) {
    const cab = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: cabinColors[s % 4], roughness: 0.5 }));
    cab.scale.set(2.6, 2, 2);
    cab.castShadow = true;
    scene.add(cab);
    animated.cabins.push(cab);
  }
  landmarks.ferris = { x: 238, z: 64 };
  obstacles.push({ x: 238, z: 64, r: 8 });

  // --- lighthouse ---
  const lh = new THREE.Group();
  lh.position.set(240, 0, -160);
  const lhWhite = new THREE.MeshStandardMaterial({ color: 0xf5f0e6, roughness: 0.8 });
  const lhRed = new THREE.MeshStandardMaterial({ color: 0xd43d3d, roughness: 0.8 });
  for (let s = 0; s < 5; s++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(3.4 - s * 0.35, 3.7 - s * 0.35, 4.4, 12), s % 2 === 0 ? lhWhite : lhRed);
    seg.position.y = 2.2 + s * 4.4;
    seg.castShadow = true;
    lh.add(seg);
  }
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 2.6, 10), darkMat);
  lampRoom.position.y = 24.5;
  lh.add(lampRoom);
  const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff6c9 }));
  lampBulb.position.y = 24.5;
  lh.add(lampBulb);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(6, 55, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  beam.position.y = 24.5;
  beam.rotation.z = Math.PI / 2;
  beam.translateY(27);
  lh.add(beam);
  animated.beam = beam;
  scene.add(lh);
  landmarks.lighthouse = { x: 240, z: -160 };
  obstacles.push({ x: 240, z: -160, r: 5 });

  // --- boats ---
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.4 });
  const hullMat2 = new THREE.MeshStandardMaterial({ color: 0x3d7ab8, roughness: 0.4 });
  for (let k = 0; k < 5; k++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(boxGeo, k % 2 ? hullMat : hullMat2);
    hull.scale.set(7, 1.6, 2.6);
    hull.castShadow = true;
    boat.add(hull);
    const cab = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
    cab.scale.set(2.6, 1.6, 2);
    cab.position.set(-0.5, 1.5, 0);
    boat.add(cab);
    boat.position.set(280 + rng.range(0, 90), 0.4, -180 + k * 85 + rng.range(-15, 15));
    boat.rotation.y = rng.range(0, Math.PI * 2);
    scene.add(boat);
    animated.boats.push({ g: boat, phase: rng.range(0, Math.PI * 2) });
  }

  let neonTimer = 0;
  return {
    colliders,
    obstacles,
    landmarks,
    update(dt, time) {
      if (animated.ferris) {
        animated.ferris.rotation.z += dt * 0.12;
        const a0 = animated.ferris.rotation.z;
        animated.cabins.forEach((cab, i) => {
          const a = a0 + (i / 8) * Math.PI * 2;
          cab.position.set(238 + Math.cos(a) * 17, 21 + Math.sin(a) * 17, 64);
        });
      }
      if (animated.beam) animated.beam.rotation.y += dt * 0.5;
      if (animated.oceanTex) { animated.oceanTex.offset.x += dt * 0.004; animated.oceanTex.offset.y += dt * 0.002; }
      for (const b of animated.boats) {
        b.g.position.y = 0.4 + Math.sin(time * 0.8 + b.phase) * 0.25;
        b.g.rotation.z = Math.sin(time * 0.6 + b.phase) * 0.04;
      }
      // occasional neon flicker on one random sign
      neonTimer -= dt;
      if (neonTimer <= 0) {
        neonTimer = rng.range(1.5, 5);
        const s = rng.pick(animated.signs);
        if (s) {
          s.visible = false;
          setTimeout(() => { s.visible = true; }, 90);
        }
      }
    },
  };
}

// Circle vs AABB collision: pushes a circle (x, z, r) out of every collider.
// Returns true when a push happened. Used by the player, cars and cops.
export function resolveCircleColliders(pos, r, colliders) {
  let hit = false;
  for (const c of colliders) {
    const nx = clamp(pos.x, c.minX, c.maxX);
    const nz = clamp(pos.z, c.minZ, c.maxZ);
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * r;
        pos.z = nz + (dz / d) * r;
      } else {
        // center inside the box: push out along the smallest penetration axis
        const pl = pos.x - c.minX, pr = c.maxX - pos.x;
        const pt = pos.z - c.minZ, pb = c.maxZ - pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = c.minX - r;
        else if (m === pr) pos.x = c.maxX + r;
        else if (m === pt) pos.z = c.minZ - r;
        else pos.z = c.maxZ + r;
      }
    }
  }
  return hit;
}

export function resolveCircleObstacles(pos, r, obstacles) {
  let hit = false;
  for (const o of obstacles) {
    const dx = pos.x - o.x, dz = pos.z - o.z;
    const rr = r + o.r, d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      pos.x = o.x + (dx / d) * rr;
      pos.z = o.z + (dz / d) * rr;
      hit = true;
    }
  }
  return hit;
}

// Segment vs AABB test for bullet occlusion: true when the segment from
// (ax,az) to (bx,bz) crosses any collider.
export function segmentBlocked(ax, az, bx, bz, colliders) {
  for (const c of colliders) {
    const dx = bx - ax, dz = bz - az;
    let tmin = 0, tmax = 1;
    if (Math.abs(dx) < 1e-9) {
      if (ax < c.minX || ax > c.maxX) continue;
    } else {
      let t1 = (c.minX - ax) / dx, t2 = (c.maxX - ax) / dx;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }
    if (Math.abs(dz) < 1e-9) {
      if (az < c.minZ || az > c.maxZ) continue;
    } else {
      let t1 = (c.minZ - az) / dz, t2 = (c.maxZ - az) / dz;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }
    return true;
  }
  return false;
}
