import type { PieceSymbol } from "chess.js";

export type SoundPhase = "lock" | "charge" | "dash" | "impact" | "death" | "check" | "move" | "attack";
type CanonicalPhase = Exclude<SoundPhase, "move" | "attack">;
export const SOUND_VARIANTS = 4;

/** Independent bags exhaust all four variants and never repeat across a bag boundary. */
export class SoundVariantBag {
  private bags = new Map<string, number[]>();
  private previous = new Map<string, number>();
  private random: () => number;
  constructor(random: () => number = Math.random) { this.random = random; }
  next(key: string): number {
    let bag = this.bags.get(key);
    if (!bag?.length) {
      bag = Array.from({ length: SOUND_VARIANTS }, (_, index) => index);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.max(0, Math.min(i, Math.floor(this.random() * (i + 1))));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (bag.at(-1) === this.previous.get(key)) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      this.bags.set(key, bag);
    }
    const variant = bag.pop()!;
    this.previous.set(key, variant);
    return variant;
  }
}

type Envelope = "punch" | "rise" | "swell";
type LayerBase = { duration: number; level: number; cutoff: number; pan: number; offset: number; envelope: Envelope };
export type SoundLayer = LayerBase & (
  { kind: "tone"; from: number; to: number; fm: number; wave: OscillatorType } |
  { kind: "noise"; filter: BiquadFilterType }
);
export type SoundRecipe = SoundLayer[];
function canonicalPhase(phase: SoundPhase): CanonicalPhase {
  return phase === "move" ? "dash" : phase === "attack" ? "charge" : phase;
}
function composer(pan: number) {
  const layers: SoundRecipe = [];
  const tone = (from: number, to: number, duration: number, level = 0.075, wave: OscillatorType = "sine", offset = 0, fm = 0, cutoff = 3200, lane = pan, envelope: Envelope = "punch") => {
    layers.push({ kind: "tone", from, to, duration, level, wave, offset, fm, cutoff, pan: lane, envelope });
  };
  const noise = (duration: number, cutoff: number, level = 0.075, offset = 0, filter: BiquadFilterType = "bandpass", lane = pan, envelope: Envelope = "punch") => {
    layers.push({ kind: "noise", duration, cutoff, level, offset, filter, pan: lane, envelope });
  };
  return { layers, tone, noise };
}

