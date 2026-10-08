import { Chess, type Square } from "chess.js";
import { SpecialChess, type UltimateMove } from "./special.ts";

/** Preview a legal move on a disposable board; never alter history or send a move. */
export function previewMove(game: Chess, from: Square, to: Square) {
  const move = game.moves({ square: from, verbose: true }).find(m => m.to === to && (!m.promotion || m.promotion === "q"));
  if (!move) return null;
  const ultimate = !!(move as UltimateMove).ultimate;
  const probe = game instanceof SpecialChess ? game.clone() : new Chess(game.fen());
  probe.move({ from, to, promotion: move.promotion, ...(ultimate ? { ultimate: true } : {}) });
  const enemy = move.color === "w" ? "b" : "w";
  return {
    from, to, piece: move.piece, color: move.color, captured: move.captured,
    capturedSquare: move.captured ? move.flags.includes("e") ? `${to[0]}${from[1]}` as Square : to : undefined,
    promotion: move.promotion, castle: move.flags.includes("k") || move.flags.includes("q"),
    check: probe.isCheck(), mate: probe.isCheckmate(),
    controlled: probe.isAttacked(to, enemy), ultimate,
  };
}
export type MovePreview = NonNullable<ReturnType<typeof previewMove>>;
