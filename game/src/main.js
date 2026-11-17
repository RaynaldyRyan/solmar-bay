// Solmar Bay: Neon Tide — bootstrap and game loop. Wires the city, sky,
// traffic, police, missions, combat and HUD together; runs the camera,
// the start/pause/busted/wasted flows, and the deterministic shot staging.
import { makeRng, seedFromUrl, shotFromUrl } from './random.js';
import { CFG, CAR_ARCHETYPES } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { createDayCycle } from './daycycle.js';
import { createSky } from './sky.js';
import { buildCity } from './city.js';
import { createCar } from './vehicles.js';
import { createPlayer } from './player.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createEffects } from './effects.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { applyShot } from './shots.js';

const shotName = shotFromUrl();
const rng = makeRng(seedFromUrl());

// --- renderer (visual quality: AA, soft shadows, ACES tone mapping, sRGB) ---
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputEncoding = THREE.sRGBEncoding;
document.getElementById('game-container').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x8a5a7d, 0.0016);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(-40, 30, 80);

// --- lights ---
const sun = new THREE.DirectionalLight(0xff8a5c, 2.0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -280; sun.shadow.camera.right = 280;
sun.shadow.camera.top = 280; sun.shadow.camera.bottom = -280;
sun.shadow.camera.near = 10; sun.shadow.camera.far = 900;
sun.shadow.bias = -0.0006;
scene.add(sun);
scene.add(sun.target);
const hemi = new THREE.HemisphereLight(0x8a7fd8, 0x3a2a3a, 0.75);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0x604a6a, 0.35);
scene.add(ambient);

// --- systems ---
const input = createInput(renderer.domElement);
const audio = createAudio();
const dayCycle = createDayCycle();
const sky = createSky(scene, rng);
const city = buildCity(scene, rng);
const effects = createEffects(scene);
const traffic = createTraffic(scene, city, rng);
const pedestrians = createPedestrians(scene, city, rng);
const police = createPolice(scene, city, rng, effects);
const combat = createCombat(scene, city, effects, audio);
const player = createPlayer(scene, 26, 44);
player.angle = Math.PI;

const world = {
  player, police, combat, dayCycle, audio,
  missions: null, hud: null, traffic, pedestrians, city,
  onMissionComplete(index) {
    writeSave({ money: player.money, mission: index, health: player.health, hour: dayCycle.hour, x: player.pos.x, z: player.pos.z });
  },
  spawnMissionCar(arch, x, z) {
    const car = createCar(scene, arch, CAR_ARCHETYPES[arch].colors[0], x, z, 0, false);
    freeCars.push(car);
    return car;
  },
  spawnParkedCar(arch, color, x, z, angle) {
    const car = createCar(scene, arch, color, x, z, angle, false);
    freeCars.push(car);
    return car;
  },
};
const missions = createMissions(scene, city, world);
world.missions = missions;
const hud = createHud(world);
world.hud = hud;

// --- parked cars to steal ---
const freeCars = [];
const PARKED = [
  // parked at the road edge (+/-5.5 from the road center), clear of traffic lanes
  ['sedan', 0x90a4ae, 52, 5.5, Math.PI / 2], ['coupe', 0xe040fb, -52, -5.5, -Math.PI / 2],
  ['pickup', 0xef6c00, 5.5, 104, 0], ['sport', 0x00e5ff, 213.5, 104, 0],
  ['comet', 0xffd23f, 57.5, 0, 0], ['van', 0xfff3e0, -104, 5.5, Math.PI / 2],
  ['sedan', 0x37474f, 156, -5.5, -Math.PI / 2], ['coupe', 0xffffff, -5.5, -156, Math.PI],
  ['sport', 0xff1744, 213.5, -104, 0], ['pickup', 0x33691e, 104, 161.5, Math.PI / 2],
];
for (const [arch, color, x, z, a] of PARKED) {
  freeCars.push(createCar(scene, arch, color, x, z, a, false));
}

// --- state ---
let state = 'menu'; // menu | playing | paused | busted | wasted
let camYaw = Math.PI, camPitch = 0.3, menuAngle = 2.6;
let gameTime = 0, smokeTimer = 0;
const saved = loadSave();

window.__solmar = { time: 0, ready: false, shot: shotName, state: 'menu' };

function nearestCar(maxDist) {
  let best = null, bd = maxDist * maxDist;
  const consider = (car, occupied) => {
    const dx = car.pos.x - player.pos.x, dz = car.pos.z - player.pos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bd) { bd = d2; best = { car, occupied }; }
  };
  for (const c of freeCars) consider(c, false);
  for (const c of traffic.cars) consider(c, true);
  return best;
}