/** Pure recipes expose structural variation for tests and the armory's sound previews. */
export function pieceSoundRecipe(piece: PieceSymbol, requestedPhase: SoundPhase, variant: number, duration = 0.3, capture = false, pan = 0): SoundRecipe {
  const phase = canonicalPhase(requestedPhase), v = ((Math.floor(variant) % 4) + 4) % 4;
  const length = Math.max(0.12, Math.min(1.2, duration));
  const { layers, tone: t, noise: n } = composer(pan);
  const signature = { p: 740, n: 145, b: 440, r: 58, q: 660, k: 196 }[piece];
  if (phase === "lock") {
    if (v === 0) t(signature, signature, 0.06, 0.04, piece === "r" ? "square" : "triangle");
    if (v === 1) { t(signature, signature * 1.5, 0.045, 0.035); t(signature * 2, signature * 2, 0.035, 0.025, "sine", 0.07); }
    if (v === 2) { n(0.04, 2200, 0.04, 0, "highpass"); t(signature * 0.75, signature, 0.12, 0.035, "sine", 0.035, 0, 2600, pan, "swell"); }
    if (v === 3) for (let i = 0; i < 3; i++) t(signature, signature * (1 + i / 4), 0.025, 0.025, "triangle", i * 0.035);
    return layers;
  }
  if (phase === "check") {
    if (v === 0) { t(signature * 0.75, signature * 0.5, 0.3, 0.06, "sawtooth", 0, 0, 1600); n(0.2, 1100, 0.035); }
    if (v === 1) for (let i = 0; i < 3; i++) t(signature * (i % 2 ? 1.1 : 0.7), signature * 0.7, 0.075, 0.05, "triangle", i * 0.12);
    if (v === 2) { t(signature * 0.5, signature * 0.5, 0.48, 0.075, "sine", 0, 0, 1800, pan, "swell"); t(signature * 1.06, signature, 0.3, 0.035, "sine", 0.08); }
    if (v === 3) { n(0.08, 3100, 0.055, 0, "highpass"); t(signature * 1.5, signature * 0.4, 0.4, 0.065, "triangle", 0.07, 1.5); }
    return layers;
  }
  if (phase === "death") {
    const tail = piece === "r" || piece === "k" ? 0.65 : 0.4;
    if (v === 0) { t(signature, Math.max(22, signature * 0.13), tail, 0.095, piece === "b" || piece === "q" ? "sine" : "triangle", 0, piece === "n" ? 3 : 0); n(tail, piece === "r" ? 600 : 2300, 0.055); }
    if (v === 1) for (let i = 0; i < 4; i++) { t(signature * (1.5 - i * 0.25), Math.max(25, signature * 0.15), 0.15, 0.045, "sine", i * 0.08, 0, 3400, i % 2 ? -0.45 : 0.45); n(0.03, 3000 - i * 450, 0.03, i * 0.08, "highpass"); }
    if (v === 2) { n(0.4, piece === "r" ? 480 : 1700, 0.085, 0, "bandpass", pan, "swell"); t(signature * 0.5, Math.max(20, signature * 0.08), 0.55, 0.08, "sine", 0.1); }
    if (v === 3) { t(signature, signature * 1.7, 0.09, 0.045, "triangle"); n(0.05, 3600, 0.075, 0.09, "highpass"); t(signature * 0.4, 25, tail, 0.085, "sine", 0.13); }
    return layers;
  }
  switch (piece) {
    case "p": // Plasma spear: needle clicks, quick triangular cuts, compact punctures.
      if (phase === "charge") {
        if (v === 0) { n(length, 1800, 0.055, 0, "bandpass", pan, "rise"); t(180, 620, length, 0.035, "triangle", 0, 0, 2400, pan, "rise"); }
        if (v === 1) for (let i = 0; i < 3; i++) t(350 + i * 140, 650 + i * 140, length / 3, 0.05, "triangle", i * length / 4);
        if (v === 2) { t(420, 840, length, 0.06, "sine", 0, 1.25, 2800, pan, "swell"); n(0.025, 3200, 0.06); }
        if (v === 3) { n(length * 0.65, 2600, 0.055, 0, "highpass", pan, "rise"); t(720, 720, 0.045, 0.05, "square", length * 0.55); t(1080, 1080, 0.035, 0.035, "sine", length * 0.75); }
      } else if (phase === "dash") {
        if (v === 0) { t(940, 230, 0.12, 0.075, "triangle"); n(0.045, 2600, 0.06, 0, "highpass"); }
        if (v === 1) { t(750, 200, 0.07, 0.065, "square"); t(1200, 380, 0.07, 0.045, "triangle", 0.085); }
        if (v === 2) { n(0.18, 2200, 0.085, 0, "bandpass"); t(640, 480, 0.16, 0.04, "sine", 0, 0, 2800, pan, "swell"); }
        if (v === 3) for (let i = 0; i < 3; i++) { n(0.025, 3300, 0.045, i * 0.045, "highpass"); t(1100 - i * 190, 380, 0.06, 0.04, "triangle", i * 0.045); }
      } else {
        if (v === 0) { t(600, 90, 0.1, 0.1, "triangle"); n(0.055, 2800, 0.085, 0, "highpass"); }
        if (v === 1) { n(0.025, 3300, 0.11, 0, "highpass"); t(160, 50, 0.17, 0.09); }
        if (v === 2) { t(880, 440, 0.06, 0.06, "sine"); t(290, 65, 0.11, 0.075, "square", 0.04); n(0.09, 1500, 0.05, 0.04); }
        if (v === 3) for (let i = 0; i < 2; i++) { t(400, 80, 0.09, 0.065, "triangle", i * 0.06); n(0.03, 2400, 0.055, i * 0.06, "highpass"); }
      }
      break;
    case "n": // Phantom movement: torn space, broken rhythm and crossing stereo air.
      if (phase === "charge") {
        if (v === 0) { t(55, 145, length, 0.085, "triangle", 0, 3.1, 1800, pan, "rise"); n(length, 1700, 0.035, 0, "bandpass", -pan); }
        if (v === 1) for (let i = 0; i < 3; i++) { t(70, 170, length * 0.35, 0.055, "square", i * length / 3, 1.8); n(0.045, 1400, 0.05, i * length / 3); }
        if (v === 2) { n(length, 2400, 0.085, 0, "bandpass", pan, "rise"); t(240, 80, length, 0.06, "sine", 0, 2.8, 2100, -pan, "swell"); }
        if (v === 3) { t(40, 110, length * 0.6, 0.065, "sawtooth", 0, 0, 700); t(220, 510, length * 0.5, 0.05, "triangle", length * 0.45, 2.2); }
      } else if (phase === "dash") {
        if (v === 0) { n(0.24, 2300, 0.13); t(320, 55, 0.14, 0.09, "square", 0, 2.8); t(180, 40, 0.14, 0.065, "square", 0.09, 2.8, 1400, -pan); }
        if (v === 1) for (let i = 0; i < 3; i++) n(0.07, 2100 + i * 350, 0.09, i * 0.06, "bandpass", i % 2 ? -0.6 : 0.6);
        if (v === 2) { t(130, 600, 0.06, 0.075, "triangle", 0, 2); n(0.22, 3100, 0.11, 0.05, "highpass", -pan); t(270, 60, 0.12, 0.06, "sine", 0.14); }
        if (v === 3) { n(0.3, 1800, 0.115, 0, "bandpass", pan, "swell"); t(480, 80, 0.25, 0.07, "triangle", 0, 3.5); }
      } else {
        if (v === 0) { t(230, 40, 0.2, 0.13, "square", 0, 2.5); n(0.12, 1900, 0.12); }
        if (v === 1) { n(0.04, 3600, 0.12, 0, "highpass"); t(360, 65, 0.15, 0.095, "triangle", 0.04, 2); n(0.07, 2400, 0.08, 0.14); }
        if (v === 2) for (let i = 0; i < 3; i++) { t(270 - i * 50, 45, 0.07, 0.075, "square", i * 0.065, 1.4); n(0.05, 1600, 0.045, i * 0.065); }
        if (v === 3) { t(520, 100, 0.3, 0.1, "triangle", 0, 3.7); n(0.18, 2300, 0.13, 0.06, "bandpass", -pan, "swell"); }
      }
      break;
    case "b": // Prism beam: coherent harmonics, glass resonance and singing laser lines.
      if (phase === "charge") {
        if (v === 0) { t(220, 660, length, 0.09, "sine", 0, 0, 3600, pan, "rise"); t(440, 1320, length, 0.03, "sine", 0, 0, 4000, -pan, "rise"); }
        if (v === 1) for (const [i, ratio] of [1, 1.5, 2].entries()) t(220 * ratio, 440 * ratio, length * 0.6, 0.045, "sine", i * length / 5, 0, 4200, pan, "swell");
        if (v === 2) { t(440, 440, length, 0.065, "triangle", 0, 0, 2200, pan, "rise"); t(880, 1760, length * 0.6, 0.04, "sine", length * 0.35); }
        if (v === 3) for (let i = 0; i < 4; i++) t(330 * (1 + i / 3), 660 * (1 + i / 3), length / 3, 0.04, "sine", i * length / 5);
      } else if (phase === "dash") {
        if (v === 0) { t(660, 610, 0.42, 0.095); t(1320, 1220, 0.42, 0.03, "sine", 0, 0, 4000, -pan); }
        if (v === 1) for (let i = 0; i < 3; i++) t(990, 440, 0.11, 0.055, "sine", i * 0.075, 0, 4000, i % 2 ? -0.5 : 0.5);
        if (v === 2) { t(350, 720, 0.25, 0.08, "triangle", 0, 0, 3300, pan, "swell"); t(1400, 900, 0.16, 0.035, "sine", 0.16); }
        if (v === 3) { t(880, 660, 0.28, 0.065); t(1100, 825, 0.28, 0.055, "sine", 0.06, 0, 4000, -pan); t(1760, 1320, 0.22, 0.02, "sine", 0.12); }
      } else {
        if (v === 0) { t(440, 405, 0.32, 0.12); t(880, 810, 0.3, 0.04, "sine", 0, 0, 4000, -pan); }
        if (v === 1) for (const [i, ratio] of [1, 1.51, 2.1].entries()) t(660 * ratio, 550 * ratio, 0.23, 0.055, "sine", i * 0.035);
        if (v === 2) { t(1800, 450, 0.075, 0.06); t(330, 320, 0.4, 0.085, "triangle", 0.035); t(990, 960, 0.3, 0.035, "sine", 0.08); }
        if (v === 3) for (let i = 0; i < 4; i++) t(880 - i * 110, 440 - i * 30, 0.1, 0.05, "sine", i * 0.055);
      }
      break;
    case "r": // Siege engine: reactor growl, mechanical latches and low cannon recoil.
      if (phase === "charge") {
        if (v === 0) { t(32, 58, length, 0.1, "sawtooth", 0, 0.5, 450, pan, "rise"); n(length, 380, 0.095, 0, "lowpass", -pan, "rise"); }
        if (v === 1) for (let i = 0; i < 4; i++) { t(55, 40, 0.08, 0.07, "square", i * length / 5, 0, 500); n(0.04, 850, 0.045, i * length / 5); }
        if (v === 2) { t(27, 90, length, 0.11, "triangle", 0, 1.2, 850, pan, "swell"); t(110, 220, length * 0.55, 0.04, "sawtooth", length * 0.4, 0, 1200); }
        if (v === 3) { n(length * 0.6, 650, 0.1, 0, "lowpass", pan, "rise"); t(75, 75, 0.045, 0.07, "square", length * 0.65, 0, 500); t(45, 80, length * 0.25, 0.07, "sawtooth", length * 0.72, 0, 500); }
      } else if (phase === "dash") {
        if (v === 0) { t(55, 38, 0.3, 0.105, "sawtooth", 0, 0, 600); n(0.28, 700, 0.09, 0, "lowpass"); }
        if (v === 1) for (let i = 0; i < 3; i++) { t(70, 38, 0.08, 0.07, "triangle", i * 0.085, 0, 600); n(0.025, 1200, 0.035, i * 0.085); }
        if (v === 2) { n(0.3, 950, 0.1, 0, "bandpass", pan, "swell"); t(35, 65, 0.22, 0.095, "sawtooth", 0, 0.6, 700); }
        if (v === 3) { t(80, 28, 0.14, 0.115, "triangle", 0, 0, 600); n(0.2, 500, 0.075, 0.12, "lowpass"); t(120, 50, 0.07, 0.04, "square", 0.19, 0, 800); }
      } else {
        if (v === 0) { t(95, 25, 0.42, 0.2, "sine", 0, 0, 600); n(0.32, 650, 0.17, 0, "lowpass"); t(55, 30, 0.12, 0.07, "triangle", 0.13, 0, 300, -pan); }
        if (v === 1) { n(0.04, 1800, 0.15); t(130, 25, 0.25, 0.19, "triangle", 0, 0, 800); n(0.45, 380, 0.1, 0.1, "lowpass"); }
        if (v === 2) for (let i = 0; i < 2; i++) { t(80, 28, 0.24, 0.135, "sine", i * 0.14, 0, 500); n(0.12, 850, 0.1, i * 0.14, "lowpass"); }
        if (v === 3) { t(45, 22, 0.6, 0.17, "sine", 0, 0, 300); n(0.15, 1300, 0.15); t(180, 55, 0.1, 0.075, "square", 0.08, 0, 1000); }
      }
      break;
    case "q": // Orbital blades: crystalline chords and multi-lane blade patterns.
      if (phase === "charge") {
        if (v === 0) for (const [i, ratio] of [1, 1.25, 1.5, 2, 2.5].entries()) t(330 * ratio, 365 * ratio, length * 0.5, 0.035, "sine", i * length / 7, 0, 4400, i % 2 ? -0.5 : 0.5);
        if (v === 1) for (const ratio of [1, 1.5, 2]) t(440 * ratio, 660 * ratio, length, 0.04, "sine", 0, 0, 4400, pan, "rise");
        if (v === 2) { t(250, 500, length, 0.065, "triangle", 0, 1.5, 2800, pan, "swell"); for (let i = 0; i < 3; i++) t(1000 + i * 220, 1400 + i * 220, 0.08, 0.03, "sine", i * length / 4); }
        if (v === 3) for (const [i, ratio] of [2, 1.5, 1.25, 1].entries()) t(660 * ratio, 700 * ratio, length / 3, 0.045, "sine", i * length / 5, 0, 4400, i % 2 ? 0.4 : -0.4);
      } else if (phase === "dash") {
        if (v === 0) for (const [i, ratio] of [1, 1.25, 1.5, 2, 2.5].entries()) t(660 * ratio, 528 * ratio, 0.22, 0.035, "sine", i * 0.045, 0, 4400, i % 2 ? -0.5 : 0.5);
        if (v === 1) { n(0.18, 3200, 0.065, 0, "highpass"); for (const ratio of [1, 1.25, 1.5]) t(880 * ratio, 440 * ratio, 0.2, 0.045); }
        if (v === 2) for (let i = 0; i < 3; i++) { t(1300, 500, 0.08, 0.06, "triangle", i * 0.08, 0, 4400, i % 2 ? -0.5 : 0.5); n(0.03, 3600, 0.035, i * 0.08, "highpass"); }
        if (v === 3) { t(440, 660, 0.28, 0.065, "sine", 0, 0, 4400, pan, "swell"); t(1100, 880, 0.28, 0.04, "sine", 0.03, 0, 4400, -pan); t(1760, 1320, 0.2, 0.025, "sine", 0.1); }
      } else {
        if (v === 0) for (const [i, ratio] of [1, 1.25, 1.5, 2].entries()) t(660 * ratio, 440 * ratio, 0.25, 0.055, "sine", i * 0.035, 0, 4400, i % 2 ? -0.5 : 0.5);
        if (v === 1) { n(0.05, 4200, 0.085, 0, "highpass"); for (const ratio of [1, 1.5, 2]) t(880 * ratio, 770 * ratio, 0.38, 0.04, "sine", 0.03); }
        if (v === 2) for (let i = 0; i < 4; i++) { t(1600 - i * 250, 600 - i * 80, 0.09, 0.06, "triangle", i * 0.06); n(0.025, 3000, 0.035, i * 0.06, "highpass"); }
        if (v === 3) { t(220, 110, 0.35, 0.085, "triangle"); for (const [i, ratio] of [1, 1.25, 1.5].entries()) t(880 * ratio, 440 * ratio, 0.25, 0.045, "sine", 0.08 + i * 0.045, 0, 4400, i % 2 ? -0.5 : 0.5); }
      }
      break;
    case "k": // Sovereign: brass authority, resonant seals and shield-like low harmonics.
      if (phase === "charge") {
        if (v === 0) for (const [i, pitch] of [98, 146.8, 196.8].entries()) t(pitch, pitch * 1.03, length, 0.04, "sawtooth", i * 0.012, 0, 1100, pan, "rise");
        if (v === 1) { t(65, 130, length, 0.08, "triangle", 0, 0, 1300, pan, "swell"); t(196, 294, length * 0.5, 0.055, "sawtooth", length * 0.4, 0, 1700); }
        if (v === 2) for (let i = 0; i < 3; i++) { t(98, 147, length / 3, 0.055, "triangle", i * length / 4, 0, 1000); t(196, 294, length / 3, 0.03, "sine", i * length / 4); }
        if (v === 3) { n(length, 950, 0.055, 0, "bandpass", pan, "rise"); t(147, 220, length, 0.06, "sawtooth", 0, 0, 1400, pan, "swell"); t(440, 440, 0.08, 0.035, "sine", length * 0.8); }
      } else if (phase === "dash") {
        if (v === 0) for (const [i, pitch] of [98, 146.8, 196.8].entries()) t(pitch, pitch * 1.03, 0.3, 0.04, "sawtooth", i * 0.012, 0, 1100);
        if (v === 1) { t(147, 98, 0.2, 0.08, "triangle", 0, 0, 1400); n(0.14, 1300, 0.055); t(294, 196, 0.17, 0.035, "sine", 0.06); }
        if (v === 2) for (let i = 0; i < 2; i++) { t(110, 73, 0.12, 0.065, "sawtooth", i * 0.11, 0, 1000); t(220, 146, 0.12, 0.025, "sine", i * 0.11); }
        if (v === 3) { t(65, 130, 0.28, 0.085, "triangle", 0, 0, 1200, pan, "swell"); t(390, 196, 0.1, 0.055, "sine", 0.12); }
      } else {
        if (v === 0) { for (const [i, pitch] of [98, 146.8, 196.8].entries()) t(pitch, pitch * 0.9, 0.35, 0.04, "sawtooth", i * 0.012, 0, 1100); t(65, 42, 0.5, 0.12, "sine", 0, 0, 500); }
        if (v === 1) { n(0.08, 1600, 0.09); t(130, 65, 0.35, 0.1, "triangle", 0, 0, 1300); t(390, 294, 0.4, 0.04, "sine", 0.06); }
        if (v === 2) for (const [i, pitch] of [196, 147, 98].entries()) { t(pitch, pitch * 0.6, 0.22, 0.065, "sawtooth", i * 0.08, 0, 1300); t(pitch * 2, pitch * 1.5, 0.2, 0.025, "sine", i * 0.08); }
        if (v === 3) { t(55, 33, 0.6, 0.13, "sine", 0, 0, 400); t(294, 196, 0.23, 0.075, "triangle", 0.04); n(0.15, 1700, 0.06, 0.06); }
      }
      break;
  }
  if (phase === "impact" && !capture) for (const layer of layers) layer.level *= 0.32;
  return layers;
}

