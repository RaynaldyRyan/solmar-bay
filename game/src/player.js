// The player: Milo Vane, a driver new in town. On foot he runs, jumps and
// fights; near a car he can steal and drive it. The mesh is a stylized
// low-poly character with swinging limbs.
import { CFG, clamp } from './config.js';
import { resolveCircleColliders, resolveCircleObstacles } from './city.js';

function makeCharacterMesh(shirt, pants, skin) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 1 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), shirtMat);
  torso.position.y = 1.18; torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skinMat);
  head.position.y = 1.82; head.castShadow = true;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.44), hairMat);
  hair.position.y = 2.05;
  g.add(hair);
  const armGeo = new THREE.BoxGeometry(0.2, 0.72, 0.22);
  const legGeo = new THREE.BoxGeometry(0.24, 0.78, 0.26);
  const mk = (geo, mat, x, y) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, 0);
    m.geometry = geo.clone();
    m.geometry.translate(0, -0.32, 0); // pivot at the top
    m.castShadow = true;
    g.add(m);
    return m;
  };
  const armL = mk(armGeo, shirtMat, -0.42, 1.5);
  const armR = mk(armGeo, shirtMat, 0.42, 1.5);
  const legL = mk(legGeo, pantsMat, -0.17, 0.78);
  const legR = mk(legGeo, pantsMat, 0.17, 0.78);
  return { group: g, armL, armR, legL, legR };
}

export function createPlayer(scene, x, z) {
  const mesh = makeCharacterMesh(0xff5a7a, 0x2a3a5f, 0xe8b98a);
  mesh.group.position.set(x, 0, z);
  scene.add(mesh.group);
  const p = {
    mesh,
    pos: mesh.group.position,
    angle: 0,
    velY: 0,
    grounded: true,
    health: 100,
    money: 200,
    weapon: 'fists', // 'fists' | 'pistol'
    ammo: 12,
    reserveAmmo: 48,
    car: null, // the car being driven, or null
    walkPhase: 0,
    punchTimer: 0,
    isDriving() { return this.car !== null; },
    heading() { return this.car ? this.car.angle : this.angle; },
    speed() { return this.car ? Math.abs(this.car.speed) : 0; },
    enterCar(car) {
      this.car = car;
      mesh.group.visible = false;
    },
    exitCar() {
      if (!this.car) return;
      const f = this.car.forward();
      // step out to the left of the car
      this.pos.set(this.car.pos.x - f.z * 2.2, 0, this.car.pos.z + f.x * 2.2);
      this.angle = this.car.angle;
      this.car = null;
      mesh.group.visible = true;
    },
    damage(amount) {
      this.health = Math.max(0, this.health - amount);
      return this.health <= 0;
    },
    heal(amount) { this.health = Math.min(100, this.health + amount); },
    update(dt, input, camYaw, city, onStep) {
      if (this.car) {
        const ax = input.axis();
        this.car.update(dt, ax.y, ax.x, input.isDown('Space'), city, (impact) => {
          if (onStep) onStep('crash', impact);
        });
        // keep the player's position glued to the car: the camera, minimap,
        // missions, police and combat all read player.pos
        this.pos.set(this.car.pos.x, 0, this.car.pos.z);
        this.angle = this.car.angle;
        return;
      }
      const ax = input.axis();
      const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
      const speed = sprint ? CFG.SPRINT_SPEED : CFG.WALK_SPEED;
      // move relative to the camera yaw
      let mx = 0, mz = 0;
      if (ax.y !== 0 || ax.x !== 0) {
        const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
        mx = (sin * ax.y + cos * ax.x) * speed;
        mz = (cos * ax.y - sin * ax.x) * speed;
        const target = Math.atan2(mx, mz);
        let d = target - this.angle;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.angle += d * Math.min(1, dt * 12);
        this.walkPhase += dt * (sprint ? 13 : 9);
      }
      this.pos.x += mx * dt;
      this.pos.z += mz * dt;
      // jump + gravity
      if (input.isDown('Space') && this.grounded) {
        this.velY = 7.5;
        this.grounded = false;
      }
      this.velY -= 22 * dt;
      this.pos.y += this.velY * dt;
      if (this.pos.y <= 0) { this.pos.y = 0; this.velY = 0; this.grounded = true; }
      resolveCircleColliders(this.pos, 0.55, city.colliders);
      resolveCircleObstacles(this.pos, 0.55, city.obstacles);
      this.pos.x = clamp(this.pos.x, -340, 330);
      this.pos.z = clamp(this.pos.z, -340, 340);
      // limb swing
      const moving = ax.y !== 0 || ax.x !== 0;
      const swing = moving ? Math.sin(this.walkPhase) * 0.75 : 0;
      mesh.legL.rotation.x = swing;
      mesh.legR.rotation.x = -swing;
      mesh.armL.rotation.x = -swing * 0.8;
      mesh.armR.rotation.x = swing * 0.8;
      if (this.punchTimer > 0) {
        this.punchTimer -= dt;
        mesh.armR.rotation.x = -1.6;
      }
      mesh.group.rotation.y = this.angle;
    },
  };
  return p;
}

export { makeCharacterMesh };
