import type { Chess, Move, Color, PieceSymbol } from "chess.js";
import type { MoveEvent } from "../shared/events.js";

export type CinematicScope = "key" | "all";
const material = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export function matchMaterial(game: Chess) {
  const captured: Record<Color, PieceSymbol[]> = { w: [], b: [] };
  for (const move of game.history({ verbose: true }))
    if (move.captured) captured[move.color].push(move.captured);
  for (const color of ["w", "b"] as const)
    captured[color].sort((a, b) => material[b] - material[a]);
  let balance = 0;
  for (const piece of game.board().flat())
    if (piece) balance += (piece.color === "w" ? 1 : -1) * material[piece.type];
  return { captured, balance };
}

export function useDramaticCamera(move: Move, event: MoveEvent, scope: CinematicScope) {
  if (event.kind === "move") return false;
  if (scope === "all") return true;
  if (["recapture", "queen-fallen", "comeback", "capture-streak"].includes(event.story || "")) return true;
  // Short attacks still use each piece's special effect; big moments get camera cuts.
  if (event.kind === "capture") return move.captured === "q" || move.captured === "r";
  return event.kind !== "escape";
}
