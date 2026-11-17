// Pedestrians: sidewalk walkers with varied shirts who stroll the grid,
// pause, turn at intersections, and flee from gunfire or a speeding car.
import { makeCharacterMesh } from './player.js';
import { resolveCircleColliders, resolveCircleObstacles } from './city.js';
import { clamp } from './config.js';

const SHIRTS = [0xff8a80, 0x80d8ff, 0xccff90, 0xffd180, 0xea80fc, 0x8c9eff, 0xffffff, 0x69f0ae];
const PANTS = [0x37474f, 0x4e342e, 0x1a237e, 0x33691e, 0x5d4037];

export function createPedestrians(scene, city, rng) {
  const peds = [];
  const ROAD_COORDS = [-208, -156, -104, -52, 0, 52, 104, 156, 208];

  function spawnPed(x, z) {
    const mesh = makeCharacterMesh(rng.pick(SHIRTS), rng.pick(PANTS), rng.pick([0xe8b98a, 0xc98a5a, 0x8a5a3a, 0xf2c9a0]));
    const road = rng.pick(ROAD_COORDS);
    const horizontal = rng.chance(0.5);
    const px = x !== undefined ? x : (horizontal ? rng.range(-200, 200) : road + rng.pick([-8, 8]));
    const pz = z !== undefined ? z : (horizontal ? road + rng.pick([-8, 8]) : rng.range(-200, 200));
    mesh.group.position.set(px, 0, pz);
    scene.add(mesh.group);
    const ped = {
      mesh, pos: mesh.group.position,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(1.2, 2.2),
      walkPhase: rng.range(0, 6),
      retarget: rng.range(2, 7),
      fleeing: 0,
      dirX: 0, dirZ: 1,
    };
    ped.dirX = Math.sin(ped.angle); ped.dirZ = Math.cos(ped.angle);
    peds.push(ped);
    return ped;
  }

  for (let i = 0; i < 26; i++) spawnPed();

  return {
    peds,
    // called when a shot is fired or a car speeds past: nearby peds flee
    scare(x, z, radius) {
      for (const ped of peds) {
        const dx = ped.pos.x - x, dz = ped.pos.z - z;
        const d2 = dx * dx + dz * dz;
        if (d2 < radius * radius && d2 > 0.01) {
          const d = Math.sqrt(d2);
          ped.dirX = dx / d; ped.dirZ = dz / d;
          ped.angle = Math.atan2(ped.dirX, ped.dirZ);
          ped.fleeing = 3 + Math.random() * 2;
        }
      }
    },
    update(dt) {
      for (const ped of peds) {
        ped.retarget -= dt;
        if (ped.fleeing > 0) ped.fleeing -= dt;
        if (ped.retarget <= 0 && ped.fleeing <= 0) {
          ped.retarget = rng.range(3, 8);
          // turn onto a new heading, usually along a road
          const snap = rng.chance(0.75);
          ped.angle = snap ? Math.round(rng.range(0, 3)) * (Math.PI / 2) + rng.range(-0.15, 0.15) : rng.range(0, Math.PI * 2);
          ped.dirX = Math.sin(ped.angle); ped.dirZ = Math.cos(ped.angle);
        }
        const sp = ped.fleeing > 0 ? ped.speed * 2.6 : ped.speed;
        const nx = ped.pos.x + ped.dirX * sp * dt;
        const nz = ped.pos.z + ped.dirZ * sp * dt;
        ped.pos.x = nx; ped.pos.z = nz;
        const hit = resolveCircleColliders(ped.pos, 0.5, city.colliders)
          || resolveCircleObstacles(ped.pos, 0.5, city.obstacles);
        if (hit || Math.abs(ped.pos.x) > 205 || Math.abs(ped.pos.z) > 205) {
          // turn around
          ped.angle += Math.PI + rng.range(-0.5, 0.5);
          ped.dirX = Math.sin(ped.angle); ped.dirZ = Math.cos(ped.angle);
          ped.pos.x = clamp(ped.pos.x, -205, 205);
          ped.pos.z = clamp(ped.pos.z, -205, 205);
        }
        ped.walkPhase += dt * (ped.fleeing > 0 ? 13 : 7);
        const swing = Math.sin(ped.walkPhase) * 0.6;
        ped.mesh.legL.rotation.x = swing;
        ped.mesh.legR.rotation.x = -swing;
        ped.mesh.armL.rotation.x = -swing * 0.7;
        ped.mesh.armR.rotation.x = swing * 0.7;
        ped.mesh.group.rotation.y = ped.angle;
      }
    },
  };
}
