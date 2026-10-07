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

export function captureFrame(progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  const smooth = (x: number) => { const p = Math.max(0, Math.min(1, x)); return p * p * (3 - 2 * p); };
  // A capture reaches a combat position first. Occupying the legal destination
  // happens after the defender falls, rather than sliding through their mesh.
  const approach = smooth((t - 0.18) / 0.18);
  return {
    phase: t < 0.18 ? "charge" : t < 0.36 ? "approach" : t < 0.48 ? "windup"
      : t < 0.56 ? "strike" : t < 0.64 ? "impact" : t < 0.78 ? "defeat" : "occupy",
    charge: smooth(t / 0.18), approach,
    strike: smooth((t - 0.48) / 0.08),
    defeat: smooth((t - 0.64) / 0.14),
    occupy: smooth((t - 0.78) / 0.17),
    impact: t >= 0.56, death: t >= 0.72,
    particleSpeed: t >= 0.56 && t < 0.64 ? 0 : t < 0.8 ? 0.3 : 1,
  };
}
