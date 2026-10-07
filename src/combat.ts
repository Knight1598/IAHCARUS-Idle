import type { PieceSymbol } from "chess.js";

// Shape, movement and sound identities remain the same across cosmetic skins.
export const combatStyles = {
  p: { sides: 3, lift: 0.16, pitch: 170, fm: 1.5, cutoff: 1400, weight: 0.5 },
  n: { sides: 4, lift: 1.5, pitch: 115, fm: 2.7, cutoff: 2100, weight: 0.8 },
  b: { sides: 3, lift: 0.65, pitch: 340, fm: 3.5, cutoff: 2700, weight: 0.5 },
  r: { sides: 4, lift: 0.09, pitch: 65, fm: 0.5, cutoff: 900, weight: 1 },
  q: { sides: 6, lift: 0.85, pitch: 260, fm: 2, cutoff: 2200, weight: 0.7 },
  k: { sides: 8, lift: 0.22, pitch: 95, fm: 1, cutoff: 1200, weight: 0.9 },
} satisfies Record<PieceSymbol, { sides: number; lift: number; pitch: number; fm: number; cutoff: number; weight: number }>;

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
