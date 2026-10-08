import type { Color } from "chess.js";
import type { VariantId, VariantOptions } from "./variants.ts";

export interface ModeSession {
  id: VariantId;
  options: VariantOptions;
  /** Match points belong to the original players, even when colors swap. */
  mirrorWins: Record<Color, number>;
  firstColor: Color;
  rushIndex: number;
  rushSolved: number;
  rushFailures: number;
  rushRemaining: number;
}
export function newModeSession(id: VariantId, options: VariantOptions, firstColor: Color): ModeSession {
  return { id, options: { ...options, round: 1 }, mirrorWins: { w: 0, b: 0 }, firstColor,
    rushIndex: 0, rushSolved: 0, rushFailures: 0, rushRemaining: 180000 };
}
export function readModeSession(raw: unknown): ModeSession | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<ModeSession>;
  if (!["draft", "score", "control", "mirror", "rush", "chaos"].includes(value.id || "") ||
      !value.options || !Number.isSafeInteger(value.options.seed) || value.options.seed < 0 || value.options.seed > 0xffffffff) return null;
  const count = (n: unknown, limit: number) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= limit ? n : 0;
  return { id: value.id!, options: { seed: value.options.seed, draft: value.options.draft, draftColor: value.options.draftColor === "b" ? "b" : "w", round: value.options.round === 2 ? 2 : 1 },
    mirrorWins: { w: typeof value.mirrorWins?.w === "number" && Number.isSafeInteger(value.mirrorWins.w * 2) && value.mirrorWins.w >= 0 && value.mirrorWins.w <= 2 ? value.mirrorWins.w : 0,
      b: typeof value.mirrorWins?.b === "number" && Number.isSafeInteger(value.mirrorWins.b * 2) && value.mirrorWins.b >= 0 && value.mirrorWins.b <= 2 ? value.mirrorWins.b : 0 }, firstColor: value.firstColor === "b" ? "b" : "w",
    rushIndex: count(value.rushIndex, 100000), rushSolved: count(value.rushSolved, 100000), rushFailures: count(value.rushFailures, 3),
    rushRemaining: typeof value.rushRemaining === "number" && Number.isFinite(value.rushRemaining) ? Math.max(0, Math.min(180000, value.rushRemaining)) : 180000 };
}
/** A round is recorded only when advancing; viewing results or undo cannot duplicate points. */
export function mirrorScore(session: ModeSession, winner: Color | null, currentPlayerColor: Color) {
  const scores = { ...session.mirrorWins };
  if (winner) scores[winner === currentPlayerColor ? session.firstColor : session.firstColor === "w" ? "b" : "w"]++;
  else { scores.w += 0.5; scores.b += 0.5; }
  return scores;
}
