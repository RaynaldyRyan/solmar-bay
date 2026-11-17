// Solmar Bay — the city itself.
// One clear job: generate every static piece of the world (roads, buildings, plaza,
// park, harbor, beach, pier, lighthouse, Ferris wheel, ocean, palms, clouds) and
// answer collision and road queries for the player, cars and combat.

import { WORLD, PALETTE } from './config.js';
import { Rng, clamp } from './random.js';
import {
  facadeTexture, roadTexture, sidewalkTexture, sandTexture,
  oceanTexture, grassTexture, frondTexture,
} from './textures.js';

function signTexture(text, sub, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = fg;
  g.lineWidth = 6;
  g.strokeRect(6, 6, 500, 116);
  g.fillStyle = fg;
  g.font = 'bold 54px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, sub ? 48 : 64);
  if (sub) {
    g.font = 'bold 30px Arial, sans-serif';
    g.fillText(sub, 256, 96);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class City {
  constructor(scene, seed = 1) {
    this.scene = scene;
    this.rng = new Rng(seed);
    this.buildings = []; // {minX,maxX,minZ,maxZ,height}
    this.group = new THREE.Group();
    scene.add(this.group);
    this.animated = []; // {mesh, fn(t)}
    this.landmarks = {
      plaza: { x: 0, z: 0, name: 'Central Plaza' },
      tower: { x: 38, z: 0, name: 'Grand Solmar' },
      park: { x: -76, z: -76, name: 'Palma Park' },
      harbor: { x: 133, z: 133, name: 'Old Harbor' },
      diner: { x: 95, z: -19, name: "Rosa's Diner" },
      spray: { x: -95, z: 95, name: 'Spray & Save' },
      hospital: { x: 57, z: 57, name: 'Solmar General' },
      police: { x: -19, z: -95, name: 'SBPD Central' },
      pier: { x: -19, z: 178, name: 'Solmar Pier' },
      beach: { x: 19, z: 158, name: 'Coral Beach' },
    };
    this._buildGround();
    this._buildRoads();
    this._buildBlocks();
    this._buildPlaza();
    this._buildPark();
    this._buildHarbor();
    this._buildBeach();
    this._buildOcean();
    this._buildClouds();
    this._buildStreetlights();
  }

  _mat(color, opts = {}) {
    return new THREE.MeshLambertMaterial({ color, ...opts });
  }

  _box(w, h, d, mat, x, y, z, parent = this.group) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = h > 2;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  _buildGround() {
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(760, 760),
      new THREE.MeshLambertMaterial({ map: grassTexture() }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, -0.05, -40);
    grass.receiveShadow = true;
    this.group.add(grass);
    // Sand strip along the shore.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(760, 34),
      new THREE.MeshLambertMaterial({ map: sandTexture() }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.0, WORLD.SHORE_Z - 8);
    sand.receiveShadow = true;
    this.group.add(sand);
  }

  _buildRoads() {
    const roadMat = new THREE.MeshLambertMaterial({ map: roadTexture() });
    const sideMat = new THREE.MeshLambertMaterial({ map: sidewalkTexture() });
    const L = WORLD.CITY_EDGE * 2 + 24;
    for (const r of WORLD.ROADS) {
      const rx = new THREE.Mesh(new THREE.PlaneGeometry(L, WORLD.ROAD_WIDTH), roadMat);
      rx.rotation.x = -Math.PI / 2;
      rx.rotation.z = Math.PI / 2;
      rx.position.set(r, 0.02, 0);
      rx.receiveShadow = true;
      this.group.add(rx);
      const rz = new THREE.Mesh(new THREE.PlaneGeometry(L, WORLD.ROAD_WIDTH), roadMat);
      rz.rotation.x = -Math.PI / 2;
      rz.position.set(0, 0.015, r);
      rz.receiveShadow = true;
      this.group.add(rz);
    }
    // Sidewalk slabs under each block.
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const cx = -114 + i * WORLD.PITCH;
        const cz = -114 + j * WORLD.PITCH;
        const slab = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), sideMat);
        slab.rotation.x = -Math.PI / 2;
        slab.position.set(cx, 0.012, cz);
        slab.receiveShadow = true;
        this.group.add(slab);
      }
    }
  }

  _addBuilding(cx, cz, w, h, d, facadeTex, sign = null) {
    const side = new THREE.MeshLambertMaterial({ map: facadeTex });
    const roof = this._mat(PALETTE.roof);
    const mats = [side, side, roof, roof, side, side];
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    m.position.set(cx, h / 2, cz);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    this.buildings.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, height: h });
    if (sign) {
      const sm = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.8, 3),
        new THREE.MeshBasicMaterial({ map: sign, transparent: false }),
      );
      sm.position.set(cx, Math.min(h - 1.5, 7), cz - d / 2 - 0.15);
      sm.rotation.y = Math.PI;
      this.group.add(sm);
    }
    return m;
  }

  _buildBlocks() {
    const rng = this.rng;
    // One facade texture per palette colour, shared across buildings.
    const facades = PALETTE.facades.map((c) => {
      const hex = `#${c.toString(16).padStart(6, '0')}`;
      return facadeTexture(hex, new Rng(100 + c % 97), 8, 5);
    });
    const special = new Set(['0,0', '-76,-76', '114,114', '38,0', '95,-19', '-95,95', '57,57', '-19,-95']);
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const cx = -114 + i * WORLD.PITCH;
        const cz = -114 + j * WORLD.PITCH;
        if (special.has(`${cx},${cz}`)) continue;
        const count = rng.int(1, 3);
        for (let k = 0; k < count; k++) {
          const w = rng.float(9, 15);
          const d = rng.float(9, 15);
          const h = rng.float(8, 34) * (rng.chance(0.12) ? 1.6 : 1);
          const ox = count === 1 ? 0 : rng.float(-7, 7);
          const oz = count === 1 ? 0 : rng.float(-7, 7);
          this._addBuilding(cx + ox, cz + oz, w, Math.min(h, 44), d, rng.pick(facades));
        }
        // Palms on the block corners.
        if (rng.chance(0.7)) this._palm(cx - 13, cz - 13);
        if (rng.chance(0.7)) this._palm(cx + 13, cz + 13);
      }
    }
    // Grand Solmar tower — the 72 m landmark beside the plaza.
    const towerTex = facadeTexture('#e8d8c0', new Rng(7), 22, 6);
    this._addBuilding(38, 0, 20, 72, 20, towerTex);
    this._box(22, 2, 22, this._mat(0xc9a86a), 38, 73, 0);
    // Rosa's Diner (mission 1 target).
    this._addBuilding(95, -19, 16, 7, 12, facades[1],
      signTexture("ROSA'S DINER", 'EAT • DRINK • TIPS', '#7a2e2e', '#ffe9a8'));
    // Spray & Save garage (clears wanted).
    this._addBuilding(-95, 95, 18, 8, 14, facades[5],
      signTexture('SPRAY & SAVE', 'WANTED GONE • $150', '#1f4a6a', '#a8e8ff'));
    // Hospital (wasted respawn).
    this._addBuilding(57, 57, 20, 14, 16, facades[2],
      signTexture('SOLMAR GENERAL', 'HOSPITAL', '#e8e8e8', '#2e8f5a'));
    // Police station (busted respawn).
    this._addBuilding(-19, -95, 20, 12, 16, facades[6],
      signTexture('SBPD CENTRAL', 'SOLMAR BAY POLICE', '#1a2a4a', '#d8e8ff'));
  }

  _palm(x, z, s = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22 * s, 0.34 * s, 5.5 * s, 6),
      this._mat(PALETTE.palmTrunk),
    );
    trunk.position.y = 2.75 * s;
    trunk.rotation.z = 0.08;
    trunk.castShadow = true;
    g.add(trunk);
    const frondMat = new THREE.MeshLambertMaterial({
      map: frondTexture(), transparent: true, side: THREE.DoubleSide, alphaTest: 0.3,
    });
    for (let i = 0; i < 7; i++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(2.6 * s, 2.6 * s), frondMat);
      f.position.y = 5.6 * s;
      f.rotation.y = (i / 7) * Math.PI * 2;
      f.rotation.x = -0.9;
      f.translateY(1.1 * s);
      g.add(f);
    }
    g.position.set(x, 0, z);
    this.group.add(g);
    return g;
  }

  _tree(x, z, s = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 2.5 * s, 6),
      this._mat(0x6a4a2e),
    );
    trunk.position.y = 1.25 * s;
    g.add(trunk);
    const top = new THREE.Mesh(
      new THREE.SphereGeometry(2.2 * s, 8, 6),
      this._mat(0x4a8f3f),
    );
    top.position.y = 3.6 * s;
    top.castShadow = true;
    g.add(top);
    g.position.set(x, 0, z);
    this.group.add(g);
    return g;
  }

  _buildPlaza() {
    // Central Plaza: fountain, palm ring, benches, open paved circle.
    const stone = new THREE.Mesh(
      new THREE.CylinderGeometry(17, 17, 0.3, 24),
      this._mat(0xcfc4ae),
    );
    stone.position.set(0, 0.05, 0);
    stone.receiveShadow = true;
    this.group.add(stone);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(5, 0.5, 8, 24),
      this._mat(0x9a8a72),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 0.7, 0);
    this.group.add(rim);
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(4.8, 4.8, 0.4, 24),
      new THREE.MeshLambertMaterial({ color: 0x4fb0d8, transparent: true, opacity: 0.85 }),
    );
    water.position.set(0, 0.55, 0);
    this.group.add(water);
    const jet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.5, 3.4, 8),
      new THREE.MeshLambertMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.7 }),
    );
    jet.position.set(0, 2.2, 0);
    this.group.add(jet);
    this.animated.push({ mesh: jet, fn: (t) => { jet.scale.y = 1 + Math.sin(t * 3) * 0.12; } });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this._palm(Math.cos(a) * 14, Math.sin(a) * 14, 1.1);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      this._box(2.2, 0.5, 0.8, this._mat(0x7a5a3a), Math.cos(a) * 9.5, 0.45, Math.sin(a) * 9.5);
    }
  }

  _buildPark() {
    // Palma Park: trees, a pond, winding paths.
    const pond = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 7, 0.3, 20),
      new THREE.MeshLambertMaterial({ color: 0x3f9ec9 }),
    );
    pond.position.set(-76, 0.05, -76);
    this.group.add(pond);
    const rng = new Rng(42);
    for (let i = 0; i < 14; i++) {
      const [x, z] = rng.inDisc(-76, -76, 13);
      if (Math.hypot(x + 76, z + 76) < 8) continue;
      this._tree(x, z, rng.float(0.8, 1.3));
    }
    this._palm(-88, -88, 1.2);
    this._palm(-64, -88, 1.2);
    this._palm(-88, -64, 1.2);
    this._palm(-64, -64, 1.2);
  }

  _buildHarbor() {
    // Old Harbor: docks, crates, containers, moored boats.
    const wood = this._mat(0x8a6a42);
    for (let i = 0; i < 3; i++) {
      this._box(4, 0.6, 18, wood, 118 + i * 8, 0.3, 138);
    }
    const rng = new Rng(77);
    const contCols = [0xc25a3a, 0x3a7ac2, 0x5aa83a, 0xc2a83a];
    for (let i = 0; i < 10; i++) {
      const c = rng.pick(contCols);
      this._box(rng.float(4, 7), 2.6, 2.6, this._mat(c),
        rng.float(104, 128), 1.3, rng.float(104, 126));
    }
    for (let i = 0; i < 8; i++) {
      this._box(1.6, 1.6, 1.6, wood, rng.float(106, 126), 0.8, rng.float(128, 142));
    }
    // Moored boats.
    for (let i = 0; i < 3; i++) this._boat(112 + i * 9, 158 + i * 4, rng.float(0, 6));
  }

  _boat(x, z, rot) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1, 6),
      this._mat(0xe8e0d0),
    );
    hull.position.y = 0.4;
    g.add(hull);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.9, 2.4),
      this._mat(0x4a7a9a),
    );
    cabin.position.set(0, 1.2, -0.5);
    g.add(cabin);
    g.position.set(x, WORLD.SEA_LEVEL + 0.2, z);
    g.rotation.y = rot;
    this.group.add(g);
    const phase = Math.random() * 6;
    this.animated.push({
      mesh: g,
      fn: (t) => {
        g.position.y = WORLD.SEA_LEVEL + 0.2 + Math.sin(t * 0.8 + phase) * 0.15;
        g.rotation.z = Math.sin(t * 0.6 + phase) * 0.03;
      },
    });
    return g;
  }

  _buildBeach() {
    // Pier, lighthouse, Ferris wheel along the shore.
    const wood = this._mat(0x8a6a42);
    for (let z = 160; z <= 196; z += 3) {
      this._box(5, 0.5, 3, wood, -19, 0.9, z);
    }
    for (let z = 162; z <= 194; z += 8) {
      this._box(0.4, 2.4, 0.4, wood, -21.2, 0, z);
      this._box(0.4, 2.4, 0.4, wood, -16.8, 0, z);
    }
    // Lighthouse at the pier end.
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 2.4, 14, 10),
      this._mat(0xe8e0d0),
    );
    tower.position.set(-19, 7.5, 198);
    tower.castShadow = true;
    this.group.add(tower);
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(1.95, 2.1, 2.4, 10),
      this._mat(0xc23b2e),
    );
    band.position.set(-19, 10, 198);
    this.group.add(band);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 }),
    );
    lamp.position.set(-19, 15.2, 198);
    this.group.add(lamp);
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(3.2, 26, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff2b0, transparent: true, opacity: 0.14,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    beam.rotation.z = Math.PI / 2;
    beam.position.set(-19, 15.2, 198);
    this.group.add(beam);
    this.animated.push({ mesh: beam, fn: (t) => { beam.rotation.y = t * 0.4; } });
    // Ferris wheel near the beach.
    const wheel = new THREE.Group();
    const rimMat = this._mat(0xd85a8a);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(11, 0.5, 8, 32), rimMat);
    wheel.add(rim);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 22, 6), rimMat);
      spoke.rotation.z = a;
      wheel.add(spoke);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), this._mat(0x3a9ac2));
      cab.position.set(Math.cos(a) * 11, Math.sin(a) * 11, 0);
      wheel.add(cab);
    }
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 15, 6), this._mat(0x6a6a6a));
    legL.position.set(-4, -9, 0);
    legL.rotation.z = 0.3;
    wheel.add(legL);
    const legR = legL.clone();
    legR.position.x = 4;
    legR.rotation.z = -0.3;
    wheel.add(legR);
    wheel.position.set(57, 13.5, 158);
    this.group.add(wheel);
    this.animated.push({ mesh: rim, fn: (t) => { wheel.rotation.z = t * 0.08; } });
    // Beach umbrellas.
    const rng = new Rng(9);
    for (let i = 0; i < 8; i++) {
      const x = rng.float(-60, 120);
      const z = rng.float(156, 166);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), this._mat(0xd8d8d8));
      pole.position.set(x, 1.2, z);
      this.group.add(pole);
      const top = new THREE.Mesh(
        new THREE.ConeGeometry(1.8, 0.7, 8),
        this._mat(rng.pick([0xe85a5a, 0x5aa8e8, 0xf2c020, 0x5ae88a])),
      );
      top.position.set(x, 2.6, z);
      this.group.add(top);
    }
    for (let x = -120; x <= 120; x += 16) this._palm(x + 4, 152, 1.15);
  }

  _buildOcean() {
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 320),
      new THREE.MeshLambertMaterial({ map: oceanTexture(), transparent: true, opacity: 0.96 }),
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, WORLD.SEA_LEVEL, WORLD.OCEAN_Z + 150);
    this.group.add(ocean);
    // A few boats out on the water.
    this._boat(-60, 220, 0.6);
    this._boat(40, 260, 2.4);
    this._boat(110, 210, 4.2);
  }

  _buildClouds() {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    const rng = new Rng(31);
    for (let i = 0; i < 12; i++) {
      const g = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(rng.float(4, 9), 8, 6), mat);
        s.scale.y = 0.45;
        s.position.set(j * 6 - 9, rng.float(-1, 1), rng.float(-3, 3));
        g.add(s);
      }
      g.position.set(rng.float(-260, 260), rng.float(60, 95), rng.float(-260, 260));
      this.group.add(g);
      const speed = rng.float(0.4, 1.0);
      this.animated.push({
        mesh: g,
        fn: (t) => {
          g.position.x += 0; // drift applied in update via dt
          g.userData.drift = speed;
        },
      });
    }
  }

  _buildStreetlights() {
    const poleMat = this._mat(0x3a3a3a);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (const r of WORLD.ROADS) {
      for (let d = -133; d <= 133; d += 38) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), poleMat);
        pole.position.set(r + 7, 3.5, d);
        this.group.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
        lamp.position.set(r + 7, 7.1, d);
        this.group.add(lamp);
      }
    }
  }

  update(dt, time) {
    for (const a of this.animated) {
      a.fn(time);
      if (a.mesh.userData.drift) {
        a.mesh.position.x += a.mesh.userData.drift * dt;
        if (a.mesh.position.x > 300) a.mesh.position.x = -300;
      }
    }
  }

  // Push a circle (x, z, radius) out of every building AABB it overlaps.
  collideCircle(x, z, r) {
    for (const b of this.buildings) {
      const nx = clamp(x, b.minX, b.maxX);
      const nz = clamp(z, b.minZ, b.maxZ);
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        } else {
          // Centre inside the box: push out along the smallest penetration.
          const pl = x - b.minX;
          const pr = b.maxX - x;
          const pt = z - b.minZ;
          const pb = b.maxZ - z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = b.minX - r;
          else if (m === pr) x = b.maxX + r;
          else if (m === pt) z = b.minZ - r;
          else z = b.maxZ + r;
        }
      }
    }
    // World bounds: soft wall at the city edge, ocean blocks the south.
    x = clamp(x, -WORLD.CITY_EDGE - 20, WORLD.CITY_EDGE + 20);
    z = clamp(z, -WORLD.CITY_EDGE - 20, WORLD.SHORE_Z + 6);
    return [x, z];
  }

  // 2D segment vs building AABB test, for gunfire line-of-sight.
  rayBlocked(x1, z1, x2, z2) {
    for (const b of this.buildings) {
      if (this._segmentHitsBox(x1, z1, x2, z2, b)) return true;
    }
    return false;
  }

  _segmentHitsBox(x1, z1, x2, z2, b) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    let tmin = 0;
    let tmax = 1;
    if (Math.abs(dx) < 1e-9) {
      if (x1 < b.minX || x1 > b.maxX) return false;
    } else {
      let t1 = (b.minX - x1) / dx;
      let t2 = (b.maxX - x1) / dx;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
    if (Math.abs(dz) < 1e-9) {
      if (z1 < b.minZ || z1 > b.maxZ) return false;
    } else {
      let t1 = (b.minZ - z1) / dz;
      let t2 = (b.maxZ - z1) / dz;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
    return true;
  }

  isOnRoad(x, z) {
    const hw = WORLD.ROAD_WIDTH / 2 + 0.5;
    for (const r of WORLD.ROADS) {
      if (Math.abs(x - r) < hw || Math.abs(z - r) < hw) return true;
    }
    return false;
  }

  // Snap a point to the nearest road centre line.
  nearestRoad(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const r of WORLD.ROADS) {
      const dx = Math.abs(x - r);
      if (dx < bestD) { bestD = dx; best = [r, z]; }
      const dz = Math.abs(z - r);
      if (dz < bestD) { bestD = dz; best = [x, r]; }
    }
    return best;
  }

  // A random road point for spawning traffic / parked cars.
  randomRoadPoint(rng) {
    const r = rng.pick(WORLD.ROADS);
    const along = rng.float(-130, 130);
    return rng.chance(0.5) ? [r, along] : [along, r];
  }
}
