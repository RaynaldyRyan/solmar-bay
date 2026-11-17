// Solmar Bay — HUD and minimap.
// One clear job: every DOM overlay the player sees (stars, money, clock,
// health, weapon, speed, objective, flash messages, briefs, busted/wasted)
// plus the canvas minimap with live blips.

import { WORLD } from './config.js';

function $(id) {
  return document.getElementById(id);
}

export class HUD {
  constructor() {
    this.el = {
      stars: $('stars'),
      money: $('money'),
      clock: $('clock'),
      healthFill: $('health-fill'),
      weapon: $('weapon'),
      ammo: $('ammo'),
      speed: $('speed'),
      objective: $('objective'),
      objectiveTimer: $('objective-timer'),
      flash: $('flash'),
      brief: $('brief'),
      briefTitle: $('brief-title'),
      briefText: $('brief-text'),
      damage: $('damage-flash'),
      busted: $('busted'),
      wasted: $('wasted'),
      hint: $('hint'),
      minimap: $('minimap'),
    };
    this.mapCtx = this.el.minimap ? this.el.minimap.getContext('2d') : null;
    this.flashTimer = null;
    this.briefTimer = null;
    this.damageTimer = null;
    this.objectiveLabel = '';
    this.objectiveTime = 0;
  }

  flash(msg) {
    if (!this.el.flash) return;
    this.el.flash.textContent = msg;
    this.el.flash.classList.add('show');
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => this.el.flash.classList.remove('show'), 3200);
  }

  showBrief(title, text) {
    if (!this.el.brief) return;
    this.el.briefTitle.textContent = title;
    this.el.briefText.textContent = text;
    this.el.brief.classList.add('show');
    clearTimeout(this.briefTimer);
    this.briefTimer = setTimeout(() => this.el.brief.classList.remove('show'), 6000);
  }

  setObjective(label, seconds) {
    this.objectiveLabel = label;
    this.objectiveTime = seconds;
    if (this.el.objective) {
      this.el.objective.textContent = label;
      this.el.objective.parentElement.style.display = label ? 'block' : 'none';
    }
  }

  damageFlash() {
    if (!this.el.damage) return;
    this.el.damage.classList.add('show');
    clearTimeout(this.damageTimer);
    this.damageTimer = setTimeout(() => this.el.damage.classList.remove('show'), 220);
  }

  showBusted() {
    if (this.el.busted) this.el.busted.classList.add('show');
  }

  showWasted() {
    if (this.el.wasted) this.el.wasted.classList.add('show');
  }

  hideEndScreens() {
    if (this.el.busted) this.el.busted.classList.remove('show');
    if (this.el.wasted) this.el.wasted.classList.remove('show');
  }

  setHint(text) {
    if (this.el.hint) {
      this.el.hint.textContent = text;
      this.el.hint.style.display = text ? 'block' : 'none';
    }
  }

  update(dt, game) {
    const player = game.player;
    if (this.el.stars) {
      const stars = game.police.stars;
      this.el.stars.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
      this.el.stars.classList.toggle('hot', stars > 0);
    }
    if (this.el.money) this.el.money.textContent = `$${game.money.toLocaleString()}`;
    if (this.el.clock) this.el.clock.textContent = game.day.clockText();
    if (this.el.healthFill) {
      this.el.healthFill.style.width = `${player.health}%`;
      this.el.healthFill.classList.toggle('low', player.health < 30);
    }
    if (this.el.weapon) {
      this.el.weapon.textContent = player.weapon === 'pistol' ? 'PISTOL' : 'FISTS';
    }
    if (this.el.ammo) {
      this.el.ammo.textContent = player.weapon === 'pistol' ? `● ${player.ammo}` : '—';
    }
    if (this.el.speed) {
      const kmh = !player.onFoot && player.car ? player.car.speedKmh() : 0;
      this.el.speed.textContent = kmh > 0 ? `${kmh} km/h` : '';
    }
    if (this.el.objectiveTimer) {
      this.el.objectiveTimer.textContent = this.objectiveTime > 0
        ? `${Math.ceil(this.objectiveTime)}s`
        : '';
    }
    this.drawMinimap(game);
  }

  // World (-160..160) to minimap (0..180) coordinates.
  mapPos(x, z, size) {
    const s = size / 360;
    return [(x + 180) * s, (z + 180) * s];
  }

  drawMinimap(game) {
    const ctx = this.mapCtx;
    if (!ctx) return;
    const size = this.el.minimap.width;
    const s = size / 360;
    ctx.clearRect(0, 0, size, size);
    // Land.
    ctx.fillStyle = '#b8c8a8';
    ctx.fillRect(0, 0, size, size);
    // Ocean (south of the shore) and the beach strip in front of it.
    const [, shoreY] = this.mapPos(0, 168, size);
    ctx.fillStyle = '#3a90c8';
    ctx.fillRect(0, shoreY, size, size - shoreY);
    ctx.fillStyle = '#e8d8a0';
    const [, sandY] = this.mapPos(0, 158, size);
    ctx.fillRect(0, sandY, size, shoreY - sandY);
    // Palma Park.
    const [parkX, parkY] = this.mapPos(-76, -76, size);
    ctx.fillStyle = '#7ab86a';
    ctx.fillRect(parkX - 12 * s, parkY - 12 * s, 24 * s, 24 * s);
    // Roads.
    ctx.strokeStyle = '#5a5a64';
    ctx.lineWidth = 2;
    for (const r of WORLD.ROADS) {
      const [rx] = this.mapPos(r, 0, size);
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(rx, size);
      ctx.stroke();
      const [, rz] = this.mapPos(0, r, size);
      ctx.beginPath();
      ctx.moveTo(0, rz);
      ctx.lineTo(size, rz);
      ctx.stroke();
    }
    // Plaza.
    const [plX, plY] = this.mapPos(0, 0, size);
    ctx.fillStyle = '#d8c8a0';
    ctx.beginPath();
    ctx.arc(plX, plY, 4, 0, Math.PI * 2);
    ctx.fill();
    // Objective diamond (pulsing).
    const obj = game.missions.objectivePos();
    if (obj) {
      const [ox, oy] = this.mapPos(obj[0], obj[1], size);
      const pulse = 4 + Math.sin(performance.now() / 250) * 1.5;
      ctx.fillStyle = '#ffd040';
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-pulse / 2, -pulse / 2, pulse, pulse);
      ctx.restore();
    }
    // Cops (blue) and gunmen (red).
    ctx.fillStyle = '#2060ff';
    for (const cop of game.police.footCops) {
      const [x, y] = this.mapPos(cop.x, cop.z, size);
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of game.police.copCars) {
      const [x, y] = this.mapPos(car.x, car.z, size);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e02020';
    for (const g of game.combat.gunmen) {
      if (g.dead) continue;
      const [x, y] = this.mapPos(g.x, g.z, size);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow (points along heading; canvas rotate is clockwise with y down,
    // so the heading is negated to match the map's north-up orientation).
    const player = game.player;
    const [px, py] = this.mapPos(player.x, player.z, size);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.lineTo(-4.5, -5);
    ctx.lineTo(0, -2.5);
    ctx.lineTo(4.5, -5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
