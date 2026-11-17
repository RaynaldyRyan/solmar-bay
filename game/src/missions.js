// Solmar Bay — story missions and courier runs.
// One clear job: the 5-mission story (step definitions live in config.js:
// goto, enterCar, escape and checkpoint steps, with stars/ambush/time
// modifiers), the objective beacon and minimap marker, step completion,
// timers, rewards, and the repeatable courier job that always pays.

import { MISSIONS, COURIER_PAY } from './config.js';

export class Missions {
  constructor(scene, city, game) {
    this.scene = scene;
    this.city = city;
    this.game = game;
    this.completed = new Set();
    this.current = null; // { def, stepIndex, timer, gunmen, checkpointIndex, courier, stops, stopIndex }
    this.beacon = this.buildBeacon();
    scene.add(this.beacon);
    this.beacon.visible = false;
    this.courierCooldown = 0;
  }

  buildBeacon() {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 2.6, 90, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffd040, transparent: true, opacity: 0.35,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    beam.position.y = 45;
    g.add(beam);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3.4, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd040, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    g.add(ring);
    return g;
  }

  // Start a story mission by its string id, in story order (unless forced,
  // which the screenshot staging uses).
  startMission(id, opts = {}) {
    const def = MISSIONS.find((m) => m.id === id);
    if (!def) return false;
    if (!opts.force) {
      const idx = MISSIONS.indexOf(def);
      if (idx > 0 && !this.completed.has(MISSIONS[idx - 1].id)) return false;
    }
    this.current = {
      def, stepIndex: 0, timer: 0, gunmen: [],
      checkpointIndex: 0, courier: false,
    };
    this.game.hud.flash(`MISSION: ${def.title}`);
    this.game.hud.showBrief(def.title, def.brief);
    this.setupStep();
    return true;
  }

  startCourier() {
    if (this.current) return false;
    const def = {
      id: 'courier', title: 'Courier Run', reward: COURIER_PAY,
      brief: 'Pick up the package and deliver it across town. Fast pays the same — late pays nothing.',
    };
    // Two stops: pickup near the player, delivery across the map.
    const [px, pz] = this.city.randomRoadPoint(this.game.rng || { pick: (l) => l[Math.floor(Math.random() * l.length)], chance: () => Math.random() < 0.5, float: (a, b) => a + Math.random() * (b - a) });
    const [dx, dz] = this.city.randomRoadPoint(this.game.rng || { pick: (l) => l[Math.floor(Math.random() * l.length)], chance: () => Math.random() < 0.5, float: (a, b) => a + Math.random() * (b - a) });
    this.current = {
      def, stepIndex: 0, timer: 90, gunmen: [],
      checkpointIndex: 0, courier: true,
      stops: [[px, pz], [dx, dz]], stopIndex: 0,
    };
    this.game.hud.flash('COURIER RUN — pick up the package');
    this.game.hud.setObjective('Pick up the package', 90);
    return true;
  }

  currentStep() {
    return this.current && !this.current.courier
      ? this.current.def.steps[this.current.stepIndex]
      : null;
  }

  objectivePos() {
    if (!this.current) return null;
    if (this.current.courier) return this.current.stops[this.current.stopIndex];
    const step = this.currentStep();
    if (!step) return null;
    if (step.kind === 'goto') return step.at;
    if (step.kind === 'checkpoint') return step.at[this.current.checkpointIndex];
    return null; // enterCar / escape have no map point
  }

  setupStep() {
    const step = this.currentStep();
    if (!step) return;
    this.current.timer = step.time || 0;
    if (step.stars) {
      this.game.police.addWanted(step.stars, 'the job went loud');
    }
    if (step.ambush) {
      this.current.gunmen = this.game.combat.spawnGunmen(step.at[0], step.at[1], 3, { health: 80 });
      this.game.hud.flash('Ambush! The Marineros are waiting at the drop');
    }
    if (step.kind === 'escape') {
      this.game.hud.flash('Lose the heat — break line of sight, or visit Spray & Save');
    }
    this.game.hud.setObjective(step.label, this.current.timer);
  }

