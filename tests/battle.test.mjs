import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { matchStory, latestMoment } from "../src/battle.ts";

test("capture exchanges produce first blood, immediate counterattack and a hunting streak", () => {
  const game = new Chess();
  for (const san of ["e4", "d5", "exd5", "Qxd5", "Nc3", "Qxd2+"]) game.move(san);
  const data = matchStory(game.history({ verbose: true }));
  assert.equal(data.moments.filter((m) => m.kind === "first-blood").length, 1);
  assert.equal(data.moments.find((m) => m.kind === "recapture").ply, 4);
  assert.equal(data.moments.find((m) => m.kind === "capture-streak").ply, 6);
  assert.equal(data.missions.b.check, true);
  assert.equal(data.missions.b.capture, false); // Captured pawns do not complete major-capture mission.
  game.undo();
  const undone = matchStory(game.history({ verbose: true }));
  assert.equal(undone.moments.some((m) => m.kind === "capture-streak"), false);
  assert.equal(undone.missions.b.check, false);
});

test("queen loss can produce a material comeback, without treating every capture as one", () => {
  const game = new Chess("7k/8/7r/3q4/8/8/8/K2Q4 w - - 0 1");
  game.move("Qxd5");
  const history = game.history({ verbose: true });
  const data = matchStory(history);
  assert.ok(data.moments.some((m) => m.kind === "queen-fallen"));
  assert.equal(latestMoment(data.moments, 1).kind, "comeback");
  assert.equal(data.missions.w.capture, true);
  assert.equal(data.missions.b.capture, false);
  const equal = new Chess("7k/8/8/3q4/8/8/8/K2Q4 w - - 0 1");
  equal.move("Qxd5");
  const other = matchStory(equal.history({ verbose: true }));
  assert.equal(other.moments.some((m) => m.kind === "comeback"), false);
  assert.equal(latestMoment(other.moments, 1).kind, "queen-fallen");
});

test("endgame threshold is crossed once, and new games reset objectives", () => {
  const game = new Chess("7k/8/7r/3n4/8/2B5/8/K2QR3 w - - 0 1");
  game.move("Qxd5");
  assert.equal(matchStory(game.history({ verbose: true })).moments.filter((m) => m.kind === "endgame").length, 1);
  const normal = new Chess();
  for (const san of ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "O-O"]) normal.move(san);
  assert.equal(matchStory(normal.history({ verbose: true })).missions.w.castle, true);
  assert.equal(matchStory(normal.history({ verbose: true })).missions.b.castle, false);
  assert.deepEqual(matchStory([]), {
    moments: [], missions: {
      w: { check: false, capture: false, castle: false },
      b: { check: false, capture: false, castle: false },
    },
  });
});
