// The 4 screenshot scenes behind ?shot=cover|marina|race|map (with &seed=N).
// Each one stages a REAL game state — a live chase, a live firefight, a live
// race, the real map screen — then runs the simulation forward with scripted
// inputs so the frame is what playing really looks like. A finalize hook runs
// after the last step (to pin the wanted zone and the dispatch feed) and
// before the capture frame is painted.
import { createCar } from './vehicles.js';
import { setWanted } from './police.js';

function placeCop(police, x, z, speed) {
  const car = createCar('cruiser', x, z, 0);
  car.speed = speed;
  car.vx = Math.sin(0) * speed;
  car.vz = Math.cos(0) * speed;
  police.units.push({ car, state: 'PURSUIT', callsign: 'Unit 7', ramTimer: 0, searchX: x, searchZ: z });
  return car;
}

export function stageShot(name, world, hud) {
  const s = world.state;
  s.clockRate = 0; // freeze the clock: the shot's time of day stays exact
  world.reset();
  s.clockRate = 0;
  // NB: reset() replaces the police object — capture it AFTER the reset.
  const p = s.police;

  if (name === 'marina') {
    // Shot 2: on-foot marina combat at dusk, 19:45. Earlier in the story
    // than the chase (stage 2, before stage 3), so the bank, the respect
    // and the radio all sit one step behind the cover's state.
    s.time.day = 6;
    s.time.minutes = 19 * 60 + 45;
    s.mode = 'foot';
    s.player.x = 690;
    s.player.z = 400;
    s.player.heading = 0.5;
    s.player.aim = 0.5;
    s.car = createCar('coupe', 685, 425, 2.6);
    s.car.color = 0xe91e8c;
    s.health = 82;
    s.armor = 35;
    s.cash = 38940;
    s.respect = 58;
    s.radio = { station: 1, track: 0 }; // SOLMAR LATIN 101.2 — Calle Fuego
    s.weapon = 1; // SMG
    s.mission.stage = 1;
    s.mission.timer = 180;
    s.mission.subStatus = 'Guards inbound — hold the slip';
    s.beaconOff = true; // the job marker sits on the combat spot: the
    // 120 m beacon pillar would fill the frame like a yellow wall
    world.spawnGuardsAt([[700, 415], [696, 428], [704, 412]], 3);
    // The middle guard is already hurt: he renders mid-stagger, so the
    // firefight reads as hits landing. (He is off the player's aim line,
    // so the scripted autofire can't finish him before the capture.)
    s.combat.guards[1].health = 40;
    setWanted(p, 1, s);
    return {
      screen: 'play', steps: 40, autoFire: true,
      finalize() {
        p.zone = 'COOLDOWN';
        p.seenTimer = 3;
        p.units = [];
        p.heli = null;
        p.frozen = true; // hold the staged zone + feed through the paint frames
        p.dispatch = [
          'Dispatch: 1 star, suspect last seen Marina Bay',
          'Unit 23: sweeping the docks, no visual',
          'Dispatch: all units, hold the perimeter',
        ];
        hud.setDialogue('vera', 'Vera Solano', 'Hold them off, Maya — the coupe is by the slip, ready to run.');
        // Guarantee the firefight is visible in the capture frame: a fresh
        // player muzzle flash + tracer and a guard's return fire, with
        // long lives so they survive the paint frames.
        const now = performance.now();
        s.combat.flashes.push({ x: s.player.x, z: s.player.z, angle: s.player.aim, until: now + 5000, weapon: 1 });
        s.combat.tracers.push({ x0: s.player.x, z0: s.player.z, x1: 700, z1: 415, life: 5 });
        s.combat.tracers.push({ x0: 696, z0: 428, x1: s.player.x, z1: s.player.z, life: 5 });
        s.combat.flashes.push({ x: 696, z: 428, angle: Math.atan2(s.player.x - 696, s.player.z - 428), until: now + 5000, weapon: 1 });
      },
    };
  }

  if (name === 'race') {
    // Shot 3: midday street race on the Strip, 13:20, mid-drift. A side
    // job from earlier in the day, so the bank and respect sit below the
    // evening heist's state and the radio is on the jazz station.
    s.time.day = 6;
    s.time.minutes = 13 * 60 + 20;
    s.mode = 'car';
    s.car = createCar('convertible', 700, -260, 0);
    s.car.color = 0xffd166;
    s.car.speed = 30;
    s.car.vx = 0;
    s.car.vz = 30;
    s.player.x = 700;
    s.player.z = -260;
    s.player.heading = 0;
    s.cash = 36850;
    s.respect = 55;
    s.radio = { station: 2, track: 0 }; // MIDNIGHT JAZZ 99.9 — Blue Hour
    s.weapon = 1;
    s.mission.active = null;
    world.startRace();
    s.race.checkpoint = 1;
    s.race.lap = 2;
    s.race.pos = 1;
    s.race.time = 74;
    s.rivals[0].x = 693;
    s.rivals[0].z = -232;
    s.rivals[0].heading = 0;
    s.rivals[0].speed = 29;
    s.rivals[0].vz = 29;
    s.rivals[1].x = 707;
    s.rivals[1].z = -244;
    s.rivals[1].heading = 0;
    s.rivals[1].speed = 28;
    s.rivals[1].vz = 28;
    setWanted(p, 0, s);
    return {
      screen: 'play', steps: 48,
      drive: { throttle: 1, brake: 0, steer: 0.85, handbrake: 1, nitro: 0 },
      finalize() {
        s.race.pos = 1;
        s.race.lap = 2;
      },
    };
  }

  if (name === 'map') {
    // Shot 4: the full-screen city map.
    s.time.day = 6;
    s.time.minutes = 18 * 60 + 50;
    s.mode = 'car';
    s.car = createCar('coupe', 700, -200, 0);
    s.player.x = 700;
    s.player.z = -200;
    s.player.heading = 0;
    setWanted(p, 0, s);
    return {
      screen: 'play', steps: 5, openMap: true,
      finalize() {
        hud.openMap(s);
      },
    };
  }

  // Shot 1 (cover, default): coastal police chase at sunset, 18:50.
  s.time.day = 6;
  s.time.minutes = 18 * 60 + 50;
  s.mode = 'car';
  s.car = createCar('coupe', 700, -100, 0);
  s.car.color = 0xe91e8c;
  s.car.speed = 42;
  s.car.vx = 0;
  s.car.vz = 42;
  s.player.x = 700;
  s.player.z = -100;
  s.player.heading = 0;
  s.cash = 42310;
  s.respect = 62;
  s.radio = { station: 0, track: 0 }; // NEON FM 88.5 — Midnight Overdrive
  s.weapon = 1;
  s.mission.stage = 2;
  s.mission.timer = 192;
  s.mission.subStatus = 'Lose the tail, reach the respray';
  // Traffic ahead on Ocean Drive: the chase weaves through it instead of
  // running down an empty road. (Route-1 cars, so their waypoints keep
  // them driving south with the chase.)
  s.traffic[0].x = 697;
  s.traffic[0].z = -55;
  s.traffic[0].heading = 0;
  s.traffic[0].speed = 13;
  s.traffic[0].vx = 0;
  s.traffic[0].vz = 13;
  s.traffic[5].x = 705;
  s.traffic[5].z = -30;
  s.traffic[5].heading = 0;
  s.traffic[5].speed = 14;
  s.traffic[5].vx = 0;
  s.traffic[5].vz = 14;
  setWanted(p, 4, s);
  p.zone = 'IN SIGHT';
  p.lastKnown = { x: 700, z: -100 };
  placeCop(p, 693, -90, 40);
  placeCop(p, 707, -92, 40);
  placeCop(p, 698, -132, 41);
  placeCop(p, 703, -146, 41);
  p.units[0].callsign = 'Unit 7';
  p.units[1].callsign = 'Unit 12';
  p.units[2].callsign = 'Unit 23';
  p.units[3].callsign = 'Unit 31';
  p.heli = { x: 742, z: -62, y: 55, heading: 0, spotlight: true };
  p.roadblock = [
    { x: 694, z: -10, heading: 0.6, car: createCar('cruiser', 694, -10, 0.6) },
    { x: 706, z: -10, heading: -0.6, car: createCar('cruiser', 706, -10, -0.6) },
  ];
  p.dispatch = [
    'Unit 7: suspect 34m out, PURSUIT',
    'Dispatch: 4 stars, all units converge on Art Deco Strip',
    'Air-1: eyes on suspect, spotlight on',
    'Unit 12: requesting backup, suspect heading south',
  ];
  p.blockTimer = 20;
  return {
    screen: 'play', steps: 90,
    drive: { throttle: 1, brake: 0, steer: 0, handbrake: 0, nitro: 0 },
    finalize() {
      p.zone = 'IN SIGHT';
      p.wanted = 4;
      // Park the helicopter ahead-left of the chase so its body is in frame
      // (it orbits too close to the player to be seen otherwise).
      if (p.heli) {
        p.heli.x = 735;
        p.heli.z = 120;
        p.heli.y = 35;
      }
    },
  };
}
