// Save / load (localStorage, guarded: private windows just lose persistence).
// The staged save the game boots into: chapter 4 in progress, 3 jobs done,
// $42,310 in the bank — the state the screenshots stage from.
import { SAVE_KEY } from './config.js';

export function stagedSave() {
  return {
    day: 6,
    minutes: 18 * 60 + 50,
    cash: 42310,
    respect: 62,
    tapes: 7,
    tapesFound: [0, 2, 5, 8, 11, 14, 17],
    properties: ['safehouse'],
    jobsDone: ['ch1', 'ch2', 'ch3'],
    jobActive: 'ch4',
    jobStage: 2,
    weapons: [0, 1],
    weapon: 1,
    station: 0,
    bestRace: 87400,
  };
}

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return stagedSave();
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return stagedSave();
    return { ...stagedSave(), ...data };
  } catch {
    return stagedSave();
  }
}

export function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
