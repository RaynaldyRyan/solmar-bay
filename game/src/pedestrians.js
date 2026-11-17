// Pedestrians: blocky walkers strolling the sidewalks, chatting at the plaza,
// fleeing when shots ring out or a car bears down on them.
import { ROADS, WORLD_BOUND } from './config.js';
import { createPersonMesh } from './player.js';
import { pick, range } from './random.js';

const SHIRTS = [0xe86a6a, 0x6a9ae8, 0x6ae8a0, 0xe8d44d, 0xb06ae8, 0xffffff, 0x2f8f83, 0xe89a4d];
const PANTS = [0x3a3f45, 0x5a4a3a, 0x2a4a7a, 0x6a6a6a];
const SKINS = [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf2c9a0];

export class Pedestrians {
  constructor(scene, city, rng, count = 26) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.peds = [];
    for (let i = 0; i < count; i++) this.spawnOne();
  }

  spawnOne() {
    const rng = this.rng;
    // start on a sidewalk beside a road, or around the plaza / park
    let x, z;
    if (rng() < 0.3) {
      const a = rng() * Math.PI * 2;
      x = Math.cos(a) * range(rng, 12, 30);
      z = Math.sin(a) * range(rng, 12, 30);
    } else {
      const road = pick(rng, ROADS);
      const along = range(rng, -150, 150);
      const side = rng() < 0.5 ? -8.5 : 8.5;
      if (rng() < 0.5) { x = along; z = road + side; } else { x = road + side; z = along; }
    }
    if (this.city.insideCollider(x, z, 1)) { x = 0; z = 40; }
    const mesh = createPersonMesh(pick(rng, SHIRTS), pick(rng, PANTS), pick(rng, SKINS));
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.peds.push({
      mesh, x, z,
      heading: rng() * Math.PI * 2,
      speed: range(rng, 1.2, 2.0),
      target: this.randomTarget(),
      flee: 0,          // seconds of fleeing left
      fleeFrom: null,
      phase: rng() * Math.PI * 2,
      health: 100,
      dead: false,
    });
  }

  randomTarget() {
    const rng = this.rng;
    const road = pick(rng, ROADS);
    const along = range(rng, -150, 150);
    const side = rng() < 0.5 ? -8.5 : 8.5;
    if (rng() < 0.5) return { x: along, z: road + side };
    return { x: road + side, z: along };
  }

  // Scare every ped within radius of (x, z): they run away from the point.
  scare(x, z, radius) {
    for (const p of this.peds) {
      if (p.dead) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < radius) {
        p.flee = 4 + Math.random() * 3;
        p.fleeFrom = { x, z };
      }
    }
  }

  update(dt, playerPos, playerSpeed) {
    for (const p of this.peds) {
      if (p.dead) continue;
      // a fast car nearby scares peds
      if (playerSpeed > 12) {
        const d = Math.hypot(p.x - playerPos.x, p.z - playerPos.z);
        if (d < 7 && p.flee <= 0) { p.flee = 3; p.fleeFrom = playerPos; }
      }
      let tx, tz, speed;
      if (p.flee > 0) {
        p.flee -= dt;
        const dx = p.x - p.fleeFrom.x, dz = p.z - p.fleeFrom.z;
        const d = Math.hypot(dx, dz) || 1;
        tx = p.x + (dx / d) * 10;
        tz = p.z + (dz / d) * 10;
        speed = 6.5;
      } else {
        tx = p.target.x; tz = p.target.z;
        speed = p.speed;
        if (Math.hypot(tx - p.x, tz - p.z) < 2) p.target = this.randomTarget();
      }
      const dx = tx - p.x, dz = tz - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.2) {
        const want = Math.atan2(dx, dz);
        let diff = want - p.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.heading += Math.max(-3 * dt, Math.min(3 * dt, diff));
        p.x += Math.sin(p.heading) * speed * dt;
        p.z += Math.cos(p.heading) * speed * dt;
        p.phase += dt * speed * 4;
      }
      p.x = Math.max(-WORLD_BOUND, Math.min(WORLD_BOUND, p.x));
      p.z = Math.max(-WORLD_BOUND, Math.min(206, p.z));
      const fixed = this.city.collideCircle(p.x, p.z, 0.5);
      p.x = fixed.x; p.z = fixed.z;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      const swing = Math.sin(p.phase) * 0.5;
      p.mesh.userData.legs[0].rotation.x = swing;
      p.mesh.userData.legs[1].rotation.x = -swing;
      p.mesh.userData.arms[0].rotation.x = -swing * 0.6;
      p.mesh.userData.arms[1].rotation.x = swing * 0.6;
    }
  }

  // The ped nearest a point within radius, or null.
  nearest(x, z, radius) {
    let best = null, bestD = radius;
    for (const p of this.peds) {
      if (p.dead) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  kill(p) {
    if (p.dead) return;
    p.dead = true;
    p.mesh.rotation.x = -Math.PI / 2; // fall over
    p.mesh.position.y = 0.3;
  }
}