  update(dt, game) {
    this.courierCooldown -= dt;
    if (this.beacon.visible) {
      const s = 1 + Math.sin(performance.now() / 300) * 0.08;
      this.beacon.scale.set(s, 1, s);
      this.beacon.rotation.y += dt * 0.6;
    }
    if (!this.current) {
      this.beacon.visible = false;
      return;
    }
    const player = game.player;
    const step = this.currentStep();
    // Timer.
    if (this.current.timer > 0) {
      this.current.timer -= dt;
      const label = this.current.courier
        ? (this.current.stopIndex === 0 ? 'Pick up the package' : 'Deliver the package')
        : step.label;
      game.hud.setObjective(label, Math.max(0, this.current.timer));
      if (this.current.timer <= 0) {
        this.failMission('Out of time');
        return;
      }
    }
    // Beacon follows the objective.
    const obj = this.objectivePos();
    if (obj) {
      this.beacon.visible = true;
      this.beacon.position.set(obj[0], 0, obj[1]);
    } else {
      this.beacon.visible = false;
    }
    // Courier completion.
    if (this.current.courier) {
      const [tx, tz] = this.current.stops[this.current.stopIndex];
      if (Math.hypot(player.x - tx, player.z - tz) < 5) {
        if (this.current.stopIndex === 0) {
          this.current.stopIndex = 1;
          this.current.timer = 120;
          game.hud.flash('Package collected — deliver it across town');
          game.hud.setObjective('Deliver the package', 120);
          game.audio.pickup();
        } else {
          this.completeMission();
        }
      }
      return;
    }
    // Story step completion.
    if (step.kind === 'goto') {
      const [tx, tz] = step.at;
      const d = Math.hypot(player.x - tx, player.z - tz);
      if (d < 6) {
        if (step.inCar && player.onFoot) {
          game.hud.flash('You need to be in a car for this');
          return;
        }
        this.advanceStep();
      }
    } else if (step.kind === 'enterCar') {
      if (!player.onFoot) this.advanceStep();
    } else if (step.kind === 'escape') {
      if (game.police.stars === 0) {
        game.hud.flash('Clean getaway');
        this.advanceStep();
      }
    } else if (step.kind === 'checkpoint') {
      const [tx, tz] = step.at[this.current.checkpointIndex];
      if (Math.hypot(player.x - tx, player.z - tz) < 8) {
        game.audio.pickup();
        this.current.checkpointIndex += 1;
        if (this.current.checkpointIndex >= step.at.length) {
          this.advanceStep();
        } else {
          game.hud.flash(`Checkpoint ${this.current.checkpointIndex + 1} of ${step.at.length}`);
        }
      }
    }
  }

  advanceStep() {
    this.current.stepIndex += 1;
    this.current.checkpointIndex = 0;
    if (this.current.stepIndex >= this.current.def.steps.length) {
      this.completeMission();
      return;
    }
    this.setupStep();
  }

  completeMission() {
    const def = this.current.def;
    const reward = def.reward;
    this.game.money += reward;
    this.game.hud.flash(`MISSION COMPLETE — +$${reward}`);
    this.game.hud.showBrief('Mission Complete', `${def.title} — you earned $${reward}.`);
    this.game.audio.missionComplete();
    if (!this.current.courier) {
      this.completed.add(def.id);
      this.game.saveGame();
    } else {
      this.courierCooldown = 5;
    }
    this.current = null;
    this.beacon.visible = false;
    this.game.hud.setObjective('', 0);
  }

  failMission(reason) {
    this.game.hud.flash(`MISSION FAILED — ${reason}`);
    this.game.hud.showBrief('Mission Failed', `${this.current.def.title}: ${reason}. Try again from the pause menu.`);
    this.game.combat.clearGunmen();
    this.current = null;
    this.beacon.visible = false;
    this.game.hud.setObjective('', 0);
  }

  onGunmanDown(g) {
    // Gunmen are a hazard, not a step requirement; nothing to count here.
  }

  // The next story mission the player can start.
  nextMission() {
    for (const m of MISSIONS) {
      if (!this.completed.has(m.id)) return m;
    }
    return null;
  }

  missionState() {
    return {
      completed: [...this.completed],
      current: this.current ? this.current.def.id : null,
    };
  }

  loadState(completed) {
    this.completed = new Set(completed || []);
  }
}
