// Solmar Bay — main entry point. Wires every system together: renderer,
// third-person camera, input, game loop, enter/exit car, garage service,
// BUSTED / WASTED flow, save/load, start screen, pause, and screenshot staging.
import { WANTED, PLAYER } from './config.js';
import { makeRng, seedFromUrl } from './random.js';
import { Input } from './input.js';
import { saveGame as persistGame, loadGame, hasSave } from './save.js';
import { AudioEngine } from './audio.js';
import { City } from './city.js';
import { Car } from './vehicles.js';
import { Effects } from './effects.js';
import { Player } from './player.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { DayCycle } from './daycycle.js';
import { Hud } from './hud.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const rng = makeRng(seedFromUrl());
const shotName = params.get('shot');

class Game {
  constructor() {
    this.time = 0;
    this.state = 'start'; // 'start' | 'playing' | 'paused' | 'busted' | 'wasted'
    this.showStartScreen = !shotName || shotName === 'start_screen';
    this.audio = new AudioEngine();
    this.garageTimer = 0;
    this._cometSpawned = false;

    // renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    document.getElementById('game').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);

    // systems
    this.city = new City(this.scene, rng);
    this.effects = new Effects(this.scene);
    this.day = new DayCycle(this.scene);
    this.player = new Player(this.scene, this.city, { x: 0, z: 30 }, Math.PI);
    this.traffic = new Traffic(this.scene, this.city, rng, 14);
    this.peds = new Pedestrians(this.scene, this.city, rng, 26);
    this.police = new Police(this.scene, this.city, rng);
    this.combat = new Combat(this.scene, this.city, this.effects, this.audio, rng);
    this.combat.peds = this.peds.peds;
    this.combat.cops = this.police.cops;
    this.missions = new Missions(this.scene, rng, (type, payload) => this.onMissionEvent(type, payload));
    this.hud = new Hud();
    this.input = new Input();
    this.input.onKey = (code) => this.onKey(code);

    this.police.onBusted = () => this.busted();
    this.combat.onKillPed = (p) => {
      this.peds.kill(p);
      this.police.addStars(WANTED.killPed, 'killed a pedestrian');
      this.hud.showMessage('WANTED', 'A pedestrian was killed', 2);
    };
    this.combat.onKillCop = (c) => {
      this.police.killCop(c);
      this.police.addStars(WANTED.killCop, 'killed a cop');
      this.hud.showMessage('WANTED', 'A cop was killed', 2);
    };

    // restore a previous save
    const saved = loadGame();
    if (saved) {
      this.player.money = saved.money ?? 200;
      this.player.health = saved.health ?? 100;
      this.missions.restore(saved.missions);
      if (saved.player) {
        this.player.x = saved.player.x;
        this.player.z = saved.player.z;
        this.player.heading = saved.player.heading;
        this.player.mesh.position.set(this.player.x, 0, this.player.z);
      }
      if (saved.timeOfDay) this.day.timeOfDay = saved.timeOfDay;
    }

    this.bindMenus();
    this.setupCameraOrbit();
    addEventListener('resize', () => this.onResize());

    // screenshot staging (deterministic, query-param driven)
    if (shotName) {
      applyShot(this, shotName);
      if (shotName !== 'start_screen') {
        this.state = 'playing';
        document.getElementById('startScreen').style.display = 'none';
        document.getElementById('hud').style.display = 'block';
      }
    }
    // debug handle for the screenshot script + playtesting
    window.__solmar = {
      get time() { return game.time; },
      get state() { return game.state; },
      get wanted() { return game.police.wanted; },
      get money() { return game.player.money; },
      get health() { return game.player.health; },
      get mission() { return game.missions.currentText(); },
      get inCar() { return game.player.inCar; },
      get pos() { return game.player.pos; },
      get peds() { return game.peds.peds.filter((p) => !p.dead).length; },
      get traffic() { return game.traffic.cars.length; },
      get cops() { return game.police.cops.filter((c) => !c.dead).length + game.police.copCars.length; },
    };

    this.last = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  bindMenus() {
    const startBtn = document.getElementById('startBtn');
    const continueBtn = document.getElementById('continueBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    const restartBtn = document.getElementById('restartBtn');
    const quitBtn = document.getElementById('quitBtn');
    const saveBtn = document.getElementById('saveBtn');
    startBtn.addEventListener('click', () => this.startGame(false));
    if (continueBtn) continueBtn.addEventListener('click', () => this.startGame(true));
    resumeBtn.addEventListener('click', () => this.togglePause());
    restartBtn.addEventListener('click', () => location.reload());
    quitBtn.addEventListener('click', () => {
      this.saveGame();
      location.reload();
    });
    saveBtn.addEventListener('click', () => {
      this.saveGame();
      this.hud.showMessage('SAVED', 'Progress saved to this browser', 2);
    });
    // hide the continue button when there is no save
    if (continueBtn && !hasSave()) continueBtn.style.display = 'none';
    document.getElementById('startScreen').style.display = this.showStartScreen ? 'flex' : 'none';
    document.getElementById('hud').style.display = this.showStartScreen ? 'none' : 'block';
  }

  startGame(useSave) {
    if (!useSave) {
      // fresh run: reset progress but keep the save slot intact
      this.player.money = 200;
      this.player.health = PLAYER.health;
      this.missions.completed.clear();
    }
    this.audio.start();
    this.state = 'playing';
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    this.input.lockPointer();
    this.hud.showMessage('SOLMAR BAY', 'Welcome back, Milo. Press M to start a mission.', 4);
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      document.getElementById('pauseMenu').style.display = 'flex';
      this.input.unlockPointer();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      document.getElementById('pauseMenu').style.display = 'none';
      this.input.lockPointer();
    }
  }

  saveGame() {
    persistGame({
      money: this.player.money,
      health: this.player.health,
      player: { x: this.player.x, z: this.player.z, heading: this.player.heading },
      timeOfDay: this.day.timeOfDay,
      missions: this.missions.serialize(),
    });
  }

  // One-shot keys, via Input.onKey.
  onKey(code) {
    if (code === 'KeyP') {
      if (this.state === 'playing' || this.state === 'paused') this.togglePause();
      return;
    }
    if (this.state !== 'playing') return;
    if (code === 'KeyM') {
      if (!this.missions.active && !this.missions.courier) {
        const m = this.missions.startNext();
        if (!m) this.hud.showMessage('ALL MISSIONS DONE', 'Free roam — courier runs still pay', 3);
      }
    } else if (code === 'KeyC') {
      if (!this.missions.startCourier()) this.hud.showMessage('BUSY', 'Finish the current job first', 2);
    } else if (code === 'KeyQ') {
      this.player.weapon = this.player.weapon === 'fists' ? 'pistol' : 'fists';
    } else if (code === 'KeyR') {
      this.combat.reload(this.player);
    } else if (code === 'KeyE') {
      if (this.player.inCar) this.player.exitCar();
      else this.tryEnterCar();
    }
  }

  onMissionEvent(type, payload) {
    if (type === 'missionStart') {
      this.hud.showMessage(payload.title, payload.brief, 4);
    } else if (type === 'stepDone') {
      this.hud.showMessage(payload.text, '', 2);
    } else if (type === 'missionDone') {
      this.player.earn(payload.reward);
      this.audio.missionDone();
      this.hud.showMessage('MISSION COMPLETE', `${payload.title} — +$${payload.reward}`, 4);
      this.saveGame();
    } else if (type === 'missionFail') {
      this.hud.showMessage('MISSION FAILED', `${payload.title} — press M to retry`, 3);
    } else if (type === 'courierStart') {
      this.hud.showMessage('COURIER RUN', `Deliver for $${payload.pay}`, 3);
    } else if (type === 'courierDone') {
      this.player.earn(payload.pay);
      this.audio.missionDone();
      this.hud.showMessage('DELIVERED', `+$${payload.pay}`, 3);
    } else if (type === 'ambush') {
      this.combat.spawnGunmen(payload.at.x, payload.at.z, payload.count);
      // the harbor shootout draws the cops — the escape step has teeth
      this.police.addStars(2, 'harbor shootout');
      this.hud.showMessage('AMBUSH', 'Rival crew — fight back, then lose the cops', 3);
    }
  }

  busted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.audio.busted();
    this.police.clearWanted();
    this.player.money = Math.max(0, this.player.money - 150);
    this.showBanner('BUSTED', 'The police caught you. -$150 bail.');
    setTimeout(() => {
      this.hideBanner();
      this.player.respawn();
      this.state = 'playing';
    }, 2600);
  }

