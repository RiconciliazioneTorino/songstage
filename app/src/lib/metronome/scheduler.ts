/**
 * Precision metronome scheduler using Web Audio.
 *
 * A single instance owns an AudioContext and schedules short click bursts on
 * the audio timeline. The runtime tempo/anchor comes from the outside (from a
 * broadcast); the scheduler treats `startAt` as a Date.now() reference and
 * translates it to AudioContext time using a single offset established at
 * start.
 */

export type MetronomeUpdate = {
  running: boolean;
  /** Chart quarter-note BPM (what the sheet says). */
  bpm: number;
  /** Date.now() ms of beat index 0. */
  startAt: number;
  /** Audible pulses per bar — carried for consistency; the scheduler doesn't
   * use it directly, strongEvery drives accents. */
  beatsPerBar?: number;
  /** Ticks per chart quarter — 1 for simple meters, 2 for compound 8ths. */
  subdivisionsPerBeat?: number;
  /** Ticks between accents. 4 for 4/4, 3 for 3/4 or 6/8, etc. */
  strongEvery?: number;
};

const SCHEDULE_AHEAD = 0.15; // seconds
const TICK_INTERVAL_MS = 25;

export class Metronome {
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private bpm = 90;
  private startAt = 0;
  private beatsPerBar = 4;
  private subdivisionsPerBeat = 1;
  private strongEvery = 4;
  private nextBeatIndex = 0;
  private baseAudioTime = 0; // audio time corresponding to startAt
  private volume = 0.6;

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
  }

  update(u: MetronomeUpdate) {
    if (!u.running) {
      this.stop();
      return;
    }
    this.ensureContext();
    if (!this.ctx) return;
    this.bpm = u.bpm;
    this.startAt = u.startAt;
    this.beatsPerBar = u.beatsPerBar ?? 4;
    this.subdivisionsPerBeat = Math.max(1, u.subdivisionsPerBeat ?? 1);
    this.strongEvery = Math.max(
      1,
      u.strongEvery ?? this.beatsPerBar * this.subdivisionsPerBeat
    );
    // Anchor: audioTime that corresponds to Date.now() == startAt.
    const now = Date.now();
    const audioNow = this.ctx.currentTime;
    this.baseAudioTime = audioNow - (now - this.startAt) / 1000;
    // Skip past ticks: start scheduling from the next upcoming one.
    const tickSec = 60 / (this.bpm * this.subdivisionsPerBeat);
    const elapsedTicks = (now - this.startAt) / 1000 / tickSec;
    this.nextBeatIndex = Math.max(0, Math.ceil(elapsedTicks));
    this.running = true;
    this.startScheduler();
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  dispose() {
    this.stop();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }

  private ensureContext() {
    if (this.ctx) return;
    if (typeof window === 'undefined') return;
    // Safari still only exposes the prefixed constructor.
    const w = window as typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
  }

  private startScheduler() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  private tick() {
    if (!this.running || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    const horizon = this.ctx.currentTime + SCHEDULE_AHEAD;
    const tickSec = 60 / (this.bpm * this.subdivisionsPerBeat);
    while (true) {
      const t = this.baseAudioTime + this.nextBeatIndex * tickSec;
      if (t > horizon) break;
      if (t >= this.ctx.currentTime - 0.02) {
        this.scheduleClick(t, this.nextBeatIndex % this.strongEvery === 0);
      }
      this.nextBeatIndex++;
    }
  }

  private scheduleClick(when: number, accent: boolean) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = accent ? 1600 : 1000;
    osc.type = 'square';
    const peak = this.volume * (accent ? 1.0 : 0.55);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(when);
    osc.stop(when + 0.08);
  }
}
