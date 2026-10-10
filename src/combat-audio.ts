import type { CombatCue } from './combat-profiles.ts';

/** Cue lengths follow the individual gesture, rather than stretching with the duel.
 * Compact presentations shorten charge-ups; extra duel time is filled by exchanges. */
export function combatCueDuration(cue: CombatCue, duration = 5000): number {
  const scale = Number.isFinite(duration) ? Math.max(0, Math.min(1, duration / 5000)) : 1;
  if (cue === 'charge') return Math.max(.18, .53 * scale);
  if (cue === 'finisher') return Math.max(.16, .33 * scale);
  return .3;
}