  wasted() {
    if (this.state !== 'playing') return;
    this.state = 'wasted';
    this.audio.busted();
    this.police.clearWanted();
    this.showBanner('WASTED', 'Milo wakes up at Solmar General. -$100.');
    setTimeout(() => {
      this.hideBanner();
      this.player.respawn();
      this.state = 'playing';
    }, 2600);
  }

  showBanner(title, sub) {
    const b = document.getElementById('banner');
    document.getElementById('bannerTitle').textContent = title;
    document.getElementById('bannerSub').textContent = sub;
    b.style.display = 'flex';
  }
  hideBanner() {
    document.getElementById('banner').style.display = 'none';
  }

  // Spawn a car of a given archetype near a point (missions + shots).
  spawnCarNear(key, x, z, heading) {
    const car = new Car(this.scene, key, x, z, heading);
    this.traffic.parked.push(car);
    return car;
  }

  // The nearest stealable car to the player within 4.5m.
  nearestCar() {
    const pos = this.player.pos;
    let best = null, bestD = 4.5;
    const consider = (c) => {
      if (c.dead || c.wrecked()) return;
      const d = Math.hypot(c.x - pos.x, c.z - pos.z);
      if (d < bestD) { bestD = d; best = c; }
    };
    for (const c of this.traffic.allCars()) consider(c);
    for (const cc of this.police.copCars) consider(cc.car);
    return best;
  }

