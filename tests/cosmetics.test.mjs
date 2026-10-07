import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { readProfile, equipPiece, skins } from "../src/profile.ts";
import { appearanceMap, initialArmySlots, avatarNames, skillNames, pieceNames, scenarioLoadout } from "../src/cosmetics.ts";

const readyProfile = () => readProfile('{"xp":600,"skin":"ember"}');
const history = (game) => game.history({ verbose: true });

test("chapters deploy equipped archetypes without taking the wrong class's origin skin", () => {
  let profile = equipPiece(readyProfile(), "w", "b1", "astral");
  profile = equipPiece(profile, "w", "a1", "frost");
  profile = equipPiece(profile, "w", "d1", "royal");
  const original = JSON.stringify(profile);
  const knightFen = "7k/8/7p/3r4/8/2N5/8/K7 w - - 0 1";
  const deployed = scenarioLoadout(profile, knightFen);
  assert.equal(deployed.loadouts.w.c3, "astral");
  const game = new Chess(knightFen); game.move("Nxd5");
  assert.equal(appearanceMap(knightFen, history(game), deployed).d5, "astral");
  const boss = scenarioLoadout(profile, "7k/8/5K2/8/8/8/8/Q7 w - - 0 1");
  assert.equal(boss.loadouts.w.a1, "royal");
  assert.equal(JSON.stringify(profile), original);
});

test("32 canonical origin slots have readable avatars and distinct theme skills", () => {
  const all = ["w", "b"].flatMap((color) => initialArmySlots(color).map(({ origin }) => `${color}:${origin}`));
  assert.equal(new Set(all).size, 32);
  assert.deepEqual(initialArmySlots("w").map(({ origin }) => origin), ["a1", "b1", "c1", "d1", "e1", "f1", "g1", "h1", "a2", "b2", "c2", "d2", "e2", "f2", "g2", "h2"]);
  for (const piece of Object.keys(pieceNames)) {
    assert.equal(new Set(Object.values(avatarNames).map((theme) => theme[piece])).size, 5);
    assert.equal(new Set(Object.values(skillNames).map((theme) => theme[piece])).size, 5);
  }
  for (const skin of Object.values(skins)) {
    assert.ok(skin.tier >= 1 && skin.tier <= 4);
    assert.ok(skin.rarity && skin.description && skin.effect);
  }
});

test("skins follow individual pawns through captures and rebuild correctly after undo", () => {
  const game = new Chess();
  const initial = game.fen();
  let profile = equipPiece(readyProfile(), "w", "e2", "frost");
  profile = equipPiece(profile, "b", "d7", "royal");
  for (const move of ["e4", "d5", "exd5"]) game.move(move);
  const current = appearanceMap(initial, history(game), profile);
  assert.equal(Object.keys(current).length, 31);
  assert.equal(current.d5, "frost");
  assert.equal(current.e2, undefined);
  assert.equal(current.d7, undefined);
  assert.equal(current.d2, "ember");
  game.undo();
  const undone = appearanceMap(initial, history(game), profile);
  assert.equal(Object.keys(undone).length, 32);
  assert.equal(undone.e4, "frost");
  assert.equal(undone.d5, "royal");
});

test("both castling directions move the rook's own skin independently of the king", () => {
  const initial = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
  let profile = equipPiece(readyProfile(), "w", "e1", "royal");
  profile = equipPiece(profile, "w", "h1", "frost");
  profile = equipPiece(profile, "b", "a8", "astral");
  const game = new Chess(initial);
  game.move("O-O");
  game.move("O-O-O");
  const current = appearanceMap(initial, history(game), profile);
  assert.equal(current.g1, "royal");
  assert.equal(current.f1, "frost");
  assert.equal(current.c8, "ember");
  assert.equal(current.d8, "astral");
  for (const square of ["e1", "h1", "e8", "a8"]) assert.equal(current[square], undefined);
  game.undo();
  assert.equal(appearanceMap(initial, history(game), profile).a8, "astral");
});

test("en passant removes the captured pawn's appearance off the destination square", () => {
  const game = new Chess();
  const initial = game.fen();
  let profile = equipPiece(readyProfile(), "w", "e2", "frost");
  profile = equipPiece(profile, "b", "d7", "royal");
  for (const move of ["e4", "a6", "e5", "d5", "exd6"]) game.move(move);
  const current = appearanceMap(initial, history(game), profile);
  assert.equal(current.d6, "frost");
  assert.equal(current.d5, undefined);
  assert.equal(current.e5, undefined);
  assert.equal(Object.keys(current).length, 31);
  game.undo();
  assert.equal(appearanceMap(initial, history(game), profile).d5, "royal");
});

test("custom FEN origin slots, capture promotion and owner isolation retain identity", () => {
  const initial = "1r5k/P7/8/8/8/8/8/7K w - - 0 1";
  let profile = equipPiece(readyProfile(), "w", "a7", "astral");
  profile = equipPiece(profile, "b", "b8", "royal");
  const game = new Chess(initial);
  const owned = appearanceMap(initial, [], profile, "w");
  assert.equal(owned.a7, "astral");
  assert.equal(owned.b8, "classic");
  assert.equal(owned.h8, "classic");
  game.move({ from: "a7", to: "b8", promotion: "n" });
  const current = appearanceMap(initial, history(game), profile, "w");
  assert.equal(current.b8, "astral");
  assert.equal(current.a7, undefined);
  assert.equal(Object.keys(current).length, 3);
  game.undo();
  assert.deepEqual(appearanceMap(initial, history(game), profile, "w"), owned);
});
