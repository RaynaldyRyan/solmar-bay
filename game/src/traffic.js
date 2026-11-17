// Traffic: cars that drive the road grid in lanes, brake for the car ahead,
// turn at intersections and U-turn at the city edge. Parked cars sit by curbs.
import { ROADS, CAR_KEYS, WORLD_BOUND } from './config.js';
import { Car } from './vehicles.js';
import { pick, range, intRange } from './random.js';

const LANE = 3; // right-hand lane offset from the road centre

export class Traffic {
  constructor(scene, city, rng, count = 14) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];    // {car, axis, road, dir, speed, target}
    this.parked = [];  // Car instances parked by curbs
    this.spawnAll(count);
    this.spawnParked(10);
  }

  spawnAll(count) {
    for (let i = 0; i < count; i++) this.spawnOne(true);
  }

  // A traffic car on a random road, random direction, random lane side.
  spawnOne(anywhere) {
    const rng = this.rng;
    const axis = rng() < 0.5 ? 'x' : 'z';
    const road = pick(rng, ROADS);
    const dir = rng() < 0.5 ? 1 : -1;
    const along = anywhere ? range(rng, -150, 150) : range(rng, 60, 150) * (rng() < 0.5 ? -1 : 1);
    const key = pick(rng, CAR_KEYS);
    let x, z, heading;
    if (axis === 'x') {
      x = along; z = road + LANE * dir;
      heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = road - LANE * dir; z = along;
      heading = dir > 0 ? 0 : Math.PI;
    }
    const car = new Car(this.scene, key, x, z, heading);
    car.occupied = true;
    this.cars.push({
      car, axis, road, dir,
      speed: range(rng, 9, 14),
      turnCooldown: range(rng, 2, 8),
    });
  }

  spawnParked(count) {
    const rng = this.rng;
    for (let i = 0; i < count; i++) {
      const road = pick(rng, ROADS);
      const along = range(rng, -140, 140);
      const side = rng() < 0.5 ? -1 : 1;
      const horizontal = rng() < 0.5;
      const key = pick(rng, CAR_KEYS);
      let x, z, heading;
      if (horizontal) {
        x = along; z = road + side * 5.2;
        heading = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        x = road + side * 5.2; z = along;
        heading = side > 0 ? 0 : Math.PI;
      }
      if (this.city.insideCollider(x, z, 2)) continue;
      const car = new Car(this.scene, key, x, z, heading);
      this.parked.push(car);
    }
  }

  // All cars the player could steal or crash into.
  allCars() {
    return [...this.cars.map((t) => t.car), ...this.parked];
  }

  update(dt, playerPos) {
    for (const t of this.cars) {
      const { car } = t;
      t.turnCooldown -= dt;
      // car ahead? brake.
      let blocked = false;
      const f = car.forward();
      for (const o of this.cars) {
        if (o === t) continue;
        const dx = o.car.x - car.x, dz = o.car.z - car.z;
        const ahead = dx * f.x + dz * f.z;
        const side = Math.abs(-dx * f.z + dz * f.x);
        if (ahead > 0 && ahead < 9 && side < 2.4) { blocked = true; break; }
      }
      const throttle = blocked ? -0.4 : 1;
      // steer back onto the lane
      let steer = 0;
      if (t.axis === 'x') {
        const want = t.road + LANE * t.dir;
        steer = (want - car.z) * 0.08 * t.dir;
      } else {
        const want = t.road - LANE * t.dir;
        steer = -(want - car.x) * 0.08 * t.dir;
      }
      // maybe turn at an intersection
      const onIntersection = ROADS.some((r) => Math.abs((t.axis === 'x' ? car.x : car.z) - r) < 3);
      if (onIntersection && t.turnCooldown <= 0 && this.rng() < 0.3) {
        t.turnCooldown = range(this.rng, 4, 10);
        const other = pick(this.rng, ROADS);
        if (t.axis === 'x') {
          t.axis = 'z'; t.road = Math.round(car.x / 40) * 40;
          t.dir = this.rng() < 0.5 ? 1 : -1;
        } else {
          t.axis = 'x'; t.road = Math.round(car.z / 40) * 40;
          t.dir = this.rng() < 0.5 ? 1 : -1;
        }
      }
      // U-turn at the city edge
      const along = t.axis === 'x' ? car.x : car.z;
      if (along * t.dir > WORLD_BOUND - 12) {
        t.dir *= -1;
        car.heading += Math.PI;
      }
      // cap traffic speed below the car's top speed
      const prev = car.spec.topSpeed;
      car.spec = { ...car.spec, topSpeed: t.speed };
      car.drive(throttle, Math.max(-1, Math.min(1, steer)), false, dt);
      car.spec = { ...car.spec, topSpeed: prev };
      // keep on the road: soft push back toward the lane
      const fixed = this.city.collideCircle(car.x, car.z, 1.6);
      car.x = fixed.x; car.z = fixed.z;
      car.mesh.position.set(car.x, 0, car.z);
      // recycle far-away cars near the player
      const d = Math.hypot(car.x - playerPos.x, car.z - playerPos.z);
      if (d > 260) {
        const axis = this.rng() < 0.5 ? 'x' : 'z';
        const road = pick(this.rng, ROADS);
        const dir = this.rng() < 0.5 ? 1 : -1;
        const near = range(this.rng, 60, 120);
        if (axis === 'x') {
          car.x = playerPos.x + near * (this.rng() < 0.5 ? -1 : 1);
          car.z = road + LANE * dir;
          car.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          car.x = road - LANE * dir;
          car.z = playerPos.z + near * (this.rng() < 0.5 ? -1 : 1);
          car.heading = dir > 0 ? 0 : Math.PI;
        }
        t.axis = axis; t.road = road; t.dir = dir;
      }
    }
  }
}
