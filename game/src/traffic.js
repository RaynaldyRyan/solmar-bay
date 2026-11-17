// Traffic: cars that drive the road grid in lanes, brake for the car ahead,
// and turn at intersections. They give the city life and the chase something
// to weave through.
import { CFG } from './config.js';
import { CAR_ARCHETYPES } from './config.js';
import { createCar } from './vehicles.js';

const ROAD_COORDS = [-208, -156, -104, -52, 0, 52, 104, 156, 208];

export function createTraffic(scene, city, rng) {
  const cars = [];
  const keys = Object.keys(CAR_ARCHETYPES);

  function spawnCar() {
    const horizontal = rng.chance(0.5);
    const road = rng.pick(ROAD_COORDS);
    const dir = rng.sign();
    const lane = 3; // right-hand lane offset
    const along = rng.range(-200, 200);
    const arch = rng.pick(keys);
    const color = rng.pick(CAR_ARCHETYPES[arch].colors);
    // lane offset is perpendicular to travel, on the right-hand side
    const lx = horizontal ? along : road + (dir > 0 ? lane : -lane);
    const lz = horizontal ? road + (dir > 0 ? -lane : lane) : along;
    const angle = horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = createCar(scene, arch, color, lx, lz, angle, false);
    car.userData = {
      horizontal, road, dir,
      cruise: rng.range(9, 14),
      turnCooldown: rng.range(2, 8),
    };
    cars.push(car);
    return car;
  }

  for (let i = 0; i < 14; i++) spawnCar();

  // nearest road coordinate to a value
  function nearestRoad(v) {
    let best = ROAD_COORDS[0], bd = 1e9;
    for (const r of ROAD_COORDS) { const d = Math.abs(v - r); if (d < bd) { bd = d; best = r; } }
    return best;
  }

  return {
    cars,
    update(dt, playerCar) {
      for (const car of cars) {
        const u = car.userData;
        const along = u.horizontal ? car.pos.x : car.pos.z;
        const across = u.horizontal ? car.pos.z : car.pos.x;
        // follow the car ahead smoothly: match its speed and keep a gap,
        // instead of braking to a stop on its bumper
        let gapTarget = u.cruise;
        const all = playerCar ? cars.concat([playerCar]) : cars;
        for (const other of all) {
          if (other === car) continue;
          const od = u.horizontal ? other.pos.z - car.pos.z : other.pos.x - car.pos.x;
          const oa = u.horizontal ? other.pos.x - car.pos.x : other.pos.z - car.pos.z;
          const gap = oa * u.dir;
          if (Math.abs(od) < 2.2 && gap > 0 && gap < 20) {
            const follow = Math.max(0, other.speed * Math.min(1, (gap - 6) / 8));
            gapTarget = Math.min(gapTarget, follow);
          }
        }
        // steer back to the lane center
        const targetAcross = u.road + (u.dir > 0 ? 3 : -3) * (u.horizontal ? -1 : 1);
        const err = targetAcross - across;
        const desiredAngle = u.horizontal
          ? (u.dir > 0 ? Math.PI / 2 : -Math.PI / 2) + (u.dir > 0 ? -err : err) * 0.06
          : (u.dir > 0 ? 0 : Math.PI) + (u.dir > 0 ? err : -err) * 0.06;
        let da = desiredAngle - car.angle;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        const steer = Math.max(-1, Math.min(1, da * 2.2));
        const throttle = car.speed < gapTarget - 0.3 ? 0.7 : (car.speed > gapTarget + 0.5 ? -1 : 0);
        car.update(dt, throttle, steer, false, city, null);
        // turn at an intersection sometimes
        u.turnCooldown -= dt;
        const nearCross = Math.abs(along - nearestRoad(along)) < 2;
        if (nearCross && u.turnCooldown <= 0 && rng.chance(0.5)) {
          u.turnCooldown = rng.range(4, 10);
          const cross = nearestRoad(along);
          const newDir = rng.sign();
          u.horizontal = !u.horizontal;
          u.road = cross;
          u.dir = newDir;
        }
        // respawn if it wandered off the grid or got wrecked
        if (Math.abs(car.pos.x) > 320 || Math.abs(car.pos.z) > 320 || car.health <= 0) {
          car.remove();
          const idx = cars.indexOf(car);
          cars.splice(idx, 1);
          spawnCar();
        }
      }
    },
  };
}