  tryEnterCar() {
    const car = this.nearestCar();
    if (!car) return;
    const result = this.player.enterCar(car);
    if (result === 'stole') {
      // the driver flees on foot
      this.peds.scare(car.x, car.z, 8);
      this.police.addStars(WANTED.stealCar, 'stole a car');
      this.hud.showMessage('CAR STOLEN', '+1 wanted star', 2);
    }
  }

  // Mouse-look: drag to orbit when not pointer-locked (start screen / menus).
  setupCameraOrbit() {
    this.camOrbit = { yaw: Math.PI, pitch: 0.35, dist: 42, target: { x: 0, z: 0 } };
    let dragging = false, lx = 0, ly = 0;
    const el = this.renderer.domElement;
    el.addEventListener('mousedown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY; });
    addEventListener('mouseup', () => { dragging = false; });
    addEventListener('mousemove', (e) => {
      if (!dragging || this.state === 'playing') return;
      this.camOrbit.yaw -= (e.clientX - lx) * 0.005;
      this.camOrbit.pitch = Math.max(0.05, Math.min(1.2, this.camOrbit.pitch + (e.clientY - ly) * 0.005));
      lx = e.clientX; ly = e.clientY;
    });
    el.addEventListener('wheel', (e) => {
      if (this.state !== 'playing') {
        this.camOrbit.dist = Math.max(15, Math.min(90, this.camOrbit.dist + e.deltaY * 0.05));
      }
    }, { passive: true });
  }

  updateCamera(dt) {
    if (this.state === 'start') {
      // slow cinematic orbit over Central Plaza
      this.camOrbit.yaw += dt * 0.03;
      const o = this.camOrbit;
      this.camera.position.set(
        o.target.x + Math.sin(o.yaw) * o.dist * Math.cos(o.pitch),
        8 + Math.sin(o.pitch) * o.dist,
        o.target.z + Math.cos(o.yaw) * o.dist * Math.cos(o.pitch),
      );
      this.camera.lookAt(o.target.x, 2, o.target.z);
      return;
    }
    // third-person follow camera
    const pos = this.player.pos;
    const yaw = this.player.camYaw;
    const pitch = this.player.camPitch;
    const dist = this.player.inCar ? 10.5 : 8;
    const height = 2.2 + Math.sin(pitch) * dist * 0.5;
    const cx = pos.x - Math.sin(yaw) * Math.cos(pitch) * dist;
    const cz = pos.z - Math.cos(yaw) * Math.cos(pitch) * dist;
    // keep the camera out of buildings
    const fixed = this.city.collideCircle(cx, cz, 1);
    this.camera.position.set(fixed.x, height, fixed.z);
    this.camera.lookAt(pos.x, 1.6, pos.z);
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.state === 'paused') {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.time += dt;
    const playing = this.state === 'playing';
    const input = this.input;

    if (playing) {
      // mouse look (pointer-locked only)
      const { dx, dy } = input.takeMouse();
      if (input.locked) {
        this.player.camYaw -= dx * 0.0023;
        this.player.camPitch = Math.max(-0.15, Math.min(1.0, this.player.camPitch + dy * 0.002));
      }
      // a click while unlocked re-locks the pointer instead of firing
      if (input.takeClick() && !input.locked) input.lockPointer();
      // fire: F key or held mouse button (combat cooldown gates the rate)
      if (input.down('KeyF') || (input.mouseDown && input.locked)) {
        const heading = this.player.inCar ? this.player.car.heading : this.player.camYaw;
        const result = this.combat.attack(this.player, heading, this.time);
        if (result === 'shot') this.peds.scare(this.player.pos.x, this.player.pos.z, 30);
      }

      // movement
      const fwd = input.driveAxis();
      const strafe = input.steerAxis();
      if (this.player.inCar) {
        const handbrake = input.down('Space');
        this.player.driveCar(fwd, strafe, handbrake, dt);
        this.audio.setEngine(Math.abs(this.player.car.speed) * 3.6, true);
        // car vs traffic collisions
        for (const c of this.traffic.allCars()) {
          if (c === this.player.car || c.dead) continue;
          const d = Math.hypot(c.x - this.player.car.x, c.z - this.player.car.z);
          if (d < 3.4) {
            const wasCop = c.isCop;
            this.player.car.bump(c, 1);
            if (wasCop && Math.abs(this.player.car.speed) > 6) {
              this.police.addStars(WANTED.hitCopCar, 'hit a cop car');
            }
            if (Math.abs(this.player.car.speed) > 10) this.effects.sparks(new THREE.Vector3(c.x, 1, c.z), 5);
          }
        }
        // running over peds (dark, but it is a crime game)
        const ped = this.peds.nearest(this.player.car.x, this.player.car.z, 2.2);
        if (ped && Math.abs(this.player.car.speed) > 8) {
          this.combat.onKillPed(ped);
        }
        // garage service: idle inside the zone for 1.2s
        const gz = this.city.garageZone;
        if (gz && Math.abs(this.player.car.speed) < 2) {
          const d = Math.hypot(this.player.car.x - gz.x, this.player.car.z - gz.z);
          if (d < gz.r) this.garageTimer += dt;
          else this.garageTimer = 0;
          if (this.garageTimer > 1.2) {
            this.garageTimer = 0;
            if (this.police.wanted > 0 || this.player.car.health < 100) {
              if (this.player.spend(WANTED.garageCost)) {
                this.police.clearWanted();
                this.player.car.health = 100;
                this.audio.pickup();
                this.hud.showMessage('SPRAY & SAVE', 'Wanted cleared, car repaired. -$150', 3);
              } else {
                this.hud.showMessage('SPRAY & SAVE', 'Not enough cash — $150 needed', 2);
              }
            }
          }
        } else {
          this.garageTimer = 0;
        }
        // smoking wreck
        if (this.player.car.smoking()) {
          this.player.car.smokeTimer -= dt;
          if (this.player.car.smokeTimer <= 0) {
            this.player.car.smokeTimer = 0.12;
            const f = this.player.car.forward();
            this.effects.smoke(new THREE.Vector3(
              this.player.car.x + f.x * 1.5, 1.2, this.player.car.z + f.z * 1.5));
          }
        }
        if (this.player.car.wrecked()) {
          this.hud.showMessage('WRECKED', 'The car is totalled — get out', 2);
          this.player.exitCar();
        }
      } else {
        this.player.moveOnFoot(fwd, strafe, input.down('ShiftLeft'), input.down('Space'), dt, this.time);
        this.audio.setEngine(0, false);
      }

      // systems
      this.traffic.update(dt, this.player.pos);
      this.peds.update(dt, this.player.pos, this.player.inCar ? Math.abs(this.player.car.speed) : 0);
      this.police.update(dt, this.player, this.time);
      this.combat.update(dt, this.player, this.time);
      this.missions.update(dt, this.player, this.police.wanted);
      if (this.player.dead) this.wasted();

      // mission 2 needs its Comet parked at the step location
      if (this.missions.active && this.missions.mission.id === 'hot-wheels' && !this._cometSpawned) {
        this._cometSpawned = true;
        this.spawnCarNear('comet', -60, 40, Math.PI / 2);
      }

      // HUD
      this.hud.update(dt, {
        player: this.player,
        wanted: this.police.wanted,
        clock: this.day.clockText(),
        missionText: this.missions.currentText(),
        missionTimer: this.missions.timer,
        speedKmh: this.player.inCar ? Math.abs(this.player.car.speed) * 3.6 : 0,
        objective: this.missions.currentTarget(),
        cars: [...this.traffic.allCars(), ...this.police.copCars.map((c) => c.car)],
      });
    }

    // ambient animation always runs (start screen orbit included)
    this.city.update(dt, this.time);
    this.day.update(playing ? dt : dt * 0.2);
    this.effects.update(dt);
    this.audio.setSiren(this.police.wanted > 0);
    this.audio.update(dt);
    const oceanLevel = Math.max(0, Math.min(1, (this.player.pos.z - 120) / 60));
    this.audio.setOcean(oceanLevel);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }
}

const game = new Game();
