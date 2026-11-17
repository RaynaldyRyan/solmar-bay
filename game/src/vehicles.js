// Cars: procedural meshes for each archetype plus arcade driving physics.
// A car's forward is +z of its mesh; heading h gives forward (sin h, 0, cos h).
// The mesh is built nose-first toward +z, so mesh.rotation.y = heading.
import { CAR_ARCHETYPES } from './config.js';

function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

// Build the visible car mesh for an archetype. Returns a THREE.Group whose
// origin is the car's centre at ground level, nose toward +z.
export function createCarMesh(key) {
  const spec = CAR_ARCHETYPES[key] || CAR_ARCHETYPES.sedan;
  const g = new THREE.Group();
  const { length: L, width: W, height: H } = spec;
  const bodyMat = mat(spec.body);
  const glassMat = mat(0x1c2f42, { transparent: true, opacity: 0.9 });
  const darkMat = mat(0x22262b);

  // lower body
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H * 0.55, L), bodyMat);
  body.position.y = H * 0.45;
  body.castShadow = true;
  g.add(body);
  // cabin (vans get a tall box cabin instead)
  if (key === 'van') {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(W * 0.96, H * 0.62, L * 0.62), bodyMat);
    cabin.position.set(0, H * 0.95, -L * 0.12);
    cabin.castShadow = true;
    g.add(cabin);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, H * 0.4, 0.15), glassMat);
    shield.position.set(0, H * 0.95, L * 0.2);
    g.add(shield);
  } else if (key === 'pickup') {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, H * 0.6, L * 0.32), bodyMat);
    cabin.position.set(0, H * 0.95, -L * 0.12);
    cabin.castShadow = true;
    g.add(cabin);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, H * 0.42, 0.12), glassMat);
    shield.position.set(0, H * 0.95, L * 0.05);
    g.add(shield);
    // open bed rails
    const bed = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 0.25, L * 0.42), darkMat);
    bed.position.set(0, H * 0.78, L * 0.26);
    g.add(bed);
  } else {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(W * 0.88, H * 0.55, L * 0.48), bodyMat);
    cabin.position.set(0, H * 0.95, -L * 0.06);
    cabin.castShadow = true;
    g.add(cabin);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(W * 0.82, H * 0.4, 0.12), glassMat);
    shield.position.set(0, H * 0.92, L * 0.19);
    shield.rotation.x = -0.25;
    g.add(shield);
    const rear = new THREE.Mesh(new THREE.BoxGeometry(W * 0.82, H * 0.4, 0.12), glassMat);
    rear.position.set(0, H * 0.92, -L * 0.31);
    rear.rotation.x = 0.25;
    g.add(rear);
  }
  // headlights / taillights
  const hl = mat(0xfff6c8, { emissive: 0x887733 });
  const tl = mat(0xcc2222, { emissive: 0x550000 });
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.1), hl);
    h.position.set(s * W * 0.32, H * 0.5, L / 2 + 0.02);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), tl);
    t.position.set(s * W * 0.32, H * 0.5, -L / 2 - 0.02);
    g.add(t);
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(spec.wheels, spec.wheels, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = mat(0x181a1c);
  g.userData.wheels = [];
  for (const [wx, wz] of [[-W / 2, L * 0.32], [W / 2, L * 0.32], [-W / 2, -L * 0.32], [W / 2, -L * 0.32]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(wx, spec.wheels, wz);
    g.add(wheel);
    g.userData.wheels.push(wheel);
  }
  // taxi sign / cop light bar
  if (key === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.4), mat(0xf5c518, { emissive: 0x664400 }));
    sign.position.set(0, H * 1.28, -L * 0.05);
    g.add(sign);
  }
  if (key === 'copcar') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 0.5), mat(0x111111));
    bar.position.set(0, H * 1.28, -L * 0.05);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.28, 0.52), mat(0xff2222, { emissive: 0x881111 }));
    red.position.set(-0.35, H * 1.28, -L * 0.05);
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.28, 0.52), mat(0x2266ff, { emissive: 0x112288 }));
    blue.position.set(0.35, H * 1.28, -L * 0.05);
    g.add(blue);
    g.userData.lightRed = red;
    g.userData.lightBlue = blue;
  }
  g.userData.spec = spec;
  return g;
}

