// Combat: fists and a pistol with hitscan shots, building occlusion, tracers
// and muzzle flash; rival gunmen who shoot back; health and ammo pickups.
import { makeCharacterMesh } from './player.js';
import { segmentBlocked, resolveCircleColliders } from './city.js';
import { dist2 } from './config.js';

export function createCombat(scene, city, effects, audio) {
  const rivals = [];
  const pickups = [];
  let shootCooldown = 0;

  const healthGeo = new THREE.BoxGeometry(0.7, 0.7, 0.2);
  const healthMat = new THREE.MeshBasicMaterial({ color: 0x2bff88 });
  const ammoGeo = new THREE.BoxGeometry(0.7, 0.5, 0.4);
  const ammoMat = new THREE.MeshBasicMaterial({ color: 0xffc93c });

  function spawnPickup(x, z, kind) {
    const m = new THREE.Mesh(kind === 'health' ? healthGeo : ammoGeo, kind === 'health' ? healthMat : ammoMat);
    m.position.set(x, 1, z);
    scene.add(m);
    pickups.push({ mesh: m, kind, x, z, spin: Math.random() * 6 });
  }

  // scatter a few pickups around the city
  spawnPickup(26, 12, 'health'); spawnPickup(-78, 26, 'ammo');
  spawnPickup(130, -78, 'health'); spawnPickup(208, 104, 'ammo');
  spawnPickup(-182, -130, 'health'); spawnPickup(60, 182, 'ammo');

  function spawnRival(x, z) {
    const mesh = makeCharacterMesh(0x8a2a2a, 0x222222, 0xc98a5a);
    mesh.group.position.set(x, 0, z);
    scene.add(mesh.group);
    const r = { mesh, pos: mesh.group.position, health: 50, angle: 0, shootTimer: 1 + Math.random(), walkPhase: 0 };
    rivals.push(r);
    return r;
  }

  function muzzlePos(player) {
    const a = player.heading();
    return {
      x: player.pos.x + Math.sin(a) * 0.8,
      y: player.isDriving() ? 1.4 : 1.5,
      z: player.pos.z + Math.cos(a) * 0.8,
    };
  }

  return {
    rivals,
    spawnRival,
    spawnPickup,
    get rivalCount() { return rivals.length; },
    // player fires the pistol toward the aim direction
    shoot(player, aimX, aimZ) {
      if (shootCooldown > 0 || player.ammo <= 0) return false;
      shootCooldown = 0.28;
      player.ammo -= 1;
      const m = muzzlePos(player);
      const dx = aimX - m.x, dz = aimZ - m.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      const dirX = dx / len, dirZ = dz / len;
      // find the nearest hit: rivals first, then buildings
      let best = 60, hitRival = null;
      for (const r of rivals) {
        const rx = r.pos.x - m.x, rz = r.pos.z - m.z;
        const along = rx * dirX + rz * dirZ;
        if (along < 0 || along > best) continue;
        const perp = Math.abs(rx * dirZ - rz * dirX);
        if (perp < 0.9 && !segmentBlocked(m.x, m.z, r.pos.x, r.pos.z, city.colliders)) {
          best = along; hitRival = r;
        }
      }
      const endX = m.x + dirX * best, endZ = m.z + dirZ * best;
      effects.tracer(m.x, m.y, m.z, endX, m.y, endZ);
      effects.muzzle(m.x, m.y, m.z);
      audio.gunshot();
      if (hitRival) {
        hitRival.health -= 34;
        effects.burst(hitRival.pos.x, 1.4, hitRival.pos.z, 0xff4444, 8, 4);
        if (hitRival.health <= 0) {
          effects.burst(hitRival.pos.x, 1, hitRival.pos.z, 0xff4444, 20, 6);
          scene.remove(hitRival.mesh.group);
          rivals.splice(rivals.indexOf(hitRival), 1);
        }
      } else if (best < 60) {
        effects.burst(endX, m.y, endZ, 0xffcc88, 4, 3);
      }
      return true;
    },
    punch(player) {
      if (shootCooldown > 0) return;
      shootCooldown = 0.4;
      player.punchTimer = 0.3;
      audio.thud();
      const a = player.heading();
      const fx = player.pos.x + Math.sin(a) * 1.4, fz = player.pos.z + Math.cos(a) * 1.4;
      for (const r of [...rivals]) {
        if (dist2(fx, fz, r.pos.x, r.pos.z) < 2.5) {
          r.health -= 20;
          effects.burst(r.pos.x, 1.4, r.pos.z, 0xffdd66, 6, 4);
          if (r.health <= 0) {
            scene.remove(r.mesh.group);
            rivals.splice(rivals.indexOf(r), 1);
          }
        }
      }
    },
    update(dt, player, onPlayerHit) {
      shootCooldown = Math.max(0, shootCooldown - dt);
      // pickups spin and bob; walking over one collects it
      for (let i = pickups.length - 1; i >= 0; i--) {
        const pk = pickups[i];
        pk.spin += dt * 2;
        pk.mesh.rotation.y = pk.spin;
        pk.mesh.position.y = 1 + Math.sin(pk.spin * 1.5) * 0.15;
        if (!player.isDriving() && dist2(player.pos.x, player.pos.z, pk.x, pk.z) < 2.2) {
          if (pk.kind === 'health') player.heal(40);
          else player.reserveAmmo = Math.min(120, player.reserveAmmo + 24);
          audio.blip(880);
          effects.burst(pk.x, 1, pk.z, pk.kind === 'health' ? 0x2bff88 : 0xffc93c, 10, 4);
          scene.remove(pk.mesh);
          pickups.splice(i, 1);
        }
      }
      // rivals advance and shoot at the player
      for (const r of rivals) {
        const dx = player.pos.x - r.pos.x, dz = player.pos.z - r.pos.z;
        const d = Math.sqrt(dx * dx + dz * dz) || 1;
        r.angle = Math.atan2(dx, dz);
        if (d > 14) {
          r.pos.x += (dx / d) * 4.5 * dt;
          r.pos.z += (dz / d) * 4.5 * dt;
          resolveCircleColliders(r.pos, 0.5, city.colliders);
          r.walkPhase += dt * 10;
          const swing = Math.sin(r.walkPhase) * 0.65;
          r.mesh.legL.rotation.x = swing;
          r.mesh.legR.rotation.x = -swing;
        }
        r.mesh.group.rotation.y = r.angle;
        r.shootTimer -= dt;
        if (r.shootTimer <= 0 && d < 45 && !segmentBlocked(r.pos.x, r.pos.z, player.pos.x, player.pos.z, city.colliders)) {
          r.shootTimer = 1.1 + Math.random() * 0.9;
          effects.tracer(r.pos.x, 1.5, r.pos.z, player.pos.x, 1.3, player.pos.z);
          effects.muzzle(r.pos.x, 1.5, r.pos.z);
          audio.gunshot();
          if (Math.random() < 0.45 && onPlayerHit) onPlayerHit(8);
        }
      }
    },
  };
}
