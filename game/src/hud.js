// The HUD: every DOM panel the player sees, mapped to its system.
//   mission card  <- missions.js (chapter, timer, objective, stage bar, NEXT)
//   dispatch feed <- police.js (callsigns, distances, states)
//   clock/cash/stars/zone <- world.js + police.js
//   weapon hotbar <- combat.js + config.js WEAPONS
//   radio widget  <- radio.js (station + track)
//   speedometer   <- vehicles.js (speed, gear, nitro, condition)
//   minimap       <- city.js drawPlan + police.js (cones, search ring)
//   vitals        <- world.js (health, armor, respect)
//   dialogue      <- portraits.js (canvas faces) + missions.js
//   full map (M)  <- city.js drawPlan + missions.js (jobs) + save.js (stats)
// No bottom keybind cheat-sheet: controls live in the pause/help menu.
import { PROPERTIES, STATIONS, WEAPONS, WORLD } from './config.js';
import { RACE_ROUTE, drawPlan, worldToPlan } from './city.js';
import { DEALER_AT, RESPRAY_AT } from './world.js';
import { formatTimer, missionNext, missionObjective } from './missions.js';
import { gearOf, kmh } from './vehicles.js';
import { drawPortrait, portraitById } from './portraits.js';

function $(id) {
  return document.getElementById(id);
}

function money(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}

