/**
 * DIALR — mock audio.
 *
 * On Android these sounds are files played through the telecom audio session.
 * In the browser demo we synthesise them, so ringtone previews and keypad DTMF
 * genuinely make sound without shipping a single byte of audio.
 *
 * The AudioContext is created lazily on first user gesture — browsers refuse to
 * start one otherwise, and a dialer that throws on load is not a good look.
 */

let ctx = null;
let activeNodes = [];
let previewTimer = null;

function context() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

export function resume() {
  const c = context();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

function stopAll() {
  for (const n of activeNodes) { try { n.stop(); } catch { /* already stopped */ } }
  activeNodes = [];
  if (previewTimer) { clearTimeout(previewTimer); previewTimer = null; }
}

/** Two-frequency DTMF pair, exactly like a real keypad. */
export function playDtmf(pair, { gain = 0.08, ms = 90 } = {}) {
  const c = context();
  if (!c || !pair) return;
  resume();
  const now = c.currentTime;
  const g = c.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(gain, now + 0.008);
  g.gain.setValueAtTime(gain, now + ms / 1000 - 0.02);
  g.gain.linearRampToValueAtTime(0, now + ms / 1000);
  g.connect(c.destination);

  for (const f of pair) {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, now);
    o.connect(g);
    o.start(now);
    o.stop(now + ms / 1000 + 0.02);
  }
}

/**
 * Render a `synth` score from src/data/media.js.
 * @param {{wave:string, notes:number[], tempo:number, gain:number}} synth
 * @param {{loop?:boolean, maxMs?:number}} opts
 */
export function playSynth(synth, { loop = false, maxMs = 6000 } = {}) {
  stopAll();
  const c = context();
  if (!c || !synth || !synth.notes?.length) return () => {};
  resume();

  const step = synth.tempo / 1000;
  const master = c.createGain();
  master.gain.value = synth.gain ?? 0.12;
  master.connect(c.destination);

  const scheduleFrom = (t0) => {
    synth.notes.forEach((freq, i) => {
      if (!freq) return;
      const start = t0 + i * step;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = synth.wave || 'sine';
      o.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(1, start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0008, start + step * 0.92);
      o.connect(g); g.connect(master);
      o.start(start); o.stop(start + step);
      activeNodes.push(o);
    });
  };

  const cycle = synth.notes.length * step;
  const cycles = loop ? Math.ceil(maxMs / 1000 / cycle) : 1;
  for (let i = 0; i < cycles; i++) scheduleFrom(c.currentTime + 0.03 + i * cycle);

  previewTimer = setTimeout(stopAll, loop ? maxMs : cycle * 1000 + 200);
  return stopAll;
}

export function stop() { stopAll(); }

/** Soft click for dock/nav taps — deliberately quieter than DTMF. */
export function tick(freq = 1400, gain = 0.025) {
  playDtmf([freq], { gain, ms: 28 });
}
