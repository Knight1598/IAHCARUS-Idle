import type { Chess, Move, Square, PieceSymbol, Color } from "chess.js";
export const attacks: Record<PieceSymbol, string>;
export function kingSquare(game: Chess, color: Color): Square | undefined;
export interface MoveEvent {
  story?: string;
  kind: string;
  title: string;
  subtitle: string;
  targets: Square[];
  checkers: Square[];
  capturedSquare: Square;
}
export function analyzeMove(before: Chess, after: Chess, move: Move): MoveEvent;
