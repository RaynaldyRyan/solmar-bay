// Solmar Bay: Neon Tide — an original open-world crime game (Three.js, no
// network, no assets: every texture is drawn at boot from the city plan).
//
// ARCHITECTURE — what each module owns, and what the player sees from it:
//   config.js    constants + tables: DAY_MINUTES, districts, 6 vehicle
//                archetypes, 5 weapons, 3 radio stations, wanted levels.
//   random.js    the one seeded RNG stream; ?seed=N replays the same city.
//   city.js      the plan: mainland + barrier island + port peninsula, 2
//                causeways, 7 districts, buildings, palms, neon signs, 20
//                Sunset Tapes, a diagonal boulevard + beachfront promenade;
//                drawPlan() renders the ground texture, the minimap and the
//                full map from the same data.
//   vehicles.js  arcade car physics (accel, steering, drift, nitro) and
//                building/water collision; the speedometer + gear read it.
//   police.js    wanted 0-5, cruiser AI (PURSUIT/RAMMING/ROADBLOCK/SEARCHING),
//                the helicopter + spotlight, and the dispatch feed.
//   missions.js  the 7 story jobs (objectives, payouts, respect, stages);
//                the mission card reads the active job's stage + timer.
//   combat.js    on-foot shooting: 5 weapons, guards, muzzle flashes,
//                tracers; the hotbar shows the owned weapons.
//   radio.js     3 Web Audio stations, synthesized live (no audio files);
//                the radio widget shows station + track.
//   portraits.js 6 canvas-drawn characters for the start screen + dialogue.
//   render3d.js  the Three.js scene: merged buildings/palms, lit window
//                grids, street dressing (lamps, parked cars, umbrellas,
//                marina crates/boats/floodlights), sky keyframes by time of
//                day, cars (wheels, lights, windshield, driver), heli,
//                box tracers, layered muzzle flash, drift smoke, beacon,
//                race gate.
//   hud.js       every DOM panel: mission card, dispatch feed (race
//                leaderboard during a race, hidden when empty), clock/cash/
//                stars/zone, hotbar, radio, speedometer, circular minimap
//                (player + police cones, search ring), vitals, dialogue,
//                and the full-screen map (M) with jobs, legend, GPS route
//                and service icons (respray, weapons, safehouse, race).
//   world.js     the simulation: clock, player, traffic, race, pickups,
//                respray/dealer/property interactions, mission triggers.
//   shots.js     the 4 screenshot scenes: real game states, staged then
//                simulated forward with scripted inputs (?shot=cover|
//                marina|race|map, &seed=N), ending in window.__shotReady.
//
// The loop: input is read every frame, the world advances in fixed 1/60 s
// steps, the renderer paints the scene and the HUD updates from the state.
// Screens: title (orbiting camera + save details + portraits), play, paused
// (controls list), map overlay, game over. No keybind cheat-sheet on the HUD.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { buildCity } from './city.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_MAP, ACTION_PAUSE, ACTION_RADIO, createInput } from './input.js';
import { createRenderer } from './render3d.js';
import { createHud } from './hud.js';
import { createRadio } from './radio.js';
import { stageShot } from './shots.js';
import { writeSave } from './save.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = createRandom(seed);
const city = buildCity(rng);
const world = createWorld(rng, city);
const state = world.state;
const renderer = createRenderer(canvas, city);
const hud = createHud(city);
const radio = createRadio();

const hudEl = document.getElementById('hud');
const startEl = document.getElementById('start-screen');
const pauseEl = document.getElementById('pause-screen');
const overEl = document.getElementById('over-screen');

function announce(message) {
  status.textContent = message;
}

function snapshotSave() {
  return {
    day: state.time.day,
    minutes: Math.floor(state.time.minutes),
    cash: state.cash,
    respect: state.respect,
    tapes: state.tapesFound.size,
    tapesFound: [...state.tapesFound],
    properties: state.properties,
    jobsDone: [...state.mission.done],
    jobActive: state.mission.active ? state.mission.active.id : null,
    jobStage: state.mission.stage,
    weapons: state.weapons,
    weapon: state.weapon,
    station: radio.station,
  };
}