export function eventSoundRecipe(event: string, variant: number, pan = 0): SoundRecipe {
  const v = ((Math.floor(variant) % 4) + 4) % 4;
  const { layers, tone: t, noise: n } = composer(pan);
  const warning = ["check", "double-check", "discovered-check", "queen-fallen", "defeat"].includes(event);
  const triumph = ["mate", "victory", "promotion", "mission", "comeback", "intro"].includes(event);
  const ratios = warning ? [1, 1.06, 1.5] : triumph ? [1, 1.25, 1.5, 2] : [1, 1.5, 2];
  const pitch = ({ fork: 760, mate: 147, "double-check": 220, "discovered-check": 196, check: 196,
    promotion: 440, rescue: 294, escape: 520, block: 110, castle: 165, "en-passant": 660,
    "first-blood": 330, recapture: 247, "queen-fallen": 130, comeback: 392, "capture-streak": 587,
    endgame: 196, mission: 523, intro: 220, victory: 262, defeat: 110, ui: 880, capture: 350,
  } as Record<string, number>)[event] ?? 440;
  const short = event === "ui", duration = short ? 0.055 : warning ? 0.35 : 0.28;
  const level = short ? 0.025 : 0.042;
  if (v === 0) for (const [i, ratio] of ratios.entries()) t(pitch * ratio, pitch * ratio * (warning ? 0.72 : 1.04), duration, level, warning ? "triangle" : "sine", i * (short ? 0.025 : 0.07), 0, 3400, i % 2 ? -0.3 : 0.3);
  if (v === 1) {
    for (const ratio of ratios) t(pitch * ratio, pitch * ratio, duration * 1.6, level * 0.75, warning ? "sawtooth" : "sine", 0, 0, warning ? 1600 : 4000, pan, "swell");
    if (!short) n(0.045, 2300, 0.035, 0, "highpass");
  }
  if (v === 2) {
    for (const [i, ratio] of [...ratios].reverse().entries()) t(pitch * ratio, pitch * ratio * (warning ? 0.55 : 0.9), duration * 0.5, level, "triangle", i * (short ? 0.018 : 0.055));
    if (!short) t(pitch / 2, pitch / 2, 0.4, 0.045, "sine", 0.12, 0, 900);
  }
  if (v === 3) {
    t(pitch / 2, pitch, duration, level * 1.2, "triangle", 0, warning ? 1.2 : 0, 2600, pan, "rise");
    for (const [i, ratio] of ratios.entries()) t(pitch * ratio, pitch * ratio, duration * 0.5, level * 0.8, "sine", (short ? 0.02 : 0.12) + i * (short ? 0.018 : 0.035));
  }
  if (event === "fork" || event === "double-check") { t(1200, 850, 0.045, 0.035, "sine", 0, 0, 3600, -0.65); t(1200, 850, 0.045, 0.035, "sine", 0.1, 0, 3600, 0.65); }
  if (event === "block" || event === "castle" || event === "rescue") t(65, 55, 0.25, 0.055, "triangle", 0, 0, 650);
  if (event === "mate" || event === "victory" || event === "defeat") t(warning ? 55 : 98, warning ? 28 : 73, 0.7, 0.075, "sine", 0.03, 0, 650);
  return layers;
}

