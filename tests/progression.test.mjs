import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { analyzeMove } from "../shared/events.js";
import { battleMVP, evaluateTrial, rivals, trials } from "../src/progression.ts";

test("rivals provide distinct named armies for each bot level", () => {
  assert.deepEqual(Object.values(rivals).map((rival) => [rival.name, rival.skin]), [
    ["อิกนิส", "ember"], ["เซเลน", "frost"], ["อัสตรา", "astral"],
  ]);
});

test("rescue trial starts in legal check, rewards the capture and restores on undo", () => {
  const game = new Chess(trials.rescue.fen);
  assert.equal(game.isCheck(), true);
  assert.equal(evaluateTrial(trials.rescue, game), "active");
  game.move("gxf6");
  assert.equal(evaluateTrial(trials.rescue, game), "won");
  game.undo();
  assert.equal(evaluateTrial(trials.rescue, game), "active");
  game.move("Kd8");
  assert.equal(game.isCheck(), false);
  assert.equal(evaluateTrial(trials.rescue, game), "lost", "escaping is legal but does not defeat the attacker");
});

test("fork trial accepts an actual double threat and counts only human turns", () => {
  const game = new Chess(trials.fork.fen);
  const before = new Chess(game.fen());
  const move = game.move("Nd5");
  assert.equal(analyzeMove(before, game, move).kind, "fork");
  assert.equal(evaluateTrial(trials.fork, game), "won");

  game.undo();
  game.move("Ka2");
  assert.equal(evaluateTrial(trials.fork, game), "active");
  game.move("Kg8");
  assert.equal(evaluateTrial(trials.fork, game), "active", "bot reply does not use the human budget");
  game.move("Ka1");
  assert.equal(evaluateTrial(trials.fork, game), "lost");
});

test("boss has no mate in one and a forced mate in two against every legal reply", () => {
  const game = new Chess(trials.boss.fen);
  assert.equal(game.isCheck(), false);
  assert.equal(game.isAttacked("h8", "w"), false);
  assert.equal(game.moves().some((move) => move.endsWith("#")), false);
  game.move("Qa7");
  assert.equal(evaluateTrial(trials.boss, game), "active");
  const replies = game.moves();
  assert.ok(replies.length > 0);
  for (const reply of replies) {
    game.move(reply);
    assert.equal(evaluateTrial(trials.boss, game), "active");
    const mate = game.moves().find((move) => move.endsWith("#"));
    assert.ok(mate, `mate remains available after ${reply}`);
    game.move(mate);
    assert.equal(evaluateTrial(trials.boss, game), "won", "last permitted human move can win");
    game.undo();
    game.undo();
  }
});

test("trial wins use objectives rather than one hard coded move", () => {
  const game = new Chess(trials.boss.fen);
  game.move("Qg1");
  assert.equal(evaluateTrial(trials.boss, game), "active");
  game.move("Kh7");
  game.move("Qg7#");
  assert.equal(evaluateTrial(trials.boss, game), "won");
  assert.equal(evaluateTrial(trials.boss, new Chess()), "lost", "a different starting board cannot clear a trial");
});

test("the medium bot responds legally to the boss setup and leaves the promised final mate", async () => {
  const savedSelf = globalThis.self;
  let reply;
  globalThis.self = { postMessage: (move) => { reply = move; } };
  try {
    await import("../src/bot.ts");
    const game = new Chess(trials.boss.fen);
    game.move("Qa7");
    self.onmessage({ data: { fen: game.fen(), depth: 2 } });
    assert.ok(reply);
    assert.equal(game.move(reply).san, "Kg8");
    assert.equal(evaluateTrial(trials.boss, game), "active");
    game.move("Qg7#");
    assert.equal(evaluateTrial(trials.boss, game), "won");
  } finally {
    globalThis.self = savedSelf;
  }
});

test("MVP gives credit to the castled rook's original square", () => {
  const fen = "4k3/8/3r4/8/8/8/8/4K2R w K - 0 1";
  const game = new Chess(fen);
  for (const move of ["O-O", "Kd8", "Rf6", "Ke8", "Rxd6"]) game.move(move);
  const mvp = battleMVP(fen, game.history({ verbose: true }), "w");
  assert.deepEqual(mvp, { origin: "h1", color: "w", piece: "r", score: 50, kills: 1, square: "d6" });
  assert.equal(battleMVP(fen, game.history({ verbose: true }), "b"), null);
});

test("MVP preserves a pawn's identity and kills after promotion", () => {
  const fen = "7k/P7/8/8/8/8/1K6/7r w - - 0 1";
  const game = new Chess(fen);
  for (const move of ["a8=Q+", "Kh7", "Qxh1+"]) game.move(move);
  const mvp = battleMVP(fen, game.history({ verbose: true }), "w");
  assert.equal(mvp.origin, "a7");
  assert.equal(mvp.piece, "q");
  assert.equal(mvp.kills, 1);
  assert.equal(mvp.square, "h1");
  assert.ok(mvp.score > 50, "promotion and both checks contribute alongside the rook capture");
});

test("MVP scores en passant and a king rescue from actual captured squares", () => {
  const fen = "7k/8/8/3pP3/8/8/8/K7 w - d6 0 1";
  const game = new Chess(fen);
  game.move("exd6");
  assert.deepEqual(battleMVP(fen, game.history({ verbose: true }), "w"), {
    origin: "e5", color: "w", piece: "p", score: 10, kills: 1, square: "d6",
  });
  const rescue = new Chess(trials.rescue.fen);
  rescue.move("gxf6");
  assert.deepEqual(battleMVP(trials.rescue.fen, rescue.history({ verbose: true }), "b"), {
    origin: "g7", color: "b", piece: "p", score: 42, kills: 1, square: "f6",
  });
});

test("MVP separates physical pawns, respects owner and has no award for quiet play", () => {
  const game = new Chess();
  const initialFen = game.fen();
  game.move("e4");
  assert.equal(battleMVP(initialFen, game.history({ verbose: true })), null);
  for (const move of ["d5", "exd5", "Nf6", "d4", "Nxd5"]) game.move(move);
  assert.equal(battleMVP(initialFen, game.history({ verbose: true }), "w").origin, "e2");
  assert.equal(battleMVP(initialFen, game.history({ verbose: true }), "w").square, undefined);
  assert.equal(battleMVP(initialFen, game.history({ verbose: true }), "b").origin, "g8");
});
