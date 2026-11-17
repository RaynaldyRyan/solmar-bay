// The player: Milo Vane, on foot (third person, sprint, jump) and behind the
// wheel (enter/exit any car, carjack occupied ones). Owns health and money.
import { PLAYER, WEAPONS, WANTED, WORLD_BOUND } from './config.js';

function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

// A simple blocky character: torso, head, arms, legs. Built facing +z.
export function createPersonMesh(shirt, pants, skin) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.4), mat(shirt));
  torso.position.y = 1.05;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), mat(skin));
  head.position.y = 1.68;
  head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.46), mat(0x2a4a7a));
  cap.position.y = 1.92;
  g.add(cap);
  g.userData.arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.22), mat(shirt));
    arm.position.set(s * 0.48, 1.05, 0);
    g.add(arm);
    g.userData.arms.push(arm);
  }
  g.userData.legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.26), mat(pants));
    leg.position.set(s * 0.2, 0.35, 0);
    g.add(leg);
    g.userData.legs.push(leg);
  }
  return g;
}

export class Player {
  constructor(scene, city, startPos, heading) {
    this.scene = scene;
    this.city = city;
    this.mesh = createPersonMesh(0x2fb5a8, 0x3a3f45, 0xe8b88a);
    this.mesh.position.set(startPos.x, 0, startPos.z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.x = startPos.x; this.z = startPos.z;
    this.heading = heading;
    this.camYaw = heading;
    this.camPitch = 0.32;
    this.vy = 0;
    this.grounded = true;
    this.health = PLAYER.health;
    this.money = 200;
    this.weapon = 'fists';
    this.ammo = { mag: 12, reserve: 48 };
    this.car = null;          // Car the player is driving, or null
    this.walkPhase = 0;
    this.lastHurt = -99;
    this.dead = false;
  }

  get inCar() { return this.car !== null; }
  get pos() { return this.inCar ? { x: this.car.x, z: this.car.z } : { x: this.x, z: this.z }; }

  // On-foot movement from input axes (forward/strafe in camera space).
  moveOnFoot(fwd, strafe, sprint, jump, dt, time) {
    const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
    let mx = (sin * fwd + cos * strafe) * speed;
    let mz = (cos * fwd - sin * strafe) * speed;
    const moving = Math.hypot(mx, mz) > 0.1;
    if (moving) {
      this.heading = Math.atan2(mx, mz);
      this.x += mx * dt;
      this.z += mz * dt;
      this.walkPhase += dt * (sprint ? 13 : 9);
    }
    // gravity + jump
    if (jump && this.grounded) {
      this.vy = PLAYER.jumpSpeed;
      this.grounded = false;
    }
    let y = this.mesh.position.y;
    if (!this.grounded || y > 0) {
      this.vy -= 22 * dt;
      y += this.vy * dt;
      if (y <= 0) { y = 0; this.vy = 0; this.grounded = true; }
    }
    // keep inside the world and out of buildings
    this.x = Math.max(-WORLD_BOUND, Math.min(WORLD_BOUND, this.x));
    this.z = Math.max(-WORLD_BOUND, Math.min(206, this.z));
    const fixed = this.city.collideCircle(this.x, this.z, 0.55);
    this.x = fixed.x; this.z = fixed.z;
    this.mesh.position.set(this.x, y, this.z);
    this.mesh.rotation.y = this.heading;
    // walk swing
    const swing = moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.mesh.userData.legs[0].rotation.x = swing;
    this.mesh.userData.legs[1].rotation.x = -swing;
    this.mesh.userData.arms[0].rotation.x = -swing * 0.7;
    this.mesh.userData.arms[1].rotation.x = swing * 0.7;
    // aim the arms forward while holding the pistol
    if (this.weapon === 'pistol') {
      this.mesh.userData.arms[0].rotation.x = -1.2;
      this.mesh.userData.arms[1].rotation.x = -1.2;
    }
  }

  // Step into a car (or carjack it). Returns 'stole' when it was occupied.
  enterCar(car) {
    const wasOccupied = car.occupied;
    car.occupied = true;
    this.car = car;
    this.mesh.visible = false;
    this.camYaw = car.heading;
    return wasOccupied ? 'stole' : 'entered';
  }

  exitCar() {
    if (!this.car) return;
    const car = this.car;
    this.car = null;
    car.occupied = false;
    // step out on the driver's side
    const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    this.x = car.x + side.x * 2.2;
    this.z = car.z + side.z * 2.2;
    const fixed = this.city.collideCircle(this.x, this.z, 0.55);
    this.x = fixed.x; this.z = fixed.z;
    this.heading = car.heading;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  // Drive the current car with the input axes.
  driveCar(throttle, steer, handbrake, dt) {
    if (!this.car) return;
    this.car.drive(throttle, steer, handbrake, dt);
    // building collision: push out, damage on hard hits
    const before = { x: this.car.x, z: this.car.z };
    const fixed = this.city.collideCircle(this.car.x, this.car.z, 1.6);
    if (fixed.x !== before.x || fixed.z !== before.z) {
      const hit = Math.abs(this.car.speed) > 4;
      this.car.x = fixed.x; this.car.z = fixed.z;
      if (hit) this.car.hitBuilding(1);
      this.car.mesh.position.set(this.car.x, 0, this.car.z);
    }
    this.car.x = Math.max(-WORLD_BOUND, Math.min(WORLD_BOUND, this.car.x));
    this.car.z = Math.max(-WORLD_BOUND, Math.min(206, this.car.z));
  }

  hurt(amount, time) {
    if (this.dead) return;
    this.health -= amount;
    this.lastHurt = time;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }

  heal(amount) {
    this.health = Math.min(PLAYER.health, this.health + amount);
  }

  earn(amount) { this.money += amount; }
  spend(amount) {
    if (this.money < amount) return false;
    this.money -= amount;
    return true;
  }

  // Respawn after WASTED: outside Solmar General hospital, cash lost, wanted cleared by caller.
  respawn() {
    this.dead = false;
    this.health = PLAYER.health;
    this.money = Math.max(0, this.money - 100);
    this.x = -60; this.z = 34;
    this.heading = Math.PI;
    if (this.car) { this.car.occupied = false; this.car = null; }
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  // Muzzle position for the current weapon (world space).
  muzzlePos() {
    if (this.inCar) {
      const f = this.car.forward();
      return new THREE.Vector3(this.car.x + f.x * 2.4, 1.2, this.car.z + f.z * 2.4);
    }
    const f = { x: Math.sin(this.heading), z: Math.cos(this.heading) };
    return new THREE.Vector3(this.x + f.x * 0.7, 1.45, this.z + f.z * 0.7);
  }
}
