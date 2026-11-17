// Solmar Bay — cars: mesh factory and arcade driving physics.
// One clear job: build every vehicle from boxes, drive it with simple arcade
// physics (throttle, steering, handbrake drift, damage), and resolve collisions.

import { CAR_TYPES } from './config.js';
import { clamp, damp, angleDelta } from './random.js';

function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

export function buildCarMesh(type, colour) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colour });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2836 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const tall = type === 'suv' || type === 'pickup';
  const low = type === 'sport' || type === 'coupe';
  const bodyH = tall ? 1.0 : low ? 0.62 : 0.78;
  const bodyY = tall ? 0.95 : 0.72;
  box(1.9, bodyH, 4.3, bodyMat, 0, bodyY, 0, g);
  box(1.7, 0.55, 2.1, glassMat, 0, bodyY + bodyH / 2 + 0.22, -0.15, g);
  box(1.72, 0.14, 2.0, bodyMat, 0, bodyY + bodyH / 2 + 0.52, -0.15, g);
  if (type === 'pickup') {
    box(1.8, 0.5, 1.5, darkMat, 0, bodyY + 0.35, 1.25, g);
  }
  if (type === 'taxi') {
    box(0.8, 0.3, 0.5, new THREE.MeshBasicMaterial({ color: 0xffe020 }), 0, bodyY + bodyH / 2 + 0.72, -0.15, g);
  }
  if (type === 'cop') {
    const barR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    barR.position.set(-0.4, bodyY + bodyH / 2 + 0.68, -0.15);
    g.add(barR);
    const barB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.3), new THREE.MeshBasicMaterial({ color: 0x2060ff }));
    barB.position.set(0.4, bodyY + bodyH / 2 + 0.68, -0.15);
    g.add(barB);
    g.userData.lightBar = [barR, barB];
  }
  box(1.86, 0.24, 0.3, lightMat, 0, bodyY - 0.05, -2.16, g);
  box(1.86, 0.24, 0.3, tailMat, 0, bodyY - 0.05, 2.16, g);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-0.85, -1.35], [0.85, -1.35], [-0.85, 1.35], [0.85, 1.35]]) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  g.userData.type = type;
  return g;
}

export class Car {
  constructor(scene, type, x, z, heading, colour = null) {
    this.spec = CAR_TYPES[type];
    this.type = type;
    this.colour = colour ?? this.spec.colours[Math.floor(Math.random() * this.spec.colours.length)];
    this.mesh = buildCarMesh(type, this.colour);
    this.mesh.position.set(x, 0, z);
    // The mesh's front (headlights) is local -Z; rotation.y = heading + PI
    // points it along the direction of travel.
    this.mesh.rotation.y = heading + Math.PI;
    scene.add(this.mesh);
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.health = 100;
    this.dead = false;
    this.damageCooldown = 0;
    this.occupied = false;
    this.driver = null; // 'player' | 'traffic' | 'cop' | null
    this.smokeTimer = 0;
    this.honkTimer = 0;
    this.alive = true;
  }

  get pos() {
    return this.mesh.position;
  }

  // Arcade drive step. throttle -1..1, steer -1..1, handbrake bool.
  drive(dt, throttle, steerInput, handbrake, city, others) {
    if (this.dead) {
      this.speed = damp(this.speed, 0, 2, dt);
      return;
    }
    this.damageCooldown -= dt;
    const spec = this.spec;
    const damageFactor = this.health > 40 ? 1 : 0.55 + (this.health / 40) * 0.45;
    const maxSpeed = spec.topSpeed * damageFactor;
    const targetSteer = clamp(steerInput, -1, 1) * (this.speed < 0 ? -1 : 1);
    this.steer = damp(this.steer, targetSteer, 8, dt);
    // Steering bites less at high speed, more with the handbrake.
    const grip = spec.grip * (handbrake ? 1.9 : 1);
    const speedFactor = clamp(Math.abs(this.speed) / 12, 0.25, 1);
    this.heading += this.steer * grip * speedFactor * dt * clamp(Math.abs(this.speed) / 6, 0, 1.4) * (this.speed >= 0 ? 1 : -1);
    const accel = throttle * spec.accel * (throttle < 0 && this.speed > 1 ? 2.2 : 1);
    this.speed += accel * dt;
    // Drag and rolling resistance; handbrake kills speed fast and lets the tail slide.
    this.speed -= this.speed * (handbrake ? 1.6 : 0.35) * dt;
    this.speed = clamp(this.speed, -maxSpeed * 0.35, maxSpeed);
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    const [cx, cz] = city.collideCircle(nx, nz, 1.35);
    if (cx !== nx || cz !== nz) {
      // Hit a building: lose speed, take damage (at most once per half second).
      const impact = Math.abs(this.speed);
      if (impact > 6 && this.damageCooldown <= 0) {
        this.damage(impact * 0.9);
        this.damageCooldown = 0.5;
      }
      this.speed *= -0.25;
    }
    this.x = cx;
    this.z = cz;
    // Soft car-vs-car push.
    for (const o of others) {
      if (o === this || !o.alive) continue;
      const dx = this.x - o.x;
      const dz = this.z - o.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 9 && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (3 - d) * 0.5;
        this.x += (dx / d) * push;
        this.z += (dz / d) * push;
        const rel = Math.abs(this.speed - o.speed);
        if (rel > 8 && this.damageCooldown <= 0) {
          this.damage(rel * 0.5);
          o.damage(rel * 0.5);
          this.damageCooldown = 0.5;
          o.damageCooldown = 0.5;
        }
        this.speed *= 0.92;
      }
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading + Math.PI;
    // Wheel spin + front-wheel steer visual.
    const spin = (this.speed / 0.36) * dt;
    this.mesh.userData.wheels.forEach((w, i) => {
      w.rotation.x += spin;
      if (i < 2) w.rotation.y = this.steer * 0.4;
    });
    // Cop light bar flash.
    if (this.mesh.userData.lightBar) {
      const phase = Math.floor(performance.now() / 180) % 2 === 0;
      this.mesh.userData.lightBar[0].material.color.setHex(phase ? 0xff2020 : 0x501010);
      this.mesh.userData.lightBar[1].material.color.setHex(phase ? 0x102060 : 0x2060ff);
    }
  }

  damage(amount) {
    if (this.dead) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.speed = 0;
      // Charred look.
      this.mesh.traverse((o) => {
        if (o.isMesh && o.material && o.material.color) o.material.color.multiplyScalar(0.45);
      });
    }
  }

  repair() {
    this.health = 100;
    this.dead = false;
  }

  // Heading the car should take to reach (tx, tz).
  headingTo(tx, tz) {
    return Math.atan2(tx - this.x, tz - this.z);
  }

  // Steer input (-1..1) that turns toward (tx, tz).
  steerTo(tx, tz) {
    return clamp(angleDelta(this.heading, this.headingTo(tx, tz)) * 2.2, -1, 1);
  }

  speedKmh() {
    return Math.round(Math.abs(this.speed) * 3.6);
  }

  remove(scene) {
    scene.remove(this.mesh);
    this.alive = false;
  }
}
