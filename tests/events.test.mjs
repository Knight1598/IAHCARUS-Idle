import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { analyzeMove } from "../shared/events.js";
function event(fen, move) {
  const g = new Chess(fen),
    before = new Chess(fen);
  const m = g.move(move);
  return analyzeMove(before, g, m);
}
test("knight attacker is captured to rescue king", () => {
  const e = event("4k3/6p1/5N2/8/8/8/8/4K3 b - - 0 1", "gxf6");
  assert.equal(e.kind, "rescue");
  assert.equal(e.capturedSquare, "f6");
});
test("interposition and king escape are distinguished", () => {
  const fen = "4kb2/8/8/8/8/8/8/K3R3 b - - 0 1";
  assert.equal(event(fen, "Be7").kind, "block");
  assert.equal(event(fen, "Kd8").kind, "escape");
});
test("discovered check and double check identify actual attackers", () => {
  const fen = "4k3/8/8/8/8/8/4B3/K3R3 w - - 0 1";
  assert.equal(event(fen, "Bf3").kind, "discovered-check");
  const e = event(fen, "Bb5");
  assert.equal(e.kind, "double-check");
  assert.equal(e.checkers.length, 2);
});
test("knight fork highlights two threatened pieces without capturing", () => {
  const e = event("7k/8/1q3r2/8/8/2N5/8/K7 w - - 0 1", "Nd5");
  assert.equal(e.kind, "fork");
  assert.deepEqual(e.targets.sort(), ["b6", "f6"]);
});
test("promotion, castling and en passant have events", () => {
  assert.equal(event("8/P6k/8/8/8/8/8/K7 w - - 0 1", "a8=Q").kind, "promotion");
  assert.equal(event("4k3/8/8/8/8/8/8/4K2R w K - 0 1", "O-O").kind, "castle");
  const e = event("7k/8/8/3pP3/8/8/8/K7 w - d6 0 1", "exd6");
  assert.equal(e.kind, "en-passant");
  assert.equal(e.capturedSquare, "d5");
});
test("checkmate overrides capture spectacle", () => {
  const g = new Chess();
  for (const m of ["f3", "e5", "g4"]) g.move(m);
  const before = new Chess(g.fen());
  const m = g.move("Qh4#");
  assert.equal(analyzeMove(before, g, m).kind, "mate");
});
