import type { PieceSymbol } from "chess.js";
import type { CombatCue, CombatPhase } from "./combat-profiles.ts";
export type { CombatCue, CombatPhase } from "./combat-profiles.ts";

export const CAPTURE_DURATION = 2600;
export const CAPTURE_CLASH = 1.12 / 2.6;
export const CAPTURE_CONTACT = 1.85 / 2.6;
export const CAPTURE_DEATH = 2.1 / 2.6;

/** A server update can create a new presentation while the tab is paused. */
export function resumeAnimationStart(start: number, pausedAt: number, now: number) {
  return start + Math.max(0, now - Math.max(pausedAt, start));
}

/** Longer timings are configurable, but never extend the match presentation. */
export function clampCaptureDuration(milliseconds: number) {
  return Number.isFinite(milliseconds) ? Math.max(2000, Math.min(3000, milliseconds)) : CAPTURE_DURATION;
}

/** Audio is dispatched when real render frames cross these points, not timers. */
export const captureCuePoints: readonly Readonly<{ cue: CombatCue; at: number; actor: "attacker" | "defender" }>[] = Object.freeze([
  { cue: "draw", at: .09 / 2.6, actor: "attacker" },
  { cue: "charge", at: .23 / 2.6, actor: "attacker" },
  { cue: "release", at: .76 / 2.6, actor: "attacker" },
  { cue: "clash", at: CAPTURE_CLASH, actor: "defender" },
  { cue: "counter", at: 1.34 / 2.6, actor: "defender" },
  { cue: "finisher", at: 1.57 / 2.6, actor: "attacker" },
  { cue: "impact", at: CAPTURE_CONTACT, actor: "attacker" },
  { cue: "armor", at: 1.91 / 2.6, actor: "defender" },
  { cue: "disintegrate", at: CAPTURE_DEATH, actor: "defender" },
].map(point => Object.freeze(point)) as Readonly<{ cue: CombatCue; at: number; actor: "attacker" | "defender" }>[]);

// Shape and movement identities remain the same across cosmetic skins.
export const combatStyles = {
  p: { sides: 3, lift: 0.16 },
  n: { sides: 4, lift: 1.5 },
  b: { sides: 3, lift: 0.65 },
  r: { sides: 4, lift: 0.09 },
  q: { sides: 6, lift: 0.85 },
  k: { sides: 8, lift: 0.22 },
} satisfies Record<PieceSymbol, { sides: number; lift: number }>;

export function moveFrame(progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  const smooth = (x: number) => x * x * (3 - 2 * x);
  // Fast launch, then a slower final approach. Hold at contact before release.
  const travel = t < 0.22 ? 0 : t < 0.46 ? smooth((t - 0.22) / 0.24) * 0.88
    : t < 0.62 ? 0.88 + smooth((t - 0.46) / 0.16) * 0.12 : 1;
  return {
    phase: t < 0.22 ? "charge" : t < 0.46 ? "dash" : t < 0.62 ? "slowmo" : t < 0.72 ? "impact" : "release",
    travel, charge: Math.min(1, t / 0.22), impact: t >= 0.62,
    particleSpeed: t >= 0.62 && t < 0.72 ? 0 : t < 0.86 ? 0.25 : 1,
  };
}

export function captureFrame(progress: number) {
  const t = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const seconds = t * 2.6;
  const smooth = (x: number) => { const p = Math.max(0, Math.min(1, x)); return p * p * (3 - 2 * p); };
  const combatPhase: CombatPhase = seconds < .4 ? "faceoff" : seconds < 1 ? "opening"
    : seconds < 1.5 ? "defense" : seconds < 2.1 ? "finisher" : "defeat";
  // Both actors remain outside one another until the visual defender has fallen.
  // Initial attack and counter pose progress are separate from the final blow.
  const approach = smooth((seconds - .24) / .66);
  const finisher = smooth((seconds - 1.5) / .35);
  const clash = Math.max(0, 1 - Math.abs(seconds - 1.12) / .1);
  const contactHold = seconds >= 1.85 && seconds < 1.97;
  const clashHold = seconds >= 1.12 && seconds < 1.2;
  return {
    // Legacy overlay aliases stay compatible with quiet moves and armory UI.
    phase: seconds < .4 ? "charge" : seconds < .9 ? "approach" : seconds < 1.5 ? "windup"
      : seconds < 1.85 ? "strike" : seconds < 2.1 ? "impact" : seconds < 2.33 ? "defeat" : "occupy",
    combatPhase, seconds,
    charge: smooth(seconds / .4), approach,
    opening: smooth((seconds - .4) / .6), counter: smooth((seconds - 1) / .5),
    clash, finisher, strike: finisher,
    defeat: smooth((seconds - 2.1) / .28),
    occupy: smooth((seconds - 2.33) / .22),
    recovery: smooth((seconds - 2.1) / .5),
    impact: t >= CAPTURE_CONTACT, death: t >= CAPTURE_DEATH,
    particleSpeed: contactHold || clashHold ? 0 : seconds >= 1.2 && seconds < 2.35 ? .3 : 1,
  };
}
