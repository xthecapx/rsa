/**
 * Procedural cues: footsteps, wire blips, alarms, chimes. WebAudio only, so
 * nothing is downloaded and every cue is shaped to the moment it marks. The
 * Kenney clips still cover UI clicks, jingles and the music loop.
 */
export type SynthId = "step" | "door" | "wire" | "capture" | "alarm" | "chime" | "fanfare" | "tick"
  | "knock" | "snuff" | "toll" | "cold" | "glow";

export class Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private stepParity = 0;

  /** Create the context lazily, after a user gesture. */
  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => undefined);
    return this.ctx;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  play(id: SynthId): void {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    switch (id) {
      case "step": {
        // Two alternating scuffs so a walk never sounds like a metronome.
        this.stepParity ^= 1;
        this.noise(ctx, t, 0.05, 900 + this.stepParity * 250 + Math.random() * 120, 0.16);
        return;
      }
      case "door":
        this.tone(ctx, t, "triangle", 180, 120, 0.18, 0.22);
        this.noise(ctx, t + 0.05, 0.08, 500, 0.08);
        return;
      case "wire":
        this.tone(ctx, t, "sine", 880, 1320, 0.09, 0.12);
        this.tone(ctx, t + 0.1, "sine", 1320, 1320, 0.06, 0.08);
        return;
      case "capture":
        this.tone(ctx, t, "triangle", 660, 660, 0.09, 0.14);
        this.tone(ctx, t + 0.09, "triangle", 990, 990, 0.14, 0.14);
        return;
      case "alarm":
        for (let i = 0; i < 3; i++) this.tone(ctx, t + i * 0.11, "square", i % 2 ? 330 : 440, i % 2 ? 330 : 440, 0.09, 0.05);
        return;
      case "chime":
        this.tone(ctx, t, "sine", 880, 880, 0.18, 0.12);
        this.tone(ctx, t + 0.12, "sine", 1320, 1320, 0.32, 0.12);
        return;
      case "fanfare": {
        // Three quick pickup notes climbing a C-major triad, then the full
        // chord held with a soft attack and a slow release, and a sparkle on
        // top. Everything rises; nothing decays before it has landed.
        const pickup = [523.25, 659.25, 783.99];
        pickup.forEach((hz, i) => this.sustain(ctx, t + i * 0.11, "triangle", hz, 0.02, 0.07, 0.08, 0.11));
        const chord = [523.25, 659.25, 783.99, 1046.5];
        chord.forEach((hz, i) => this.sustain(ctx, t + 0.34, "triangle", hz, 0.04, 0.55, 0.9, i === 3 ? 0.13 : 0.08));
        chord.forEach((hz) => this.sustain(ctx, t + 0.34, "sine", hz * 2, 0.06, 0.4, 0.8, 0.02));
        [1567.98, 2093, 2637.02].forEach((hz, i) => this.sustain(ctx, t + 0.62 + i * 0.09, "sine", hz, 0.01, 0.05, 0.35, 0.05));
        return;
      }
      case "tick":
        this.tone(ctx, t, "sine", 1800, 1800, 0.012, 0.035);
        return;
      case "knock":
        // Two knuckles on old wood: a low body thump plus a dull click.
        for (const at of [t, t + 0.19]) {
          this.tone(ctx, at, "triangle", 120, 62, 0.11, 0.34);
          this.noise(ctx, at, 0.05, 320, 0.22);
        }
        return;
      case "snuff":
        this.noise(ctx, t, 0.16, 2600, 0.07);
        this.noise(ctx, t + 0.04, 0.22, 700, 0.05);
        return;
      case "toll":
        // A distant clock: three strikes, each quieter, with a slow bell decay.
        [0, 0.8, 1.6].forEach((delay, i) => {
          const volume = 0.12 * (1 - i * 0.28);
          this.sustain(ctx, t + delay, "sine", 196, 0.01, 0.05, 1.5, volume);
          this.sustain(ctx, t + delay, "sine", 466, 0.01, 0.03, 0.9, volume * 0.35);
        });
        return;
      case "cold":
        this.wind(ctx, t, 1.6);
        return;
      case "glow":
        [1175, 1480, 1760].forEach((hz, i) => this.tone(ctx, t + i * 0.07, "sine", hz, hz * 1.5, 0.28, 0.05));
        return;
    }
  }

  /** Attack, hold, release: for notes that should land, not plink. */
  private sustain(ctx: AudioContext, at: number, type: OscillatorType, hz: number, attack: number, hold: number, release: number, volume: number): void {
    if (!this.master) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = hz;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + attack);
    gain.gain.setValueAtTime(volume, at + attack + hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
    osc.connect(gain).connect(this.master);
    osc.start(at);
    osc.stop(at + attack + hold + release + 0.05);
  }

  private tone(ctx: AudioContext, at: number, type: OscillatorType, from: number, to: number, duration: number, volume: number): void {
    if (!this.master) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain).connect(this.master);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  private noise(ctx: AudioContext, at: number, duration: number, frequency: number, volume: number): void {
    if (!this.master) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer(ctx, 0.2);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass"; filter.frequency.value = frequency; filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(at);
    source.stop(at + duration + 0.02);
  }

  /** A draft through the house: low noise that swells and settles again. */
  private wind(ctx: AudioContext, at: number, duration: number): void {
    if (!this.master) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer(ctx, duration);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass"; filter.Q.value = 3;
    filter.frequency.setValueAtTime(300, at);
    filter.frequency.exponentialRampToValueAtTime(900, at + duration * 0.45);
    filter.frequency.exponentialRampToValueAtTime(240, at + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.3, at + duration * 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(at);
    source.stop(at + duration + 0.02);
  }

  private noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      // Brown-ish noise: integrate white noise and leak it back so it stays bounded.
      last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02;
      data[i] = last * 3.5;
    }
    return buffer;
  }
}
