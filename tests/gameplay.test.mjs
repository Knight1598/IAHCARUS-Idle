import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { matchMaterial, useDramaticCamera } from "../src/gameplay.ts";
import { analyzeMove } from "../shared/events.js";

test("captured pieces and material follow en passant and undo", () => {
  const game = new Chess();
  for (const san of ["e4", "a6", "e5", "d5", "exd6"]) game.move(san);
  assert.deepEqual(matchMaterial(game), { captured: { w: ["p"], b: [] }, balance: 1 });
  game.undo();
  assert.deepEqual(matchMaterial(game), { captured: { w: [], b: [] }, balance: 0 });
});

test("promotion changes material without inventing captures in a training position", () => {
  const game = new Chess("7k/P7/8/8/8/8/8/7K w - - 0 1");
  game.move({ from: "a7", to: "a8", promotion: "q" });
  assert.deepEqual(matchMaterial(game), { captured: { w: [], b: [] }, balance: 9 });
  game.undo();
  assert.equal(matchMaterial(game).balance, 1);
});

test("quick pacing preserves capture effects and reserves camera cuts for key events", () => {
  const game = new Chess();
  for (const san of ["e4", "d5"]) game.move(san);
  const before = new Chess(game.fen());
  const move = game.move("exd5");
  const event = analyzeMove(before, game, move);
  assert.equal(event.kind, "capture");
  assert.equal(useDramaticCamera(move, event, "key"), false);
  assert.equal(useDramaticCamera(move, event, "all"), true);
  const mate = new Chess();
  for (const san of ["f3", "e5", "g4"]) mate.move(san);
  const preMate = new Chess(mate.fen());
  const final = mate.move("Qh4#");
  assert.equal(useDramaticCamera(final, analyzeMove(preMate, mate, final), "key"), true);
});
