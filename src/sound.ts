import type { PieceSymbol } from "chess.js";
import { combatStyles } from "./combat";

export type SoundPhase = "lock" | "charge" | "dash" | "impact";
/** Procedural FM, filtered space noise and a short stereo echo; no audio downloads. */
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
  private voice(source: AudioScheduledSourceNode, duration: number, level: number, cutoff: number, pan: number, nodes: AudioNode[] = []) {
    const c = this.context, now = c.currentTime;
    const gain = c.createGain(), filter = c.createBiquadFilter(), stereo = c.createStereoPanner();
    filter.type = "lowpass"; filter.frequency.setValueAtTime(cutoff, now);
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
  private tone(from: number, to: number, duration: number, level: number, fm: number, cutoff: number, pan: number) {
    const c = this.context, now = c.currentTime;
    const carrier = c.createOscillator(), mod = c.createOscillator(), depth = c.createGain();
    carrier.type = "sine"; mod.type = "sine";
    carrier.frequency.setValueAtTime(from, now);
    carrier.frequency.exponentialRampToValueAtTime(to, now + duration);
    mod.frequency.setValueAtTime(from * fm, now);
    mod.frequency.exponentialRampToValueAtTime(Math.max(20, to * fm), now + duration);
    depth.gain.setValueAtTime(from * 0.65, now);
    depth.gain.exponentialRampToValueAtTime(1, now + duration);
    mod.connect(depth).connect(carrier.frequency);
    this.voice(carrier, duration, level, cutoff, pan, [depth]);
    // Track modulators too so cancellation releases every oscillator.
    this.sources.set(mod, depth);
    mod.onended = () => { this.sources.delete(mod); mod.disconnect(); };
    mod.start(now); mod.stop(now + duration + 0.01);
  }
  private sweep(duration: number, cutoff: number, level: number, pan: number) {
    const source = this.context.createBufferSource();
    source.buffer = this.noise;
    this.voice(source, duration, level, cutoff, pan);
  }
  play(piece: PieceSymbol, phase: SoundPhase, duration = 0.3, capture = false, pan = 0) {
    const c = this.context, now = c.currentTime, style = combatStyles[piece];
    this.gate.gain.cancelScheduledValues(now); this.gate.gain.setTargetAtTime(1, now, 0.008);
    if (phase === "lock") {
      this.tone(style.pitch * 2, style.pitch * 2.6, 0.08, 0.035, 0.5, 1700, pan);
    } else if (phase === "charge") {
      const length = Math.max(0.12, Math.min(1.2, duration));
      this.tone(style.pitch * 0.55, style.pitch * 2.2, length, 0.075, style.fm, style.cutoff, pan);
      this.sweep(length, style.cutoff * 0.7, 0.035, -pan);
    } else if (phase === "dash") {
      this.tone(style.pitch * 3.5, style.pitch * 0.6, piece === "b" ? 0.45 : 0.22,
        0.09, style.fm, style.cutoff, pan);
      this.sweep(piece === "r" ? 0.32 : 0.18, style.cutoff, 0.07, pan);
      if (piece === "q") this.tone(style.pitch * 4, style.pitch, 0.28, 0.035, 1.5, style.cutoff, -pan);
    } else {
      const strength = capture ? 1 : 0.35;
      this.tone(65 + style.weight * 65, 28, capture ? 0.45 : 0.18, 0.2 * strength, 0.5, 650, pan);
      this.sweep(capture ? 0.28 : 0.12, style.cutoff, 0.11 * strength, pan);
      if (capture) this.tone(style.pitch * 2, style.pitch * 0.75, 0.36, 0.065, style.fm, style.cutoff, -pan);
    }
  }
}
