// Missions: the 5-mission Milo Vane story plus repeatable courier runs.
// Step kinds (see config.js): goto (reach step.target), enterCar (get into
// the staged archetype at step.at), escape (bring the wanted level to 0),
// checkpoint (reach each of step.targets in order). A tall light beacon and
// a minimap diamond mark the current objective.
import { MISSIONS, COURIER_PAY } from './config.js';

export class Missions {
  constructor(scene, rng, onEvent) {
    this.scene = scene;
    this.rng = rng;
    this.onEvent = onEvent;   // (type, payload) — 'missionStart','missionDone','missionFail','courierStart','courierDone','stepDone','ambush'
    this.current = -1;        // index into MISSIONS, -1 = none active
    this.step = 0;
    this.checkpointIdx = 0;
    this.completed = new Set();
    this.courier = null;      // {x,z} active courier pickup/dropoff
    this.courierStage = 0;    // 0 = go to pickup, 1 = deliver
    this.courierPay = 0;
    this.timer = 0;           // mission time limit countdown
    this.beacon = null;
    this.marker = null;
    this.ambushSpawned = false;
    this.buildBeacon();
  }

  buildBeacon() {
    // a tall glowing column visible across the city
    const geo = new THREE.CylinderGeometry(1.6, 1.6, 120, 12, 1, true);
    this.beacon = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0xf5c518, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
    }));
    this.beacon.position.y = 60;
    this.beacon.visible = false;
    this.scene.add(this.beacon);
    // a ground ring at the objective
    this.marker = new THREE.Mesh(
      new THREE.TorusGeometry(3, 0.3, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xf5c518 }),
    );
    this.marker.rotation.x = Math.PI / 2;
    this.marker.position.y = 0.3;
    this.marker.visible = false;
    this.scene.add(this.marker);
  }

  get active() { return this.current >= 0; }
  get mission() { return this.active ? MISSIONS[this.current] : null; }

  // Start the next uncompleted story mission.
  startNext() {
    const next = MISSIONS.findIndex((m) => !this.completed.has(m.id));
    if (next === -1) return null;
    this.current = next;
    this.step = 0;
    this.checkpointIdx = 0;
    this.timer = MISSIONS[next].timeLimit || 0;
    this.ambushSpawned = false;
    this.placeMarker();
    this.onEvent('missionStart', MISSIONS[next]);
    return MISSIONS[next];
  }

  // The current step's target position, or null (escape steps have no place).
  currentTarget() {
    if (this.courier) return this.courier;
    if (!this.active) return null;
    const step = this.mission.steps[this.step];
    if (!step) return null;
    if (step.kind === 'goto') return step.target;
    if (step.kind === 'enterCar') return step.at;
    if (step.kind === 'checkpoint') return step.targets[this.checkpointIdx];
    return null; // escape
  }

  currentText() {
    if (this.courier) {
      return this.courierStage === 0
        ? 'Courier: pick up the parcel'
        : 'Courier: deliver the parcel';
    }
    if (!this.active) return null;
    const step = this.mission.steps[this.step];
    return step ? step.text : null;
  }

  placeMarker() {
    const t = this.currentTarget();
    if (!t) {
      this.beacon.visible = false;
      this.marker.visible = false;
      return;
    }
    this.beacon.visible = true;
    this.marker.visible = true;
    this.beacon.position.x = t.x;
    this.beacon.position.z = t.z;
    this.marker.position.x = t.x;
    this.marker.position.z = t.z;
  }

  // Called every frame; wanted is the police wanted level (for escape steps).
  update(dt, player, wanted) {
    const pos = player.pos;
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        const failed = this.mission;
        this.current = -1;
        this.placeMarker();
        this.onEvent('missionFail', failed);
        return;
      }
    }
    // courier run
    if (this.courier) {
      const d = Math.hypot(this.courier.x - pos.x, this.courier.z - pos.z);
      if (d < 6) {
        if (this.courierStage === 0) {
          this.courierStage = 1;
          this.courier = this.randomSpot();
          this.placeMarker();
          this.onEvent('stepDone', { text: 'Parcel collected — deliver it' });
        } else {
          this.courier = null;
          this.placeMarker();
          this.onEvent('courierDone', { pay: this.courierPay });
        }
      }
      return;
    }
    if (!this.active) return;
    const step = this.mission.steps[this.step];
    if (!step) return;
    // ambush: gunmen spawn once when the player nears the ambush step
    if (step.ambush && !this.ambushSpawned) {
      const d = Math.hypot(step.target.x - pos.x, step.target.z - pos.z);
      if (d < 25) {
        this.ambushSpawned = true;
        this.onEvent('ambush', { at: step.target, count: step.ambush });
      }
    }
    if (step.kind === 'goto') {
      const d = Math.hypot(step.target.x - pos.x, step.target.z - pos.z);
      if (d < 6) this.advance();
    } else if (step.kind === 'enterCar') {
      if (player.inCar && player.car.key === step.archetype) this.advance();
    } else if (step.kind === 'escape') {
      if (wanted === 0) this.advance();
    } else if (step.kind === 'checkpoint') {
      const pt = step.targets[this.checkpointIdx];
      const d = Math.hypot(pt.x - pos.x, pt.z - pos.z);
      if (d < 7) {
        this.checkpointIdx += 1;
        if (this.checkpointIdx >= step.targets.length) {
          this.checkpointIdx = 0;
          this.advance();
        } else {
          this.placeMarker();
          this.onEvent('stepDone', { text: `Checkpoint ${this.checkpointIdx}/${step.targets.length}` });
        }
      }
    }
  }

  advance() {
    this.step += 1;
    this.ambushSpawned = false;
    if (this.step >= this.mission.steps.length) {
      const done = this.mission;
      this.completed.add(done.id);
      this.current = -1;
      this.step = 0;
      this.placeMarker();
      this.onEvent('missionDone', done);
    } else {
      this.placeMarker();
      const next = this.mission.steps[this.step];
      this.onEvent('stepDone', { text: next.text });
    }
  }

  // Start a courier run: pickup then delivery, both random landmarks.
  startCourier() {
    if (this.active || this.courier) return false;
    this.courierStage = 0;
    this.courierPay = COURIER_PAY[Math.floor(this.rng() * COURIER_PAY.length)];
    this.courier = this.randomSpot();
    this.placeMarker();
    this.onEvent('courierStart', { pay: this.courierPay });
    return true;
  }

  randomSpot() {
    const keys = ['plaza', 'rosa', 'park', 'harbor', 'lighthouse', 'ferris', 'beach', 'garage', 'pier'];
    const spots = {
      plaza: { x: 0, z: 0 }, rosa: { x: 34, z: -26 }, park: { x: -80, z: -80 },
      harbor: { x: 172, z: -80 }, lighthouse: { x: 60, z: 204 }, ferris: { x: 120, z: 192 },
      beach: { x: -20, z: 196 }, garage: { x: -100, z: 100 }, pier: { x: 60, z: 186 },
    };
    return spots[keys[Math.floor(this.rng() * keys.length)]];
  }

  // For save/load.
  serialize() {
    return { completed: [...this.completed] };
  }
  restore(data) {
    if (data && Array.isArray(data.completed)) {
      this.completed = new Set(data.completed);
    }
  }
}
