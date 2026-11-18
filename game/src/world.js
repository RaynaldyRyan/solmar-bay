// The simulation: one state object every system reads and writes. step()
// advances the clock (the day rollover reads DAY_MINUTES from config.js —
// never a local copy), moves the player (car or on foot), runs traffic, the
// race, the police, combat and the mission, and fires events (pickups,
// purchases, stage completions) that main.js turns into toasts and dialogue.
import { ARCHETYPES, DAY_MINUTES, PROPERTIES, RESPRAY_COST, STEP } from './config.js';
import { RACE_ROUTE, districtAt, hitBuilding, isLand } from './city.js';
import { createCar, gearOf, kmh, nearMiss, stepCar } from './vehicles.js';
import { createPolice, setWanted, updatePolice } from './police.js';
import { JOBS, advanceStage, createMission, jobById, updateMission } from './missions.js';
import { createCombat, fireWeapon, spawnGuards, updateCombat } from './combat.js';
import { readSave } from './save.js';

export const RESPRAY_AT = [675, -160];
export const DEALER_AT = [-700, 60];
export const WEAPON_PRICES = [0, 800, 1500, 2600, 4200];

// Traffic loops: waypoint routes the ambient cars follow forever.
const TRAFFIC_ROUTES = [
  [[700, -600], [700, 600], [600, 600], [600, -600]],
  [[-380, -200], [-380, 160], [-20, 160], [-20, -200]],
  [[300, -295], [560, -295], [700, -295], [700, 210], [560, 210], [300, 210]],
  [[-940, -140], [-460, -140], [-460, 220], [-940, 220]],
  [[-360, 260], [240, 260], [240, 620], [-360, 620]],
];

