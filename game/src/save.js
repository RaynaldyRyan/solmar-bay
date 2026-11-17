// Save / load through localStorage: money, mission progress, health and the
// player's last position. A save is written on mission completion, on entering
// the garage, and when the player pauses.
const KEY = 'solmar-bay-neon-tide-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch (e) { return null; }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({
      money: state.money | 0,
      mission: state.mission | 0,
      health: state.health | 0,
      hour: state.hour,
      x: state.x, z: state.z,
      savedAt: Date.now(),
    }));
    return true;
  } catch (e) { return false; }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
