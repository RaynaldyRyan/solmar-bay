// Cars: arcade physics (acceleration, speed-scaled steering, handbrake drift,
// nitro) plus the collision response against building footprints and the
// world edge. One step function drives the player, the cops, the traffic and
// the race rivals — the AI just feeds it different inputs.
import { ARCHETYPES, NITRO_MAX, WORLD } from './config.js';
import { hitBuilding, isLand } from './city.js';

export function createCar(type, x, z, heading) {
  const arch = ARCHETYPES[type];
  return {
    type, x, z, heading,
    speed: 0, steer: 0, nitro: NITRO_MAX, condition: 100,
    drift: 0, driftScore: 0, sliding: false,
    vx: 0, vz: 0, color: arch.color,
  };
}

// speed in m/s along the heading; vx/vz is the actual velocity (they diverge
// while drifting, which is how the drift score is measured).
export function stepCar(car, input, dt, city) {
  const arch = ARCHETYPES[car.type];
  // Normalize: callers may pass a partial input (the title screen passes {}),
  // and an undefined axis must mean "off", never NaN.
  const throttle = input.throttle || 0;
  const brake = input.brake || 0;
  const steerIn = input.steer || 0;
  const handbrake = input.handbrake || 0;
  const nitroIn = input.nitro || 0;
  const boosting = nitroIn && car.nitro > 0 && throttle > 0;
  const accel = arch.accel * (boosting ? 1.6 : 1);
  if (throttle) car.speed += accel * dt;
  if (brake) car.speed -= (car.speed > 0.5 ? 26 : 10) * dt;
  car.speed -= car.speed * 0.35 * dt; // drag + rolling resistance
  if (!throttle && !brake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 4 * dt);
  const top = arch.top * (boosting ? 1.18 : 1);
  car.speed = Math.max(-12, Math.min(top, car.speed));
  if (boosting) car.nitro = Math.max(0, car.nitro - 34 * dt);
  else car.nitro = Math.min(NITRO_MAX, car.nitro + 6 * dt);

  // Steering tightens at low speed, loosens at high speed; handbrake cuts grip.
  const spd = Math.abs(car.speed);
  const steerRate = 2.4 * Math.min(1, 8 / (4 + spd * 0.55));
  car.steer += (steerIn - car.steer) * Math.min(1, dt * 8);
  car.heading += car.steer * steerRate * dt * Math.sign(car.speed || 1);

  const grip = handbrake ? arch.grip * 0.25 : arch.grip;
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  // Velocity blends toward the heading direction at the grip rate: low grip
  // leaves the old velocity in place, which is the slide.
  const k = Math.min(1, grip * dt);
  car.vx += (fx * car.speed - car.vx) * k;
  car.vz += (fz * car.speed - car.vz) * k;
  const slide = Math.hypot(car.vx - fx * car.speed, car.vz - fz * car.speed);
  car.sliding = slide > 6 && spd > 12;
  if (car.sliding) {
    car.drift += slide * dt;
    car.driftScore += slide * dt * 2; // accumulate the fraction — flooring
    // each step rounded every increment to 0 and the drift never scored
  }

  let nx = car.x + car.vx * dt;
  let nz = car.z + car.vz * dt;
  // World edge + water: cars cannot leave the land.
  nx = Math.max(WORLD.minX + 6, Math.min(WORLD.maxX - 6, nx));
  nz = Math.max(WORLD.minZ + 6, Math.min(WORLD.maxZ - 6, nz));
  if (!isLand(nx, nz)) {
    nx = car.x;
    nz = car.z;
    car.speed *= 0.4;
    car.vx *= -0.2;
    car.vz *= -0.2;
  }
  // Buildings: push out along the smallest penetration axis, lose speed.
  const b = hitBuilding(city, nx, nz, 2.4);
  if (b) {
    const overlapX = (b.w / 2 + 2.4) - Math.abs(nx - b.x);
    const overlapZ = (b.d / 2 + 2.4) - Math.abs(nz - b.z);
    if (overlapX < overlapZ) nx = b.x + Math.sign(nx - b.x) * (b.w / 2 + 2.5);
    else nz = b.z + Math.sign(nz - b.z) * (b.d / 2 + 2.5);
    const impact = Math.abs(car.speed);
    car.speed *= 0.35;
    car.vx *= 0.3;
    car.vz *= 0.3;
    if (impact > 12) car.condition = Math.max(0, car.condition - (impact - 12) * 0.8);
  }
  car.x = nx;
  car.z = nz;
  return car;
}

// Near-miss: another car passed within 4 m at a closing speed over 15 m/s.
export function nearMiss(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 4.5 || dist < 1.5) return false;
  const closing = Math.abs((a.vx - b.vx) * dx + (a.vz - b.vz) * dz) / Math.max(dist, 0.1);
  return closing > 15;
}

export function kmh(car) {
  return Math.round(Math.hypot(car.vx, car.vz) * 3.6);
}

export function gearOf(car) {
  const s = Math.abs(car.speed);
  if (s < 0.5) return 'N';
  if (car.speed < 0) return 'R';
  if (s < 8) return '1';
  if (s < 16) return '2';
  if (s < 25) return '3';
  if (s < 34) return '4';
  return '5';
}
