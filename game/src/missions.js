// Missions: a 5-chapter story for Milo Vane plus repeatable courier runs.
// Each mission is a list of steps (go to, enter a car, escape the law,
// survive an ambush, beat the clock). A tall neon beacon marks the objective.
import { MISSION_NAMES, dist2 } from './config.js';

function beaconMesh(scene) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.5, 90, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffea00, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  beam.position.y = 45;
  g.add(beam);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.2, 0.25, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffea00 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  g.add(ring);
  g.visible = false;
  scene.add(g);
  return g;
}

// Mission scripts. Coordinates are world positions on the road grid.
const MISSIONS = [
  {
    name: MISSION_NAMES[0],
    intro: 'Milo Vane, a driver new in town. Rosa needs a fare run — get to her diner.',
    steps: [
      { type: 'goto', x: 208, z: -52, label: 'Go to Rosa' },
      { type: 'goto', x: 104, z: 156, label: 'Drop Rosa at the marina', reward: 120 },
    ],
  },
  {
    name: MISSION_NAMES[1],
    intro: 'The harbor crew needs a wheelman. Take the Comet and meet them at the docks.',
    steps: [
      { type: 'enterCar', arch: 'comet', x: 52, z: 0, label: 'Take the Comet' },
      { type: 'goto', x: 182, z: 182, label: 'Reach the harbor', reward: 180 },
    ],
  },
  {
    name: MISSION_NAMES[2],
    intro: 'Sunset Run: three checkpoints across the city before the clock runs out.',
    steps: [
      { type: 'goto', x: -156, z: -52, label: 'Checkpoint 1 of 3', time: 75 },
      { type: 'goto', x: 0, z: -156, label: 'Checkpoint 2 of 3', time: 75 },
      { type: 'goto', x: 208, z: 156, label: 'Checkpoint 3 of 3', time: 75, reward: 250 },
    ],
  },
  {
    name: MISSION_NAMES[3],
    intro: 'The cops are onto you. Lose the heat, then lay low at the garage.',
    steps: [
      { type: 'escape', label: 'Lose the wanted level', wanted: 2 },
      { type: 'goto', x: 130, z: 142, label: 'Reach Spray & Save', reward: 200 },
    ],
  },
  {
    name: MISSION_NAMES[4],
    intro: 'The Tide crew is moving on the pier. Hold the line and take the score.',
    steps: [
      { type: 'goto', x: 238, z: 0, label: 'Reach the pier' },
      { type: 'ambush', label: 'Fight off the Tide crew', count: 4, reward: 400 },
      { type: 'goto', x: 26, z: 26, label: 'Return to the plaza', reward: 150 },
    ],
  },
];

