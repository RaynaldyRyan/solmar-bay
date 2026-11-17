// HUD: stars, money, clock, health, weapon, speed, objective panel, mission
// cards, and a circular canvas minimap with blips for the player, the
// objective, cops and the garage. Also the start screen and pause menu.
import { CFG } from './config.js';

export function createHud(world) {
  const $ = (id) => document.getElementById(id);
  const el = {
    stars: $('hud-stars'), money: $('hud-money'), clock: $('hud-clock'),
    healthFill: $('hud-health-fill'), healthText: $('hud-health-text'),
    weapon: $('hud-weapon'), ammo: $('hud-ammo'), speed: $('hud-speed'),
    objective: $('hud-objective'), objectiveText: $('hud-objective-text'),
    card: $('mission-card'), cardTitle: $('mission-card-title'), cardText: $('mission-card-text'),
    flash: $('hud-flash'), message: $('hud-message'),
    start: $('start-screen'), pause: $('pause-menu'),
    busted: $('busted-screen'), wasted: $('wasted-screen'),
    minimap: $('minimap'), hud: $('hud'),
  };
  const mm = el.minimap.getContext('2d');
  let cardTimer = 0, flashTimer = 0, messageTimer = 0;

  function drawMinimap() {
    const S = 168, C = S / 2;
    mm.clearRect(0, 0, S, S);
    // ocean + sand on the east edge
    mm.fillStyle = '#274b8f';
    mm.fillRect(0, 0, S, S);
    const toMm = (v) => C + (v / 240) * (S / 2);
    // city ground
    mm.fillStyle = '#575064';
    mm.fillRect(toMm(-214), toMm(-214), toMm(214) - toMm(-214), toMm(214) - toMm(-214));
    mm.fillStyle = '#f2d5a0';
    mm.fillRect(toMm(214), toMm(-214), toMm(252) - toMm(214), toMm(214) - toMm(-214));
    // roads
    mm.strokeStyle = '#23232e';
    mm.lineWidth = 4;
    for (let k = -4; k <= 4; k++) {
      mm.beginPath(); mm.moveTo(toMm(k * CFG.PITCH), toMm(-214)); mm.lineTo(toMm(k * CFG.PITCH), toMm(214)); mm.stroke();
      mm.beginPath(); mm.moveTo(toMm(-214), toMm(k * CFG.PITCH)); mm.lineTo(toMm(214), toMm(k * CFG.PITCH)); mm.stroke();
    }
    // plaza + park
    mm.fillStyle = '#5d8a4a';
    mm.fillRect(toMm(-150), toMm(-150), toMm(-110) - toMm(-150), toMm(-110) - toMm(-150));
    mm.fillStyle = '#35c4e8';
    mm.beginPath(); mm.arc(toMm(26), toMm(26), 5, 0, Math.PI * 2); mm.fill();
    // garage
    mm.fillStyle = '#00ff9d';
    mm.fillRect(toMm(124), toMm(136), 6, 6);
    // objective diamond
    const obj = world.missions ? world.missions.objective() : null;
    if (obj) {
      const ox = toMm(obj.x), oz = toMm(obj.z);
      mm.fillStyle = '#ffea00';
      mm.save();
      mm.translate(ox, oz); mm.rotate(Math.PI / 4);
      mm.fillRect(-4, -4, 8, 8);
      mm.restore();
    }
    // player arrow
    const p = world.player;
    const px = toMm(p.pos.x), pz = toMm(p.pos.z);
    mm.save();
    mm.translate(px, pz);
    mm.rotate(p.heading());
    mm.fillStyle = '#ffffff';
    mm.beginPath(); mm.moveTo(0, -7); mm.lineTo(5, 5); mm.lineTo(-5, 5); mm.closePath(); mm.fill();
    mm.strokeStyle = '#ff2e88'; mm.lineWidth = 1.5; mm.stroke();
    mm.restore();
    // north indicator
    mm.fillStyle = 'rgba(255,255,255,0.85)';
    mm.font = 'bold 11px Arial';
    mm.textAlign = 'center';
    mm.fillText('N', C, 13);
  }

  return {
    showStart(hasSave) {
      el.start.classList.remove('hidden');
      el.hud.classList.add('hidden');
      const cont = document.getElementById('btn-continue');
      if (cont) cont.style.display = hasSave ? '' : 'none';
    },
    hideStart() { el.start.classList.add('hidden'); el.hud.classList.remove('hidden'); },
    showPause() { el.pause.classList.remove('hidden'); },
    hidePause() { el.pause.classList.add('hidden'); },
    showBusted() { el.busted.classList.remove('hidden'); },
    hideBusted() { el.busted.classList.add('hidden'); },
    showWasted() { el.wasted.classList.remove('hidden'); },
    hideWasted() { el.wasted.classList.add('hidden'); },
    setObjective(text) {
      el.objectiveText.textContent = text;
      el.objective.classList.remove('hidden');
    },
    showMissionCard(title, text) {
      el.cardTitle.textContent = title;
      el.cardText.textContent = text;
      el.card.classList.remove('hidden');
      cardTimer = 4.5;
    },
    flash(text) {
      el.flash.textContent = text;
      el.flash.classList.remove('hidden');
      flashTimer = 2.2;
    },
    message(text) {
      el.message.textContent = text;
      el.message.classList.remove('hidden');
      messageTimer = 3;
    },
    update(dt) {
      const p = world.player;
      const police = world.police;
      // stars
      let stars = '';
      for (let i = 0; i < 5; i++) stars += i < police.wanted ? '★' : '☆';
      el.stars.textContent = stars;
      el.stars.className = 'stars' + (police.wanted > 0 ? ' wanted' : '');
      el.money.textContent = '$' + p.money.toLocaleString('en-US');
      el.clock.textContent = world.dayCycle.clockText();
      el.healthFill.style.width = p.health + '%';
      el.healthFill.className = 'health-fill' + (p.health < 30 ? ' low' : '');
      el.healthText.textContent = Math.ceil(p.health) + ' HP';
      el.weapon.textContent = p.weapon === 'pistol' ? 'PISTOL' : 'FISTS';
      el.ammo.textContent = p.weapon === 'pistol' ? p.ammo + ' / ' + p.reserveAmmo : '—';
      const kmh = Math.round(p.speed() * 3.6);
      el.speed.textContent = p.isDriving() ? kmh + ' km/h' : '';
      el.speed.style.display = p.isDriving() ? '' : 'none';
      drawMinimap();
      if (cardTimer > 0) {
        cardTimer -= dt;
        if (cardTimer <= 0) el.card.classList.add('hidden');
      }
      if (flashTimer > 0) {
        flashTimer -= dt;
        if (flashTimer <= 0) el.flash.classList.add('hidden');
      }
      if (messageTimer > 0) {
        messageTimer -= dt;
        if (messageTimer <= 0) el.message.classList.add('hidden');
      }
    },
  };
}
