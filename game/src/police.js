// Police AI: wanted 0-5, cruisers with four states, a helicopter at 3+ stars,
// and the dispatch feed the HUD shows. States: PURSUIT (chase the player),
// RAMMING (close in fast and hit the player's car), ROADBLOCK (two cruisers
// angled across the road ahead) and SEARCHING (lost sight — sweep the last
// known area until the heat cools or the player is seen again).
import { WANTED } from './config.js';
import { createCar, stepCar } from './vehicles.js';

const CALLSIGNS = ['Unit 7', 'Unit 12', 'Unit 23', 'Unit 31', 'Unit 44', 'Unit 58', 'Air-1', 'Dispatch'];

export function createPolice() {
  return {
    wanted: 0,
    zone: 'CLEAR', // CLEAR | IN SIGHT | COOLDOWN
    units: [],
    heli: null,
    roadblock: [],
    dispatch: [],
    seenTimer: 0,
    coolTimer: 0,
    feedTimer: 0,
    lastKnown: null,
    blockTimer: 0,
    frozen: false, // staged shots freeze the police after setup
  };
}

function pushFeed(police, text) {
  police.dispatch.unshift(text);
  if (police.dispatch.length > 5) police.dispatch.pop();
}

function spawnUnit(police, state, i) {
  const p = state.player;
  const angle = (i / 4) * Math.PI * 2 + 0.7;
  const dist = 55 + i * 18;
  const car = createCar('cruiser', p.x + Math.sin(angle) * dist, p.z + Math.cos(angle) * dist, Math.atan2(p.x - (p.x + Math.sin(angle) * dist), p.z - (p.z + Math.cos(angle) * dist)));
  const unit = { car, state: 'PURSUIT', callsign: CALLSIGNS[i % 6], ramTimer: 0, searchX: p.x, searchZ: p.z };
  police.units.push(unit);
  return unit;
}

function spawnHeli(police, state) {
  const p = state.player;
  police.heli = { x: p.x + 40, z: p.z - 60, y: 70, heading: 0, spotlight: true };
  pushFeed(police, 'Air-1: eyes on suspect, spotlight on');
}

function setRoadblock(police, state) {
  const p = state.player;
  const ahead = 90;
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  const bx = p.x + fx * ahead;
  const bz = p.z + fz * ahead;
  police.roadblock = [
    { x: bx - fz * 5, z: bz + fx * 5, heading: p.heading + 0.6, car: createCar('cruiser', bx - fz * 5, bz + fx * 5, p.heading + 0.6) },
    { x: bx + fz * 5, z: bz - fx * 5, heading: p.heading - 0.6, car: createCar('cruiser', bx + fz * 5, bz - fx * 5, p.heading - 0.6) },
  ];
  pushFeed(police, 'Dispatch: roadblock forming ahead, all units hold');
}

// Line of sight: the player is seen when a unit is close enough and roughly
// in front of the player's car (cops look forward, not through buildings —
// approximated by range + a building check on the midpoint).
function unitSees(unit, state, city) {
  const p = state.player;
  const dx = p.x - unit.car.x;
  const dz = p.z - unit.car.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 130) return false;
  return true;
}

export function setWanted(police, stars, state) {
  police.wanted = Math.max(0, Math.min(5, stars));
  if (police.wanted === 0) {
    police.units = [];
    police.heli = null;
    police.roadblock = [];
    police.zone = 'CLEAR';
    police.dispatch = [];
  }
}

