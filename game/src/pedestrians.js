// Solmar Bay — pedestrians.
// One clear job: the people on the sidewalks (walk, chat, cross streets, flee
// gunfire and near-miss cars) and the fleeing drivers carjacked by the player.

import { WORLD } from './config.js';
import { Rng, clamp } from './random.js';
import { buildPersonMesh } from './player.js';

const SHIRTS = [0xe8e8e8, 0x5a8fd8, 0xd88a5a, 0x8ad85a, 0xd85aa8, 0x5ad8c8, 0xf2d020, 0x8a5ad8];
const PANTS = [0x2a2a33, 0x3a4a5a, 0x5a3a2a, 0x2a4a2a];
const SKINS = [0xc89a72, 0x8a5a3a, 0xe8b890, 0x6a4a2e];

export class Pedestrians {
  constructor(scene, city, count = 26, seed = 11) {
    this.scene = scene;
    this.city = city;
    this.rng = new Rng(seed);
    this.peds = [];
    for (let i = 0; i < count; i++) this.spawn();
  }

  spawn(x = null, z = null) {
    const rng = this.rng;
    if (x === null) {
      const [rx, rz] = this.city.randomRoadPoint(rng);
      x = rx + rng.float(-7, 7);
      z = rz + rng.float(-7, 7);
    }
    const mesh = buildPersonMesh(rng.pick(SHIRTS), rng.pick(PANTS), rng.pick(SKINS));
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const ped = {
      mesh, x, z, heading: rng.float(0, Math.PI * 2),
      speed: rng.float(1.1, 1.9), walkPhase: rng.float(0, 6),
      target: null, wait: 0, fleeing: 0, health: 100, dead: false,
      state: 'walk',
    };
    this.pickTarget(ped);
    this.peds.push(ped);
    return ped;
  }

  pickTarget(ped) {
    const rng = this.rng;
    const [x, z] = this.city.randomRoadPoint(rng);
    ped.target = [x + rng.float(-7, 7), z + rng.float(-7, 7)];
  }

  update(dt, game) {
    const player = game.player;
    for (const ped of [...this.peds]) {
      if (ped.dead) continue;
      // Flee from gunfire or a fast car bearing down.
      if (ped.fleeing > 0) {
        ped.fleeing -= dt;
        const away = Math.atan2(ped.x - player.x, ped.z - player.z);
        ped.heading = away;
        this.step(ped, dt, 4.6);
        continue;
      }
      if (ped.wait > 0) {
        ped.wait -= dt;
        this.animate(ped, dt, 0);
        continue;
      }
      if (!ped.target) this.pickTarget(ped);
      const dx = ped.target[0] - ped.x;
      const dz = ped.target[1] - ped.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.2) {
        if (this.rng.chance(0.4)) ped.wait = this.rng.float(1, 4);
        this.pickTarget(ped);
        this.animate(ped, dt, 0);
        continue;
      }
      const want = Math.atan2(dx, dz);
      let dh = want - ped.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      ped.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
      this.step(ped, dt, ped.speed);
      // Respawn far-away pedestrians near the player.
      const pd2 = (ped.x - player.x) ** 2 + (ped.z - player.z) ** 2;
      if (pd2 > 200 * 200) {
        const a = this.rng.float(0, Math.PI * 2);
        ped.x = clamp(player.x + Math.cos(a) * 70, -145, 145);
        ped.z = clamp(player.z + Math.sin(a) * 70, -145, 150);
        this.pickTarget(ped);
      }
    }
  }

  step(ped, dt, speed) {
    const nx = ped.x + Math.sin(ped.heading) * speed * dt;
    const nz = ped.z + Math.cos(ped.heading) * speed * dt;
    const [cx, cz] = this.city.collideCircle(nx, nz, 0.45);
    ped.x = cx;
    ped.z = cz;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
    this.animate(ped, dt, speed);
  }

  animate(ped, dt, speed) {
    ped.walkPhase += dt * (speed > 3 ? 13 : 8) * (speed > 0 ? 1 : 0);
    const swing = speed > 0 ? Math.sin(ped.walkPhase) * 0.6 : 0;
    const L = ped.mesh.userData.limbs;
    L.legL.rotation.x = swing;
    L.legR.rotation.x = -swing;
    L.armL.rotation.x = -swing * 0.7;
    L.armR.rotation.x = swing * 0.7;
  }

  // Gunfire or a near miss scares everyone nearby.
  scare(x, z, radius = 26) {
    for (const ped of this.peds) {
      if (ped.dead) continue;
      const d2 = (ped.x - x) ** 2 + (ped.z - z) ** 2;
      if (d2 < radius * radius) ped.fleeing = 5;
    }
  }

  // A driver the player just carjacked runs away on foot.
  spawnFleeingDriver(x, z) {
    const ped = this.spawn(x, z);
    ped.fleeing = 8;
    return ped;
  }

  hurt(ped, amount, game) {
    if (ped.dead) return;
    ped.health -= amount;
    game.effects.blood(ped.x, 1.2, ped.z);
    this.scare(ped.x, ped.z, 30);
    if (ped.health <= 0) {
      ped.dead = true;
      ped.mesh.rotation.x = -Math.PI / 2;
      ped.mesh.position.y = 0.3;
      game.police.addWanted(1, 'pedestrian down');
    } else {
      ped.fleeing = 6;
    }
  }

  nearest(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const ped of this.peds) {
      if (ped.dead) continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    return best;
  }
}
