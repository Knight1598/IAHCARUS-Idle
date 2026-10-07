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
const timeout = Symbol("search timeout");
function search(g: Chess, depth: number, alpha: number, beta: number, deadline: number): number {
  if (performance.now() >= deadline) throw timeout;
  if (depth === 0 || g.isGameOver()) return evaluate(g);
  const maximize = g.turn() === "w";
  let best = maximize ? -Infinity : Infinity;
  const moves = g
    .moves({ verbose: true })
    .sort((a, b) => value[b.captured || "k"] - value[a.captured || "k"]);
  for (const m of moves) {
    g.move(m);
    let score: number;
    try {
      score = search(g, depth - 1, alpha, beta, deadline);
    } finally {
      g.undo();
    }
    best = maximize ? Math.max(best, score) : Math.min(best, score);
    if (maximize) alpha = Math.max(alpha, best);
    else beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}
self.onmessage = (e: MessageEvent<{ fen: string; depth: number }>) => {
  const g = new Chess(e.data.fen);
  if (g.isGameOver()) { self.postMessage(undefined); return; }
  const max = g.turn() === "w";
  const depth = Math.max(1, Math.min(3, Math.floor(e.data.depth) || 1));
  const deadline = performance.now() + [0, 150, 700, 1800][depth];
  const moves = g.moves({ verbose: true }).sort(() => Math.random() - 0.5);
  let chosen = moves[0];
  // Keep the last completed depth if a phone cannot finish the deeper search.
  for (let level = 1; level <= depth; level++) {
    let best = max ? -Infinity : Infinity;
    let candidate = chosen;
    try {
      const ordered = [...moves].sort((a, b) =>
        Number(b.san === chosen.san) - Number(a.san === chosen.san) ||
        value[b.captured || "k"] - value[a.captured || "k"]);
      for (const m of ordered) {
        g.move(m);
        let score: number;
        try {
          score = search(g, level - 1, max ? best : -Infinity, max ? Infinity : best, deadline);
        } finally {
          g.undo();
        }
        if (max ? score > best : score < best) { best = score; candidate = m; }
        if (max ? best >= 100000 : best <= -100000) break;
      }
      chosen = candidate;
      if (max ? best >= 100000 : best <= -100000) break;
    } catch (error) {
      if (error !== timeout) throw error;
      break;
    }
  }
  self.postMessage({ from: chosen.from, to: chosen.to, promotion: chosen.promotion || "q" });
};
