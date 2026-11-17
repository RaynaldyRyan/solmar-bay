// Solmar Bay — the wanted system and the SBPD.
// One clear job: track the player's stars, spawn the police response for each
// level (foot cops, interceptor cars, helicopter), chase, ram, arrest, and let
// the heat decay when no officer can see the player.

import { WANTED, WORLD } from './config.js';
import { clamp, angleDelta } from './random.js';
import { buildPersonMesh } from './player.js';
import { Car } from './vehicles.js';

export class Police {
  constructor(scene, city, game) {
    this.scene = scene;
    this.city = city;
    this.game = game;
    this.stars = 0;
    this.footCops = [];
    this.copCars = [];
    this.heli = null;
    this.heliAngle = 0;
    this.noSightTimer = 0;
    this.arrestTimer = 0;
    this.spawnTimer = 0;
  }

  addWanted(n, reason = '') {
    const before = this.stars;
    this.stars = clamp(this.stars + n, 0, WANTED.MAX_STARS);
    if (this.stars > before) {
      this.noSightTimer = 0;
      this.game.hud.flash(`WANTED ${'★'.repeat(this.stars)}${reason ? ' — ' + reason : ''}`);
      this.game.audio.siren(this.stars > 0);
    }
  }

  clearWanted() {
    this.stars = 0;
    this.noSightTimer = 0;
    this.game.audio.siren(false);
    this.despawnAll();
  }

  despawnAll() {
    for (const c of this.footCops) this.scene.remove(c.mesh);
    this.footCops = [];
    for (const c of this.copCars) c.remove(this.scene);
    this.copCars = [];
    if (this.heli) {
      this.scene.remove(this.heli.group);
      this.heli = null;
    }
  }

  wantedCount(stars) {
    // How many of each unit the level calls for.
    return {
      foot: stars >= 1 ? 1 + stars : 0,
      cars: stars >= 2 ? stars - 1 : 0,
      heli: stars >= 4 ? 1 : 0,
    };
  }

