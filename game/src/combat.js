// Combat: fists and pistol, hitscan with building occlusion, tracers and
// muzzle flash; rival gunmen who shoot back; health and ammo pickups.
import { WEAPONS, WANTED } from './config.js';
import { createPersonMesh } from './player.js';

function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

export class Combat {
  constructor(scene, city, effects, audio, rng) {
    this.scene = scene;
    this.city = city;
    this.effects = effects;
    this.audio = audio;
    this.rng = rng;
    this.gunmen = [];   // {mesh,x,z,heading,health,dead,shootTimer,phase}
    this.pickups = [];  // {mesh,kind,x,z,taken}
    this.cooldown = 0;
    this.onKillPed = null;   // () => void — wanted bookkeeping by the caller
    this.onKillCop = null;
    this.spawnPickups();
  }

  spawnPickups() {
    const spots = [
      { kind: 'health', x: 14, z: -14 }, { kind: 'health', x: -80, z: -40 },
      { kind: 'health', x: 140, z: 60 }, { kind: 'ammo', x: -20, z: 60 },
      { kind: 'ammo', x: 100, z: -100 }, { kind: 'ammo', x: 172, z: -60 },
      { kind: 'health', x: 60, z: 180 }, { kind: 'ammo', x: -140, z: 140 },
    ];
    for (const s of spots) this.addPickup(s.kind, s.x, s.z);
  }

