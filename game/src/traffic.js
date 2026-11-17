// Solmar Bay — road traffic.
// One clear job: the civilian cars that drive the road grid (lanes, turns,
// braking, U-turns at the city edge) plus parked cars the player can steal.

import { WORLD, CAR_TYPES } from './config.js';
import { Rng, clamp } from './random.js';
import { Car } from './vehicles.js';

const TRAFFIC_TYPES = ['sedan', 'coupe', 'suv', 'pickup', 'taxi'];

export class Traffic {
  constructor(scene, city, count = 14, seed = 5) {
    this.scene = scene;
    this.city = city;
    this.rng = new Rng(seed);
    this.cars = [];
    this.parked = [];
    for (let i = 0; i < count; i++) this.spawnMoving();
    for (let i = 0; i < 10; i++) this.spawnParked();
  }

  spawnMoving() {
    const rng = this.rng;
    const [x, z] = this.city.randomRoadPoint(rng);
    const type = rng.pick(TRAFFIC_TYPES);
    // Pick an axis and a direction; lane offset puts the car on the right side.
    const alongX = rng.chance(0.5);
    const dir = rng.chance(0.5) ? 1 : -1;
    const lane = 2.6;
    const px = alongX ? x : x + dir * lane;
    const pz = alongX ? z - dir * lane : z;
    const heading = alongX ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = new Car(this.scene, type, px, pz, heading);
    car.driver = 'traffic';
    car.occupied = true;
    car.cruise = rng.float(9, 15);
    car.road = alongX ? pz : px; // the road line it follows
    car.alongX = alongX;
    car.dir = dir;
    car.turnCooldown = rng.float(2, 8);
    this.cars.push(car);
    return car;
  }

  spawnParked() {
    const rng = this.rng;
    const [x, z] = this.city.randomRoadPoint(rng);
    const type = rng.pick(TRAFFIC_TYPES);
    const alongX = rng.chance(0.5);
    const px = alongX ? x : x + 4.6;
    const pz = alongX ? z + 4.6 : z;
    const heading = alongX ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
    const car = new Car(this.scene, type, px, pz, heading);
    car.driver = null;
    car.occupied = false;
    this.parked.push(car);
    return car;
  }

  // The player ripped the driver out of this car: it becomes a free parked car.
  ejectDriver(car) {
    car.driver = null;
    car.occupied = false;
    car.speed = 0;
    const i = this.cars.indexOf(car);
    if (i !== -1) this.cars.splice(i, 1);
    this.parked.push(car);
  }

  allCars() {
    return this.cars.concat(this.parked);
  }

  update(dt, game) {
    const player = game.player;
    for (const car of [...this.cars]) {
      // Respawn far-away cars near the player so the streets stay busy.
      const d2 = (car.x - player.x) ** 2 + (car.z - player.z) ** 2;
      if (d2 > 220 * 220) {
        this.respawnNear(car, player);
        continue;
      }
      this.driveTrafficCar(car, dt, game);
    }
    // Parked cars just sit, but keep their smoke going if wrecked.
    for (const car of this.parked) {
      if (car.health < 45 && !car.dead) {
        car.smokeTimer -= dt;
        if (car.smokeTimer <= 0) {
          car.smokeTimer = 0.25;
          game.effects.smoke(car.x, 1.2, car.z);
        }
      }
    }
  }

  respawnNear(car, player) {
    const rng = this.rng;
    const a = rng.float(0, Math.PI * 2);
    const d = rng.float(60, 110);
    const [rx, rz] = this.city.nearestRoad(
      clamp(player.x + Math.cos(a) * d, -140, 140),
      clamp(player.z + Math.sin(a) * d, -140, 140),
    );
    car.x = rx;
    car.z = rz;
    car.speed = 0;
    car.heading = rng.float(0, Math.PI * 2);
    car.mesh.position.set(rx, 0, rz);
    car.mesh.rotation.y = car.heading + Math.PI;
  }

  driveTrafficCar(car, dt, game) {
    const rng = this.rng;
    car.turnCooldown -= dt;
    // At an intersection, sometimes turn onto the crossing road.
    const onCrossX = WORLD.ROADS.some((r) => Math.abs(car.x - r) < 1.2);
    const onCrossZ = WORLD.ROADS.some((r) => Math.abs(car.z - r) < 1.2);
    if (onCrossX && onCrossZ && car.turnCooldown <= 0 && rng.chance(0.5)) {
      car.alongX = !car.alongX;
      car.dir = rng.chance(0.5) ? 1 : -1;
      car.turnCooldown = rng.float(4, 10);
    }
    // U-turn at the city edge.
    if (car.alongX && Math.abs(car.x) > 146) car.dir *= -1;
    if (!car.alongX && Math.abs(car.z) > 146) car.dir *= -1;
    // Target: stay on the road line, in the right-hand lane.
    const lane = 2.6;
    let tx;
    let tz;
    if (car.alongX) {
      tx = car.x + car.dir * 20;
      tz = car.road - car.dir * lane;
    } else {
      tx = car.road + car.dir * lane;
      tz = car.z + car.dir * 20;
    }
    // Brake for a car ahead.
    let throttle = 0.55;
    const ahead = this.carAhead(car, game);
    if (ahead !== null) {
      throttle = ahead < 8 ? -0.6 : 0.15;
    }
    // Brake for the player crossing close ahead.
    const pdx = game.player.x - car.x;
    const pdz = game.player.z - car.z;
    const pd = Math.hypot(pdx, pdz);
    if (pd < 7 && game.player.onFoot) {
      const facing = Math.sin(car.heading) * pdx + Math.cos(car.heading) * pdz;
      if (facing > 0) throttle = -0.8;
    }
    const steer = car.steerTo(tx, tz);
    const wantSpeed = car.cruise;
    const speedThrottle = car.speed < wantSpeed ? throttle : 0.1;
    car.drive(dt, speedThrottle, steer, false, this.city, game.allVehicles());
    // Re-sync the road line after a turn.
    if (car.alongX) car.road = car.z + car.dir * lane;
    else car.road = car.x - car.dir * lane;
    if (car.health < 45 && !car.dead) {
      car.smokeTimer -= dt;
      if (car.smokeTimer <= 0) {
        car.smokeTimer = 0.25;
        game.effects.smoke(car.x, 1.2, car.z);
      }
    }
  }

  carAhead(car, game) {
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    let best = null;
    for (const o of game.allVehicles()) {
      if (o === car || !o.alive) continue;
      const dx = o.x - car.x;
      const dz = o.z - car.z;
      const along = dx * fx + dz * fz;
      if (along < 0 || along > 22) continue;
      const side = Math.abs(dx * fz - dz * fx);
      if (side < 2.6 && (best === null || along < best)) best = along;
    }
    return best;
  }

  // Nearest car to a point, within maxDist, that the player could enter.
  nearestEnterable(x, z, maxDist = 4) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.allCars()) {
      if (!car.alive || car.dead) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }
}