export function createWorld(rng, city) {
  const save = readSave();
  const state = {
    time: { day: save.day, minutes: save.minutes },
    cash: save.cash,
    respect: save.respect,
    health: 100,
    armor: 50,
    tapesFound: new Set(save.tapesFound || []),
    properties: [...(save.properties || ['safehouse'])],
    weapons: [...(save.weapons || [0, 1])],
    weapon: save.weapon ?? 1,
    radio: { station: save.station || 0, track: 0 },
    mode: 'car',
    player: { x: 700, z: -200, heading: 0, aim: 0 },
    car: null,
    carName: 'Comet GT',
    traffic: [],
    rivals: [],
    police: createPolice(),
    combat: createCombat(),
    mission: createMission(save),
    jobs: JOBS,
    race: null,
    district: 'Art Deco Strip',
    driftScore: 0,
    driftBank: 0,
    boosting: false,
    events: [],
    clockRate: 1,
    beaconOff: false,
    nearMissCooldown: 0,
  };

  state.car = createCar('coupe', 700, -200, 0);
  state.car.color = 0xe91e8c;

  // Traffic: 10 cars spread over the loops.
  const types = ['sedan', 'taxi', 'pickup', 'van', 'convertible'];
  for (let i = 0; i < 10; i += 1) {
    const route = TRAFFIC_ROUTES[i % TRAFFIC_ROUTES.length];
    const wp = route[i % route.length];
    const car = createCar(types[i % types.length], wp[0] + rng.range(-4, 4), wp[1] + rng.range(-4, 4), rng.range(0, Math.PI * 2));
    car.route = route;
    car.wp = (i + 1) % route.length;
    state.traffic.push(car);
  }

  function event(text) {
    state.events.push(text);
  }

  function takeEvents() {
    const e = state.events;
    state.events = [];
    return e;
  }

  function startRace() {
    const route = RACE_ROUTE;
    state.race = {
      route, checkpoint: 0, lap: 1, pos: 1, time: 0,
      next: route[0], rivals: [],
    };
    state.rivals = [
      createCar('convertible', 694, -540, 0),
      createCar('coupe', 706, -545, 0),
    ];
    state.rivals[0].route = route;
    state.rivals[0].wp = 1;
    state.rivals[1].route = route;
    state.rivals[1].wp = 1;
    state.rivals[0].color = 0x4cc9f0;
    state.rivals[1].color = 0xff9f1c;
    event('Side job: Ocean Drive GP — 2 laps, 3 cars, $2,500 to the winner');
  }

  function stepTraffic(dt) {
    for (const c of state.traffic) {
      const wp = c.route[c.wp];
      const dx = wp[0] - c.x;
      const dz = wp[1] - c.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 12) {
        c.wp = (c.wp + 1) % c.route.length;
        continue;
      }
      const want = Math.atan2(dx, dz);
      let diff = want - c.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      stepCar(c, { throttle: 1, brake: 0, steer: Math.max(-1, Math.min(1, diff * 2)), handbrake: 0, nitro: 0 }, dt, city);
      if (Math.abs(c.speed) > 16) c.speed = 16; // traffic keeps to the limit
    }
  }

  function stepRivals(dt) {
    for (const c of state.rivals) {
      const wp = c.route[c.wp];
      const dx = wp[0] - c.x;
      const dz = wp[1] - c.z;
      if (Math.hypot(dx, dz) < 14) {
        c.wp = (c.wp + 1) % c.route.length;
        continue;
      }
      const want = Math.atan2(dx, dz);
      let diff = want - c.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      stepCar(c, { throttle: 1, brake: 0, steer: Math.max(-1, Math.min(1, diff * 2.4)), handbrake: 0, nitro: 0 }, dt, city);
    }
  }

  function stepRace(dt) {
    const r = state.race;
    if (!r) return;
    r.time += dt;
    const p = state.player;
    const next = r.route[r.checkpoint];
    r.next = next;
    if (Math.hypot(p.x - next[0], p.z - next[1]) < 16) {
      r.checkpoint += 1;
      if (r.checkpoint >= r.route.length) {
        r.checkpoint = 0;
        r.lap += 1;
        if (r.lap > 2) {
          state.cash += 2500;
          state.respect = Math.min(100, state.respect + 8);
          event('Race won — $2,500 and +8 respect');
          state.race = null;
          state.rivals = [];
          return;
        }
        event(`Lap ${r.lap}/2`);
      }
    }
    // Position: who has covered more of the route.
    const progress = (car) => {
      const w = car.route ? car.wp : 0;
      return w;
    };
    let pos = 1;
    for (const rv of state.rivals) {
      const myProg = r.checkpoint + (r.lap - 1) * r.route.length;
      const rvProg = rv.wp + 0; // rivals run the same loop from the start
      if (rvProg > myProg) pos += 1;
    }
    r.pos = pos;
  }

  function stepPlayer(dt, input, now) {
    const p = state.player;
    if (state.mode === 'car' && state.car) {
      const c = state.car;
      const d = input.drive ? input.drive() : input;
      state.carName = ARCHETYPES[c.type].name;
      state.boosting = d.nitro === 1 && c.nitro > 0 && d.throttle === 1;
      stepCar(c, d, dt, city);
      p.x = c.x;
      p.z = c.z;
      p.heading = c.heading;
      // Drift score banks into respect.
      if (c.driftScore > 0) {
        state.driftScore += c.driftScore; // the chain total, not one step
        state.driftBank += c.driftScore;
        c.driftScore = 0;
        if (state.driftBank >= 500) {
          state.driftBank -= 500;
          state.respect = Math.min(100, state.respect + 1);
          event('Drift style +1 respect');
        }
      } else {
        state.driftScore = Math.max(0, state.driftScore - dt * 120);
      }
      // Near-miss vs traffic.
      state.nearMissCooldown -= dt;
      for (const t of state.traffic) {
        if (state.nearMissCooldown <= 0 && nearMiss(c, t)) {
          state.nearMissCooldown = 2;
          state.respect = Math.min(100, state.respect + 1);
          event('Near miss +1 respect');
        }
      }
    } else {
      // On foot: walk in camera space, collide with buildings and water.
      const w = input.walk ? input.walk() : { forward: 0, strafe: 0, sprint: 0 };
      const speed = w.sprint ? 9 : 5.5;
      const fx = Math.sin(p.heading);
      const fz = Math.cos(p.heading);
      const rx = Math.cos(p.heading);
      const rz = -Math.sin(p.heading);
      let nx = p.x + (fx * w.forward + rx * w.strafe) * speed * dt;
      let nz = p.z + (fz * w.forward + rz * w.strafe) * speed * dt;
      if (!hitBuilding(city, nx, nz, 0.8) && isLand(nx, nz)) {
        p.x = nx;
        p.z = nz;
      }
      p.aim = input.aimAngle !== undefined ? input.aimAngle : p.aim;
      p.heading = p.aim;
      if (input.firing) {
        fireWeapon(state.combat, p, p.aim, state.weapon, rng, now);
      }
    }
  }

  function interact() {
    const p = state.player;
    if (state.mode === 'car') {
      // Exit the car: step out to its left side.
      state.mode = 'foot';
      p.x = state.car.x - Math.cos(state.car.heading) * 3;
      p.z = state.car.z + Math.sin(state.car.heading) * 3;
      p.heading = state.car.heading;
      event('On foot — F to get back in');
      return;
    }
    // On foot: nearest interaction wins — car, dealer, property, safehouse.
    if (state.car && Math.hypot(p.x - state.car.x, p.z - state.car.z) < 6) {
      state.mode = 'car';
      event('Back behind the wheel');
      return;
    }
    const dDealer = Math.hypot(p.x - DEALER_AT[0], p.z - DEALER_AT[1]);
    if (dDealer < 12) {
      const next = [0, 1, 2, 3, 4].find((i) => !state.weapons.includes(i));
      if (next === undefined) {
        event('Dealer: you own every weapon');
      } else if (state.cash >= WEAPON_PRICES[next]) {
        state.cash -= WEAPON_PRICES[next];
        state.weapons.push(next);
        state.weapon = next;
        event(`Dealer: bought ${['Pistol', 'SMG', 'Shotgun', 'Rifle', 'Sniper'][next]} for $${WEAPON_PRICES[next]}`);
      } else {
        event(`Dealer: need $${WEAPON_PRICES[next]} for the next weapon`);
      }
      return;
    }
    for (const prop of PROPERTIES) {
      const d = Math.hypot(p.x - prop.at[0], p.z - prop.at[1]);
      if (d < 14) {
        if (prop.id === 'safehouse') {
          event('Game saved at the Neon Palms safehouse');
          return;
        }
        if (state.properties.includes(prop.id)) {
          event(`${prop.name}: yours — $${prop.income}/day`);
          return;
        }
        if (state.cash >= prop.price) {
          state.cash -= prop.price;
          state.properties.push(prop.id);
          event(`Bought ${prop.name} — $${prop.income}/day income`);
        } else {
          event(`${prop.name}: $${prop.price} — you have $${state.cash}`);
        }
        return;
      }
    }
    event('Nothing to interact with here');
  }

  function step(dt, input, now) {
    // Clock: 1 game minute per real second (faster in shots via clockRate).
    state.time.minutes += dt * state.clockRate;
    if (state.time.minutes >= DAY_MINUTES) {
      state.time.minutes -= DAY_MINUTES;
      state.time.day += 1;
      const income = PROPERTIES.filter((pr) => state.properties.includes(pr.id)).reduce((n, pr) => n + pr.income, 0);
      if (income > 0) {
        state.cash += income;
        event(`Day ${state.time.day} — property income $${income}`);
      }
    }
    const d = districtAt(state.player.x, state.player.z);
    state.district = d ? d.name : 'Solmar Bay';

    stepPlayer(dt, input, now);
    stepTraffic(dt);
    if (state.race) {
      stepRivals(dt);
      stepRace(dt);
    }
    updatePolice(state.police, state, dt, city, rng);
    updateCombat(state.combat, state, dt, rng, now);
    updateMission(state.mission, state, dt);

    // Tape pickup.
    for (const t of city.tapes) {
      if (state.tapesFound.has(t.id)) continue;
      if (Math.hypot(state.player.x - t.x, state.player.z - t.z) < 4) {
        state.tapesFound.add(t.id);
        state.respect = Math.min(100, state.respect + 2);
        event(`Sunset Tape ${state.tapesFound.size}/20 — +2 respect`);
      }
    }

    // Respray garage: drive in with heat and $500 to clear it.
    if (state.mode === 'car' && Math.hypot(state.player.x - RESPRAY_AT[0], state.player.z - RESPRAY_AT[1]) < 12) {
      if (state.police.wanted > 0 && state.cash >= RESPRAY_COST) {
        state.cash -= RESPRAY_COST;
        setWanted(state.police, 0, state);
        state.car.condition = 100;
        event('Respray: heat cleared, car restored — $500');
        if (state.mission.active && state.mission.active.id === 'ch4' && state.mission.stage === 3) {
          advanceStage(state.mission, state);
          event('CH4 complete — $8,500 banked');
        }
      }
    }

    // Mission triggers.
    const m = state.mission;
    if (m.active) {
      const at = m.active.at;
      const dist = Math.hypot(state.player.x - at[0], state.player.z - at[1]);
      if (m.active.id === 'ch4' && m.stage === 1) {
        // Stage 2 (index 1): hold off the guards — done when all are down.
        if (state.combat.guards.length > 0 && state.combat.guards.every((g) => !g.alive)) {
          advanceStage(m, state);
          event('Harbor Boys down — take the coupe and run');
        }
      } else if (dist < 20 && m.stage === 0) {
        advanceStage(m, state);
        event(`Stage ${m.stage + 1}: ${m.active.stages[m.stage]}`);
      }
    }
  }

  function reset() {
    state.time.day = save.day;
    state.time.minutes = save.minutes;
    state.cash = save.cash;
    state.respect = save.respect;
    state.health = 100;
    state.armor = 50;
    state.mode = 'car';
    state.car = createCar('coupe', 700, -200, 0);
    state.player.x = 700;
    state.player.z = -200;
    state.player.heading = 0;
    state.police = createPolice();
    state.combat = createCombat();
    state.race = null;
    state.rivals = [];
    state.beaconOff = false;
  }

  return {
    state, city, step, reset, takeEvents, interact, startRace,
    spawnGuardsAt(spots, count) {
      spawnGuards(state.combat, spots, count);
    },
  };
}
