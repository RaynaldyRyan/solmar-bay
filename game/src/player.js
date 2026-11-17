// Solmar Bay — the player character and the third-person camera.
// One clear job: the on-foot hero (move, sprint, jump, punch), getting in and out
// of cars, and the chase camera that follows them either way.

import { PLAYER, WEAPONS } from './config.js';
import { clamp, damp, angleDelta } from './random.js';

function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

export function buildPersonMesh(shirt, pants, skin) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const legL = box(0.22, 0.8, 0.26, pantsMat, -0.14, 0.4, 0, g);
  const legR = box(0.22, 0.8, 0.26, pantsMat, 0.14, 0.4, 0, g);
  legL.geometry.translate(0, -0.4, 0);
  legR.geometry.translate(0, -0.4, 0);
  legL.position.y = 0.8;
  legR.position.y = 0.8;
  box(0.52, 0.62, 0.3, shirtMat, 0, 1.12, 0, g);
  const armL = box(0.16, 0.6, 0.2, shirtMat, -0.36, 1.42, 0, g);
  const armR = box(0.16, 0.6, 0.2, shirtMat, 0.36, 1.42, 0, g);
  armL.geometry.translate(0, 0.3, 0);
  armR.geometry.translate(0, 0.3, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skinMat);
  head.position.y = 1.62;
  head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 10, 6, 0, Math.PI * 2, 0, 1.1),
    new THREE.MeshLambertMaterial({ color: 0x2e5a8a }),
  );
  cap.position.y = 1.66;
  g.add(cap);
  g.userData.limbs = { legL, legR, armL, armR };
  return g;
}

export class Player {
  constructor(scene, x, z) {
    this.scene = scene;
    this.mesh = buildPersonMesh(0x2e8f8a, 0x2a2a33, 0xc89a72);
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.x = x;
    this.z = z;
    this.y = 0;
    this.vy = 0;
    this.heading = 0;
    this.health = PLAYER.MAX_HEALTH;
    this.weapon = 'fists';
    this.ammo = 0;
    this.pistolOwned = false;
    this.onFoot = true;
    this.car = null;
    this.walkPhase = 0;
    this.punchTimer = 0;
    this.shootTimer = 0;
    this.dead = false;
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.camDist = 7;
    this.camPos = new THREE.Vector3(x, 4, z + 7);
  }

  get speed2d() {
    return Math.hypot(this.vx || 0, this.vz || 0);
  }

  // On-foot step: camera-relative WASD, sprint, jump, punch.
  updateOnFoot(dt, input, city, game) {
    const axes = input.moveAxes();
    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = sprint ? PLAYER.SPRINT_SPEED : PLAYER.WALK_SPEED;
    // Camera-relative move direction.
    const sin = Math.sin(this.camYaw);
    const cos = Math.cos(this.camYaw);
    let mx = 0;
    let mz = 0;
    if (axes.y !== 0 || axes.x !== 0) {
      mx = sin * axes.y + cos * axes.x;
      mz = cos * axes.y - sin * axes.x;
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      this.heading = damp(this.heading, Math.atan2(mx, mz), 12, dt);
    }
    const moving = axes.y !== 0 || axes.x !== 0;
    const step = moving ? speed * dt : 0;
    const nx = this.x + mx * step;
    const nz = this.z + mz * step;
    const [cx, cz] = city.collideCircle(nx, nz, PLAYER.RADIUS);
    this.x = cx;
    this.z = cz;
    // Jump + gravity.
    if (input.wasPressed('Space') && this.y <= 0.01) {
      this.vy = PLAYER.JUMP_SPEED;
    }
    this.vy -= 22 * dt;
    this.y += this.vy * dt;
    if (this.y <= 0) {
      this.y = 0;
      this.vy = 0;
    }
    // Walk cycle.
    if (moving && this.y <= 0.01) {
      this.walkPhase += dt * (sprint ? 13 : 9);
    }
    const swing = moving && this.y <= 0.01 ? Math.sin(this.walkPhase) * 0.7 : 0;
    const L = this.mesh.userData.limbs;
    L.legL.rotation.x = swing;
    L.legR.rotation.x = -swing;
    L.armL.rotation.x = -swing * 0.8;
    L.armR.rotation.x = swing * 0.8;
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.heading;
    this.punchTimer -= dt;
    this.shootTimer -= dt;
    // Punch on F or left click with fists.
    if ((input.wasPressed('KeyF') || (input.mousePressed && this.weapon === 'fists')) && this.punchTimer <= 0) {
      this.punchTimer = WEAPONS.fists.cooldown;
      game.combat.playerPunch(this);
      L.armR.rotation.x = -1.6;
    }
    // Shoot on left click with the pistol.
    if (input.mouseDown && this.weapon === 'pistol' && this.shootTimer <= 0 && this.ammo > 0) {
      this.shootTimer = WEAPONS.pistol.cooldown;
      this.ammo -= 1;
      game.combat.playerShoot(this);
    }
    if (input.wasPressed('KeyQ')) {
      this.weapon = this.weapon === 'fists' && this.pistolOwned ? 'pistol' : 'fists';
    }
  }