export function createMissions(scene, city, world) {
  const beacon = beaconMesh(scene);
  const state = {
    index: 0,
    step: 0,
    active: false,
    courier: null, // {x, z, pay, timer}
    timer: 0,
    done: false,
  };

  function current() { return MISSIONS[state.index]; }
  function currentStep() {
    const m = current();
    return m ? m.steps[state.step] : null;
  }

  function placeBeacon(x, z) {
    beacon.position.set(x, 0, z);
    beacon.visible = true;
  }

  function startStep() {
    const s = currentStep();
    if (!s) return;
    state.timer = s.time || 0;
    if (s.type === 'goto' || s.type === 'enterCar') placeBeacon(s.x, s.z);
    if (s.type === 'ambush') {
      placeBeacon(world.player.pos.x, world.player.pos.z);
      for (let i = 0; i < s.count; i++) {
        const a = (i / s.count) * Math.PI * 2;
        world.combat.spawnRival(
          world.player.pos.x + Math.cos(a) * 18,
          world.player.pos.z + Math.sin(a) * 18,
        );
      }
    }
    if (s.type === 'escape') {
      world.police.addWanted(s.wanted || 2);
      beacon.visible = false;
    }
    if (s.type === 'enterCar') {
      // park the mission car at the marker
      world.spawnMissionCar(s.arch, s.x, s.z);
    }
    if (world.hud) world.hud.setObjective(s.label, state.timer);
  }

  function advance() {
    const s = currentStep();
    if (s && s.reward) {
      world.player.money += s.reward;
      if (world.hud) world.hud.flash(`+$${s.reward}`);
      if (world.audio) world.audio.blip(990);
    }
    state.step += 1;
    const m = current();
    if (state.step >= m.steps.length) {
      // mission complete
      state.index += 1;
      state.step = 0;
      state.active = false;
      beacon.visible = false;
      if (world.hud) {
        world.hud.showMissionCard('Mission complete', m.name + ' — well driven, Milo.');
        world.hud.setObjective('Press M for the next job', 0);
      }
      if (world.onMissionComplete) world.onMissionComplete(state.index);
      if (state.index >= MISSIONS.length) {
        state.done = true;
        if (world.hud) world.hud.showMissionCard('Neon Tide', 'Every chapter done. Solmar Bay is yours now.');
      }
      return;
    }
    startStep();
  }

  return {
    state,
    current,
    currentStep,
    objective() {
      const s = currentStep();
      if (state.courier) return { x: state.courier.x, z: state.courier.z, label: state.courier.label };
      if (!state.active || !s) return null;
      if (s.type === 'goto' || s.type === 'enterCar') return { x: s.x, z: s.z, label: s.label };
      return { x: world.player.pos.x, z: world.player.pos.z, label: s.label };
    },
    startMission() {
      if (state.active || state.done) return false;
      state.active = true;
      state.step = 0;
      const m = current();
      if (world.hud) world.hud.showMissionCard(m.name, m.intro);
      startStep();
      return true;
    },
    startCourier() {
      if (state.courier) return false;
      const spots = [
        { x: 208, z: -156, label: 'Courier: Ocean Hotel' },
        { x: -156, z: 156, label: 'Courier: West Docks' },
        { x: -52, z: -156, label: 'Courier: North Market' },
        { x: 104, z: 104, label: 'Courier: Midtown' },
      ];
      const pick = spots[Math.floor(Math.random() * spots.length)];
      state.courier = { ...pick, pay: 60 + Math.floor(Math.random() * 60), timer: 60 };
      placeBeacon(pick.x, pick.z);
      if (world.hud) world.hud.setObjective(pick.label + ' — 60s', 60);
      return true;
    },
    update(dt) {
      // courier countdown
      if (state.courier) {
        state.courier.timer -= dt;
        if (world.hud) world.hud.setObjective(state.courier.label + ' — ' + Math.max(0, Math.ceil(state.courier.timer)) + 's', state.courier.timer);
        if (dist2(world.player.pos.x, world.player.pos.z, state.courier.x, state.courier.z) < 64) {
          world.player.money += state.courier.pay;
          if (world.hud) world.hud.flash(`+$${state.courier.pay} courier pay`);
          state.courier = null;
          beacon.visible = state.active;
          if (world.hud) world.hud.setObjective(state.active ? currentStep().label : 'Press M for a job · C for courier', 0);
        } else if (state.courier.timer <= 0) {
          state.courier = null;
          beacon.visible = state.active;
          if (world.hud) world.hud.flash('Courier run failed — too slow');
        }
      }
      if (!state.active) return;
      const s = currentStep();
      if (!s) return;
      if (state.timer > 0) {
        state.timer -= dt;
        if (world.hud) world.hud.setObjective(s.label + ' — ' + Math.max(0, Math.ceil(state.timer)) + 's', state.timer);
        if (state.timer <= 0) {
          state.active = false;
          beacon.visible = false;
          if (world.hud) {
            world.hud.showMissionCard('Out of time', 'The run failed. Press M to try again.');
            world.hud.setObjective('Press M to retry', 0);
          }
          state.step = 0;
          return;
        }
      }
      const p = world.player;
      if (s.type === 'goto') {
        if (dist2(p.pos.x, p.pos.z, s.x, s.z) < 100) advance();
      } else if (s.type === 'enterCar') {
        if (p.isDriving() && p.car && p.car.archetype === s.arch) advance();
        else if (dist2(p.pos.x, p.pos.z, s.x, s.z) < 100 && !p.isDriving()) {
          if (world.hud) world.hud.setObjective('Press E to take the ' + s.arch, 0);
        }
      } else if (s.type === 'escape') {
        if (world.police.wanted === 0) advance();
      } else if (s.type === 'ambush') {
        if (world.combat.rivalCount === 0) advance();
      }
      // beacon pulse
      beacon.rotation.y += dt * 0.8;
    },
  };
}
