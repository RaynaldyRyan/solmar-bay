// Procedural sound: every sound is synthesized with WebAudio, no audio files.
// The context starts suspended and is resumed on the first user gesture; every
// call is a no-op until then, so screenshots taken without a click stay silent.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineNoise = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.oceanGain = null;
    this.started = false;
  }

  // Call from a click handler. Safe to call repeatedly.
  start() {
    if (this.started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this._startEngineLoop();
      this._startOceanLoop();
      this.started = true;
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch { /* audio unavailable: play silent */ }
  }

  _startEngineLoop() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  _startOceanLoop() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // brown-ish rumble
      data[i] = last * 3.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.oceanGain = ctx.createGain();
    this.oceanGain.gain.value = 0;
    src.connect(filter);
    filter.connect(this.oceanGain);
    this.oceanGain.connect(this.master);
    src.start();
  }

  // speedKmh 0..130, inCar whether the player is driving.
  setEngine(speedKmh, inCar) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const level = inCar ? 0.05 + Math.min(0.09, speedKmh / 130 * 0.09) : 0;
    this.engineGain.gain.setTargetAtTime(level, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + speedKmh * 1.1, t, 0.1);
  }

  // 0..1, louder near the beach.
  setOcean(level) {
    if (!this.started) return;
    this.oceanGain.gain.setTargetAtTime(level * 0.12, this.ctx.currentTime, 0.5);
  }

  setSiren(on) {
    if (!this.started) return;
    if (on && !this.sirenOsc) {
      const ctx = this.ctx;
      this.sirenOsc = ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = ctx.createGain();
      this.sirenGain.gain.value = 0.0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this._sirenPhase = 0;
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); } catch { /* already stopped */ }
      this.sirenOsc = null;
      this.sirenGain = null;
    }
  }

  update(dt) {
    if (!this.started || !this.sirenOsc) return;
    this._sirenPhase = (this._sirenPhase + dt) % 1.2;
    const hi = this._sirenPhase < 0.6;
    this.sirenOsc.frequency.setTargetAtTime(hi ? 950 : 700, this.ctx.currentTime, 0.05);
    this.sirenGain.gain.setTargetAtTime(0.045, this.ctx.currentTime, 0.1);
  }

  _burst(duration, freq, type, gain, slideTo) {
    if (!this.started) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  _noiseBurst(duration, gain, filterFreq) {
    if (!this.started) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  gunshot() { this._noiseBurst(0.16, 0.5, 2800); this._burst(0.1, 160, 'sine', 0.4, 60); }
  punch() { this._burst(0.09, 120, 'sine', 0.35, 70); }
  pickup() { this._burst(0.12, 660, 'sine', 0.25, 990); }
  missionDone() {
    this._burst(0.14, 523, 'triangle', 0.25);
    setTimeout(() => this._burst(0.14, 659, 'triangle', 0.25), 120);
    setTimeout(() => this._burst(0.22, 784, 'triangle', 0.28), 240);
  }
  busted() { this._burst(0.5, 220, 'sawtooth', 0.2, 110); }
  crash() { this._noiseBurst(0.25, 0.4, 900); }
}
