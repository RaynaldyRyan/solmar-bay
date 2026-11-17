// Solmar Bay — the game itself.
// One clear job: own the renderer and the loop, wire every system together,
// run the menu / playing / paused / busted / wasted states, and expose the
// debug handle the screenshot script waits on.

import { WORLD, PLAYER, START_MONEY } from './config.js';
import { City } from './city.js';
import { DayCycle } from './daycycle.js';
import { Player } from './player.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { Pickups } from './pickups.js';
import { Effects } from './effects.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { saveState, loadState, clearState, hasSave } from './save.js';
import { shotFromUrl, applyShot } from './shots.js';

export class Game {
  constructor() {
    this.time = 0;
    this.money = START_MONEY;
    this.state = 'menu'; // menu | playing | paused | busted | wasted
    this.menuAngle = 0;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    document.getElementById('game-container').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 800);
    this.camera.position.set(0, 60, 120);
    this.input = new Input(this.renderer.domElement);
    this.city = new City(this.scene);
    this.day = new DayCycle(this.scene);
    this.effects = new Effects(this.scene);
    this.player = new Player(this.scene, 0, 12);
    this.traffic = new Traffic(this.scene, this.city);
    this.pedestrians = new Pedestrians(this.scene, this.city);
    this.police = new Police(this.scene, this.city, this);
    this.combat = new Combat(this.scene, this.city, this);
    this.missions = new Missions(this.scene, this.city, this);
    this.pickups = new Pickups(this.scene, this.city, this);
    this.hud = new HUD();
    this.audio = new AudioEngine();
    this.clock = new THREE.Clock();
    this.bindMenus();
    this.bindResize();
    const { shot } = shotFromUrl();
    if (shot) {
      applyShot(this, shot);
      this.shotName = shot;
    }
    window.__solmar = {
      game: this,
      get time() {
        return window.__solmarGame.time;
      },
      get state() {
        return window.__solmarGame.state;
      },
      ready: true,
    };
    window.__solmarGame = this;
    this.renderer.setAnimationLoop(() => this.frame());
  }

  allVehicles() {
    const list = this.traffic.allCars().concat(this.police.copCars);
    if (this.player.car && !list.includes(this.player.car)) list.push(this.player.car);
    return list;
  }

  bindMenus() {
    const startBtn = document.getElementById('start-btn');
    const continueBtn = document.getElementById('continue-btn');
    const resumeBtn = document.getElementById('resume-btn');
    const missionBtn = document.getElementById('mission-btn');
    const courierBtn = document.getElementById('courier-btn');
    const saveBtn = document.getElementById('save-btn');
    const restartBtn = document.getElementById('restart-btn');
    if (continueBtn && !hasSave()) continueBtn.style.display = 'none';
    if (startBtn) startBtn.addEventListener('click', () => this.startGame(false));
    if (continueBtn) continueBtn.addEventListener('click', () => this.startGame(true));
    if (resumeBtn) resumeBtn.addEventListener('click', () => this.resume());
    if (missionBtn) missionBtn.addEventListener('click', () => {
      this.resume();
      this.startNextMission();
    });
    if (courierBtn) courierBtn.addEventListener('click', () => {
      this.resume();
      if (!this.missions.current) this.missions.startCourier();
    });
    if (saveBtn) saveBtn.addEventListener('click', () => {
      this.saveGame();
      this.hud.flash('Game saved');
    });
    if (restartBtn) restartBtn.addEventListener('click', () => {
      clearState();
      window.location.reload();
    });
    // Clicking the canvas locks the pointer for mouse-look.
    this.renderer.domElement.addEventListener('click', () => {
      if (this.state === 'playing') this.input.requestLock();
    });
  }

  bindResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  hideMenus() {
    const start = document.getElementById('start-screen');
    const pause = document.getElementById('pause-menu');
    const hud = document.getElementById('hud');
    if (start) start.style.display = 'none';
    if (pause) pause.style.display = 'none';
    if (hud) hud.style.display = 'block';
  }

  showMenu() {
    const start = document.getElementById('start-screen');
    const hud = document.getElementById('hud');
    if (start) start.style.display = 'flex';
    if (hud) hud.style.display = 'none';
  }

  startGame(continueSave) {
    this.audio.start();
    if (continueSave) {
      const data = loadState();
      if (data) {
        this.money = data.money;
        this.missions.loadState(data.missionsCompleted);
        this.player.x = data.player.x;
        this.player.z = data.player.z;
        this.player.health = data.player.health;
        this.player.ammo = data.player.ammo;
        this.player.pistolOwned = data.player.pistolOwned;
        this.player.mesh.position.set(data.player.x, 0, data.player.z);
        this.day.setHour(data.hour);
        this.hud.flash('Welcome back to Solmar Bay');
      }
    }
    this.state = 'playing';
    this.hideMenus();
    this.input.requestLock();
    if (!continueSave) {
      this.hud.showBrief(
        'Welcome to Solmar Bay',
        'You are Milo Vane, a driver new in town. Press M to start your first mission, E to steal a car, and stay out of the SBPD\'s way.',
      );
    }
  }

  startNextMission() {
    if (this.missions.current) {
      this.hud.flash('Finish the current job first');
      return;
    }
    const next = this.missions.nextMission();
    if (!next) {
      this.hud.flash('Story complete — courier runs still pay. Press C.');
      return;
    }
    this.missions.startMission(next.id);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    const pause = document.getElementById('pause-menu');
    if (pause) pause.style.display = 'flex';
    this.input.releaseLock();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    const pause = document.getElementById('pause-menu');
    if (pause) pause.style.display = 'none';
    this.input.requestLock();
  }

  saveGame() {
    return saveState(this);
  }

  onPlayerBusted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.police.clearWanted();
    this.audio.busted();
    this.audio.engineStop();
    this.hud.showBusted();
    this.input.releaseLock();
  }

  onPlayerWasted() {
    if (this.state !== 'playing') return;
    this.state = 'wasted';
    this.police.clearWanted();
    this.audio.busted();
    this.audio.engineStop();
    this.hud.showWasted();
    this.input.releaseLock();
  }

  respawnAfterBusted() {
    const st = this.city.landmarks.police;
    this.respawn(st.x + 8, st.z + 6, 200);
    this.hud.flash('Released outside the SBPD station. -$200 fine.');
  }

  respawnAfterWasted() {
    const st = this.city.landmarks.hospital;
    this.respawn(st.x + 6, st.z + 6, 100);
    this.hud.flash('Patched up at Solmar General. -$100 bill.');
  }

  respawn(x, z, cost) {
    if (this.player.car) {
      this.player.car.driver = null;
      this.player.car = null;
      this.player.onFoot = true;
      this.player.mesh.visible = true;
    }
    this.player.x = x;
    this.player.z = z;
    this.player.y = 0;
    this.player.health = PLAYER.MAX_HEALTH;
    this.player.dead = false;
    this.player.mesh.position.set(x, 0, z);
    this.money = Math.max(0, this.money - cost);
    this.missions.current = null;
    this.missions.beacon.visible = false;
    this.combat.clearGunmen();
    this.hud.hideEndScreens();
    this.hud.setObjective('', 0);
    this.state = 'playing';
    this.input.requestLock();
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.state === 'menu') {
      this.menuAngle += dt * 0.03;
      const r = 130;
      this.camera.position.set(Math.cos(this.menuAngle) * r, 55, Math.sin(this.menuAngle) * r);
      this.camera.lookAt(0, 0, 10);
      this.city.update(dt, this.time);
      this.day.update(dt * 0.2);
      this.renderer.render(this.scene, this.camera);
      this.input.endFrame();
      return;
    }
    if (this.state === 'paused') {
      this.renderer.render(this.scene, this.camera);
      if (this.input.wasPressed('Escape') || this.input.wasPressed('KeyP')) this.resume();
      this.input.endFrame();
      return;
    }
    if (this.state === 'busted' || this.state === 'wasted') {
      this.renderer.render(this.scene, this.camera);
      if (this.input.wasPressed('Enter') || this.input.wasPressed('KeyR')) {
        if (this.state === 'busted') this.respawnAfterBusted();
        else this.respawnAfterWasted();
      }
      this.input.endFrame();
      return;
    }
    // Playing.
    this.time += dt;
    this.day.update(dt);
    this.city.update(dt, this.time);
    if (this.input.wasPressed('Escape') || this.input.wasPressed('KeyP')) {
      this.pause();
      this.input.endFrame();
      return;
    }
    if (this.input.wasPressed('KeyM')) this.startNextMission();
    if (this.input.wasPressed('KeyC') && !this.missions.current) this.missions.startCourier();
    // Enter / exit car.
    if (this.input.wasPressed('KeyE')) {
      if (this.player.onFoot) {
        const car = this.traffic.nearestEnterable(this.player.x, this.player.z, 4.5);
        if (car) {
          if (car.driver === 'traffic') {
            this.pedestrians.spawnFleeingDriver(car.x + 2, car.z + 2);
          }
          this.player.enterCar(car, this);
        } else {
          this.hud.flash('No car nearby — get closer to one');
        }
      } else {
        this.player.exitCar(this);
      }
    }
    if (this.player.onFoot) {
      this.player.updateOnFoot(dt, this.input, this.city, this);
    } else {
      this.player.updateDriving(dt, this.input, this.city, this.allVehicles());
      if (this.player.car) {
        this.audio.engineSpeed(Math.abs(this.player.car.speed) / this.player.car.spec.topSpeed);
        // Damage smoke.
        if (this.player.car.health < 45 && !this.player.car.dead) {
          this.player.car.smokeTimer -= dt;
          if (this.player.car.smokeTimer <= 0) {
            this.player.car.smokeTimer = 0.25;
            this.effects.smoke(this.player.car.x, 1.2, this.player.car.z);
          }
        }
        // Skid dust on handbrake turns.
        if (this.input.isDown('Space') && Math.abs(this.player.car.speed) > 8 && Math.random() < 0.4) {
          this.effects.dust(this.player.car.x, 0.3, this.player.car.z);
        }
      }
    }
    this.traffic.update(dt, this);
    this.pedestrians.update(dt, this);
    this.police.update(dt, this);
    this.combat.update(dt);
    this.missions.update(dt, this);
    this.pickups.update(dt, this);
    this.effects.update(dt);
    // Enter-car hint.
    if (this.player.onFoot) {
      const near = this.traffic.nearestEnterable(this.player.x, this.player.z, 4.5);
      this.hud.setHint(near ? `Press E to drive the ${near.spec.name}` : '');
    } else {
      this.hud.setHint('E — exit car · Space — handbrake');
    }
    this.player.updateCamera(dt, this.input, this.camera, this.city);
    this.hud.update(dt, this);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }
}

new Game();