  // Drive the current car from input; returns true while driving.
  updateDriving(dt, input, city, others) {
    if (!this.car) return false;
    const axes = input.moveAxes();
    const handbrake = input.isDown('Space');
    this.car.drive(dt, axes.y, -axes.x, handbrake, city, others);
    this.x = this.car.x;
    this.z = this.car.z;
    this.heading = this.car.heading;
    this.mesh.visible = false;
    return true;
  }

  enterCar(car, game) {
    if (car.driver === 'traffic' && car.occupied) {
      // Carjacking: the driver flees, the law notices.
      game.traffic.ejectDriver(car);
      game.police.addWanted(1, 'carjacking');
      game.hud.flash(`Stole a ${car.spec.name} — +1 star`);
    }
    this.car = car;
    car.driver = 'player';
    car.occupied = true;
    this.onFoot = false;
    this.mesh.visible = false;
    game.audio.engineStart();
  }

  exitCar(game) {
    if (!this.car) return;
    const car = this.car;
    car.driver = null;
    car.speed = 0;
    // Step out on the left side of the car.
    const side = car.heading + Math.PI / 2;
    this.x = car.x + Math.sin(side) * 2.2;
    this.z = car.z + Math.cos(side) * 2.2;
    const [cx, cz] = game.city.collideCircle(this.x, this.z, PLAYER.RADIUS);
    this.x = cx;
    this.z = cz;
    this.y = 0;
    this.car = null;
    this.onFoot = true;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
    game.audio.engineStop();
  }

  hurt(amount, game) {
    if (this.dead) return;
    this.health -= amount;
    game.hud.damageFlash();
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      game.onPlayerWasted();
    }
  }

  heal(amount) {
    this.health = clamp(this.health + amount, 0, PLAYER.MAX_HEALTH);
  }

  // Third-person camera: mouse orbit, collision pull-in, car chase mode.
  updateCamera(dt, input, camera, city, override = null) {
    if (override) {
      camera.position.copy(override.pos);
      camera.lookAt(override.look);
      return;
    }
    if (input.locked) {
      this.camYaw -= input.mouseDX * 0.0026;
      this.camPitch = clamp(this.camPitch + input.mouseDY * 0.0022, -0.15, 0.9);
    }
    // Arrow keys also steer the camera for players without pointer lock.
    if (input.isDown('ArrowLeft')) this.camYaw += 1.8 * dt;
    if (input.isDown('ArrowRight')) this.camYaw -= 1.8 * dt;
    if (input.isDown('ArrowUp')) this.camPitch = clamp(this.camPitch - 1.2 * dt, -0.15, 0.9);
    if (input.isDown('ArrowDown')) this.camPitch = clamp(this.camPitch + 1.2 * dt, -0.15, 0.9);
    const inCar = !this.onFoot && this.car;
    const targetDist = inCar ? 10.5 : 7;
    const targetHeight = inCar ? 3.6 : 2.6;
    this.camDist = damp(this.camDist, targetDist, 4, dt);
    // In a car the camera swings behind the car: it sits opposite the car's
    // forward direction, so camYaw equals the car's heading.
    if (inCar) {
      const want = this.car.heading;
      const d = angleDelta(this.camYaw, want);
      this.camYaw += d * Math.min(1, 2.2 * dt);
    }
    const tx = this.x;
    const ty = this.y + (inCar ? 1.4 : 1.7);
    const tz = this.z;
    const cy = Math.sin(this.camPitch) * this.camDist;
    const ch = Math.cos(this.camPitch) * this.camDist;
    let camX = tx - Math.sin(this.camYaw) * ch;
    let camZ = tz - Math.cos(this.camYaw) * ch;
    let camY = ty + cy + targetHeight * 0.4;
    // Pull the camera in when a building blocks the view.
    let dist = this.camDist;
    for (let f = 1; f > 0.25; f -= 0.15) {
      const px = tx - Math.sin(this.camYaw) * ch * f;
      const pz = tz - Math.cos(this.camYaw) * ch * f;
      if (!city.rayBlocked(tx, tz, px, pz)) {
        dist = this.camDist * f;
        camX = px;
        camZ = pz;
        camY = ty + cy * f + targetHeight * 0.4;
        break;
      }
    }
    camY = Math.max(camY, 0.8);
    const want = new THREE.Vector3(camX, camY, camZ);
    this.camPos.lerp(want, 1 - Math.exp(-10 * dt));
    camera.position.copy(this.camPos);
    camera.lookAt(tx, ty + 0.4, tz);
    return dist;
  }

  // Where the player's eyes are, for aiming.
  eyePos() {
    return new THREE.Vector3(this.x, this.y + 1.6, this.z);
  }

  aimDir() {
    // Aim where the camera looks, horizontally.
    return new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
  }
}