// One drivable car: arcade physics, damage, smoke when hurt.
export class Car {
  constructor(scene, key, x, z, heading) {
    this.key = key;
    this.spec = CAR_ARCHETYPES[key];
    this.mesh = createCarMesh(key);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.x = x; this.z = z;
    this.heading = heading;
    this.speed = 0;              // signed, m/s along the forward axis
    this.health = 100;
    this.occupied = false;       // a driver sits in it (traffic / parked with driver)
    this.isCop = key === 'copcar';
    this.damageCooldown = 0;     // seconds until the next collision can hurt it
    this.smokeTimer = 0;
    this.flashTimer = 0;         // cop light-bar strobe phase
    this.dead = false;
  }

  forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  // Drive with throttle (-1..1) and steer (-1..1, + = right). dt in seconds.
  // Returns nothing; the caller resolves collisions afterwards.
  drive(throttle, steer, handbrake, dt) {
    const s = this.spec;
    if (this.health <= 0) throttle = 0;
    const drag = 0.6 + Math.abs(this.speed) * 0.02 + (handbrake ? 2.2 : 0);
    this.speed += throttle * s.accel * dt;
    this.speed -= this.speed * drag * dt;
    const max = s.topSpeed * (this.speed < 0 ? 0.35 : 1);
    if (this.speed > max) this.speed = max;
    if (this.speed < -max * 0.35) this.speed = -max * 0.35;
    // steering: sharper at low speed, looser at speed
    const spd = Math.abs(this.speed);
    const steerRate = s.grip * 0.32 * Math.min(1, spd / 8 + 0.25) * (handbrake ? 1.6 : 1);
    this.heading += steer * steerRate * dt * (this.speed >= 0 ? 1 : -1);
    const f = this.forward();
    this.x += f.x * this.speed * dt;
    this.z += f.z * this.speed * dt;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // wheel spin + front-wheel steer
    const spin = this.speed * dt / s.wheels;
    for (let i = 0; i < 4; i++) {
      const w = this.mesh.userData.wheels[i];
      w.rotation.x += spin;
      if (i < 2) w.rotation.y = steer * 0.4;
    }
    if (this.damageCooldown > 0) this.damageCooldown -= dt;
    // cop light bar strobe
    if (this.isCop && this.mesh.userData.lightRed) {
      this.flashTimer += dt;
      const phase = Math.floor(this.flashTimer * 6) % 2 === 0;
      this.mesh.userData.lightRed.material.emissive.setHex(phase ? 0xff2222 : 0x220000);
      this.mesh.userData.lightBlue.material.emissive.setHex(phase ? 0x000022 : 0x2244ff);
    }
  }

  // Collision with a building: stop dead, take damage (with cooldown).
  hitBuilding(strength) {
    if (this.damageCooldown > 0) return 0;
    this.damageCooldown = 0.5;
    const dmg = Math.min(30, 6 + Math.abs(this.speed) * 1.2) * strength;
    this.health -= dmg;
    this.speed *= -0.25;
    return dmg;
  }

  // Bump into another car: both slow down.
  bump(other, strength) {
    const dx = other.x - this.x, dz = other.z - this.z;
    const d = Math.hypot(dx, dz) || 1;
    const push = 0.6 * strength;
    this.x -= (dx / d) * push;
    this.z -= (dz / d) * push;
    this.speed *= 0.6;
    if (this.damageCooldown <= 0 && Math.abs(this.speed) > 6) {
      this.damageCooldown = 0.5;
      this.health -= 4;
    }
  }

  smoking() { return this.health < 45 && this.health > 0; }
  wrecked() { return this.health <= 0; }

  remove(scene) {
    scene.remove(this.mesh);
    this.dead = true;
  }
}