  addPickup(kind, x, z) {
    const color = kind === 'health' ? 0x35d05a : 0xf5c518;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), mat(color, { emissive: color, emissiveIntensity: 0.4 }));
    mesh.position.set(x, 0.9, z);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.08, 6, 20),
      mat(color, { transparent: true, opacity: 0.6 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 0.15, z);
    this.scene.add(mesh, ring);
    this.pickups.push({ mesh, ring, kind, x, z, taken: false });
  }

  // Spawn rival gunmen around a point (mission ambushes).
  spawnGunmen(x, z, count) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + this.rng() * 0.8;
      const r = 12 + this.rng() * 8;
      const gx = x + Math.cos(a) * r;
      const gz = z + Math.sin(a) * r;
      if (this.city.insideCollider(gx, gz, 1)) continue;
      const mesh = createPersonMesh(0x8a2a2a, 0x2a2a2a, 0xe8b88a);
      mesh.position.set(gx, 0, gz);
      this.scene.add(mesh);
      this.gunmen.push({
        mesh, x: gx, z: gz, heading: Math.atan2(x - gx, z - gz),
        health: 60, dead: false, shootTimer: 1 + this.rng(),
        phase: this.rng() * 6,
      });
    }
  }

  // The player attacks. Returns what happened ('punch' | 'shot' | 'reload' | null).
  attack(player, aimHeading, time) {
    if (this.cooldown > 0) return null;
    const w = WEAPONS[player.weapon];
    this.cooldown = 1 / w.rate;
    const pos = player.pos;
    const muzzle = player.muzzlePos();
    if (player.weapon === 'fists') {
      this.audio.punch();
      // punch the nearest target in range and in front
      const target = this.nearestTarget(pos.x, pos.z, aimHeading, w.range, 1.2);
      if (target) {
        this.damageTarget(target, w.damage);
        this.effects.hitPuff(new THREE.Vector3(target.x, 1.2, target.z));
      }
      return 'punch';
    }
    // pistol
    if (player.ammo.mag <= 0) {
      this.reload(player);
      return 'reload';
    }
    player.ammo.mag -= 1;
    this.audio.gunshot();
    this.effects.muzzle(muzzle);
    const dir = { x: Math.sin(aimHeading), z: Math.cos(aimHeading) };
    const end = { x: pos.x + dir.x * w.range, z: pos.z + dir.z * w.range };
    // occlusion: stop the ray at the first building it hits
    const hitWall = this.rayWall(pos.x, pos.z, end.x, end.z);
    const range = hitWall === null ? w.range : hitWall;
    const target = this.nearestTarget(pos.x, pos.z, aimHeading, range, 0.25);
    let endPoint;
    if (target) {
      this.damageTarget(target, w.damage);
      endPoint = new THREE.Vector3(target.x, 1.2, target.z);
      this.effects.hitPuff(endPoint);
    } else {
      endPoint = new THREE.Vector3(pos.x + dir.x * range, 1.2, pos.z + dir.z * range);
      if (hitWall !== null) this.effects.sparks(endPoint, 4);
    }
    this.effects.tracer(muzzle, endPoint);
    return 'shot';
  }

  reload(player) {
    if (player.weapon !== 'pistol') return;
    const need = WEAPONS.pistol.mag - player.ammo.mag;
    const take = Math.min(need, player.ammo.reserve);
    player.ammo.mag += take;
    player.ammo.reserve -= take;
    this.cooldown = Math.max(this.cooldown, 0.9);
  }

  // Distance along the ray where it first enters a building, or null.
  rayWall(x1, z1, x2, z2) {
    const dx = x2 - x1, dz = z2 - z1;
    const dist = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(dist / 2));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const px = x1 + dx * t, pz = z1 + dz * t;
      for (const c of this.city.colliders) {
        if (px > c.minX && px < c.maxX && pz > c.minZ && pz < c.maxZ) return dist * t;
      }
    }
    return null;
  }

  // Nearest shootable target near the aim ray: gunmen, cops, peds (set by main).
  nearestTarget(x, z, heading, range, halfAngle) {
    let best = null, bestD = range;
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const consider = (t) => {
      if (!t || t.dead) return;
      const dx = t.x - x, dz = t.z - z;
      const d = Math.hypot(dx, dz);
      if (d > bestD || d < 0.01) return;
      const dot = (dx * fx + dz * fz) / d;
      if (dot < Math.cos(halfAngle)) return;
      bestD = d;
      best = t;
    };
    for (const g of this.gunmen) consider(g);
    if (this.cops) for (const c of this.cops) consider(c);
    if (this.peds) for (const p of this.peds) consider(p);
    return best;
  }

  damageTarget(t, dmg) {
    t.health -= dmg;
    if (t.health > 0) return;
    if (this.gunmen.includes(t)) {
      t.dead = true;
      t.mesh.rotation.x = -Math.PI / 2;
      t.mesh.position.y = 0.3;
      this.addPickup('ammo', t.x + 1, t.z);
    } else if (this.cops && this.cops.includes(t)) {
      if (this.onKillCop) this.onKillCop(t);
    } else if (this.peds && this.peds.includes(t)) {
      if (this.onKillPed) this.onKillPed(t);
    }
  }

  update(dt, player, time) {
    if (this.cooldown > 0) this.cooldown -= dt;
    const pos = player.pos;
    // gunmen: face the player, strafe a little, shoot with inaccuracy
    for (const g of this.gunmen) {
      if (g.dead) continue;
      const dx = pos.x - g.x, dz = pos.z - g.z;
      const d = Math.hypot(dx, dz);
      g.heading = Math.atan2(dx, dz);
      g.mesh.rotation.y = g.heading;
      // strafe sideways to stay in the fight
      g.phase += dt;
      const strafe = Math.sin(g.phase * 0.9) * 2.2;
      g.x += Math.cos(g.heading) * strafe * dt * 0.4;
      g.z += -Math.sin(g.heading) * strafe * dt * 0.4;
      const fixed = this.city.collideCircle(g.x, g.z, 0.5);
      g.x = fixed.x; g.z = fixed.z;
      g.mesh.position.set(g.x, 0, g.z);
      g.mesh.userData.arms[0].rotation.x = -1.2;
      g.mesh.userData.arms[1].rotation.x = -1.2;
      g.shootTimer -= dt;
      if (g.shootTimer <= 0 && d < 55 && !this.city.blocked(g.x, g.z, pos.x, pos.z)) {
        g.shootTimer = 1.1 + this.rng() * 0.9;
        const muzzle = new THREE.Vector3(g.x, 1.45, g.z);
        // inaccurate: 55% hit chance at close range, less far away
        const hitChance = Math.max(0.15, 0.6 - d * 0.008);
        if (this.rng() < hitChance) {
          player.hurt(8 + Math.floor(this.rng() * 8), time);
          this.effects.tracer(muzzle, new THREE.Vector3(pos.x, 1.2, pos.z));
        } else {
          const miss = new THREE.Vector3(
            pos.x + (this.rng() - 0.5) * 6, 0.5,
            pos.z + (this.rng() - 0.5) * 6,
          );
          this.effects.tracer(muzzle, miss);
        }
        this.effects.muzzle(muzzle);
        this.audio.gunshot();
      }
    }
    // pickups spin and bob; collect on touch
    for (const p of this.pickups) {
      if (p.taken) continue;
      p.mesh.rotation.y += dt * 2;
      p.mesh.position.y = 0.9 + Math.sin(time * 2 + p.x) * 0.15;
      const d = Math.hypot(p.x - pos.x, p.z - pos.z);
      if (d < 1.6) {
        p.taken = true;
        this.scene.remove(p.mesh);
        this.scene.remove(p.ring);
        if (p.kind === 'health') player.heal(40);
        else player.ammo.reserve += 24;
        this.audio.pickup();
      }
    }
  }
}
