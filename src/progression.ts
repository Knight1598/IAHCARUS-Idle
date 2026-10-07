import { Chess, type Color, type Move, type PieceSymbol, type Square } from "chess.js";
import { analyzeMove, kingSquare } from "../shared/events.js";

export const rivals = {
  1: { name: "อิกนิส", title: "อัศวินเพลิง", skin: "ember", description: "ฝึกอ่านจังหวะและเปิดศึก" },
  2: { name: "เซเลน", title: "ผู้พิทักษ์เหมันต์", skin: "frost", description: "รับมือแนวป้องกันและการกินคืน" },
  3: { name: "อัสตรา", title: "ราชันดวงดาว", skin: "astral", description: "ศึกยาวที่ทุกความผิดพลาดมีราคา" },
} as const;

export interface Trial {
  name: string;
  story: string;
  fen: string;
  side: Color;
  maxMoves: number;
  objective: "mate" | "rescue" | "fork";
  hint: string;
}

export const trials = {
  rescue: {
    name: "บทที่ 1 · ช่วยราชัน",
    story: "ม้าศัตรูทะลวงเข้ามาถึงราชัน จงให้ผู้พิทักษ์เข้ากำจัดผู้โจมตี",
    fen: "4k3/6p1/5N2/8/8/8/8/4K3 b - - 0 1",
    side: "b",
    maxMoves: 1,
    objective: "rescue",
    hint: "คิงดำถูกม้ารุกอยู่ มองหาหมากที่กินผู้โจมตีได้",
  },
  fork: {
    name: "บทที่ 2 · นักล่าสองเป้าหมาย",
    story: "กองทัพศัตรูมีกำลังเหนือกว่า ใช้ม้าสร้างภัยคุกคามสองแนวพร้อมกัน",
    fen: "7k/8/1q3r2/8/8/2N5/8/K7 w - - 0 1",
    side: "w",
    maxMoves: 2,
    objective: "fork",
    hint: "หาช่องที่ม้าขาวขู่ทั้งควีนและเรือ โดยไม่จำเป็นต้องกินทันที",
  },
  boss: {
    name: "บทที่ 3 · ปิดฉากราชันดวงดาว",
    story: "อัสตราเหลือทางหนีสุดท้าย ประสานคิงกับควีนเพื่อรุกฆาตในสองตาของคุณ",
    fen: "7k/8/5K2/8/8/8/8/Q7 w - - 0 1",
    side: "w",
    maxMoves: 2,
    objective: "mate",
    hint: "ควีนคุมทางหนี ส่วนคิงช่วยปกป้องช่องสังหาร ลองคุมแถวที่ 7",
  },
} as const satisfies Record<string, Trial>;

function rescuedKing(before: Chess, after: Chess, move: Move) {
  const event = analyzeMove(before, after, move);
  if (event.kind === "rescue") return true;
  // A rescue that also checks the opponent is classified as "check" by the
  // shared event system. It still satisfies the same actual capture objective.
  const king = kingSquare(before, move.color);
  const enemy = move.color === "w" ? "b" : "w";
  return !!move.captured && !!king &&
    before.attackers(king, enemy).includes(event.capturedSquare) &&
    !!kingSquare(after, move.color) &&
    !after.isAttacked(kingSquare(after, move.color)!, enemy);
}

/**
 * The budget counts the player's moves, never the opponent's replies. A goal
 * achieved on the final allowed move wins. Otherwise that move ends the trial
 * immediately, so callers should not schedule another bot reply. Replay makes
 * undo restore the objective and budget without keeping an extra mutable flag.
 */
export function evaluateTrial(trial: Trial, game: Chess): "active" | "won" | "lost" {
  const history = game.history({ verbose: true });
  const replay = new Chess(trial.fen);
  if ((history[0]?.before ?? game.fen()) !== replay.fen()) return "lost";
  let used = 0;
  for (const recorded of history) {
    const before = new Chess(replay.fen());
    const move = replay.move({ from: recorded.from, to: recorded.to, promotion: recorded.promotion });
    if (move.color === trial.side) {
      used++;
      const event = analyzeMove(before, replay, move);
      const reached = trial.objective === "mate"
        ? replay.isCheckmate()
        : trial.objective === "fork"
          ? event.kind === "fork"
          : rescuedKing(before, replay, move);
      if (reached) return "won";
      if (used >= trial.maxMoves) return "lost";
    }
    if (replay.isGameOver()) return "lost";
  }
  return replay.isGameOver() ? "lost" : "active";
}

export interface BattleMVP {
  /** Initial square is the permanent identity, including a promoted pawn. */
  origin: Square;
  color: Color;
  /** Current piece type; promotion does not change origin or accumulated score. */
  piece: PieceSymbol;
  score: number;
  kills: number;
  /** Present square if the piece survived; fallen heroes can still win MVP. */
  square?: Square;
}

const capturePoints: Record<PieceSymbol, number> = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 0 };

/**
 * Scores actual captures by material (10/30/30/50/90), checks (+8), capturing a
 * checking attacker (+12), promotion (+8), and checkmate (+30). Fallen pieces
 * retain their achievements. An uneventful game has no MVP. Replay follows each
 * physical piece through castling, en passant and promotion, rather than merging
 * all pawns or rooks into one score.
 */
export function battleMVP(initialFen: string, moves: Move[], owner?: Color): BattleMVP | null {
  const game = new Chess(initialFen);
  const pieces: BattleMVP[] = game.board().flat().flatMap((piece) => piece
    ? [{ origin: piece.square, color: piece.color, piece: piece.type, score: 0, kills: 0 }]
    : []);
  const occupants = new Map<Square, BattleMVP>(pieces.map((piece) => [piece.origin, piece]));

  for (const recorded of moves) {
    const attacker = occupants.get(recorded.from);
    const before = new Chess(game.fen());
    const move = game.move({ from: recorded.from, to: recorded.to, promotion: recorded.promotion });
    if (!attacker) continue;
    const event = analyzeMove(before, game, move);
    occupants.delete(move.from);
    if (move.captured) {
      occupants.delete(event.capturedSquare);
      attacker.score += capturePoints[move.captured];
      attacker.kills++;
    }
    if (event.checkers.length) attacker.score += 8;
    if (rescuedKing(before, game, move)) attacker.score += 12;
    if (game.isCheckmate()) attacker.score += 30;
    if (move.promotion) {
      attacker.piece = move.promotion;
      attacker.score += 8;
    }
    occupants.set(move.to, attacker);

    if (move.flags.includes("k") || move.flags.includes("q")) {
      const rank = move.color === "w" ? "1" : "8";
      const kingside = move.flags.includes("k");
      const rookFrom = `${kingside ? "h" : "a"}${rank}` as Square;
      const rookTo = `${kingside ? "f" : "d"}${rank}` as Square;
      const rook = occupants.get(rookFrom);
      if (rook) {
        occupants.delete(rookFrom);
        occupants.set(rookTo, rook);
      }
    }
  }

  const mvp = pieces.filter((piece) => piece.score > 0 && (!owner || piece.color === owner))
    .sort((a, b) => b.score - a.score || b.kills - a.kills || a.origin.localeCompare(b.origin))[0];
  if (!mvp) return null;
  return { ...mvp, square: [...occupants].find(([, piece]) => piece === mvp)?.[0] };
}
