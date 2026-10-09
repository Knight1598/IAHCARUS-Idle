import test from "node:test";
import assert from "node:assert/strict";
import { combatProfiles, combatProfile, resolveDefense } from "../src/combat-profiles.ts";

const pieces = ["p", "n", "b", "r", "q", "k"];
const skins = ["classic", "ember", "frost", "astral", "royal", "storm", "void", "prism"];

test("all forty-eight real class and skin combinations have cached, immutable combat identities", () => {
  const ids = new Set();
  for (const piece of pieces) {
    const shapes = new Set(), choreography = new Set(), timbres = new Set();
    for (const skin of skins) {
      const profile = combatProfile(piece, skin);
      assert.equal(profile, combatProfiles[piece][skin]);
      assert.equal(profile, combatProfile(piece, skin));
      assert.equal(profile.id, `${piece}:${skin}`);
      assert.equal(profile.piece, piece);
      assert.equal(profile.skin, skin);
      ids.add(profile.id);
      shapes.add(JSON.stringify(profile.vfx));
      choreography.add(JSON.stringify(profile.motion));
      timbres.add(JSON.stringify(profile.sound));
      for (const part of [profile, profile.motion, profile.vfx, profile.sound, profile.camera]) assert.ok(Object.isFrozen(part));
      for (const part of [profile.motion, profile.vfx, profile.sound, profile.camera]) {
        for (const value of Object.values(part)) if (typeof value === "number") assert.ok(Number.isFinite(value));
      }
      assert.ok(profile.motion.reach > .5 && profile.motion.reach < 1.5);
      assert.ok(profile.motion.lift >= 0 && profile.motion.lift < 1);
      assert.ok(profile.vfx.rings <= 5 && profile.vfx.shards <= 28);
      assert.ok(profile.camera.shake > 0 && profile.camera.shake < .06);
      assert.throws(() => { profile.motion.reach = 100; }, TypeError);
    }
    assert.equal(shapes.size, 8, "every skin changes shape or flourishing, not only colour");
    assert.equal(choreography.size, 8, "every skin changes posing cadence and trajectory");
    assert.equal(timbres.size, 8, "each skin also has a sonic texture");
  }
  assert.equal(ids.size, 48);
  assert.equal(new Set(pieces.map(piece => combatProfile(piece, "classic").motion.opening)).size, 6);
  assert.equal(new Set(pieces.map(piece => combatProfile(piece, "classic").vfx.signature)).size, 6);
  assert.equal(new Set(pieces.map(piece => combatProfile(piece, "classic").sound.timbre)).size, 6);
  assert.throws(() => combatProfile("x", "classic"), RangeError);
  assert.throws(() => combatProfile("p", "missing"), RangeError);
});

test("defenders answer attack classes with repeatable guards, parries, barriers or retreats", () => {
  const reactions = new Set();
  for (const attackerPiece of pieces) for (const defenderPiece of pieces) for (const skin of skins) {
    const attacker = combatProfile(attackerPiece, "classic"), defender = combatProfile(defenderPiece, skin);
    for (let seed = 0; seed < 64; seed++) {
      const reaction = resolveDefense(attacker, defender, seed);
      assert.equal(reaction, resolveDefense(attacker, defender, seed));
      assert.ok(["parry", "shield", "barrier", "dodge", "brace"].includes(reaction));
      reactions.add(reaction);
      if (defenderPiece === "r") assert.ok(["shield", "brace", "barrier"].includes(reaction));
    }
  }
  assert.deepEqual([...reactions].sort(), ["barrier", "brace", "dodge", "parry", "shield"]);
  for (const spell of ["b", "q"]) for (const caster of ["b", "q"]) {
    assert.equal(resolveDefense(combatProfile(spell, "classic"), combatProfile(caster, "classic"), 7), "barrier");
  }
  const sword = combatProfile("n", "classic");
  const normal = combatProfile("p", "classic"), phase = combatProfile("p", "astral");
  assert.equal(new Set(Array.from({ length: 64 }, (_, seed) => resolveDefense(sword, normal, seed))).size, 2);
  assert.ok(Array.from({ length: 64 }, (_, seed) => resolveDefense(sword, phase, seed)).includes("dodge"));
  assert.ok(["parry", "shield"].includes(resolveDefense(sword, normal, NaN)));
});
