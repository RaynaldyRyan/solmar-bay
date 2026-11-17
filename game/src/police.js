// The wanted system and the Solmar Bay Police Department: foot cops who chase
// and arrest, interceptor cars that pursue and ram, and a helicopter at 4+
// stars. Wanted decays only while no unit has line of sight on the player.
import { WANTED, WORLD_BOUND } from './config.js';
import { Car } from './vehicles.js';
import { createPersonMesh } from './player.js';

function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

export class Police {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.wanted = 0;
    this.cops = [];      // foot cops {mesh,x,z,heading,arrest,health,dead}
    this.copCars = [];   // {car, deployTimer}
    this.heli = null;    // {group, angle, spotlight}
    this.noSightTimer = 0;
    this.decayTimer = 0;
    this.spawnTimer = 0;
    this.bustedTimer = 0;
    this.onBusted = null;
  }

  addStars(n, reason) {
    if (n <= 0) return;
    this.wanted = Math.min(WANTED.max, this.wanted + n);
    this.noSightTimer = 0;
  }

  clearWanted() {
    this.wanted = 0;
    this.noSightTimer = 0;
  }

  // Does any police unit see the player? Distance + no building in between.
  anyLineOfSight(px, pz) {
    const sees = (x, z, range) => {
      if (Math.hypot(x - px, z - pz) > range) return false;
      return !this.city.blocked(x, z, px, pz);
    };
    for (const c of this.cops) if (!c.dead && sees(c.x, c.z, 55)) return true;
    for (const c of this.copCars) if (sees(c.car.x, c.car.z, 70)) return true;
    if (this.heli) return true; // the eye in the sky always sees
    return false;
  }

  update(dt, player, time) {
    const pos = player.pos;
    // spawn pressure: more wanted = more units, up to caps
    this.spawnTimer -= dt;
    if (this.wanted >= 1 && this.spawnTimer <= 0) {
      this.spawnTimer = 1.5;
      const wantCops = Math.min(2 + this.wanted, 7);
      const wantCars = this.wanted >= 2 ? Math.min(this.wanted - 1, 4) : 0;
      if (this.cops.filter((c) => !c.dead).length < wantCops) this.spawnCop(pos);
      if (this.copCars.length < wantCars) this.spawnCopCar(pos);
      if (this.wanted >= 4 && !this.heli) this.spawnHeli(pos);
      if (this.wanted < 4 && this.heli) this.removeHeli();
    }
    if (this.wanted === 0) {
      // stand down: cops wander off, cars drive away, heli leaves.
      // Mutate the arrays in place — combat.js holds references to them.
      this.removeHeli();
      for (const c of this.copCars) this.scene.remove(c.car.mesh);
      this.copCars.length = 0;
      for (const c of this.cops) this.scene.remove(c.mesh);
      this.cops.length = 0;
    }

    // foot cops chase
    let arresting = false;
    for (const c of this.cops) {
      if (c.dead) continue;
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let diff = want - c.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.heading += Math.max(-4 * dt, Math.min(4 * dt, diff));
      const speed = d > 12 ? 8.5 : 6.5;
      c.x += Math.sin(c.heading) * speed * dt;
      c.z += Math.cos(c.heading) * speed * dt;
      const fixed = this.city.collideCircle(c.x, c.z, 0.5);
      c.x = fixed.x; c.z = fixed.z;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      const swing = Math.sin(time * 11 + c.phase) * 0.6;
      c.mesh.userData.legs[0].rotation.x = swing;
      c.mesh.userData.legs[1].rotation.x = -swing;
      // arrest: on-foot player, cop close for 1.5s
      if (!player.inCar && d < 1.8) {
        arresting = true;
        c.arrest += dt;
      } else {
        c.arrest = 0;
      }
    }
    if (arresting) {
      this.bustedTimer += dt;
      if (this.bustedTimer > 1.5 && this.onBusted) {
        this.bustedTimer = 0;
        this.onBusted();
      }
    } else {
      this.bustedTimer = 0;
    }

    // cop cars pursue and ram
    for (const cc of this.copCars) {
      const car = cc.car;
      const dx = pos.x - car.x, dz = pos.z - car.z;
      const d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let diff = want - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 1.6));
      const throttle = d > 6 ? 1 : 0.4;
      car.drive(throttle, steer, false, dt);
      const fixed = this.city.collideCircle(car.x, car.z, 1.6);
      if (fixed.x !== car.x || fixed.z !== car.z) {
        car.x = fixed.x; car.z = fixed.z;
        car.hitBuilding(0.5);
        car.mesh.position.set(car.x, 0, car.z);
      }
      // deploy a foot cop when close and slow
      cc.deployTimer -= dt;
      if (d < 12 && Math.abs(car.speed) < 6 && cc.deployTimer <= 0) {
        cc.deployTimer = 12;
        if (this.cops.filter((c) => !c.dead).length < 7) this.spawnCop({ x: car.x, z: car.z });
      }
    }

    // helicopter circles the player with a spotlight
    if (this.heli) {
      const h = this.heli;
      h.angle += dt * 0.35;
      const hx = pos.x + Math.cos(h.angle) * 26;
      const hz = pos.z + Math.sin(h.angle) * 26;
      h.group.position.set(hx, 34 + Math.sin(time * 0.8) * 1.5, hz);
      h.group.rotation.y = -h.angle;
      h.spot.position.set(hx, 33, hz);
      h.spot.target.position.set(pos.x, 0, pos.z);
      h.spot.target.updateMatrixWorld();
      h.rotor.rotation.y += dt * 30;
    }

    // wanted decay: only while unseen
    if (this.wanted > 0) {
      if (this.anyLineOfSight(pos.x, pos.z)) {
        this.noSightTimer = 0;
        this.decayTimer = 0;
      } else {
        this.noSightTimer += dt;
        if (this.noSightTimer > WANTED.decayDelay) {
          this.decayTimer += dt;
          if (this.decayTimer > WANTED.decayStep) {
            this.decayTimer = 0;
            this.wanted -= 1;
          }
        }
      }
    }
  }

  spawnCop(near) {
    const rng = this.rng;
    // spawn on a road 25-40m from the player, not inside a building
    for (let tries = 0; tries < 8; tries++) {
      const a = rng() * Math.PI * 2;
      const r = 25 + rng() * 15;
      const x = near.x + Math.cos(a) * r;
      const z = near.z + Math.sin(a) * r;
      if (Math.abs(x) > WORLD_BOUND || Math.abs(z) > WORLD_BOUND) continue;
      if (this.city.insideCollider(x, z, 1)) continue;
      const mesh = createPersonMesh(0x22364d, 0x1a2530, pickSkin(rng));
      mesh.position.set(x, 0, z);
      // cop hat
      const hat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), mat(0x101418));
      hat.position.y = 1.95;
      mesh.add(hat);
      this.scene.add(mesh);
      this.cops.push({
        mesh, x, z, heading: rng() * Math.PI * 2,
        arrest: 0, health: 60, dead: false, phase: rng() * 6,
      });
      return;
    }
  }

  // Place a cop car at an exact spot (screenshot staging).
  placeCopCar(x, z, heading) {
    const car = new Car(this.scene, 'copcar', x, z, heading);
    car.occupied = true;
    this.copCars.push({ car, deployTimer: 4 });
    return car;
  }

  spawnCopCar(near) {
    const rng = this.rng;
    for (let tries = 0; tries < 8; tries++) {
      const a = rng() * Math.PI * 2;
      const r = 30 + rng() * 20;
      const x = near.x + Math.cos(a) * r;
      const z = near.z + Math.sin(a) * r;
      if (Math.abs(x) > WORLD_BOUND - 6 || Math.abs(z) > WORLD_BOUND - 6) continue;
      if (this.city.insideCollider(x, z, 2)) continue;
      this.placeCopCar(x, z, Math.atan2(near.x - x, near.z - z));
      return;
    }
  }

  spawnHeli(pos) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 5), mat(0x22364d));
    body.position.y = 0;
    g.add(body);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1.2), mat(0x9fd4e8));
    glass.position.set(0, 0.2, 2.2);
    g.add(glass);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4), mat(0x22364d));
    tail.position.set(0, 0.3, -4);
    g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.4), mat(0x111111));
    rotor.position.y = 1.1;
    g.add(rotor);
    const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 4), mat(0x111111));
    skidL.position.set(-1, -1, 0);
    const skidR = skidL.clone();
    skidR.position.x = 1;
    g.add(skidL, skidR);
    g.position.set(pos.x + 26, 34, pos.z);
    this.scene.add(g);
    const spot = new THREE.SpotLight(0xfff2b0, 2.2, 70, 0.35, 0.5);
    spot.position.set(pos.x + 26, 33, pos.z);
    spot.target.position.set(pos.x, 0, pos.z);
    this.scene.add(spot);
    this.scene.add(spot.target);
    this.heli = { group: g, angle: 0, rotor, spot };
  }

  removeHeli() {
    if (!this.heli) return;
    this.scene.remove(this.heli.group);
    this.scene.remove(this.heli.spot);
    this.scene.remove(this.heli.spot.target);
    this.heli = null;
  }

  // Nearest live cop (foot) to a point, within radius.
  nearestCop(x, z, radius) {
    let best = null, bestD = radius;
    for (const c of this.cops) {
      if (c.dead) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  killCop(c) {
    if (c.dead) return;
    c.dead = true;
    c.mesh.rotation.x = -Math.PI / 2;
    c.mesh.position.y = 0.3;
  }
}

function pickSkin(rng) {
  const skins = [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf2c9a0];
  return skins[Math.floor(rng() * skins.length)];
}
