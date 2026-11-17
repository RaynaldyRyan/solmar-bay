// Solmar Bay — save game.
// One clear job: persist money, completed missions, player position and the
// clock to localStorage, and restore them on load.

import { SAVE_KEY } from './config.js';

export function saveState(game) {
  const data = {
    version: 1,
    savedAt: Date.now(),
    money: game.money,
    missionsCompleted: [...game.missions.completed],
    player: {
      x: game.player.x,
      z: game.player.z,
      health: game.player.health,
      ammo: game.player.ammo,
      pistolOwned: game.player.pistolOwned,
    },
    hour: game.day.hour,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearState() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch { /* storage unavailable */ }
}

export function hasSave() {
  return loadState() !== null;
}
