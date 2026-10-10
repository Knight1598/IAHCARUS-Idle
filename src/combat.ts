import type { PieceSymbol } from "chess.js";
import type { CombatCue, CombatPhase } from "./combat-profiles.ts";
export type { CombatCue, CombatPhase } from "./combat-profiles.ts";

/** One shared score: choreography, sound, camera and defeat sample these landmarks. */
export const CAPTURE_DURATION = 5000;
export const CAPTURE_CLASH = 1.08 / 5;
export const CAPTURE_COUNTER_CLASH = 1.86 / 5;
export const CAPTURE_FINISHER = 3.12 / 5;
export const CAPTURE_RELEASE = 3.72 / 5;
export const CAPTURE_CONTACT = 3.85 / 5;
export const CAPTURE_DEATH = 4.25 / 5;
export const CAPTURE_RETURN = 4.65 / 5;
const captureContacts = [1.08, 1.86, 2.48, 2.83, 3.85] as const;

/** A server update can create a new presentation while the tab is paused. */
export function resumeAnimationStart(start: number, pausedAt: number, now: number) {
  return start + Math.max(0, now - Math.max(pausedAt, start));
}

/** Compact presentations remain available; the full duel lasts exactly five seconds. */
export function clampCaptureDuration(milliseconds: number) {
  return Number.isFinite(milliseconds) ? Math.max(2000, Math.min(CAPTURE_DURATION, milliseconds)) : CAPTURE_DURATION;
}

/** Audio is dispatched when real render frames cross these points, not timers. */
export const captureCuePoints: readonly Readonly<{ cue: CombatCue; at: number; actor: "attacker" | "defender" }>[] = Object.freeze([
  { cue: "draw", at: .09 / 5, actor: "attacker" },
  { cue: "charge", at: .34 / 5, actor: "attacker" },
  { cue: "release", at: .82 / 5, actor: "attacker" },
  { cue: "clash", at: CAPTURE_CLASH, actor: "defender" },
  { cue: "counter", at: 1.48 / 5, actor: "defender" },
  { cue: "release", at: 1.67 / 5, actor: "defender" },
  { cue: "clash", at: CAPTURE_COUNTER_CLASH, actor: "attacker" },
  { cue: "charge", at: 2.13 / 5, actor: "attacker" },
  { cue: "release", at: 2.31 / 5, actor: "attacker" },
  { cue: "clash", at: 2.48 / 5, actor: "defender" },
  { cue: "release", at: 2.66 / 5, actor: "attacker" },
  { cue: "clash", at: 2.83 / 5, actor: "defender" },
  { cue: "finisher", at: CAPTURE_FINISHER, actor: "attacker" },
  { cue: "charge", at: 3.35 / 5, actor: "attacker" },
  { cue: "release", at: CAPTURE_RELEASE, actor: "attacker" },
  { cue: "impact", at: CAPTURE_CONTACT, actor: "attacker" },
  { cue: "armor", at: 3.96 / 5, actor: "defender" },
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
  const seconds = t * (CAPTURE_DURATION / 1000);
  const smooth = (x: number) => { const p = Math.max(0, Math.min(1, x)); return p * p * (3 - 2 * p); };
  const pulse = (at: number, width: number) => Math.max(0, 1 - Math.abs(seconds - at) / width);
  const attackPulse = (start: number, contact: number, recover: number, hold = .08) =>
    smooth((seconds - start) / (contact - start)) * (1 - smooth((seconds - contact - hold) / recover));
  const combatPhase: CombatPhase = seconds < .45 ? "faceoff" : seconds < 1.14 ? "opening"
    : seconds < 2.12 ? "defense" : seconds < 3.12 ? "opening" : seconds < 4.25 ? "finisher" : "defeat";
  // Both actors remain outside one another until the visual defender has fallen.
  // Initial attack and counter pose progress are separate from the final blow.
  const approach = smooth((seconds - .45) / .5);
  const finisher = smooth((seconds - 3.12) / .73);
  let clash = 0, contactPulse = 0, contactHold = false;
  for (let index = 0; index < captureContacts.length; index++) {
    const at = captureContacts[index], contact = pulse(at, .11);
    if (index < 4) clash = Math.max(clash, contact);
    contactPulse = Math.max(contactPulse, contact);
    if (t >= at / 5 && t < (at + (index === 4 ? .12 : .08)) / 5) contactHold = true;
  }
  const attackerStrike = Math.max(attackPulse(.88, 1.08, .14), attackPulse(2.28, 2.48, .14),
    attackPulse(2.715, 2.83, .14), attackPulse(3.65, 3.85, .14, .12));
  const defenderStrike = attackPulse(1.52, 1.86, .21);
  const attackerCharge = Math.max(pulse(.69, .37), pulse(2.17, .22), pulse(2.61, .15), pulse(3.46, .52));
  const defenderCharge = pulse(1.53, .28);
  const defenderGuard = Math.max(pulse(1.08, .38), pulse(2.48, .3), pulse(2.83, .23), pulse(3.85, .45));
  const attackerGuard = pulse(1.86, .32);
  return {
    // Legacy overlay aliases stay compatible with quiet moves and armory UI.
    phase: seconds < .45 ? "charge" : seconds < 1.1 ? "approach" : seconds < 3.12 ? "windup"
      : seconds < 3.85 ? "strike" : seconds < 4.25 ? "impact" : seconds < 4.65 ? "defeat" : "occupy",
    exchange: seconds < .45 ? "faceoff" : seconds < 1.08 ? "opening" : seconds < 1.4 ? "guard"
      : seconds < 1.86 ? "counter" : seconds < 2.12 ? "counter-clash" : seconds < 2.48 ? "combo"
      : seconds < 2.62 ? "combo-clash" : seconds < 2.83 ? "combo" : seconds < 3.12 ? "combo-clash"
      : seconds < 3.5 ? "finisher-charge" : seconds < 3.85 ? "finisher" : seconds < 4.25 ? "impact"
      : seconds < 4.65 ? "defeat" : "return",
    combatPhase, seconds,
    charge: smooth(seconds / .45), approach,
    opening: smooth((seconds - .45) / .63), counter: smooth((seconds - 1.2) / .66),
    clash, finisher, strike: finisher,
    attackerStrike, defenderStrike, attackerCharge, defenderCharge, defenderGuard, attackerGuard,
    attackerRecoil: pulse(1.86, .2), defenderRecoil: Math.max(pulse(1.08, .15), pulse(2.48, .15), pulse(2.83, .15)),
    contactPulse, block: Math.max(attackerGuard, defenderGuard),
    defeat: smooth((seconds - 4.25) / .38),
    occupy: smooth((seconds - 4.65) / .28),
    recovery: smooth((seconds - 4.25) / .75),
    impact: t >= CAPTURE_CONTACT, death: t >= CAPTURE_DEATH,
    particleSpeed: contactHold ? 0 : seconds >= 3.5 && seconds < 4.45 ? .3 : 1,
  };
}
