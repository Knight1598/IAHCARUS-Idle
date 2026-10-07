import type { PieceSymbol } from "chess.js";

export type SoundPhase = "lock" | "charge" | "dash" | "impact";
/** Six procedural sound families with filtered space noise and stereo echo; no downloads. */
export class SpaceAudio {
  private bus: GainNode;
  private output: GainNode;
  private gate: GainNode;
  private noise: AudioBuffer;
  private sources = new Map<AudioScheduledSourceNode, GainNode>();
  private tails: AudioNode[] = [];
  constructor(readonly context: BaseAudioContext) {
    const c = context;
    this.bus = c.createGain();
    const compressor = c.createDynamicsCompressor();
    compressor.threshold.value = -18; compressor.knee.value = 12;
    compressor.ratio.value = 5; compressor.attack.value = 0.005; compressor.release.value = 0.15;
    this.gate = c.createGain(); this.output = c.createGain();
    this.output.gain.value = 0.35;
    this.bus.connect(compressor).connect(this.gate).connect(this.output).connect(c.destination);
    const delay = c.createDelay(0.4), feedback = c.createGain(), wet = c.createGain();
    const filter = c.createBiquadFilter();
    delay.delayTime.value = 0.115; feedback.gain.value = 0.18; wet.gain.value = 0.15;
    filter.type = "lowpass"; filter.frequency.value = 1700;
    this.bus.connect(delay); delay.connect(filter).connect(wet).connect(compressor);
    filter.connect(feedback).connect(delay);
    this.tails = [delay, filter, wet, feedback, compressor];
    this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = this.noise.getChannelData(0);
    let seed = 2027;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] = seed / 2147483648 - 1;
    }
  }
  get activeVoices() { return this.sources.size; }
  setVolume(value: number) {
    this.output.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), this.context.currentTime, 0.025);
  }
  cancel() {
    const now = this.context.currentTime;
    this.gate.gain.cancelScheduledValues(now);
    this.gate.gain.setTargetAtTime(0, now, 0.008);
    for (const [source, gain] of this.sources) {
      gain.gain.cancelScheduledValues(now); gain.gain.setTargetAtTime(0, now, 0.008);
      try { source.stop(now + 0.025); } catch {}
    }
  }
  dispose() {
    this.cancel(); this.bus.disconnect(); this.gate.disconnect(); this.output.disconnect();
    this.tails.forEach((node) => node.disconnect());
  }
  private voice(source: AudioScheduledSourceNode, duration: number, level: number, cutoff: number, pan: number, nodes: AudioNode[] = [], offset = 0, filterType: BiquadFilterType = "lowpass") {
    const c = this.context, now = c.currentTime + offset;
    const gain = c.createGain(), filter = c.createBiquadFilter(), stereo = c.createStereoPanner();
    filter.type = filterType; filter.Q.value = filterType === "bandpass" ? 2.5 : 0.7; filter.frequency.setValueAtTime(cutoff, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(250, cutoff * 0.45), now + duration);
    stereo.pan.value = Math.max(-0.75, Math.min(0.75, pan));
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + Math.min(0.03, duration * 0.15));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(gain).connect(stereo).connect(this.bus);
    this.sources.set(source, gain);
    source.onended = () => {
      this.sources.delete(source);
      [source, filter, gain, stereo, ...nodes].forEach((node) => node.disconnect());
    };
    source.start(now); source.stop(now + duration + 0.01);
  }
  private tone(from: number, to: number, duration: number, level: number, fm: number, cutoff: number, pan: number, type: OscillatorType = "sine", offset = 0) {
    const c = this.context, now = c.currentTime + offset;
    const carrier = c.createOscillator(); carrier.type = type;
    carrier.frequency.setValueAtTime(from, now);
    carrier.frequency.exponentialRampToValueAtTime(to, now + duration);
    if (fm > 0) {
      const mod = c.createOscillator(), depth = c.createGain();
      mod.frequency.setValueAtTime(from * fm, now);
      mod.frequency.exponentialRampToValueAtTime(Math.max(20, to * fm), now + duration);
      depth.gain.setValueAtTime(from * 0.65, now); depth.gain.exponentialRampToValueAtTime(1, now + duration);
      mod.connect(depth).connect(carrier.frequency);
      this.voice(carrier, duration, level, cutoff, pan, [depth], offset);
      this.sources.set(mod, depth);
      mod.onended = () => { this.sources.delete(mod); mod.disconnect(); };
      mod.start(now); mod.stop(now + duration + 0.01);
    } else this.voice(carrier, duration, level, cutoff, pan, [], offset);
  }
  private sweep(duration: number, cutoff: number, level: number, pan: number, offset = 0, filter: BiquadFilterType = "lowpass") {
    const source = this.context.createBufferSource(); source.buffer = this.noise;
    this.voice(source, duration, level, cutoff, pan, [], offset, filter);
  }
  play(piece: PieceSymbol, phase: SoundPhase, duration = 0.3, capture = false, pan = 0) {
    const c = this.context, now = c.currentTime;
    this.gate.gain.cancelScheduledValues(now); this.gate.gain.setTargetAtTime(1, now, 0.008);
    const length = Math.max(0.12, Math.min(1.2, duration));
    const strength = phase === "impact" && !capture ? 0.35 : 1;
    // Each family has its own waveform, rhythm and layering, rather than a shared pitch sweep.
    switch (piece) {
      case "p": // Compact plasma needle: dry clicks and a quick triangular zip.
        if (phase === "charge") this.sweep(length, 1800, 0.065, pan, 0, "bandpass");
        else {
          this.tone(phase === "lock" ? 620 : 940, phase === "lock" ? 620 : 230,
            phase === "lock" ? 0.045 : 0.12, 0.085 * strength, 0, 2400, pan, "triangle");
          if (phase !== "lock") this.sweep(0.045, 2600, 0.07 * strength, pan, 0, "highpass");
        }
        break;
      case "n": // Torn-space double pulse and a broad rushing air layer.
        if (phase === "lock") { this.sweep(0.035, 1700, 0.045, pan); this.sweep(0.035, 2300, 0.035, pan, 0.06); }
        else if (phase === "charge") {
          this.tone(55, 145, length, 0.09, 3.1, 1800, pan, "triangle");
          this.sweep(length, 1700, 0.04, -pan, 0, "bandpass");
        } else {
          this.sweep(0.24, 2300, 0.15 * strength, pan, 0, "bandpass");
          this.tone(320, 55, 0.14, 0.1 * strength, 2.8, 2000, pan, "square");
          this.tone(180, 40, 0.14, 0.075 * strength, 2.8, 1400, -pan, "square", 0.09);
        }
        break;
      case "b": // Coherent beam: sustained pure harmonics, no common explosion noise.
        if (phase === "lock") this.tone(880, 880, 0.08, 0.035, 0, 3200, pan);
        else {
          const pitch = phase === "charge" ? 220 : phase === "dash" ? 660 : 440;
          const end = phase === "charge" ? 660 : pitch * 0.92;
          const sustain = phase === "charge" ? length : phase === "dash" ? 0.48 : 0.32;
          this.tone(pitch, end, sustain, 0.12 * strength, 0, 3600, pan);
          this.tone(pitch * 2, end * 2, sustain, 0.035 * strength, 0, 4000, -pan);
        }
        break;
      case "r": // Reactor motor and a low cannon burst with a delayed mechanical kick.
        if (phase === "lock") this.tone(90, 65, 0.1, 0.08, 0, 700, pan, "square");
        else if (phase === "charge") {
          this.tone(32, 58, length, 0.11, 0.5, 450, pan, "sawtooth");
          this.sweep(length, 380, 0.11, -pan);
        } else {
          this.tone(95, 25, 0.42, 0.23 * strength, 0, 600, pan);
          this.sweep(0.32, 650, 0.2 * strength, pan);
          this.tone(55, 30, 0.12, 0.09 * strength, 0, 300, -pan, "triangle", 0.13);
        }
        break;
      case "q": // Orbital blades: a cascading crystalline chord, alternating stereo lanes.
        if (phase === "lock") {
          this.tone(1046, 1046, 0.07, 0.035, 0, 4200, pan);
          this.tone(1568, 1568, 0.07, 0.025, 0, 4200, -pan, "sine", 0.055);
        } else for (const [index, ratio] of [1, 1.25, 1.5, 2, 2.5].entries()) {
          const pitch = (phase === "charge" ? 330 : 660) * ratio;
          const gap = phase === "charge" ? length / 7 : 0.055;
          this.tone(pitch, phase === "charge" ? pitch * 1.1 : pitch * 0.8,
            phase === "charge" ? length * 0.5 : 0.24, 0.045 * strength, 0, 4400,
            index % 2 ? -0.5 : 0.5, "sine", index * gap);
        }
        break;
      case "k": // Royal shield: broad, steady brass chord and a resonant low seal.
        if (phase === "lock") this.tone(196, 196, 0.12, 0.05, 0, 1200, pan, "triangle");
        else {
          const sustain = phase === "charge" ? length : 0.35;
          for (const [index, pitch] of [98, 146.8, 196.8].entries())
            this.tone(pitch, pitch * (phase === "impact" ? 0.9 : 1.03), sustain,
              0.045 * strength, 0, 1100, pan, "sawtooth", index * 0.012);
          if (phase === "impact") this.tone(65, 42, 0.5, 0.14 * strength, 0, 500, pan);
        }
        break;
    }
  }
}