export function createHud(city) {
  // One offscreen plan render feeds both the minimap and the full map.
  const planCanvas = document.createElement('canvas');
  planCanvas.width = 1024;
  planCanvas.height = 717;
  drawPlan(planCanvas.getContext('2d'), 1024, 717, { labels: false });

  const minimap = $('minimap');
  const mm = minimap.getContext('2d');
  const mapCanvas = $('map-canvas');
  const mc = mapCanvas.getContext('2d');
  let mapOpen = false;
  let toastTimer = 0;

  // Hotbar slots, built once.
  const hotbar = $('hotbar');
  WEAPONS.forEach((w, i) => {
    const slot = document.createElement('div');
    slot.className = 'hotbar-slot';
    slot.id = `hotbar-${i}`;
    slot.innerHTML = `<span class="hotbar-key">${i + 1}</span><span class="hotbar-name">${w.name}</span>`;
    hotbar.appendChild(slot);
  });

  function drawMinimap(state) {
    const S = minimap.width;
    const R = 190; // world metres shown across the minimap
    const p = state.player;
    mm.clearRect(0, 0, S, S);
    mm.save();
    mm.beginPath();
    mm.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    mm.clip();
    // Plan region around the player.
    const pw = (R * 2) / (WORLD.maxX - WORLD.minX) * planCanvas.width;
    const ph = (R * 2) / (WORLD.maxZ - WORLD.minZ) * planCanvas.height;
    const [cx, cy] = worldToPlan(p.x, p.z, planCanvas.width, planCanvas.height);
    mm.drawImage(planCanvas, cx - pw / 2, cy - ph / 2, pw, ph, 0, 0, S, S);
    const toMm = (x, z) => [S / 2 + (x - p.x) / R * (S / 2), S / 2 + (z - p.z) / R * (S / 2)];
    // Search ring (wanted cooldown) + mission marker + tapes + properties.
    if (state.police.zone === 'COOLDOWN') {
      mm.strokeStyle = 'rgba(255,60,60,0.8)';
      mm.lineWidth = 2;
      mm.beginPath();
      mm.arc(S / 2, S / 2, S / 2 - 6, 0, Math.PI * 2);
      mm.stroke();
    }
    if (state.mission.active) {
      const [mx, my] = toMm(state.mission.active.at[0], state.mission.active.at[1]);
      mm.fillStyle = '#ffd166';
      mm.beginPath();
      mm.arc(mx, my, 5, 0, Math.PI * 2);
      mm.fill();
    }
    for (const t of city.tapes) {
      if (state.tapesFound.has(t.id)) continue;
      const [tx, ty] = toMm(t.x, t.z);
      if (tx < 0 || ty < 0 || tx > S || ty > S) continue;
      mm.fillStyle = '#ff5d8f';
      mm.fillRect(tx - 2, ty - 2, 4, 4);
    }
    if (state.race && state.race.next) {
      const [rx, ry] = toMm(state.race.next[0], state.race.next[1]);
      mm.strokeStyle = '#ff9f1c';
      mm.lineWidth = 2.5;
      mm.beginPath();
      mm.arc(rx, ry, 7, 0, Math.PI * 2);
      mm.stroke();
    }
    // Police cones (blue wedges) + player cone (white).
    for (const u of state.police.units) {
      const [ux, uy] = toMm(u.car.x, u.car.z);
      mm.fillStyle = 'rgba(70,130,255,0.85)';
      mm.beginPath();
      mm.moveTo(ux, uy);
      mm.arc(ux, uy, 14, u.car.heading - Math.PI / 2 - 0.5, u.car.heading - Math.PI / 2 + 0.5);
      mm.closePath();
      mm.fill();
    }
    mm.fillStyle = '#ffffff';
    mm.beginPath();
    mm.moveTo(S / 2, S / 2);
    mm.arc(S / 2, S / 2, 12, p.heading - Math.PI / 2 - 0.45, p.heading - Math.PI / 2 + 0.45);
    mm.closePath();
    mm.fill();
    mm.restore();
    mm.strokeStyle = 'rgba(255,255,255,0.6)';
    mm.lineWidth = 2;
    mm.beginPath();
    mm.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    mm.stroke();
  }

  function drawFullMap(state) {
    const W = mapCanvas.width;
    const H = mapCanvas.height;
    mc.clearRect(0, 0, W, H);
    mc.drawImage(planCanvas, 0, 0, W, H);
    // District names in the top-left corner of each district: the job markers
    // sit near the centres, so centred labels would collide with them.
    mc.fillStyle = 'rgba(255,255,255,0.65)';
    mc.font = 'bold 13px system-ui, sans-serif';
    mc.textAlign = 'left';
    for (const d of city.districts) {
      const [lx, ly] = worldToPlan(d.x0 + 18, d.z0 + 26, W, H);
      mc.fillText(d.name.toUpperCase(), lx, ly);
    }
    const mark = (x, z, color, label) => {
      const [mx, my] = worldToPlan(x, z, W, H);
      mc.fillStyle = color;
      mc.beginPath();
      mc.arc(mx, my, 7, 0, Math.PI * 2);
      mc.fill();
      mc.strokeStyle = '#000';
      mc.lineWidth = 2;
      mc.stroke();
      if (label) {
        mc.fillStyle = '#fff';
        mc.font = 'bold 12px system-ui, sans-serif';
        mc.textAlign = 'left';
        mc.fillText(label, mx + 10, my + 4);
      }
    };
    // GPS route: player -> active job. A wide translucent glow under a
    // solid core, plus a ring at the destination — the old thin dashed
    // line vanished against the road dashes.
    if (state.mission.active) {
      const [x0, y0] = worldToPlan(state.player.x, state.player.z, W, H);
      const [x1, y1] = worldToPlan(state.mission.active.at[0], state.mission.active.at[1], W, H);
      mc.strokeStyle = 'rgba(255,209,102,0.35)';
      mc.lineWidth = 7;
      mc.beginPath();
      mc.moveTo(x0, y0);
      mc.lineTo(x1, y1);
      mc.stroke();
      mc.strokeStyle = '#ffd166';
      mc.lineWidth = 3;
      mc.beginPath();
      mc.moveTo(x0, y0);
      mc.lineTo(x1, y1);
      mc.stroke();
      mc.strokeStyle = '#ffd166';
      mc.lineWidth = 2.5;
      mc.beginPath();
      mc.arc(x1, y1, 11, 0, Math.PI * 2);
      mc.stroke();
    }
    // Service icons: respray garage, weapon dealer, safehouse, race start.
    const icon = (x, z, color, letter) => {
      const [ix, iy] = worldToPlan(x, z, W, H);
      mc.fillStyle = color;
      mc.fillRect(ix - 7, iy - 7, 14, 14);
      mc.strokeStyle = '#000';
      mc.lineWidth = 2;
      mc.strokeRect(ix - 7, iy - 7, 14, 14);
      mc.fillStyle = '#111';
      mc.font = 'bold 10px system-ui, sans-serif';
      mc.textAlign = 'center';
      mc.fillText(letter, ix, iy + 3.5);
    };
    icon(RESPRAY_AT[0], RESPRAY_AT[1], '#ff9f1c', 'R');
    icon(DEALER_AT[0], DEALER_AT[1], '#ff4757', 'W');
    icon(PROPERTIES[0].at[0], PROPERTIES[0].at[1], '#4cc9f0', 'S');
    icon(RACE_ROUTE[0][0], RACE_ROUTE[0][1], '#b5179e', 'F');
    for (const j of state.jobs) {
      const done = state.mission.done.has(j.id);
      mark(j.at[0], j.at[1], done ? '#2f9e44' : j.id === (state.mission.active && state.mission.active.id) ? '#ffd166' : '#888888', `CH${j.chapter}`);
    }
    for (const t of city.tapes) {
      if (state.tapesFound.has(t.id)) continue;
      const [tx, ty] = worldToPlan(t.x, t.z, W, H);
      mc.fillStyle = '#ff5d8f';
      mc.fillRect(tx - 2, ty - 2, 4, 4);
    }
    mark(state.player.x, state.player.z, '#ffffff', 'YOU');
  }

  function renderJobList(state) {
    const el = $('map-jobs');
    el.innerHTML = state.jobs.map((j) => {
      const done = state.mission.done.has(j.id);
      const active = state.mission.active && state.mission.active.id === j.id;
      const status = done ? 'COMPLETE' : active ? 'IN PROGRESS' : 'LOCKED';
      return `<div class="job-row ${done ? 'done' : active ? 'active' : 'locked'}">
        <span class="job-ch">CH${j.chapter}</span>
        <span class="job-name">${j.name}</span>
        <span class="job-kind">${j.kind}</span>
        <span class="job-pay">${money(j.payout)}</span>
        <span class="job-status">${status}</span></div>`;
    }).join('');
  }

  function renderStats(state) {
    $('map-stats').innerHTML =
      `<div>Cash <b>${money(state.cash)}</b></div>` +
      `<div>Respect <b>${state.respect}/100</b></div>` +
      `<div>Sunset Tapes <b>${state.tapesFound.size}/20</b></div>` +
      `<div>Properties <b>${state.properties.length}/3</b></div>` +
      `<div>Day <b>${state.time.day}</b> — <b>${String(Math.floor(state.time.minutes / 60)).padStart(2, '0')}:${String(state.time.minutes % 60).padStart(2, '0')}</b></div>`;
  }

  function setDialogue(id, name, text) {
    const dlg = $('dialogue');
    dlg.classList.remove('hidden');
    const c = $('dlg-portrait');
    drawPortrait(c.getContext('2d'), id, 0, 0, c.width);
    $('dlg-name').textContent = name;
    $('dlg-text').textContent = text;
  }
  function clearDialogue() {
    $('dialogue').classList.add('hidden');
  }

  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    toastTimer = 3;
  }

  function update(state, dt) {
    // Mission card.
    const m = state.mission;
    $('mc-chapter').textContent = m.active ? `CH ${m.active.chapter} — ${m.active.name}` : 'FREE ROAM';
    $('mc-timer').textContent = m.active ? formatTimer(m.timer) : '';
    $('mc-objective').textContent = missionObjective(m);
    $('mc-sub').textContent = m.subStatus;
    $('mc-next').textContent = m.active ? `NEXT: ${missionNext(m)}` : '';
    const stageFill = $('mc-stage-fill');
    if (m.active) {
      stageFill.style.width = `${((m.stage + 1) / m.active.stages.length) * 100}%`;
      $('mc-stage-label').textContent = `STAGE ${m.stage + 1}/${m.active.stages.length}`;
    } else {
      stageFill.style.width = '0%';
      $('mc-stage-label').textContent = '';
    }
    // Race overrides the mission card's objective line.
    if (state.race) {
      $('mc-chapter').textContent = 'SIDE JOB — OCEAN DRIVE GP';
      $('mc-objective').textContent = `POS ${state.race.pos}/3 — LAP ${state.race.lap}/2`;
      $('mc-sub').textContent = `Checkpoint ${state.race.checkpoint + 1}/${state.race.route.length}`;
      $('mc-timer').textContent = formatTimer(state.race.time);
    }
    // Dispatch feed — during a race this panel becomes the leaderboard;
    // with no heat and no traffic it hides (an empty "the city is quiet"
    // box wastes prime screen real estate).
    const dispEl = $('dispatch');
    const dispTitle = dispEl.querySelector('.panel-title');
    if (state.race) {
      dispEl.classList.remove('hidden');
      dispTitle.textContent = 'RACE';
      const gaps = ['—', '+0.9s', '+2.3s'];
      const order = ['Maya', 'Rico', 'Dex'];
      const mine = order.splice(0, 1)[0];
      order.splice(state.race.pos - 1, 0, mine);
      $('dispatch-lines').innerHTML = order.map((n, i) =>
        `<div class="${n === 'Maya' ? 'lb-you' : ''}">${i + 1}. ${n}${n === 'Maya' ? ' (YOU)' : ''} &nbsp;${gaps[i]}</div>`).join('');
    } else if (state.police.wanted === 0 && state.police.dispatch.length === 0) {
      dispEl.classList.add('hidden');
    } else {
      dispEl.classList.remove('hidden');
      dispTitle.textContent = 'DISPATCH';
      $('dispatch-lines').innerHTML = state.police.dispatch.map((l) => `<div>${l}</div>`).join('') ||
        '<div class="dim">No police traffic — the city is quiet.</div>';
    }
    // Top right.
    const hh = String(Math.floor(state.time.minutes / 60)).padStart(2, '0');
    const mm2 = String(state.time.minutes % 60).padStart(2, '0');
    $('clock').textContent = `DAY ${state.time.day} — ${hh}:${mm2}`;
    $('cash').textContent = money(state.cash);
    $('stars').textContent = '★'.repeat(state.police.wanted) + '☆'.repeat(5 - state.police.wanted);
    $('stars').className = state.police.wanted > 0 ? 'wanted-hot' : '';
    const zone = $('zone-pill');
    zone.textContent = state.police.zone;
    zone.className = `zone-${state.police.zone.toLowerCase().replace(' ', '-')}`;
    WEAPONS.forEach((w, i) => {
      const slot = $(`hotbar-${i}`);
      slot.classList.toggle('active', i === state.weapon);
      slot.classList.toggle('owned', state.weapons.includes(i));
    });
    // Radio + speedo.
    $('radio-station').textContent = STATIONS[state.radio.station].name;
    $('radio-track').textContent = STATIONS[state.radio.station].tracks[state.radio.track];
    if (state.mode === 'car' && state.car) {
      $('speed-num').textContent = kmh(state.car);
      $('speed-gear').textContent = gearOf(state.car);
      $('speed-car').textContent = `${state.car.type === 'cruiser' ? 'PD Cruiser' : state.carName} — ${state.car.condition}%`;
      $('nitro-fill').style.width = `${state.car.nitro}%`;
      $('speedo').classList.remove('onfoot');
    } else {
      $('speed-num').textContent = '—';
      $('speed-gear').textContent = 'ON FOOT';
      $('speed-car').textContent = WEAPONS[state.weapon].name;
      $('nitro-fill').style.width = '0%';
      $('speedo').classList.add('onfoot');
    }
    // Vitals + district + minimap.
    $('health-fill').style.width = `${state.health}%`;
    $('armor-fill').style.width = `${state.armor}%`;
    $('respect-val').textContent = `RESPECT ${state.respect}`;
    $('district-label').textContent = state.district || 'Solmar Bay';
    drawMinimap(state);
    // Drift / near-miss score popup.
    if (state.driftScore > 0) {
      $('score-pop').textContent = `DRIFT +${Math.floor(state.driftScore)}`;
      $('score-pop').classList.remove('hidden');
    } else {
      $('score-pop').classList.add('hidden');
    }
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) $('toast').classList.add('hidden');
    }
    if (mapOpen) {
      drawFullMap(state);
      renderJobList(state);
      renderStats(state);
    }
  }

  function openMap(state) {
    mapOpen = true;
    $('map-screen').classList.remove('hidden');
    drawFullMap(state);
    renderJobList(state);
    renderStats(state);
  }
  function closeMap() {
    mapOpen = false;
    $('map-screen').classList.add('hidden');
  }

  function buildStartScreen(save) {
    const hh = String(Math.floor(save.minutes / 60)).padStart(2, '0');
    const mm2 = String(save.minutes % 60).padStart(2, '0');
    $('save-details').innerHTML =
      `<div>CHAPTER ${save.jobActive ? '4' : '—'} — The Marina Exchange</div>` +
      `<div>${money(save.cash)} &nbsp;·&nbsp; Respect ${save.respect} &nbsp;·&nbsp; Day ${save.day}, ${hh}:${mm2}</div>` +
      `<div>Sunset Tapes ${save.tapes}/20 &nbsp;·&nbsp; Properties ${save.properties.length}/3</div>`;
    const wrap = $('portraits');
    wrap.innerHTML = '';
    for (const p of ['maya', 'dizzy', 'vera', 'rico', 'kwan', 'sal']) {
      const info = portraitById(p);
      const c = document.createElement('canvas');
      c.width = 96;
      c.height = 96;
      drawPortrait(c.getContext('2d'), p, 0, 0, 96);
      const d = document.createElement('div');
      d.className = 'portrait';
      d.appendChild(c);
      const name = document.createElement('div');
      name.className = 'portrait-name';
      name.textContent = info.name;
      const role = document.createElement('div');
      role.className = 'portrait-role';
      role.textContent = info.role;
      d.appendChild(name);
      d.appendChild(role);
      wrap.appendChild(d);
    }
  }

  return { update, openMap, closeMap, setDialogue, clearDialogue, toast, buildStartScreen, isMapOpen: () => mapOpen };
}
