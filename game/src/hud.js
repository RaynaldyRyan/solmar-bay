// HUD: stars, money, clock, health, weapon/ammo, speed, objective text and a
// canvas minimap with blips (player, objective, cars, cops, garage).
import { LANDMARKS, WORLD_BOUND } from './config.js';

export class Hud {
  constructor() {
    this.el = {};
    for (const id of ['stars', 'money', 'clock', 'health', 'healthbar', 'weapon', 'speed', 'objective', 'objectiveTimer', 'message', 'messageSub', 'wantedFlash']) {
      this.el[id] = document.getElementById(id);
    }
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
    this.messageTimer = 0;
  }

  showMessage(title, sub = '', seconds = 3) {
    this.el.message.textContent = title;
    this.el.messageSub.textContent = sub;
    this.el.message.style.opacity = '1';
    this.el.messageSub.style.opacity = '1';
    this.messageTimer = seconds;
  }

  update(dt, state) {
    const { player, wanted, clock, missionText, missionTimer, speedKmh, objective } = state;
    // wanted stars
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < wanted ? '★' : '☆';
    this.el.stars.textContent = stars;
    this.el.stars.className = wanted > 0 ? 'stars hot' : 'stars';
    this.el.money.textContent = `$${player.money.toLocaleString()}`;
    this.el.clock.textContent = clock;
    this.el.health.textContent = `${Math.ceil(player.health)}`;
    this.el.healthbar.style.width = `${player.health}%`;
    this.el.healthbar.className = 'bar-fill' + (player.health < 30 ? ' low' : '');
    this.el.weapon.textContent = player.weapon === 'pistol'
      ? `PISTOL ${player.ammo.mag} / ${player.ammo.reserve}`
      : 'FISTS';
    this.el.speed.textContent = player.inCar ? `${Math.round(speedKmh)} km/h` : '';
    this.el.objective.textContent = missionText || 'Free roam — press M for a mission, C for a courier run';
    this.el.objectiveTimer.textContent = missionTimer > 0 ? `⏱ ${Math.ceil(missionTimer)}s` : '';
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) {
        this.el.message.style.opacity = '0';
        this.el.messageSub.style.opacity = '0';
      }
    }
    this.drawMinimap(state);
  }

  drawMinimap(state) {
    const ctx = this.mapCtx;
    const S = 150; // canvas size
    const scale = S / (WORLD_BOUND * 2 + 80);
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    // sea + land
    ctx.fillStyle = '#2f6f9f';
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#8fae7d';
    const [lx, lz] = toMap(-WORLD_BOUND, -WORLD_BOUND);
    const [rx, rz] = toMap(WORLD_BOUND, 196);
    ctx.fillRect(lx, lz, rx - lx, rz - lz);
    // sand strip
    ctx.fillStyle = '#e8d9a8';
    const [, beachTop] = toMap(0, 178);
    ctx.fillRect(lx, beachTop, rx - lx, rz - beachTop);
    // roads
    ctx.strokeStyle = '#5a5f66';
    ctx.lineWidth = 2;
    for (const c of [-160, -120, -80, -40, 0, 40, 80, 120, 160]) {
      const [mx] = toMap(c, 0);
      ctx.beginPath(); ctx.moveTo(mx, lz); ctx.lineTo(mx, rz); ctx.stroke();
      const [, mz] = toMap(0, c);
      ctx.beginPath(); ctx.moveTo(lx, mz); ctx.lineTo(rx, mz); ctx.stroke();
    }
    // plaza + park
    ctx.fillStyle = '#d8d2c2';
    const [px, pz] = toMap(0, 0);
    ctx.beginPath(); ctx.arc(px, pz, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4e8f3a';
    const [kx, kz] = toMap(-80, -80);
    ctx.fillRect(kx - 8, kz - 8, 16, 16);
    // garage blip
    ctx.fillStyle = '#c23b3b';
    const [gx, gz] = toMap(-100, 100);
    ctx.fillRect(gx - 2, gz - 2, 4, 4);
    // traffic + cop cars
    if (state.cars) {
      for (const c of state.cars) {
        const [cx, cz] = toMap(c.x, c.z);
        ctx.fillStyle = c.isCop ? '#2244ff' : '#e8e8e8';
        ctx.fillRect(cx - 1.5, cz - 1.5, 3, 3);
      }
    }
    // objective diamond
    if (state.objective) {
      const [ox, oz] = toMap(state.objective.x, state.objective.z);
      ctx.fillStyle = '#f5c518';
      ctx.beginPath();
      ctx.moveTo(ox, oz - 5); ctx.lineTo(ox + 4, oz); ctx.lineTo(ox, oz + 5); ctx.lineTo(ox - 4, oz);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // player arrow (pointing along heading; map north = -z, so rotate by heading)
    const pos = state.player.pos;
    const [pX, pZ] = toMap(pos.x, pos.z);
    const heading = state.player.inCar ? state.player.car.heading : state.player.heading;
    ctx.save();
    ctx.translate(pX, pZ);
    ctx.rotate(heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
