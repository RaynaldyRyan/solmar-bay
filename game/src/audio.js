// Procedural WebAudio: engine hum, siren, gunshots, ocean wash, UI blips.
// Everything is synthesized with oscillators and filtered noise — no audio
// files. Every call is guarded: in a headless run the context may stay
// suspended, and the game must never crash on sound.
export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineGain = null;
  let sirenOsc = null, sirenGain = null, sirenTimer = null, oceanSrc = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }

  function noiseBuffer(seconds) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  return {
    start() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      // ocean wash: looped filtered noise, quiet
      try {
        if (!oceanSrc) {
          oceanSrc = ctx.createBufferSource();
          oceanSrc.buffer = noiseBuffer(3);
          oceanSrc.loop = true;
          const f = ctx.createBiquadFilter();
          f.type = 'lowpass'; f.frequency.value = 420;
          const g = ctx.createGain(); g.gain.value = 0.05;
          oceanSrc.connect(f); f.connect(g); g.connect(master);
          oceanSrc.start();
        }
      } catch (e) { /* sound is optional */ }
    },
    engine(on, speed01) {
      if (!ctx) return;
      try {
        if (on && !engineOsc) {
          engineOsc = ctx.createOscillator();
          engineOsc.type = 'sawtooth';
          engineGain = ctx.createGain(); engineGain.gain.value = 0.0;
          const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
          engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
          engineOsc.start();
        }
        if (engineOsc) {
          engineOsc.frequency.value = 55 + speed01 * 130;
          engineGain.gain.value = on ? 0.05 + speed01 * 0.05 : 0.0;
        }
      } catch (e) { /* ignore */ }
    },
    siren(on) {
      if (!ctx) return;
      try {
        if (on && !sirenOsc) {
          sirenOsc = ctx.createOscillator();
          sirenOsc.type = 'triangle';
          sirenGain = ctx.createGain(); sirenGain.gain.value = 0.045;
          sirenOsc.connect(sirenGain); sirenGain.connect(master);
          sirenOsc.start();
          let hi = false;
          sirenTimer = setInterval(() => {
            if (!sirenOsc) return;
            hi = !hi;
            sirenOsc.frequency.setValueAtTime(hi ? 880 : 660, ctx.currentTime);
          }, 380);
        } else if (!on && sirenOsc) {
          clearInterval(sirenTimer);
          sirenOsc.stop(); sirenOsc.disconnect();
          sirenOsc = null; sirenTimer = null;
        }
      } catch (e) { /* ignore */ }
    },
    gunshot() {
      if (!ctx) return;
      try {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer(0.18);
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.35, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
        src.connect(f); f.connect(g); g.connect(master);
        src.start();
      } catch (e) { /* ignore */ }
    },
    blip(freq) {
      if (!ctx) return;
      try {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq || 660;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.18, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        o.connect(g); g.connect(master);
        o.start(); o.stop(ctx.currentTime + 0.2);
      } catch (e) { /* ignore */ }
    },
    thud() {
      if (!ctx) return;
      try {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 90;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.3, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        o.connect(g); g.connect(master);
        o.start(); o.stop(ctx.currentTime + 0.16);
      } catch (e) { /* ignore */ }
    },
  };
}