  update(dt, game) {
    const player = game.player;
    if (this.stars === 0) return;
    const want = this.wantedCount(this.stars);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.2;
      while (this.footCops.length < want.foot) this.spawnFootCop(player);
      while (this.copCars.length < want.cars) this.spawnCopCar(player);
      if (want.heli && !this.heli) this.spawnHeli(player);
    }
    // Line of sight: does any officer see the player?
    const seen = this.anyoneSees(player);
    if (seen) {
      this.noSightTimer = 0;
    } else {
      this.noSightTimer += dt;
      if (this.noSightTimer > WANTED.DECAY_LOS_SECONDS) {
        this.stars -= 1;
        this.noSightTimer = 0;
        game.hud.flash(`Heat cooling… ${'★'.repeat(Math.max(0, this.stars))}`);
        if (this.stars <= 0) {
          this.clearWanted();
          game.hud.flash('You lost them. Clean.');
          return;
        }
      }
    }
    this.updateFootCops(dt, game);
    this.updateCopCars(dt, game);
    this.updateHeli(dt, game);
    // Arrest: a foot cop holding the player still for 1.5 s busts them.
    if (this.arrestTimer > 0) {
      this.arrestTimer -= dt;
      if (this.arrestTimer <= 0) game.onPlayerBusted();
    }
  }

  anyoneSees(player) {
    for (const c of this.footCops) {
      if (this.canSee(c.x, c.z, player)) return true;
    }
    for (const c of this.copCars) {
      if (this.canSee(c.x, c.z, player)) return true;
    }
    if (this.heli) return true; // the helicopter always watches
    return false;
  }

  canSee(x, z, player) {
    const d = Math.hypot(player.x - x, player.z - z);
    if (d > 55) return false;
    return !this.city.rayBlocked(x, z, player.x, player.z);
  }

  spawnFootCop(player) {
    const a = Math.random() * Math.PI * 2;
    const d = 22 + Math.random() * 14;
    const x = clamp(player.x + Math.cos(a) * d, -148, 148);
    const z = clamp(player.z + Math.sin(a) * d, -148, 150);
    const mesh = buildPersonMesh(0x1a2a4a, 0x1a1a22, 0xc89a72);
    // Police cap: white instead of navy.
    mesh.children.forEach((c) => {
      if (c.geometry && c.geometry.type === 'SphereGeometry' && c.position.y > 1.6) {
        c.material = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
      }
    });
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.footCops.push({
      mesh, x, z, heading: 0, health: 100, walkPhase: 0,
      shootTimer: 1 + Math.random(),
    });
  }

  spawnCopCar(player) {
    const [x, z] = this.city.randomRoadPoint({ pick: (l) => l[Math.floor(Math.random() * l.length)], chance: () => Math.random() < 0.5, float: (a, b) => a + Math.random() * (b - a) });
    // Prefer a road point 40-90 m from the player.
    let px = x;
    let pz = z;
    for (let tries = 0; tries < 6; tries++) {
      const [tx, tz] = this.city.randomRoadPoint({ pick: (l) => l[Math.floor(Math.random() * l.length)], chance: () => Math.random() < 0.5, float: (a, b) => a + Math.random() * (b - a) });
      const d = Math.hypot(tx - player.x, tz - player.z);
      if (d > 35 && d < 100) {
        px = tx;
        pz = tz;
        break;
      }
    }
    const car = new Car(this.scene, 'cop', px, pz, Math.atan2(player.x - px, player.z - pz));
    car.driver = 'cop';
    car.occupied = true;
    car.deployTimer = 4 + Math.random() * 4;
    this.copCars.push(car);
  }

  spawnHeli(player) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 4.4), bodyMat);
    body.castShadow = true;
    group.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4), bodyMat);
    tail.position.set(0, 0.2, 3.6);
    group.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.4), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    rotor.position.y = 1.0;
    group.add(rotor);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
    lamp.position.set(0, -0.8, -1.5);
    group.add(lamp);
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(4, 26, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.rotation.x = Math.PI;
    beam.position.y = -13;
    group.add(beam);
    group.position.set(player.x + 20, 42, player.z + 20);
    this.scene.add(group);
    this.heli = { group, rotor, beam, angle: 0 };
    this.game.hud.flash('SBPD helicopter overhead');
  }

  updateFootCops(dt, game) {
    const player = game.player;
    for (const cop of [...this.footCops]) {
      const dx = player.x - cop.x;
      const dz = player.z - cop.z;
      const d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let dh = angleDelta(cop.heading, want);
      cop.heading += clamp(dh, -3.2 * dt, 3.2 * dt);
      const speed = 6.4;
      const nx = cop.x + Math.sin(cop.heading) * speed * dt;
      const nz = cop.z + Math.cos(cop.heading) * speed * dt;
      const [cx, cz] = this.city.collideCircle(nx, nz, 0.45);
      cop.x = cx;
      cop.z = cz;
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
      cop.walkPhase += dt * 11;
      const swing = Math.sin(cop.walkPhase) * 0.7;
      const L = cop.mesh.userData.limbs;
      L.legL.rotation.x = swing;
      L.legR.rotation.x = -swing;
      // Arrest the player on foot at close range; shoot at range when stars are high.
      if (d < 2.0 && player.onFoot && Math.abs(player.speed2d || 0) < 2.5) {
        if (this.arrestTimer <= 0) {
          this.arrestTimer = 1.5;
          game.hud.flash('The SBPD is arresting you — RUN!');
        }
      } else if (d > 2.0 && d < 4) {
        this.arrestTimer = 0;
      }
      if (this.stars >= 2 && d < 30 && d > 6 && !this.city.rayBlocked(cop.x, cop.z, player.x, player.z)) {
        cop.shootTimer -= dt;
        if (cop.shootTimer <= 0) {
          cop.shootTimer = 1.1 + Math.random() * 0.8;
          game.combat.copShoot(cop, player);
        }
      }
      // Cops far behind despawn so the chase stays near the player.
      if (d > 150) {
        this.scene.remove(cop.mesh);
        this.footCops.splice(this.footCops.indexOf(cop), 1);
      }
    }
  }

  updateCopCars(dt, game) {
    const player = game.player;
    for (const car of [...this.copCars]) {
      if (car.dead) {
        // Wrecked interceptor: its crew gets out and chases on foot.
        if (!car.crewOut) {
          car.crewOut = true;
          this.spawnFootCop(player);
        }
        car.drive(dt, 0, 0, false, this.city, game.allVehicles());
        continue;
      }
      // Pursuit: steer at the player, ram when close.
      const steer = car.steerTo(player.x, player.z);
      const d = Math.hypot(player.x - car.x, player.z - car.z);
      const throttle = d > 6 ? 1 : 0.4;
      car.drive(dt, throttle, steer, false, this.city, game.allVehicles());
      // Deploy a foot cop when alongside the player on foot.
      car.deployTimer -= dt;
      if (car.deployTimer <= 0 && d < 14 && player.onFoot) {
        car.deployTimer = 9;
        this.spawnFootCop(player);
      }
      if (car.health < 45) {
        car.smokeTimer -= dt;
        if (car.smokeTimer <= 0) {
          car.smokeTimer = 0.25;
          game.effects.smoke(car.x, 1.2, car.z);
        }
      }
      if (d > 220) {
        car.remove(this.scene);
        this.copCars.splice(this.copCars.indexOf(car), 1);
      }
    }
  }

  updateHeli(dt, game) {
    if (!this.heli) return;
    const player = game.player;
    this.heli.angle += dt * 0.25;
    const r = 26;
    const tx = player.x + Math.cos(this.heli.angle) * r;
    const tz = player.z + Math.sin(this.heli.angle) * r;
    const g = this.heli.group;
    g.position.x += (tx - g.position.x) * Math.min(1, 1.5 * dt);
    g.position.z += (tz - g.position.z) * Math.min(1, 1.5 * dt);
    g.position.y = 42 + Math.sin(performance.now() / 900) * 1.5;
    // The tail is local +Z, so +PI points the nose at the player.
    g.rotation.y = Math.atan2(player.x - g.position.x, player.z - g.position.z) + Math.PI;
    this.heli.rotor.rotation.y += dt * 24;
    // Spotlight tracks the player.
    this.heli.beam.lookAt(player.x, 0, player.z);
  }

  // A foot cop was hit by the player's attack.
  hurtCop(cop, amount, game) {
    cop.health -= amount;
    game.effects.blood(cop.x, 1.2, cop.z);
    if (cop.health <= 0) {
      cop.mesh.rotation.x = -Math.PI / 2;
      cop.mesh.position.y = 0.3;
      this.footCops.splice(this.footCops.indexOf(cop), 1);
      setTimeout(() => this.scene.remove(cop.mesh), 4000);
      this.addWanted(2, 'officer down');
    }
  }
}
