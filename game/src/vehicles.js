// Cars: glossy-painted 3D models built from boxes and cylinders (body,
// cabin, wheels, lights), plus arcade driving physics with collision.
import { CAR_ARCHETYPES, clamp } from './config.js';
import { resolveCircleColliders, resolveCircleObstacles } from './city.js';

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.9 });
const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.32, 8);
const hubMat = new THREE.MeshStandardMaterial({ color: 0xd8d8e0, roughness: 0.3, metalness: 0.8 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x0e1a2a, roughness: 0.08, metalness: 0.9 });
const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });

// Builds a car mesh for an archetype. Returns { group, wheels, brakeLights }.
export function createCarMesh(archetype, color, isPolice) {
  const a = CAR_ARCHETYPES[archetype];
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color: isPolice ? 0x1a2530 : color,
    roughness: 0.32, metalness: 0.65,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(a.wid, a.body, a.len), paint);
  body.position.y = 0.55 + a.body / 2 - 0.28;
  body.castShadow = true;
  g.add(body);
  // hood slope + trunk lip
  const nose = new THREE.Mesh(new THREE.BoxGeometry(a.wid * 0.96, a.body * 0.55, 0.7), paint);
  nose.position.set(0, 0.62, a.len / 2 - 0.2);
  nose.castShadow = true;
  g.add(nose);
  // cabin
  const cabLen = archetype === 'van' ? a.len * 0.82 : a.len * 0.5;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(a.wid * 0.86, 0.55, cabLen), glassMat);
  cabin.position.set(0, 0.55 + a.body - 0.28 + 0.28, archetype === 'van' ? 0.2 : -a.len * 0.06);
  cabin.castShadow = true;
  g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(a.wid * 0.88, 0.08, cabLen * 0.96), paint);
  roof.position.set(0, 0.55 + a.body - 0.28 + 0.58, archetype === 'van' ? 0.2 : -a.len * 0.06);
  g.add(roof);
  // wheels
  const wheels = [];
  const wx = a.wid / 2 - 0.05, wz = a.len / 2 - 0.75;
  for (const [x, z] of [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]]) {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, wheelMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    w.add(tire); w.add(hub);
    w.position.set(x, 0.36, z);
    g.add(w);
    wheels.push(w);
  }
  // headlights + taillights
  const hlGeo = new THREE.BoxGeometry(0.42, 0.22, 0.08);
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(hlGeo, lightMat);
    hl.position.set(s * (a.wid / 2 - 0.35), 0.62, a.len / 2 + 0.01);
    g.add(hl);
    const tl = new THREE.Mesh(hlGeo, tailMat);
    tl.position.set(s * (a.wid / 2 - 0.35), 0.66, -a.len / 2 - 0.01);
    g.add(tl);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }));
    bar.position.set(0, 0.55 + a.body - 0.28 + 0.62, -a.len * 0.06);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.28, 0.55 + a.body - 0.28 + 0.68, -a.len * 0.06);
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.42), new THREE.MeshBasicMaterial({ color: 0x2050ff }));
    blue.position.set(0.28, 0.55 + a.body - 0.28 + 0.68, -a.len * 0.06);
    g.add(blue);
    g.userData.lightbar = { red, blue };
  }
  return { group: g, wheels, archetype: a };
}

// A drivable car: position, heading, speed, health. update() applies arcade
// physics and resolves collisions against the city.
export function createCar(scene, archetype, color, x, z, angle, isPolice) {
  const mesh = createCarMesh(archetype, color, isPolice);
  mesh.group.position.set(x, 0, z);
  mesh.group.rotation.y = angle;
  scene.add(mesh.group);
  const a = CAR_ARCHETYPES[archetype];
  const car = {
    mesh, archetype, angle, speed: 0, steer: 0, health: 100,
    pos: mesh.group.position,
    update(dt, throttle, steering, handbrake, city, onCrash) {
      const prevX = this.pos.x, prevZ = this.pos.z;
      if (throttle > 0) this.speed += a.accel * throttle * dt;
      else if (throttle < 0) {
        if (this.speed > 0.5) this.speed -= a.accel * 1.6 * dt; // brake
        else this.speed = Math.max(this.speed + a.accel * 0.6 * throttle * dt, -a.top * 0.4);
      } else {
        this.speed -= this.speed * 0.15 * dt; // gentle rolling drag: coasts
        if (Math.abs(this.speed) < 0.05) this.speed = 0;
      }
      this.speed = clamp(this.speed, -a.top * 0.4, a.top);
      const speed01 = clamp(Math.abs(this.speed) / a.top, 0, 1);
      this.steer = steering * (0.5 + 0.5 * (1 - speed01));
      const turnRate = this.steer * a.grip * (this.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(this.speed) / 6 + 0.25);
      this.angle += turnRate * dt * (handbrake ? 1.6 : 1);
      if (handbrake) this.speed -= this.speed * 1.4 * dt;
      const fx = Math.sin(this.angle), fz = Math.cos(this.angle);
      this.pos.x += fx * this.speed * dt;
      this.pos.z += fz * this.speed * dt;
      const hitWall = resolveCircleColliders(this.pos, a.len * 0.42, city.colliders)
        || resolveCircleObstacles(this.pos, a.len * 0.42, city.obstacles);
      // keep inside the world
      this.pos.x = clamp(this.pos.x, -340, 330);
      this.pos.z = clamp(this.pos.z, -340, 340);
      if (hitWall) {
        const impact = Math.abs(this.speed);
        if (impact > 6 && onCrash) onCrash(impact, this.pos.x, this.pos.z);
        this.speed *= -0.25;
        this.health = Math.max(0, this.health - impact * 0.7);
      }
      // wheel spin + front-wheel steer visuals
      const spin = (this.speed * dt) / 0.36;
      mesh.wheels.forEach((w, i) => {
        w.children[0].rotation.x += spin;
        w.children[1].rotation.x += spin;
        if (i < 2) w.rotation.y = this.steer * 0.4;
      });
      mesh.group.rotation.y = this.angle;
      return { movedX: this.pos.x - prevX, movedZ: this.pos.z - prevZ };
    },
    setPose(x, z, angle) {
      this.pos.set(x, 0, z);
      this.angle = angle;
      this.speed = 0;
      mesh.group.rotation.y = angle;
    },
    forward() { return { x: Math.sin(this.angle), z: Math.cos(this.angle) }; },
    remove() { scene.remove(mesh.group); },
  };
  return car;
}