/** Four variants per family/action, filtered space noise and stereo echo; no downloads. */
export class SpaceAudio {
  readonly context: BaseAudioContext;
  private bus: GainNode;
  private output: GainNode;
  private gate: GainNode;
  private noise: AudioBuffer;
  private sources = new Map<AudioScheduledSourceNode, GainNode>();
  private tails: AudioNode[] = [];
  private variants: SoundVariantBag;
  lastVariant: { key: string; variant: number } | null = null;
  constructor(context: BaseAudioContext, random: () => number = Math.random) {
    this.context = context;
    this.variants = new SoundVariantBag(random);
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
  private voice(source: AudioScheduledSourceNode, layer: SoundLayer, nodes: AudioNode[] = []) {
    const c = this.context, now = c.currentTime + layer.offset;
    const gain = c.createGain(), filter = c.createBiquadFilter(), stereo = c.createStereoPanner();
    filter.type = layer.kind === "noise" ? layer.filter : "lowpass";
    filter.Q.value = filter.type === "bandpass" ? 2.5 : 0.7;
    filter.frequency.setValueAtTime(layer.cutoff, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(120, layer.cutoff * 0.45), now + layer.duration);
    stereo.pan.value = Math.max(-0.75, Math.min(0.75, layer.pan));
    gain.gain.setValueAtTime(0, now);
    const attack = layer.envelope === "rise" ? layer.duration * 0.75 : layer.envelope === "swell" ? layer.duration * 0.4 : Math.min(0.012, layer.duration * 0.12);
    gain.gain.linearRampToValueAtTime(layer.level, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + layer.duration);
    source.connect(filter).connect(gain).connect(stereo).connect(this.bus);
    this.sources.set(source, gain);
    source.onended = () => {
      this.sources.delete(source);
      [source, filter, gain, stereo, ...nodes].forEach((node) => node.disconnect());
    };
    source.start(now); source.stop(now + layer.duration + 0.01);
  }
  private render(recipe: SoundRecipe) {
    const c = this.context, now = c.currentTime;
    this.gate.gain.cancelScheduledValues(now); this.gate.gain.setTargetAtTime(1, now, 0.008);
    for (const layer of recipe) {
      if (layer.kind === "noise") {
        const source = c.createBufferSource(); source.buffer = this.noise; source.loop = true;
        this.voice(source, layer);
        continue;
      }
      const start = now + layer.offset, carrier = c.createOscillator(); carrier.type = layer.wave;
      carrier.frequency.setValueAtTime(layer.from, start);
      carrier.frequency.exponentialRampToValueAtTime(layer.to, start + layer.duration);
      if (layer.fm > 0) {
        const mod = c.createOscillator(), depth = c.createGain();
        mod.frequency.setValueAtTime(layer.from * layer.fm, start);
        mod.frequency.exponentialRampToValueAtTime(Math.max(20, layer.to * layer.fm), start + layer.duration);
        depth.gain.setValueAtTime(layer.from * 0.65, start);
        depth.gain.exponentialRampToValueAtTime(1, start + layer.duration);
        mod.connect(depth).connect(carrier.frequency);
        this.voice(carrier, layer, [depth]);
        this.sources.set(mod, depth);
        mod.onended = () => { this.sources.delete(mod); mod.disconnect(); };
        mod.start(start); mod.stop(start + layer.duration + 0.01);
      } else this.voice(carrier, layer);
    }
  }
  play(piece: PieceSymbol, phase: SoundPhase, duration = 0.3, capture = false, pan = 0) {
    const key = `${piece}:${canonicalPhase(phase)}`, variant = this.variants.next(key);
    this.lastVariant = { key, variant };
    this.render(pieceSoundRecipe(piece, phase, variant, duration, capture, pan));
    return variant;
  }
  playEvent(event: string, pan = 0) {
    const key = `event:${event}`, variant = this.variants.next(key);
    this.lastVariant = { key, variant };
    this.render(eventSoundRecipe(event, variant, pan));
    return variant;
  }
}
