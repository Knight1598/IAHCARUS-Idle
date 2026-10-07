import type { PieceSymbol } from "chess.js";

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
