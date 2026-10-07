import { Chess } from "chess.js";
const value = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
function evaluate(g: Chess) {
  if (g.isCheckmate()) return g.turn() === "w" ? -100000 : 100000;
  if (g.isDraw()) return 0;
  let score = 0;
  for (const row of g.board())
    for (const p of row)
      if (p) {
        const file = p.square.charCodeAt(0) - 97,
          rank = Number(p.square[1]) - 1;
        const center = 3.5 - Math.abs(file - 3.5) + 3.5 - Math.abs(rank - 3.5);
        const advance = p.color === "w" ? rank : 7 - rank;
        score +=
          (p.color === "w" ? 1 : -1) *
          (value[p.type] + (p.type === "p" ? advance * 8 : center * 5));
      }
  return score;
}
function search(g: Chess, depth: number, alpha: number, beta: number): number {
  if (depth === 0 || g.isGameOver()) return evaluate(g);
  const maximize = g.turn() === "w";
  let best = maximize ? -Infinity : Infinity;
  const moves = g
    .moves({ verbose: true })
    .sort((a, b) => value[b.captured || "k"] - value[a.captured || "k"]);
  for (const m of moves) {
    g.move(m);
    const score = search(g, depth - 1, alpha, beta);
    g.undo();
    best = maximize ? Math.max(best, score) : Math.min(best, score);
    if (maximize) alpha = Math.max(alpha, best);
    else beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}
self.onmessage = (e: MessageEvent<{ fen: string; depth: number }>) => {
  const g = new Chess(e.data.fen);
  const max = g.turn() === "w";
  let best = max ? -Infinity : Infinity;
  let chosen;
  for (const m of g.moves({ verbose: true }).sort(() => Math.random() - 0.5)) {
    g.move(m);
    const score = search(g, e.data.depth - 1, -Infinity, Infinity);
    g.undo();
    if (chosen === undefined || (max ? score > best : score < best)) {
      best = score;
      chosen = { from: m.from, to: m.to, promotion: m.promotion || "q" };
    }
  }
  self.postMessage(chosen);
};
