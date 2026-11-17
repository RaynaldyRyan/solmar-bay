// Builds Solmar Bay: ground, the 8x8 road grid, pastel procedural buildings,
// Central Plaza, Palma Park, Old Harbor, beach, pier, lighthouse, Ferris wheel,
// ocean, boats and drifting clouds. Returns colliders (AABBs) and animatables.
import { ROAD_SPACING, ROADS, BLOCKS, BLOCK_SIZE, WORLD_BOUND, BEACH_Z, OCEAN_Z, HARBOR_X, LANDMARKS } from './config.js';
import { facadeTexture, roadTexture, crosswalkTexture, sidewalkTexture, sandTexture, grassTexture, waterTexture, palmTexture } from './textures.js';
import { pick, range } from './random.js';

const PASTELS = ['#f2c6a0', '#f7e3b0', '#c8dcea', '#e8b4b8', '#c9e4c5', '#e6d5f2', '#f5d6a8', '#bcd6e8'];

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = h > 2;
  m.receiveShadow = true;
  return m;
}

function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

export class City {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = [];   // {minX,maxX,minZ,maxZ} building/prop boxes
    this.ferrisWheel = null;
    this.boats = [];
    this.clouds = [];
    this.lighthouseLight = null;
    this.garageZone = null;
    this.build();
  }

  addCollider(x, z, halfW, halfD) {
    this.colliders.push({ minX: x - halfW, maxX: x + halfW, minZ: z - halfD, maxZ: z + halfD });
  }

  build() {
    this.ground();
    this.roads();
    this.blocks();
    this.plaza();
    this.park();
    this.harbor();
    this.beach();
    this.ocean();
    this.cloudsSky();
    this.streetProps();
  }

  ground() {
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_BOUND * 2 + 60, WORLD_BOUND * 2 + 120),
      new THREE.MeshLambertMaterial({ color: 0x9aa08a }),
    );
    g.rotation.x = -Math.PI / 2;
    g.position.set(0, -0.05, 20);
    g.receiveShadow = true;
    this.scene.add(g);
  }

  roads() {
    const roadTex = roadTexture();
    const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
    const walkMat = new THREE.MeshLambertMaterial({ map: sidewalkTexture() });
    const crossMat = new THREE.MeshLambertMaterial({ map: crosswalkTexture() });
    const len = WORLD_BOUND * 2 + 24;
    for (const c of ROADS) {
      // road surface (x-running and z-running)
      const rx = new THREE.Mesh(new THREE.PlaneGeometry(len, 12), roadMat.clone());
      rx.material.map = roadTex.clone();
      rx.material.map.repeat.set(len / 12, 1);
      rx.rotation.x = -Math.PI / 2;
      rx.position.set(0, 0, c);
      rx.receiveShadow = true;
      this.scene.add(rx);
      const rz = new THREE.Mesh(new THREE.PlaneGeometry(12, len), roadMat.clone());
      rz.material.map = roadTex.clone();
      rz.material.map.repeat.set(1, len / 12);
      rz.rotation.x = -Math.PI / 2;
      rz.rotation.z = Math.PI / 2;
      rz.position.set(c, 0.01, 0);
      rz.receiveShadow = true;
      this.scene.add(rz);
      // sidewalks flanking each road
      for (const off of [-8.5, 8.5]) {
        const s1 = new THREE.Mesh(new THREE.PlaneGeometry(len, 5), walkMat);
        s1.rotation.x = -Math.PI / 2;
        s1.position.set(0, 0.02, c + off);
        s1.receiveShadow = true;
        this.scene.add(s1);
        const s2 = new THREE.Mesh(new THREE.PlaneGeometry(5, len), walkMat);
        s2.rotation.x = -Math.PI / 2;
        s2.position.set(c + off, 0.02, 0);
        s2.receiveShadow = true;
        this.scene.add(s2);
      }
    }
    // crosswalks at the central intersections
    for (const cx of [0, 40]) {
      for (const cz of [0, 40]) {
        const cw = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), crossMat);
        cw.rotation.x = -Math.PI / 2;
        cw.position.set(cx, 0.03, cz);
        this.scene.add(cw);
      }
    }
  }

  // Which blocks are special (not plain building blocks)?
  specialBlock(bx, bz) {
    if (Math.abs(bx) <= 20 && Math.abs(bz) <= 20) return 'plaza';
    if (bx <= -60 && bz <= -60) return 'park';
    if (bx >= 140 && bz <= -60) return 'harbor';
    if (bx === -100 && bz === 100) return 'garage';
    if (bx === -60 && bz === 20) return 'hospital';
    return null;
  }

  blocks() {
    const rng = this.rng;
    for (const bx of BLOCKS) {
      for (const bz of BLOCKS) {
        const special = this.specialBlock(bx, bz);
        if (special === 'plaza' || special === 'park' || special === 'harbor') continue;
        if (special === 'garage') { this.garage(bx, bz); continue; }
        if (special === 'hospital') { this.hospital(bx, bz); continue; }
        this.buildingBlock(bx, bz);
      }
    }
  }

  buildingBlock(bx, bz) {
    const rng = this.rng;
    const n = 1 + Math.floor(rng() * 3); // 1-3 buildings per block
    const spots = [{ dx: 0, dz: 0, s: 1 }, { dx: -7, dz: -7, s: 0.55 }, { dx: 7, dz: 7, s: 0.55 }, { dx: 7, dz: -7, s: 0.5 }];
    for (let i = 0; i < n; i++) {
      const sp = spots[i];
      const w = BLOCK_SIZE * 0.62 * sp.s + 4;
      const d = BLOCK_SIZE * 0.62 * sp.s + 4;
      const h = 8 + rng() * rng() * 34; // mostly low, a few towers
      const base = pick(rng, PASTELS);
      const tex = facadeTexture(base, 0.25, rng);
      tex.repeat.set(Math.max(1, Math.round(w / 10)), Math.max(1, Math.round(h / 12)));
      const building = box(w, h, d, new THREE.MeshLambertMaterial({ map: tex }), bx + sp.dx, h / 2, bz + sp.dz);
      this.scene.add(building);
      // roof cap + occasional rooftop box
      const cap = box(w * 0.9, 0.6, d * 0.9, mat(0x8a7f72), bx + sp.dx, h + 0.3, bz + sp.dz);
      this.scene.add(cap);
      if (rng() < 0.4) {
        const roof = box(w * 0.3, 2.5, d * 0.3, mat(0x9a938a), bx + sp.dx + w * 0.2, h + 1.5, bz + sp.dz);
        this.scene.add(roof);
      }
      this.addCollider(bx + sp.dx, bz + sp.dz, w / 2, d / 2);
    }
  }

  garage(bx, bz) {
    const g = new THREE.Group();
    const hall = box(20, 7, 16, mat(0xe8e0d0), 0, 3.5, 0);
    g.add(hall);
    const roof = box(21, 0.5, 17, mat(0xc23b3b), 0, 7.2, 0);
    g.add(roof);
    const door = box(12, 4.5, 0.4, mat(0x3a3f45), 0, 2.25, 8.1);
    g.add(door);
    const sign = box(14, 2.2, 0.5, mat(0xc23b3b), 0, 5.6, 8.1);
    g.add(sign);
    g.position.set(bx, 0, bz);
    this.scene.add(g);
    this.addCollider(bx, bz, 10, 8);
    // service zone in front of the garage doors
    this.garageZone = { x: bx, z: bz + 16, r: 9 };
    const zone = new THREE.Mesh(
      new THREE.CircleGeometry(9, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.25 }),
    );
    zone.rotation.x = -Math.PI / 2;
    zone.position.set(bx, 0.05, bz + 16);
    this.scene.add(zone);
  }

  hospital(bx, bz) {
    const h = box(22, 12, 16, mat(0xf0f4f6), bx, 6, bz);
    this.scene.add(h);
    const cross1 = box(4, 1.2, 0.4, mat(0xd23b3b), bx, 10, bz + 8.2);
    const cross2 = box(1.2, 4, 0.4, mat(0xd23b3b), bx, 10, bz + 8.2);
    this.scene.add(cross1, cross2);
    this.addCollider(bx, bz, 11, 8);
  }

  palm(x, z, s = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 6 * s, 6),
      mat(0x8a6b4a),
    );
    trunk.position.y = 3 * s;
    trunk.rotation.z = 0.08;
    g.add(trunk);
    const fronds = new THREE.Mesh(
      new THREE.PlaneGeometry(7 * s, 7 * s),
      new THREE.MeshLambertMaterial({ map: palmTexture(), transparent: true, side: THREE.DoubleSide, alphaTest: 0.2 }),
    );
    fronds.position.y = 6.4 * s;
    fronds.rotation.x = -Math.PI / 2 + 0.35;
    g.add(fronds);
    const fronds2 = fronds.clone();
    fronds2.rotation.z = Math.PI / 3;
    g.add(fronds2);
    g.position.set(x, 0, z);
    this.scene.add(g);
    return g;
  }

  plaza() {
    const { x, z } = LANDMARKS.plaza;
    // stone floor
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(34, 32),
      new THREE.MeshLambertMaterial({ color: 0xd8d2c2 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(x, 0.04, z);
    floor.receiveShadow = true;
    this.scene.add(floor);
    // fountain: basin + water + centre jet column
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 7.5, 1.2, 24),
      mat(0xcfc8b8),
    );
    basin.position.set(x, 0.6, z);
    this.scene.add(basin);
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(6.6, 24),
      new THREE.MeshLambertMaterial({ color: 0x4db2d8, transparent: true, opacity: 0.85 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(x, 1.25, z);
    this.scene.add(water);
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 3.2, 10), mat(0xe8e2d2));
    jet.position.set(x, 2.6, z);
    this.scene.add(jet);
    const spray = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xbfe6f5, transparent: true, opacity: 0.7 }),
    );
    spray.position.set(x, 4.6, z);
    this.scene.add(spray);
    this.addCollider(x, z, 7.5, 7.5);
    // palms ring + benches + lamps
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3;
      this.palm(x + Math.cos(a) * 24, z + Math.sin(a) * 24, 1.1);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const bench = box(3, 0.5, 1, mat(0x7a5a3a), x + Math.cos(a) * 13, 0.4, z + Math.sin(a) * 13);
      bench.rotation.y = -a;
      this.scene.add(bench);
    }
    // Rosa's Diner on the plaza's east edge
    const diner = box(12, 6, 9, mat(0xf2e3c8), 34, 3, -26);
    this.scene.add(diner);
    const awning = box(12.5, 0.4, 3, mat(0xd24a6a), 34, 4.2, -21.2);
    this.scene.add(awning);
    this.addCollider(34, -26, 6, 4.5);
  }

  park() {
    const { x, z } = LANDMARKS.park;
    const lawn = new THREE.Mesh(
      new THREE.PlaneGeometry(76, 76),
      new THREE.MeshLambertMaterial({ map: grassTexture() }),
    );
    lawn.material.map.repeat.set(6, 6);
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(x, 0.03, z);
    lawn.receiveShadow = true;
    this.scene.add(lawn);
    // pond
    const pond = new THREE.Mesh(
      new THREE.CircleGeometry(10, 24),
      new THREE.MeshLambertMaterial({ color: 0x4db2d8 }),
    );
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(x - 12, 0.06, z + 10);
    this.scene.add(pond);
    // trees
    const rng = this.rng;
    for (let i = 0; i < 26; i++) {
      const tx = x + range(rng, -34, 34);
      const tz = z + range(rng, -34, 34);
      if (Math.hypot(tx - (x - 12), tz - (z + 10)) < 12) continue;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2.5, 6), mat(0x6b4a2a));
      trunk.position.set(tx, 1.25, tz);
      this.scene.add(trunk);
      const crown = new THREE.Mesh(
        new THREE.SphereGeometry(2.2 + rng() * 1.4, 8, 6),
        mat(0x4e8f3a),
      );
      crown.position.set(tx, 3.6, tz);
      crown.castShadow = true;
      this.scene.add(crown);
      this.addCollider(tx, tz, 0.5, 0.5);
    }
    // paths
    const pathMat = new THREE.MeshLambertMaterial({ color: 0xd8cba8 });
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(76, 3), pathMat);
    p1.rotation.x = -Math.PI / 2;
    p1.position.set(x, 0.05, z);
    this.scene.add(p1);
    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(3, 76), pathMat);
    p2.rotation.x = -Math.PI / 2;
    p2.position.set(x, 0.05, z);
    this.scene.add(p2);
  }

  harbor() {
    const { x, z } = LANDMARKS.harbor;
    // docks reaching east into the water
    const dockMat = mat(0x8a6f4d);
    for (let i = 0; i < 3; i++) {
      const dock = box(26, 0.8, 4, dockMat, x + 16, 0.4, z - 20 + i * 20);
      this.scene.add(dock);
    }
    // water east of the harbor
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 260),
      new THREE.MeshLambertMaterial({ map: waterTexture() }),
    );
    water.material.map.repeat.set(4, 12);
    water.rotation.x = -Math.PI / 2;
    water.position.set(HARBOR_X + 42, -0.1, 0);
    this.scene.add(water);
    // warehouses
    for (const [wx, wz] of [[150, -110], [150, -50]]) {
      const wh = box(16, 8, 24, mat(0xb8a88e), wx, 4, wz);
      this.scene.add(wh);
      this.addCollider(wx, wz, 8, 12);
    }
    // crates
    const rng = this.rng;
    for (let i = 0; i < 14; i++) {
      const cx = 158 + rng() * 12;
      const cz = -110 + rng() * 60;
      const crate = box(2.2, 2.2, 2.2, mat(pick(rng, [0xc2a35a, 0x7a9a5a, 0x9a6a4a])), cx, 1.1, cz);
      crate.rotation.y = rng() * Math.PI;
      this.scene.add(crate);
      this.addCollider(cx, cz, 1.2, 1.2);
    }
    this.boat(x + 24, z - 8, 0.4);
    this.boat(x + 30, z + 22, -0.2);
  }

  boat(x, z, yaw) {
    const g = new THREE.Group();
    const hull = box(7, 1.6, 2.6, mat(0xf0f0f0), 0, 0.6, 0);
    g.add(hull);
    const cabin = box(3, 1.6, 2, mat(0x4a7fb5), -0.5, 2, 0);
    g.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 6), mat(0x8a6b4a));
    mast.position.set(1.5, 3.2, 0);
    g.add(mast);
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    this.scene.add(g);
    this.boats.push(g);
    return g;
  }

  beach() {
    // sand strip along the south edge
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 40),
      new THREE.MeshLambertMaterial({ map: sandTexture() }),
    );
    sand.material.map.repeat.set(20, 2);
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.02, BEACH_Z + 14);
    sand.receiveShadow = true;
    this.scene.add(sand);
    // boardwalk
    const walk = box(400, 0.4, 6, mat(0xa08050), 0, 0.2, BEACH_Z - 2);
    this.scene.add(walk);
    // pier out to the lighthouse
    const pier = box(6, 0.6, 34, mat(0x8a6f4d), 60, 0.3, BEACH_Z + 20);
    this.scene.add(pier);
    // lighthouse
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 3, 18, 12),
      mat(0xf2f0ea),
    );
    tower.position.set(60, 9, 204);
    tower.castShadow = true;
    this.scene.add(tower);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.7, 3, 12), mat(0xd24a4a));
    band.position.set(60, 12, 204);
    this.scene.add(band);
    const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 2.4, 10), mat(0x2a2f36));
    lampRoom.position.set(60, 19, 204);
    this.scene.add(lampRoom);
    this.lighthouseLight = new THREE.PointLight(0xffe9a8, 1.2, 60);
    this.lighthouseLight.position.set(60, 19, 204);
    this.scene.add(this.lighthouseLight);
    this.addCollider(60, 204, 3, 3);
    // Ferris wheel
    this.ferrisWheel = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(14, 0.5, 8, 32), mat(0xd24a6a));
    this.ferrisWheel.add(rim);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spoke = box(0.4, 27, 0.4, mat(0xf0f0f0), 0, 0, 0);
      spoke.rotation.z = a;
      this.ferrisWheel.add(spoke);
      const cab = box(2.2, 2.2, 2.2, mat(pick(this.rng, [0xf5c518, 0x4a7fb5, 0x9b2d4a, 0x4e8f3a])), Math.cos(a) * 14, Math.sin(a) * 14, 0);
      this.ferrisWheel.add(cab);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2, 10), mat(0x2a2f36));
    hub.rotation.x = Math.PI / 2;
    this.ferrisWheel.add(hub);
    const legL = box(1, 18, 1, mat(0x8a8f96), -6, -8, 0);
    legL.rotation.z = 0.35;
    const legR = box(1, 18, 1, mat(0x8a8f96), 6, -8, 0);
    legR.rotation.z = -0.35;
    this.ferrisWheel.add(legL, legR);
    this.ferrisWheel.position.set(120, 17, 192);
    this.scene.add(this.ferrisWheel);
    this.addCollider(120, 192, 4, 4);
    // beach umbrellas + palms
    for (let i = 0; i < 8; i++) {
      const ux = -140 + i * 38 + this.rng() * 10;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6), mat(0xf0f0f0));
      pole.position.set(ux, 1.3, BEACH_Z + 10 + this.rng() * 12);
      this.scene.add(pole);
      const top = new THREE.Mesh(
        new THREE.ConeGeometry(2.4, 1, 8),
        mat(pick(this.rng, [0xd24a6a, 0x4a7fb5, 0xf5c518])),
      );
      top.position.set(ux, 3, pole.position.z);
      this.scene.add(top);
    }
    for (let i = 0; i < 12; i++) {
      this.palm(-160 + i * 30, BEACH_Z + 4, 1.2);
    }
  }

  ocean() {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(560, 180),
      new THREE.MeshLambertMaterial({ map: waterTexture(), transparent: true, opacity: 0.96 }),
    );
    water.material.map.repeat.set(24, 8);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.15, OCEAN_Z + 80);
    this.scene.add(water);
    this.boat(-40, OCEAN_Z + 30, 0.8);
    this.boat(140, OCEAN_Z + 55, -0.5);
  }

  cloudsSky() {
    const rng = this.rng;
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group();
      const n = 3 + Math.floor(rng() * 3);
      for (let j = 0; j < n; j++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(4 + rng() * 5, 8, 6), cloudMat);
        puff.scale.y = 0.45;
        puff.position.set(j * 5 - n * 2.5, rng() * 1.5, rng() * 4);
        g.add(puff);
      }
      g.position.set(range(rng, -260, 260), 55 + rng() * 25, range(rng, -260, 260));
      this.scene.add(g);
      this.clouds.push(g);
    }
  }

  streetProps() {
    // street lamps along the main roads
    const rng = this.rng;
    for (const c of [-120, -40, 40, 120]) {
      for (let d = -140; d <= 140; d += 40) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 7, 6), mat(0x3a3f45));
        pole.position.set(c + 7, 3.5, d);
        this.scene.add(pole);
        const head = box(1.6, 0.3, 0.5, mat(0xffe9a8), c + 6.4, 7, d);
        this.scene.add(head);
      }
    }
    // traffic lights at the central intersections
    for (const [cx, cz] of [[0, 0], [40, 0], [0, 40], [40, 40]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 5.5, 6), mat(0x2a2f36));
      pole.position.set(cx + 7, 2.75, cz + 7);
      this.scene.add(pole);
      const lampBox = box(0.6, 1.6, 0.6, mat(0x222222), cx + 7, 5.6, cz + 7);
      this.scene.add(lampBox);
      const lamp = box(0.5, 0.4, 0.2, mat(0x35d05a), cx + 7, 5.3, cz + 7.35);
      this.scene.add(lamp);
    }
  }

  // Animate the Ferris wheel, boats and clouds.
  update(dt, time) {
    if (this.ferrisWheel) this.ferrisWheel.rotation.z += dt * 0.12;
    for (let i = 0; i < this.boats.length; i++) {
      const b = this.boats[i];
      b.position.y = Math.sin(time * 0.7 + i * 1.7) * 0.25;
      b.rotation.z = Math.sin(time * 0.5 + i) * 0.03;
    }
    for (const c of this.clouds) {
      c.position.x += dt * 1.1;
      if (c.position.x > 300) c.position.x = -300;
    }
    if (this.lighthouseLight) {
      this.lighthouseLight.intensity = 0.8 + Math.sin(time * 2.2) * 0.6;
    }
  }

  // True when the segment from (x1,z1) to (x2,z2) crosses a building collider.
  blocked(x1, z1, x2, z2) {
    const dx = x2 - x1, dz = z2 - z1;
    const dist = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(dist / 4));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const px = x1 + dx * t, pz = z1 + dz * t;
      for (const c of this.colliders) {
        if (px > c.minX && px < c.maxX && pz > c.minZ && pz < c.maxZ) return true;
      }
    }
    return false;
  }

  // Push a circle (x, z, radius) out of colliders; returns corrected {x, z}.
  collideCircle(x, z, r) {
    for (const c of this.colliders) {
      const nx = Math.max(c.minX, Math.min(x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - nx, dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        } else {
          // centre inside the box: push out along the smallest penetration
          const pl = x - c.minX, pr = c.maxX - x, pt = z - c.minZ, pb = c.maxZ - z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = c.minX - r;
          else if (m === pr) x = c.maxX + r;
          else if (m === pt) z = c.minZ - r;
          else z = c.maxZ + r;
        }
      }
    }
    return { x, z };
  }

  // Is a point inside a collider (used for spawn checks)?
  insideCollider(x, z, pad = 0) {
    for (const c of this.colliders) {
      if (x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad) return true;
    }
    return false;
  }
}
