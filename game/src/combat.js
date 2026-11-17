// Solmar Bay — combat.
// One clear job: the player's fists and pistol (hitscan with building
// occlusion), tracers and muzzle flashes, and the rival gunmen who shoot back.

import { WEAPONS } from './config.js';
import { clamp } from './random.js';
import { buildPersonMesh } from './player.js';

export class Combat {
  constructor(scene, city, game) {
    this.scene = scene;
    this.city = city;
    this.game = game;
    this.tracers = [];
    this.gunmen = [];
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe080, transparent: true, opacity: 0.9 });
  }

  // A short-lived bright line from muzzle to impact point.
  tracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, this.tracerMat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.08 });
  }

  // Hitscan from the player's eye along the aim direction. Returns the first hit.
  hitscan(origin, dir, maxDist) {
    // Step along the ray; stop at the first building.
    const step = 1.2;
    let hitDist = maxDist;
    for (let d = 1; d < maxDist; d += step) {
      const x = origin.x + dir.x * d;
      const z = origin.z + dir.z * d;
      if (this.city.rayBlocked(origin.x, origin.z, x, z)) {
        hitDist = d;
        break;
      }
    }
    const end = new THREE.Vector3(
      origin.x + dir.x * hitDist,
      origin.y,
      origin.z + dir.z * hitDist,
    );
    // Who is closest to the ray, inside the hit range?
    let best = null;
    let bestD = Infinity;
    const targets = [];
    for (const ped of this.game.pedestrians.peds) {
      if (!ped.dead) targets.push({ kind: 'ped', ref: ped, x: ped.x, z: ped.z, r: 0.8 });
    }
    for (const cop of this.game.police.footCops) {
      targets.push({ kind: 'cop', ref: cop, x: cop.x, z: cop.z, r: 0.8 });
    }
    for (const g of this.gunmen) {
      if (!g.dead) targets.push({ kind: 'gunman', ref: g, x: g.x, z: g.z, r: 0.8 });
    }
    for (const t of targets) {
      const rx = t.x - origin.x;
      const rz = t.z - origin.z;
      const along = rx * dir.x + rz * dir.z;
      if (along < 0 || along > hitDist) continue;
      const side = Math.abs(rx * dir.z - rz * dir.x);
      if (side < t.r && along < bestD) {
        bestD = along;
        best = t;
      }
    }
    return { target: best, dist: best ? bestD : hitDist, end };
  }

  playerShoot(player) {
    const origin = player.eyePos();
    const dir = player.aimDir();
    const { target, dist, end } = this.hitscan(origin, dir, WEAPONS.pistol.range);
    this.tracer(origin, target ? new THREE.Vector3(target.x, 1.3, target.z) : end);
    this.game.effects.muzzle(origin.x + dir.x, origin.y - 0.2, origin.z + dir.z, dir);
    this.game.audio.gunshot();
    this.game.pedestrians.scare(player.x, player.z, 30);
    if (target) {
      const dmg = WEAPONS.pistol.damage;
      if (target.kind === 'ped') this.game.pedestrians.hurt(target.ref, dmg, this.game);
      else if (target.kind === 'cop') this.game.police.hurtCop(target.ref, dmg, this.game);
      else if (target.kind === 'gunman') this.hurtGunman(target.ref, dmg);
      this.game.effects.blood(target.x, 1.3, target.z);
    } else if (dist < WEAPONS.pistol.range) {
      this.game.effects.sparks(end.x, 1.2, end.z);
    }
    // Firing in public draws the law.
    if (this.game.police.stars === 0) this.game.police.addWanted(1, 'shots fired');
  }

  playerPunch(player) {
    const reach = WEAPONS.fists.range;
    const dir = player.aimDir();
    const ox = player.x + dir.x * reach * 0.6;
    const oz = player.z + dir.z * reach * 0.6;
    this.game.audio.punch();
    const ped = this.game.pedestrians.nearest(ox, oz, 1.4);
    if (ped) {
      this.game.pedestrians.hurt(ped, WEAPONS.fists.damage, this.game);
      return;
    }
    for (const cop of this.game.police.footCops) {
      if (Math.hypot(cop.x - ox, cop.z - oz) < 1.4) {
        this.game.police.hurtCop(cop, WEAPONS.fists.damage, this.game);
        return;
      }
    }
    for (const g of this.gunmen) {
      if (!g.dead && Math.hypot(g.x - ox, g.z - oz) < 1.4) {
        this.hurtGunman(g, WEAPONS.fists.damage);
        return;
      }
    }
  }

  // A foot cop fires at the player.
  copShoot(cop, player) {
    const from = new THREE.Vector3(cop.x, 1.5, cop.z);
    const to = new THREE.Vector3(player.x, 1.3, player.z);
    const dir = to.clone().sub(from).normalize();
    this.tracer(from, to);
    this.game.effects.muzzle(from.x, from.y, from.z, dir);
    this.game.audio.gunshotFar();
    // Cops miss more at range; a hit hurts.
    const d = from.distanceTo(to);
    const hitChance = clamp(0.55 - d / 90, 0.08, 0.5);
    if (Math.random() < hitChance) {
      player.hurt(6 + Math.random() * 6, this.game);
    }
  }

  // --- Rival gunmen (mission enemies) ---

  spawnGunmen(x, z, count, opts = {}) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const gx = x + (Math.random() - 0.5) * 8;
      const gz = z + (Math.random() - 0.5) * 8;
      const mesh = buildPersonMesh(opts.shirt ?? 0x8a2020, 0x1a1a22, 0x8a5a3a);
      mesh.position.set(gx, 0, gz);
      this.scene.add(mesh);
      const g = {
        mesh, x: gx, z: gz, heading: 0, health: opts.health ?? 100,
        shootTimer: 1 + Math.random() * 2, walkPhase: Math.random() * 6,
        dead: false, speed: 3.6, home: [gx, gz],
      };
      this.gunmen.push(g);
      out.push(g);
    }
    return out;
  }

  clearGunmen() {
    for (const g of this.gunmen) this.scene.remove(g.mesh);
    this.gunmen = [];
  }

  hurtGunman(g, amount) {
    if (g.dead) return;
    g.health -= amount;
    if (g.health <= 0) {
      g.dead = true;
      g.mesh.rotation.x = -Math.PI / 2;
      g.mesh.position.y = 0.3;
      this.game.missions.onGunmanDown(g);
      setTimeout(() => {
        this.scene.remove(g.mesh);
        this.gunmen.splice(this.gunmen.indexOf(g), 1);
      }, 5000);
    }
  }

  updateGunmen(dt, game) {
    const player = game.player;
    for (const g of this.gunmen) {
      if (g.dead) continue;
      const dx = player.x - g.x;
      const dz = player.z - g.z;
      const d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let dh = want - g.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      g.heading += clamp(dh, -3 * dt, 3 * dt);
      const blocked = this.city.rayBlocked(g.x, g.z, player.x, player.z);
      // Advance when the player is far or hidden; hold and shoot when in range.
      if ((d > 16 || blocked) && d < 120) {
        const nx = g.x + Math.sin(g.heading) * g.speed * dt;
        const nz = g.z + Math.cos(g.heading) * g.speed * dt;
        const [cx, cz] = this.city.collideCircle(nx, nz, 0.45);
        g.x = cx;
        g.z = cz;
        g.walkPhase += dt * 10;
        const swing = Math.sin(g.walkPhase) * 0.6;
        const L = g.mesh.userData.limbs;
        L.legL.rotation.x = swing;
        L.legR.rotation.x = -swing;
      }
      g.mesh.position.set(g.x, 0, g.z);
      g.mesh.rotation.y = g.heading;
      if (!blocked && d < 40) {
        g.shootTimer -= dt;
        if (g.shootTimer <= 0) {
          g.shootTimer = 0.9 + Math.random() * 1.1;
          const from = new THREE.Vector3(g.x, 1.5, g.z);
          const to = new THREE.Vector3(player.x, 1.3, player.z);
          const dir = to.clone().sub(from).normalize();
          this.tracer(from, to);
          this.game.effects.muzzle(from.x, from.y, from.z, dir);
          this.game.audio.gunshotFar();
          const hitChance = clamp(0.5 - d / 100, 0.1, 0.45);
          if (Math.random() < hitChance) player.hurt(5 + Math.random() * 6, this.game);
        }
      }
    }
  }

  update(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }
    this.updateGunmen(dt, this.game);
  }
}
