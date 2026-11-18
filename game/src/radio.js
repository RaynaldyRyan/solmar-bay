// Radio: 3 stations synthesized live with Web Audio — no audio files, no
// network. Each station has a chord progression, a bass line and a lead
// arpeggio at its own tempo; the scheduler queues notes a bar ahead. Audio
// only starts after the first user gesture (autoplay policy); the HUD shows
// the station and track either way.
import { STATIONS } from './config.js';

const PROGRESSIONS = {
  neon: [[0, 3, 7, 10], [8, 11, 3, 7], [5, 8, 0, 3], [10, 1, 5, 8]],
  latin: [[0, 4, 7, 11], [5, 9, 0, 4], [7, 11, 2, 5], [5, 9, 0, 4]],
  jazz: [[0, 3, 7, 10], [5, 8, 0, 3], [2, 5, 9, 0], [7, 10, 2, 5]],
};

export function createRadio() {
  let ctx = null;
  let master = null;
  let timer = null;
  let nextTime = 0;
  let step = 0;
  let bar = 0;
  const radio = {
    station: 0,
    track: 0,
    playing: false,
    started: false,
  };

  function note(freq, at, dur, type, gain) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  function schedule() {
    const st = STATIONS[radio.station];
    const beat = 60 / st.bpm / 2; // eighth notes
    while (nextTime < ctx.currentTime + 0.35) {
      const prog = PROGRESSIONS[st.id];
      const chord = prog[bar % prog.length];
      const root = st.root;
      const s = step % 8;
      if (s === 0) note(root, nextTime, beat * 3, 'sine', 0.16);
      if (s === 4) note(root * 1.5, nextTime, beat * 2, 'sine', 0.1);
      if (s % 2 === 0) note(root * 4 * Math.pow(2, chord[s / 2] / 12), nextTime, beat * 0.9, st.id === 'jazz' ? 'triangle' : 'sawtooth', 0.05);
      if (s === 2 || s === 6) note(root * 8 * Math.pow(2, chord[(s + 1) % 4] / 12), nextTime, beat * 0.5, 'square', 0.025);
      step += 1;
      if (step % 8 === 0) bar += 1;
      nextTime += beat;
    }
  }

  return {
    ...radio,
    get stationName() {
      return STATIONS[radio.station].name;
    },
    get trackName() {
      return STATIONS[radio.station].tracks[radio.track];
    },
    start() {
      if (radio.started) return;
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
        nextTime = ctx.currentTime + 0.1;
        timer = window.setInterval(schedule, 90);
        radio.started = true;
        radio.playing = true;
      } catch {
        // No audio device: the game plays on silently.
      }
    },
    nextStation() {
      radio.station = (radio.station + 1) % STATIONS.length;
      radio.track = (radio.track + 1) % STATIONS[radio.station].tracks.length;
      bar = 0;
      step = 0;
      return STATIONS[radio.station].name;
    },
    setStation(i) {
      radio.station = i % STATIONS.length;
      bar = 0;
      step = 0;
    },
    setTrack(i) {
      radio.track = i % STATIONS[radio.station].tracks.length;
    },
    toggle() {
      if (!ctx) return;
      if (ctx.state === 'running') {
        ctx.suspend();
        radio.playing = false;
      } else {
        ctx.resume();
        radio.playing = true;
      }
    },
    stop() {
      if (timer) window.clearInterval(timer);
      if (ctx) ctx.close().catch(() => {});
    },
  };
}
