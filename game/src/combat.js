// On-foot combat: 5 weapons, guards with health and simple seek-and-shoot
// AI, muzzle flashes and tracers the renderer draws. Firing is a ray from the
// player toward the aim point; guards hit take damage and return fire when the
// player is in range and in front of them.
import { WEAPONS } from './config.js';

export function createCombat() {
  return {
    guards: [],
    tracers: [],
    flashes: [],
    cooldown: 0,
    guardCooldown: 0,
  };
}

export function spawnGuards(combat, spots, count) {
  combat.guards = [];
  for (let i = 0; i < count; i += 1) {
    const s = spots[i % spots.length];
    combat.guards.push({
      x: s[0], z: s[1], heading: Math.atan2(-s[0], -s[1]),
      health: 100, alive: true, fireTimer: 0.5 + i * 0.4, weapon: 1,
    });
  }
}

// Fire one shot (or a pellet spread) from `from` toward `angle`. Returns the
// hit point for the tracer; applies damage to the first guard in the cone.
export function fireWeapon(combat, from, angle, weaponIndex, rng, now) {
  const w = WEAPONS[weaponIndex];
  if (combat.cooldown > 0) return null;
  combat.cooldown = 1 / w.rate;
  const pellets = w.pellets || 1;
  let best = null;
  for (let p = 0; p < pellets; p += 1) {
    const a = angle + (rng.next() - 0.5) * w.spread * 2;
    const ex = from.x + Math.sin(a) * w.range;
    const ez = from.z + Math.cos(a) * w.range;
    let hit = { x: ex, z: ez, dist: w.range, guard: null };
    for (const g of combat.guards) {
      if (!g.alive) continue;
      const dx = g.x - from.x;
      const dz = g.z - from.z;
      const d = Math.hypot(dx, dz);
      if (d > w.range || d < 1) continue;
      const ga = Math.atan2(dx, dz);
      let diff = ga - a;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < 0.09 && d < hit.dist) {
        hit = { x: g.x, z: g.z, dist: d, guard: g };
      }
    }
    if (hit.guard) {
      hit.guard.health -= w.dmg;
      if (hit.guard.health <= 0) hit.guard.alive = false;
    }
    combat.tracers.push({ x0: from.x, z0: from.z, x1: hit.x, z1: hit.z, life: 0.09 });
    if (!best || hit.dist < best.dist) best = hit;
  }
  combat.flashes.push({ x: from.x, z: from.z, angle, until: now + 0.12, weapon: weaponIndex });
  return best;
}

export function updateCombat(combat, state, dt, rng, now) {
  combat.cooldown = Math.max(0, combat.cooldown - dt);
  for (let i = combat.tracers.length - 1; i >= 0; i -= 1) {
    combat.tracers[i].life -= dt;
    if (combat.tracers[i].life <= 0) combat.tracers.splice(i, 1);
  }
  for (let i = combat.flashes.length - 1; i >= 0; i -= 1) {
    if (now > combat.flashes[i].until) combat.flashes.splice(i, 1);
  }
  // Guards: face the player, strafe a little, shoot when in range.
  const p = state.player;
  for (const g of combat.guards) {
    if (!g.alive) continue;
    const dx = p.x - g.x;
    const dz = p.z - g.z;
    const dist = Math.hypot(dx, dz);
    g.heading = Math.atan2(dx, dz);
    g.fireTimer -= dt;
    if (dist < 70 && g.fireTimer <= 0) {
      g.fireTimer = 0.9 + rng.next() * 0.7;
      const w = WEAPONS[g.weapon];
      const a = g.heading + (rng.next() - 0.5) * 0.14;
      const hitX = g.x + Math.sin(a) * Math.min(dist, w.range);
      const hitZ = g.z + Math.cos(a) * Math.min(dist, w.range);
      combat.tracers.push({ x0: g.x, z0: g.z, x1: hitX, z1: hitZ, life: 0.09 });
      combat.flashes.push({ x: g.x, z: g.z, angle: a, until: now + 0.12, weapon: g.weapon });
      if (Math.abs(a - g.heading) < 0.05 && dist < 60) {
        if (state.armor > 0) state.armor = Math.max(0, state.armor - w.dmg * 0.6);
        else state.health = Math.max(0, state.health - w.dmg * 0.6);
      }
    }
  }
}
