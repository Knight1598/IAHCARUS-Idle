import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { SpecialChess, type UltimateMove } from "./special.ts";
import { VariantChess } from "./variants.ts";

export interface TacticalPiece {
  square: Square;
  type: PieceSymbol;
  color: Color;
}
export interface PieceInspection extends TacticalPiece {
  attackers: TacticalPiece[];
  defenders: TacticalPiece[];
  legalDestinations: Square[];
  captureDestinations: Square[];
  kingSquare: Square | null;
  inCheck: boolean;
  checkers: TacticalPiece[];
  ultimate: boolean;
  variant: boolean;
  /** Normal piece geometry, including pinned controllers; not a safety verdict. */
  controlScope: "ordinary";
}
const opposite = (color: Color): Color => color === "w" ? "b" : "w";
function describePiece(game: Chess, square: Square): TacticalPiece | undefined {
  const piece = game.get(square);
  return piece ? { square, type: piece.type, color: piece.color } : undefined;
}
function controllers(game: Chess, square: Square, color: Color): TacticalPiece[] {
  return game.attackers(square, color).sort().flatMap(source => {
    const piece = describePiece(game, source);
    return piece ? [piece] : [];
  });
}
function kingSquare(game: Chess, color: Color): Square | null {
  return game.board().flat().find(piece => piece?.type === "k" && piece.color === color)?.square || null;
}

/** Explain a piece using the active rules' legal moves and ordinary attack geometry.
 * Custom ultimates/field actions are counted only when exposed by moves(), and
 * never become permanent attack patterns or consume their resources here.
 */
export function inspectPiece(game: Chess, square: Square): PieceInspection | null {
  const piece = describePiece(game, square);
  if (!piece) return null;
  const enemy = opposite(piece.color);
  const moves = game.moves({ square, verbose: true });
  const king = kingSquare(game, piece.color);
  const checkers = king ? controllers(game, king, enemy) : [];
  return {
    ...piece,
    attackers: controllers(game, square, enemy),
    defenders: controllers(game, square, piece.color),
    legalDestinations: [...new Set(moves.map(move => move.to))],
    captureDestinations: [...new Set(moves.filter(move => move.captured).map(move => move.to))],
    kingSquare: king,
    inCheck: checkers.length > 0,
    checkers,
    ultimate: game instanceof SpecialChess && game.armed === square,
    variant: game instanceof SpecialChess || game instanceof VariantChess,
    controlScope: "ordinary",
  };
}

/** Preview a legal move on a disposable board; never alter history or send a move. */
export function previewMove(game: Chess, from: Square, to: Square) {
  const move = game.moves({ square: from, verbose: true }).find(m => m.to === to && (!m.promotion || m.promotion === "q"));
  if (!move) return null;
  const ultimate = !!(move as UltimateMove).ultimate;
  const probe = game instanceof SpecialChess || game instanceof VariantChess ? game.clone() : new Chess(game.fen());
  probe.move(move);
  const enemy = opposite(move.color);
  const capturedSquare = move.captured ? move.flags.includes("e") ? `${to[0]}${from[1]}` as Square : to : undefined;
  const attackers = controllers(probe, to, enemy);
  const originalKing = kingSquare(game, move.color);
  const nextKing = kingSquare(probe, move.color);
  return {
    from, to, piece: move.piece, color: move.color, captured: move.captured,
    capturedSquare, victim: capturedSquare ? describePiece(game, capturedSquare) : undefined,
    promotion: move.promotion, castle: move.flags.includes("k") || move.flags.includes("q"),
    check: probe.isCheck(), mate: probe.isCheckmate(),
    controlled: attackers.length > 0, ultimate,
    attackers, defenders: controllers(probe, to, move.color),
    escapesCheck: !!originalKing && game.isAttacked(originalKing, enemy) && !!nextKing && !probe.isAttacked(nextKing, enemy),
    controlScope: "ordinary" as const,
  };
}
export type MovePreview = NonNullable<ReturnType<typeof previewMove>>;
