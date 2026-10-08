import type { MusicState } from "./sound.ts";
import { type StereoPCM } from "./audio-synthesis.ts";

export const MUSIC_BPM = 70;
export const MUSIC_BARS = 16;
/** D minor / Phrygian, with a D/A pedal throughout a 16-bar (54.9 second) arrangement.
 * Phrases evolve over several bars instead of cycling a short synthetic melody. */
export function renderMusic(state: MusicState, seed = 7163, sampleRate = 12000): StereoPCM {
  const TAU = Math.PI * 2, D = 73.41619198, A = 110;
  const MUSIC_BPM = 70, MUSIC_BARS = 16;
  let randomValue = seed >>> 0;
  const random = () => { randomValue = (Math.imul(randomValue, 1664525) + 1013904223) >>> 0; return randomValue / 4294967296; };
  const closing = ["mate", "victory", "defeat"].includes(state);
  const duration = closing ? 3.4 : MUSIC_BARS * 4 * 60 / MUSIC_BPM;
  const length = Math.ceil(duration * sampleRate), left = new Float32Array(length), right = new Float32Array(length);
  const tension = state === "threat" || state === "check";
  const energy = state === "ultimate";
  const menu = state === "menu";
  // Voiced chords preserve the tonic. The minor second appears only in the threat phrase.
  const normal = [[D * 2, A * 2, D * 4], [D * 2, D * 2 * 1.189207, A * 2], [D * 2, D * 2 * 1.33484, A * 2], [D * 2, A * 2, D * 2 * 1.7818]];
  const hostile = [[D * 2, D * 2 * 1.05946, A * 2], [D * 2, D * 2 * 1.189207, D * 2 * 1.33484], [D * 2, A * 2, D * 2 * 1.05946], [D * 2, D * 2 * 1.7818, A * 2]];
  const chords = tension ? hostile : normal;
  const bellTimes = [3.4, 15.2, 32.8, 46.5].map((time) => time + random() * 1.1);
  const bellPitches = [A * 4, D * 8, tension ? D * 8 * 1.05946 : D * 6, A * 4];
  const beatDuration = 60 / MUSIC_BPM;
  const chordLength = duration / 4;
  let air = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate, u = t / duration;
    air += 0.008 * (random() * 2 - 1 - air);
    const section = Math.min(3, Math.floor(t / chordLength));
    const blend = Math.min(1, (t % chordLength) / 2.8);
    let padL = 0, padR = 0;
    for (let note = 0; note < 3; note++) {
      const f = chords[section][note], previous = chords[(section + 3) % 4][note];
      const breathing = 0.7 + 0.3 * Math.sin(TAU * u * (2 + note) + note);
      const currentL = Math.sin(TAU * f * t + Math.sin(t * 0.15 + note) * 0.3) + Math.sin(TAU * f * 2.002 * t) * 0.2;
      const previousL = Math.sin(TAU * previous * t + Math.sin(t * 0.15 + note) * 0.3) + Math.sin(TAU * previous * 2.002 * t) * 0.2;
      const currentR = Math.sin(TAU * (f + 0.045) * t + Math.sin(t * 0.14 + note) * 0.3) + Math.sin(TAU * f * 1.998 * t) * 0.2;
      const previousR = Math.sin(TAU * (previous + 0.045) * t + Math.sin(t * 0.14 + note) * 0.3) + Math.sin(TAU * previous * 1.998 * t) * 0.2;
      padL += (currentL * blend + previousL * (1 - blend)) * breathing * 0.014;
      padR += (currentR * blend + previousR * (1 - blend)) * breathing * 0.014;
    }
    const drone = Math.sin(TAU * D * t) * 0.012 + Math.sin(TAU * A * t + Math.sin(t * 0.09) * 0.15) * 0.008;
    const sub = Math.sin(TAU * D * 0.5 * t) * 0.006;
    let pulse = 0, bells = 0;
    if (!menu || energy || tension) {
      const interval = energy ? beatDuration : tension ? beatDuration * 2 : beatDuration * 4;
      const attackTime = t % interval;
      const sequenceBeat = Math.floor(t / beatDuration);
      const accent = sequenceBeat % 4 === 0 ? 1 : 0.65;
      const drumPhase = TAU * (58 * attackTime + 45 * (1 - Math.exp(-attackTime * 14)) / 14);
      pulse = (Math.sin(drumPhase) + Math.sin(drumPhase * 2) * 0.3) * Math.exp(-attackTime * 7.8) * Math.min(1, attackTime / 0.007) * (energy ? 0.045 : tension ? 0.026 : 0.011) * accent;
    }
    for (let bell = 0; bell < bellTimes.length; bell++) {
      const age = t - bellTimes[bell];
      if (age >= 0 && age < 5) bells += (Math.sin(TAU * bellPitches[bell] * age) + Math.sin(TAU * bellPitches[bell] * 2.756 * age) * 0.26) * Math.exp(-age * 0.95) * Math.min(1, age / 0.025) * 0.011;
    }
    let ending = 1;
    if (closing) {
      const shape = Math.sin(Math.PI * u) ** 0.65;
      const resolved = state === "defeat" ? D * 1.05946 : state === "victory" ? D * 1.189207 : D;
      const brass = (Math.sin(TAU * resolved * t) + Math.sin(TAU * resolved * 2 * t) * 0.28 + Math.sin(TAU * resolved * 3 * t) * 0.1) * shape * 0.075;
      padL += brass; padR += brass;
      ending = Math.min(1, t / 0.03, (duration - t) / 0.6);
    } else ending = Math.min(1, t / 0.9, (duration - t) / 0.9);
    left[i] = Math.tanh((padL + drone + sub + pulse + bells + air * 0.025) * (menu ? 1.12 : 1)) * ending;
    right[i] = Math.tanh((padR + drone + sub + pulse + bells * 0.91 + air * 0.024) * (menu ? 1.12 : 1)) * ending;
  }
  return { left, right, sampleRate, duration: length / sampleRate };
}
