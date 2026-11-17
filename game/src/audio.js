// Solmar Bay — procedural WebAudio.
// One clear job: every sound in the game, synthesized live (no audio files):
// engine hum, siren, gunshots, ocean wash, UI blips and the mission jingle.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.oceanGain = null;
    this.started = false;
  }

  // Browsers need a user gesture before audio starts.
  start() {
    if (this.started) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startOcean();
      this.started = true;
    } catch {
      // Headless or blocked audio: the game plays silently.
      this.started = false;
    }
  }

  startOcean() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // Brown-ish noise: slow swells, like waves.
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    this.oceanGain = ctx.createGain();
    this.oceanGain.gain.value = 0.05;
    src.connect(filter);
    filter.connect(this.oceanGain);
    this.oceanGain.connect(this.master);
    src.start();
    // Swell the volume slowly, like surf.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain);
    lfoGain.connect(this.oceanGain.gain);
    lfo.start();
  }

  engineStart() {
    if (!this.started) return;
    if (this.engineOsc) return;
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 60;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.08;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  engineStop() {
    if (!this.engineOsc) return;
    try {
      this.engineOsc.stop();
    } catch { /* already stopped */ }
    this.engineOsc = null;
    this.engineGain = null;
  }

  engineSpeed(speedNorm) {
    if (!this.engineOsc) return;
    this.engineOsc.frequency.value = 55 + speedNorm * 140;
    this.engineGain.gain.value = 0.06 + speedNorm * 0.06;
  }

  siren(on) {
    if (!this.started) return;
    if (on && !this.sirenOsc) {
      const ctx = this.ctx;
      this.sirenOsc = ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 700;
      this.sirenLfo = ctx.createOscillator();
      this.sirenLfo.frequency.value = 0.6;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 300;
      this.sirenLfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenGain = ctx.createGain();
      this.sirenGain.gain.value = 0.05;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenLfo.start();
    } else if (!on && this.sirenOsc) {
      try {
        this.sirenOsc.stop();
        this.sirenLfo.stop();
      } catch { /* already stopped */ }
      this.sirenOsc = null;
      this.sirenLfo = null;
      this.sirenGain = null;
    }
  }

  blip(freq, dur, type = 'sine', vol = 0.15) {
    if (!this.started) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(ctx.currentTime + dur);
  }

  gunshot() {
    if (!this.started) return;
    const ctx = this.ctx;
    const len = ctx.sampleRate * 0.12;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    src.connect(g);
    g.connect(this.master);
    src.start();
    this.blip(120, 0.1, 'square', 0.2);
  }

  gunshotFar() {
    this.blip(90, 0.12, 'square', 0.06);
  }

  punch() {
    this.blip(160, 0.08, 'sine', 0.2);
  }

  pickup() {
    this.blip(880, 0.12, 'sine', 0.18);
    setTimeout(() => this.blip(1320, 0.15, 'sine', 0.18), 90);
  }

  missionComplete() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.22, 'triangle', 0.2), i * 130));
  }

  busted() {
    const notes = [392, 330, 262];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.3, 'sawtooth', 0.12), i * 200));
  }
}
