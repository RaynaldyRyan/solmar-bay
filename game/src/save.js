// Save / load through localStorage. One slot, JSON, versioned so old saves are
// ignored rather than misread.
const KEY = 'solmar-bay-save-v1';

export function saveGame(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, ...data }));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.v === 1 ? data : null;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