function tryEnterCar() {
  const found = nearestCar(4.5);
  if (!found) return;
  const { car, occupied } = found;
  const fi = freeCars.indexOf(car);
  if (fi !== -1) freeCars.splice(fi, 1);
  const ti = traffic.cars.indexOf(car);
  if (ti !== -1) {
    traffic.cars.splice(ti, 1);
    if (occupied) {
      police.addWanted(1);
      pedestrians.scare(player.pos.x, player.pos.z, 20);
      hud.message('Car stolen! +1 wanted star');
    }
  }
  player.enterCar(car);
  audio.blip(440);
}

function exitCar() {
  const car = player.car;
  player.exitCar();
  if (car) freeCars.push(car);
}

function tryGarage() {
  const g = city.landmarks.garage;
  const dx = player.pos.x - g.x, dz = player.pos.z - g.z;
  if (dx * dx + dz * dz > 20 * 20) return;
  if (!player.isDriving()) { hud.message('Drive in to use Spray & Save'); return; }
  if (player.money < CFG.GARAGE_COST) { hud.message('Spray & Save costs $150'); return; }
  player.money -= CFG.GARAGE_COST;
  player.car.health = 100;
  police.clearWanted();
  hud.flash('Spray & Save — wanted cleared, car repaired');
  audio.blip(770);
  writeSave({ money: player.money, mission: missions.state.index, health: player.health, hour: dayCycle.hour, x: player.pos.x, z: player.pos.z });
}

function startGame(fromSave) {
  if (fromSave && saved) {
    player.money = saved.money || 200;
    player.health = saved.health || 100;
    missions.state.index = saved.mission || 0;
    dayCycle.hour = saved.hour || CFG.DAY_START_HOUR;
    player.pos.set(saved.x || 26, 0, saved.z || 44);
  }
  audio.start();
  hud.hideStart();
  state = 'playing';
  window.__solmar.state = 'playing';
  if (!fromSave) {
    hud.showMissionCard('Solmar Bay: Neon Tide', 'Milo Vane came home broke. Press M to start the story — or steal a car and make the bay yours.');
    hud.setObjective('Press M for the next job · C for courier');
  } else {
    hud.setObjective('Press M to continue the story');
  }
}

function onBusted() {
  if (state !== 'playing') return;
  state = 'busted';
  window.__solmar.state = 'busted';
  const fine = Math.min(player.money, 100);
  player.money -= fine;
  if (player.isDriving()) exitCar();
  police.clearWanted();
  hud.showBusted();
}
function onWasted() {
  if (state !== 'playing') return;
  state = 'wasted';
  window.__solmar.state = 'wasted';
  const fine = Math.min(player.money, 50);
  player.money -= fine;
  if (player.isDriving()) exitCar();
  police.clearWanted();
  hud.showWasted();
}
function respawn() {
  player.health = 100;
  player.pos.set(26, 0, 44);
  player.angle = Math.PI;
  camYaw = Math.PI;
  hud.hideBusted();
  hud.hideWasted();
  state = 'playing';
  window.__solmar.state = 'playing';
}

document.getElementById('btn-new').addEventListener('click', () => { clearSave(); startGame(false); });
document.getElementById('btn-continue').addEventListener('click', () => startGame(true));
document.getElementById('btn-resume').addEventListener('click', () => { state = 'playing'; hud.hidePause(); });
document.getElementById('btn-restart').addEventListener('click', () => { hud.hidePause(); respawn(); });
document.getElementById('btn-busted-ok').addEventListener('click', respawn);
document.getElementById('btn-wasted-ok').addEventListener('click', respawn);

// --- shot staging: skip the menu for gameplay shots ---
if (shotName && shotName !== 'menu') {
  hud.hideStart();
  state = 'playing';
  window.__solmar.state = 'playing';
  applyShot(shotName, world);
  camYaw = player.heading();
} else {
  hud.showStart(!!saved);
}

// --- camera ---
function updateCamera(dt) {
  if (state === 'menu') {
    menuAngle += dt * 0.02;
    const cx = Math.cos(menuAngle) * 250, cz = Math.sin(menuAngle) * 250;
    camera.position.set(cx, 95, cz);
    camera.lookAt(60, 12, 0);
    return;
  }
  const m = input.takeMouse();
  camYaw -= m.x * 0.0032;
  camPitch = Math.max(0.08, Math.min(0.9, camPitch + m.y * 0.0022));
  // ease the camera behind the car while driving
  if (player.isDriving()) {
    let d = player.car.angle - camYaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    camYaw += d * Math.min(1, dt * 1.6);
  }
  const dist = player.isDriving() ? 10.5 : 8.5;
  const tx = player.pos.x, ty = player.pos.y + 2, tz = player.pos.z;
  const cx = tx - Math.sin(camYaw) * Math.cos(camPitch) * dist;
  const cz = tz - Math.cos(camYaw) * Math.cos(camPitch) * dist;
  const cy = ty + Math.sin(camPitch) * dist + 1.2;
  camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 7);
  camera.position.y += (Math.max(cy, 1.6) - camera.position.y) * Math.min(1, dt * 7);
  camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 7);
  camera.lookAt(tx, ty, tz);
}

