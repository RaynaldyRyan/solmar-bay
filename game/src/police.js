// The wanted system: 0-5 stars. Foot cops chase and arrest (BUSTED), cop
// cars pursue and ram, and a helicopter joins at 4 stars. Wanted decays when
// no officer has line of sight for a while.
import { createCar } from './vehicles.js';
import { makeCharacterMesh } from './player.js';
import { segmentBlocked, resolveCircleColliders, resolveCircleObstacles } from './city.js';
import { clamp, dist2 } from './config.js';

export function createPolice(scene, city, rng, effects) {
  const cops = []; // foot cops
  const copCars = [];
  let heli = null;
  let wanted = 0;
  let unseenTimer = 0;
  let spawnTimer = 0;
  let lightPhase = 0;

  function spawnFootCop(x, z) {
    const mesh = makeCharacterMesh(0x1a2a4a, 0x141c2e, rng.pick([0xe8b98a, 0xc98a5a, 0x8a5a3a]));
    // police cap
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.44), new THREE.MeshStandardMaterial({ color: 0x101828, roughness: 0.6 }));
    cap.position.y = 2.08;
    mesh.group.add(cap);
    mesh.group.position.set(x, 0, z);
    scene.add(mesh.group);
    const cop = { mesh, pos: mesh.group.position, angle: 0, walkPhase: 0, speed: rng.range(5.5, 6.5) };
    cops.push(cop);
    return cop;
  }

  function spawnCopCar(x, z, angle) {
    const car = createCar(scene, 'sedan', 0x1a2530, x, z, angle, true);
    car.userData = { pursue: true };
    copCars.push(car);
    return car;
  }

  function spawnHeli(x, z) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a2530, roughness: 0.4, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 4.2), bodyMat);
    body.castShadow = true;
    g.add(body);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 1.4), new THREE.MeshStandardMaterial({ color: 0x0e1a2a, roughness: 0.1, metalness: 0.8 }));
    glass.position.set(0, 0.3, 1.6);
    g.add(glass);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.5), bodyMat);
    tail.position.set(0, 0.2, -4);
    g.add(tail);
    const rotor = new THREE.Group();
    const bladeGeo = new THREE.BoxGeometry(9, 0.08, 0.4);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
    const b1 = new THREE.Mesh(bladeGeo, bladeMat);
    const b2 = new THREE.Mesh(bladeGeo, bladeMat);
    b2.rotation.y = Math.PI / 2;
    rotor.add(b1); rotor.add(b2);
    rotor.position.y = 1.1;
    g.add(rotor);
    const search = new THREE.Mesh(
      new THREE.ConeGeometry(7, 42, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    search.position.y = -21;
    search.rotation.x = Math.PI;
    g.add(search);
    g.position.set(x, 42, z);
    scene.add(g);
    heli = { group: g, rotor, angle: 0 };
  }

  function removeHeli() {
    if (heli) { scene.remove(heli.group); heli = null; }
  }

  // spawn point just off-screen: on a road near the player
  function spawnNear(px, pz, dist) {
    const a = rng.range(0, Math.PI * 2);
    return { x: clamp(px + Math.cos(a) * dist, -200, 200), z: clamp(pz + Math.sin(a) * dist, -200, 200) };
  }

  return {
    get wanted() { return wanted; },
    addWanted(n) {
      wanted = clamp(wanted + n, 0, 5);
      unseenTimer = 0;
    },
    // deterministic placement for screenshot staging
    placeCopCar(x, z, angle) { return spawnCopCar(x, z, angle); },
    clearWanted() {
      wanted = 0;
      for (const c of cops) scene.remove(c.mesh.group);
      for (const c of copCars) c.remove();
      cops.length = 0; copCars.length = 0;
      removeHeli();
    },
    get copCount() { return cops.length + copCars.length; },
    get heliActive() { return heli !== null; },
    update(dt, player, onBusted) {
      lightPhase += dt * 9;
      const px = player.pos.x, pz = player.pos.z;
      const driving = player.isDriving();
      const wantCars = wanted >= 2 ? Math.min(1 + Math.floor((wanted - 1) / 2), 3) : 0;
      const wantCops = wanted >= 1 ? Math.min(1 + wanted, 5) : 0;

      spawnTimer -= dt;
      if (wanted > 0 && spawnTimer <= 0) {
        spawnTimer = 1.2;
        if (copCars.length < wantCars) {
          const s = spawnNear(px, pz, 55);
          spawnCopCar(s.x, s.z, Math.atan2(px - s.x, pz - s.z));
        } else if (cops.length < wantCops) {
          const s = spawnNear(px, pz, 30);
          spawnFootCop(s.x, s.z);
        }
      }
      if (wanted >= 4 && !heli) spawnHeli(px + 30, pz - 30);
      if (wanted < 4 && heli) removeHeli();

      // line of sight: any officer within 60m with no building between
      let seen = false;
      const los = (x, z) => dist2(x, z, px, pz) < 3600 && !segmentBlocked(x, z, px, pz, city.colliders);
      for (const c of cops) if (los(c.pos.x, c.pos.z)) { seen = true; break; }
      if (!seen) for (const c of copCars) if (los(c.pos.x, c.pos.z)) { seen = true; break; }
      if (heli) seen = true; // the helicopter always watches
      if (wanted > 0) {
        if (seen) unseenTimer = 0;
        else {
          unseenTimer += dt;
          if (unseenTimer > 9) { wanted = Math.max(0, wanted - 1); unseenTimer = 0; }
        }
      }

      // foot cops chase
      for (let i = cops.length - 1; i >= 0; i--) {
        const cop = cops[i];
        if (wanted === 0) { scene.remove(cop.mesh.group); cops.splice(i, 1); continue; }
        const dx = px - cop.pos.x, dz = pz - cop.pos.z;
        const d = Math.sqrt(dx * dx + dz * dz) || 1;
        cop.angle = Math.atan2(dx, dz);
        const sp = driving ? cop.speed * 1.15 : cop.speed;
        cop.pos.x += (dx / d) * sp * dt;
        cop.pos.z += (dz / d) * sp * dt;
        resolveCircleColliders(cop.pos, 0.5, city.colliders);
        resolveCircleObstacles(cop.pos, 0.5, city.obstacles);
        cop.walkPhase += dt * 11;
        const swing = Math.sin(cop.walkPhase) * 0.7;
        cop.mesh.legL.rotation.x = swing;
        cop.mesh.legR.rotation.x = -swing;
        cop.mesh.armL.rotation.x = -swing * 0.7;
        cop.mesh.armR.rotation.x = swing * 0.7;
        cop.mesh.group.rotation.y = cop.angle;
        // arrest: touching the player on foot
        if (!driving && d < 1.6 && onBusted) onBusted();
      }

      // cop cars pursue and ram
      for (let i = copCars.length - 1; i >= 0; i--) {
        const car = copCars[i];
        if (wanted === 0 || car.health <= 0) { car.remove(); copCars.splice(i, 1); continue; }
        const dx = px - car.pos.x, dz = pz - car.pos.z;
        const target = Math.atan2(dx, dz);
        let da = target - car.angle;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        const steer = clamp(da * 2.4, -1, 1);
        const d = Math.sqrt(dx * dx + dz * dz);
        const throttle = d > 6 ? 1 : 0.4;
        car.update(dt, throttle, steer, false, city, (impact) => {
          effects.burst(car.pos.x, 1, car.pos.z, 0xffcc66, 8, 5);
        });
        // flashing light bar
        const lb = car.mesh.group.userData.lightbar;
        if (lb) {
          const on = Math.sin(lightPhase) > 0;
          lb.red.visible = on;
          lb.blue.visible = !on;
        }
        // ramming damage to the player's car
        if (driving && d < 4.5) {
          player.car.health = Math.max(0, player.car.health - 12 * dt);
          if (Math.random() < dt * 2) effects.burst(px, 1, pz, 0xffcc66, 4, 4);
        }
      }

      // helicopter follows overhead
      if (heli) {
        const dx = px - heli.group.position.x, dz = pz - heli.group.position.z;
        const d = Math.sqrt(dx * dx + dz * dz) || 1;
        const sp = Math.min(26, 8 + d * 0.25);
        heli.group.position.x += (dx / d) * sp * dt;
        heli.group.position.z += (dz / d) * sp * dt;
        heli.group.position.y = 42 + Math.sin(performance.now() * 0.001) * 1.5;
        heli.group.rotation.y = Math.atan2(dx, dz);
        heli.rotor.rotation.y += dt * 22;
      }
    },
  };
}
