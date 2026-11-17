// Sound, synthesized live with WebAudio — no audio files, no network.
// Engine hum (pitch follows speed), two-tone sirens, gunshots, pickup
// chimes and a low radio loop. Starts on the first user gesture.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let radioTimer = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter).connect(engineGain).connect(ctx.destination);
      engineOsc.start();
      startRadio();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol || 0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  function startRadio() {
    // A slow, moody bass loop: four notes, one bar every 2.4 seconds.
    const notes = [110, 98, 130.8, 98];
    let i = 0;
    radioTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      blip(notes[i % 4], 0.5, 'triangle', 0.045);
      blip(notes[i % 4] * 2, 0.18, 'sine', 0.02);
      i += 1;
    }, 600);
  }

  return {
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    engine(speed01, on) {
      if (!ctx || !engineGain) return;
      engineGain.gain.value = muted ? 0 : (on ? 0.02 + speed01 * 0.05 : 0);
      engineOsc.frequency.value = 48 + speed01 * 130;
    },
    siren() {
      blip(720, 0.32, 'sine', 0.05, 980);
      window.setTimeout(() => blip(980, 0.32, 'sine', 0.05, 720), 340);
    },
    shot() {
      blip(160, 0.09, 'square', 0.16, 60);
    },
    crash() {
      blip(90, 0.25, 'sawtooth', 0.2, 40);
    },
    coin() {
      blip(880, 0.1, 'sine', 0.12);
      window.setTimeout(() => blip(1320, 0.14, 'sine', 0.12), 90);
    },
    mission() {
      blip(523, 0.14, 'triangle', 0.14);
      window.setTimeout(() => blip(659, 0.14, 'triangle', 0.14), 140);
      window.setTimeout(() => blip(784, 0.22, 'triangle', 0.14), 280);
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
  };
}