// --- main loop ---
const clock = new THREE.Clock();
let firstFrame = true;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  gameTime += dt;
  window.__solmar.time = gameTime;
  window.__solmar.player = { x: +player.pos.x.toFixed(1), z: +player.pos.z.toFixed(1), driving: player.isDriving(), speed: +(player.speed() * 3.6).toFixed(0) };
  window.__solmar.camera = { x: +camera.position.x.toFixed(1), y: +camera.position.y.toFixed(1), z: +camera.position.z.toFixed(1) };

  dayCycle.update(dt);
  const sunInfo = dayCycle.sunDirection();
  // sun + sky + fog follow the day cycle
  sun.position.copy(sunInfo.dir).multiplyScalar(320);
  sun.color.copy(sunInfo.sunColor);
  sun.intensity = 0.6 + sunInfo.ambient * 1.8;
  hemi.intensity = 0.3 + sunInfo.ambient * 0.6;
  ambient.intensity = 0.15 + sunInfo.ambient * 0.3;
  scene.fog.color.copy(sunInfo.fogColor);
  sky.update(dt, sunInfo, gameTime);
  city.update(dt, gameTime);
  effects.update(dt);

  if (state === 'playing') {
    // keys
    if (input.pressed('KeyE')) { if (player.isDriving()) exitCar(); else tryEnterCar(); }
    if (input.pressed('KeyQ')) {
      player.weapon = player.weapon === 'pistol' ? 'fists' : 'pistol';
      hud.message(player.weapon === 'pistol' ? 'Pistol equipped' : 'Fists equipped');
    }
    if (input.pressed('KeyR') && player.weapon === 'pistol') {
      const need = 12 - player.ammo;
      const take = Math.min(need, player.reserveAmmo);
      player.ammo += take; player.reserveAmmo -= take;
      audio.blip(520);
    }
    if (input.pressed('KeyM')) missions.startMission();
    if (input.pressed('KeyC')) missions.startCourier();
    if (input.pressed('KeyG')) tryGarage();
    if (input.pressed('KeyP') || input.pressed('Escape')) {
      state = 'paused';
      hud.showPause();
      writeSave({ money: player.money, mission: missions.state.index, health: player.health, hour: dayCycle.hour, x: player.pos.x, z: player.pos.z });
    }
    if (input.isDown('KeyF')) {
      if (player.weapon === 'pistol') {
        // aim along the camera forward, projected on the ground
        const aimX = player.pos.x + Math.sin(camYaw) * 30;
        const aimZ = player.pos.z + Math.cos(camYaw) * 30;
        if (combat.shoot(player, aimX, aimZ)) {
          police.addWanted(0); // shooting in public draws heat
          if (police.wanted === 0) police.addWanted(1);
          pedestrians.scare(player.pos.x, player.pos.z, 30);
        }
      } else {
        combat.punch(player);
      }
    }
    player.update(dt, input, camYaw, city, (kind, impact) => {
      if (kind === 'crash') {
        audio.thud();
        effects.burst(player.pos.x, 1, player.pos.z, 0xffcc66, 10, 5);
      }
    });
    // car damage smoke
    if (player.isDriving() && player.car.health < 40) {
      smokeTimer -= dt;
      if (smokeTimer <= 0) {
        smokeTimer = 0.12;
        const f = player.car.forward();
        effects.smoke(player.car.pos.x + f.x * 1.8, 1.2, player.car.pos.z + f.z * 1.8);
      }
      if (player.car.health <= 0) {
        effects.burst(player.car.pos.x, 1, player.pos.z, 0xff5533, 30, 8);
        const car = player.car;
        exitCar();
        car.remove();
        const fi = freeCars.indexOf(car);
        if (fi !== -1) freeCars.splice(fi, 1);
        hud.message('Your car is wrecked!');
      }
    }
    traffic.update(dt, player.car);
    pedestrians.update(dt);
    police.update(dt, player, onBusted);
    combat.update(dt, player, (dmg) => {
      if (player.damage(dmg)) onWasted();
      else hud.flash('Hit! -' + dmg + ' HP');
    });
    missions.update(dt);
    audio.engine(player.isDriving(), player.isDriving() ? Math.abs(player.car.speed) / 38 : 0);
    audio.siren(police.wanted > 0);
    hud.update(dt);
  } else if (state === 'menu') {
    // the city stays alive behind the start screen
    traffic.update(dt, null);
    pedestrians.update(dt);
  } else if (state === 'paused') {
    if (input.pressed('KeyP') || input.pressed('Escape')) {
      state = 'playing';
      hud.hidePause();
    }
  }

  updateCamera(dt);
  renderer.render(scene, camera);
  if (firstFrame) {
    firstFrame = false;
    window.__solmar.ready = true;
  }
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