function runShot(name) {
  const staged = stageShot(name, world, hud);
  startEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  const input = { ...(staged.drive || {}), firing: !!staged.autoFire, aimAngle: state.player.aim };
  for (let i = 0; i < staged.steps; i += 1) {
    world.step(STEP, input, performance.now());
  }
  if (staged.finalize) staged.finalize();
  let painted = 0;
  function paint() {
    // Keep stepping while painting so muzzle flashes and the chase stay live
    // in the capture frame.
    world.step(STEP, input, performance.now());
    renderer.draw(state, STEP, staged.screen, performance.now());
    hud.update(state, STEP);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = 'title';
  let accumulator = 0;
  let last = performance.now();
  hud.buildStartScreen({
    day: state.time.day,
    minutes: state.time.minutes,
    cash: state.cash,
    respect: state.respect,
    tapes: state.tapesFound.size,
    properties: state.properties,
    jobActive: state.mission.active ? state.mission.active.id : null,
  });

  function startGame() {
    screen = 'play';
    startEl.classList.add('hidden');
    overEl.classList.add('hidden');
    hudEl.classList.remove('hidden');
    radio.start();
    announce('Playing. Chapter 4, The Marina Exchange.');
  }

  function endGame() {
    screen = 'over';
    overEl.classList.remove('hidden');
    announce('Wasted. Press Enter to try again.');
  }

  function handleActions() {
    const actions = input.takeActions();
    const slot = input.takeWeaponSlot();
    if (slot >= 0 && state.weapons.includes(slot)) {
      state.weapon = slot;
    }
    if (actions & ACTION_CONFIRM) {
      if (screen === 'title') startGame();
      else if (screen === 'over') {
        world.reset();
        startGame();
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === 'play') {
        screen = 'paused';
        pauseEl.classList.remove('hidden');
        announce('Paused.');
      } else if (screen === 'paused') {
        screen = 'play';
        pauseEl.classList.add('hidden');
        announce('Playing.');
      }
    }
    if (actions & ACTION_MAP && screen === 'play') {
      if (hud.isMapOpen()) hud.closeMap();
      else hud.openMap(state);
    }
    if (actions & ACTION_ENTER_CAR && screen === 'play') {
      world.interact();
      for (const e of world.takeEvents()) {
        hud.toast(e);
        if (e.startsWith('Game saved')) writeSave(snapshotSave());
      }
    }
    if (actions & ACTION_RADIO && screen === 'play') {
      const name = radio.nextStation();
      state.radio.station = radio.station;
      state.radio.track = radio.track;
      hud.toast(`Radio: ${name}`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    const liveInput = {
      drive: () => input.drive(),
      walk: () => input.walk(),
      firing: input.firing,
      aimAngle: state.player.aim,
    };
    // On foot, the player aims at the mouse: unproject it onto the ground.
    if (state.mode === 'foot' && screen === 'play') {
      const hit = renderer.screenToGround(input.mouse.x, input.mouse.y);
      if (hit) liveInput.aimAngle = Math.atan2(hit.x - state.player.x, hit.z - state.player.z);
    }
    if (screen === 'title' || screen === 'play') {
      while (accumulator >= STEP) {
        world.step(STEP, screen === 'title' ? {} : liveInput, now);
        accumulator -= STEP;
        if (state.health <= 0 && screen === 'play') {
          endGame();
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    for (const e of world.takeEvents()) hud.toast(e);
    renderer.draw(state, STEP, screen, now);
    if (screen !== 'title') hud.update(state, STEP);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      pauseEl.classList.remove('hidden');
      announce('Paused.');
    }
  });

  announce('Solmar Bay: Neon Tide. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