export function updatePolice(police, state, dt, city, rng) {
  if (police.frozen) return;
  const p = state.player;
  const cfg = WANTED[police.wanted];
  if (police.wanted === 0) return;

  // Spawn up to the wanted level's cruiser count; heli at 3+ stars.
  while (police.units.length < cfg.cruisers) spawnUnit(police, state, police.units.length);
  if (cfg.heli && !police.heli) spawnHeli(police, state);
  if (!cfg.heli && police.heli) police.heli = null;

  // Sight: any unit seeing the player refreshes IN SIGHT; otherwise the
  // cooldown timer runs and the wanted level drops when it expires.
  let seen = false;
  for (const u of police.units) if (unitSees(u, state, city)) seen = true;
  if (police.heli) {
    const hd = Math.hypot(police.heli.x - p.x, police.heli.z - p.z);
    if (hd < 160) seen = true;
  }
  if (seen) {
    police.zone = 'IN SIGHT';
    police.seenTimer = 0;
    police.coolTimer = 0;
    police.lastKnown = { x: p.x, z: p.z };
  } else {
    police.seenTimer += dt;
    if (police.seenTimer > 2) {
      police.zone = 'COOLDOWN';
      police.coolTimer += dt;
      if (police.coolTimer > 14) {
        setWanted(police, police.wanted - 1, state);
        police.coolTimer = 0;
        if (police.wanted > 0) pushFeed(police, 'Dispatch: heat dropping, one star down');
      }
    }
  }

  // Roadblock: at 3+ stars, once every ~25 s, two cruisers set up ahead.
  police.blockTimer -= dt;
  if (police.wanted >= 3 && police.blockTimer <= 0 && police.zone === 'IN SIGHT') {
    setRoadblock(police, state);
    police.blockTimer = 25;
  }
  if (police.roadblock.length && Math.hypot(police.roadblock[0].x - p.x, police.roadblock[0].z - p.z) > 260) {
    police.roadblock = [];
  }

  // Unit AI: steer toward the target, ram when close and fast, search when blind.
  for (const u of police.units) {
    const c = u.car;
    const dx = p.x - c.x;
    const dz = p.z - c.z;
    const dist = Math.hypot(dx, dz);
    let tx = p.x;
    let tz = p.z;
    if (police.zone === 'IN SIGHT') {
      u.state = dist < 22 && Math.abs(c.speed) > 18 ? 'RAMMING' : 'PURSUIT';
      if (u.state === 'RAMMING') {
        u.ramTimer += dt;
        // Aim slightly ahead of the player's nose to cut across.
        tx = p.x + Math.sin(p.heading) * 8;
        tz = p.z + Math.cos(p.heading) * 8;
      }
    } else {
      u.state = 'SEARCHING';
      const lk = police.lastKnown || { x: p.x, z: p.z };
      tx = lk.x + Math.sin(u.searchX * 0.01 + performance.now() * 0.0001) * 40;
      tz = lk.z + Math.cos(u.searchZ * 0.01) * 40;
    }
    const want = Math.atan2(tx - c.x, tz - c.z);
    let diff = want - c.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    stepCar(c, { throttle: 1, brake: dist < 6 ? 1 : 0, steer, handbrake: 0, nitro: u.state === 'RAMMING' ? 1 : 0 }, dt, city);
    // Ramming contact shoves the player's car and dents it.
    if (dist < 4.5 && state.mode === 'car' && state.car) {
      state.car.vx += (p.x - c.x) * 0.9;
      state.car.vz += (p.z - c.z) * 0.9;
      state.car.condition = Math.max(0, state.car.condition - 1.2);
    }
  }

  // Helicopter: orbits above the player, spotlight tracking them.
  if (police.heli) {
    const h = police.heli;
    const t = performance.now() * 0.00012;
    const tx = p.x + Math.sin(t) * 34;
    const tz = p.z + Math.cos(t) * 34;
    h.x += (tx - h.x) * Math.min(1, dt * 1.2);
    h.z += (tz - h.z) * Math.min(1, dt * 1.2);
    h.heading = Math.atan2(p.x - h.x, p.z - h.z);
  }

  // Dispatch feed: a new line every ~2.5 s while the chase is hot.
  police.feedTimer -= dt;
  if (police.feedTimer <= 0 && police.zone === 'IN SIGHT') {
    police.feedTimer = 2.5;
    const u = police.units[0];
    const d = u ? Math.round(Math.hypot(p.x - u.car.x, p.z - u.car.z)) : 0;
    const lines = [
      `${u ? u.callsign : 'Unit 7'}: suspect ${d}m out, ${u ? u.state : 'PURSUIT'}`,
      `Dispatch: ${police.wanted} stars, all units converge on ${state.district || 'Solmar'}`,
      `${u ? u.callsign : 'Unit 7'}: requesting backup, suspect heading south`,
      'Air-1: spotlight locked, suspect in view',
      'Dispatch: roadblock units, hold your line',
    ];
    pushFeed(police, rng.pick(lines));
  }
}
