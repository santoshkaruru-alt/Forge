// Beeps, buzzes and keeping the screen awake during a workout.

let ctx = null;
let enabled = true;
export const setSound = (on) => { enabled = on; };

/** Must be called from a tap at least once on iOS before sound can play. */
export function unlockAudio() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { ctx = null; }
}

export function beep(kind = 'tick') {
  if (navigator.vibrate) navigator.vibrate(kind === 'go' ? [180, 60, 180] : kind === 'done' ? [300] : 40);
  if (!enabled || !ctx) return;
  const tones = { tick: [880, 0.09], go: [1320, 0.22], done: [660, 0.5] };
  const [freq, dur] = tones[kind] || tones.tick;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

let lock = null;
export async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !lock) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } else if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch { lock = null; }
}

/** A countdown that survives the tab sleeping: it tracks end times, not ticks. */
export class Countdown {
  constructor({ onTick, onEnd }) { this.onTick = onTick; this.onEnd = onEnd; this.end = 0; this.left = 0; this.running = false; this.id = null; this.lastBeep = null; }
  start(sec) { this.left = sec; this.resume(); }
  resume() {
    if (this.running) return;
    this.running = true;
    this.end = Date.now() + this.left * 1000;
    this.loop();
  }
  pause() { if (!this.running) return; this.left = Math.max(0, (this.end - Date.now()) / 1000); this.running = false; clearTimeout(this.id); this.onTick?.(this.remaining()); }
  add(sec) { if (this.running) this.end += sec * 1000; else this.left = Math.max(0, this.left + sec); this.onTick?.(this.remaining()); }
  stop() { this.running = false; clearTimeout(this.id); }
  remaining() { return this.running ? Math.max(0, (this.end - Date.now()) / 1000) : this.left; }
  loop() {
    clearTimeout(this.id);
    if (!this.running) return;
    const r = this.remaining();
    const whole = Math.ceil(r);
    if (whole <= 3 && whole >= 1 && this.lastBeep !== whole) { this.lastBeep = whole; beep('tick'); }
    this.onTick?.(r);
    if (r <= 0) { this.running = false; this.lastBeep = null; this.onEnd?.(); return; }
    this.id = setTimeout(() => this.loop(), 200);
  }
}
