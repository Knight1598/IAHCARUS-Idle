import test from "node:test";
import assert from "node:assert/strict";
import { readProfile, claimXP, matchXP, levelProgress, isSkinUnlocked, equipPiece, equipArmy, pieceSkin } from "../src/profile.ts";

test("new and malformed profiles have usable starter skins and safe progress", () => {
  for (const input of [null, "broken", '{"xp":-1,"skin":"royal","claimed":{}}']) {
    const profile = readProfile(input);
    assert.equal(profile.xp, 0);
    assert.equal(profile.skin, "classic");
    for (const skin of ["classic", "ember", "frost"]) assert.equal(isSkinUnlocked(profile, skin), true);
    assert.equal(isSkinUnlocked(profile, "astral"), false);
  }
  assert.equal(readProfile('{"xp":400,"skin":"unknown"}').skin, "classic");
});
test("legacy army skins migrate without inventing individual assignments", () => {
  const profile = readProfile('{"xp":600,"skin":"royal"}');
  assert.equal(profile.skin, "royal");
  assert.deepEqual(profile.loadouts, { w: {}, b: {} });
  assert.equal(pieceSkin(profile, "w", "a2"), "royal");
  assert.equal(pieceSkin(profile, "b", "h8"), "royal");
});
test("each physical slot can be equipped independently and survives save/reload", () => {
  const original = readProfile('{"xp":600,"skin":"ember"}');
  let profile = equipPiece(original, "w", "b1", "frost");
  profile = equipPiece(profile, "w", "g1", "astral");
  profile = equipPiece(profile, "b", "b8", "royal");
  profile = readProfile(JSON.stringify(profile));
  assert.equal(pieceSkin(profile, "w", "b1"), "frost");
  assert.equal(pieceSkin(profile, "w", "g1"), "astral");
  assert.equal(pieceSkin(profile, "b", "b8"), "royal");
  assert.equal(pieceSkin(profile, "w", "a2"), "ember");
  assert.deepEqual(original.loadouts, { w: {}, b: {} });
  assert.deepEqual(equipArmy(profile, "classic").loadouts, { w: {}, b: {} });
  assert.equal(equipArmy(profile, "classic").skin, "classic");
});
test("invalid and locked assignments are rejected or filtered on load", () => {
  const profile = readProfile(null);
  assert.throws(() => equipPiece(profile, "w", "b1", "royal"), /locked/);
  assert.throws(() => equipArmy(profile, "astral"), /locked/);
  assert.throws(() => equipPiece(profile, "w", "b1", "unknown"), /Unknown/);
  assert.throws(() => equipPiece(profile, "w", "a9", "ember"), /slot/);
  assert.throws(() => equipPiece(profile, "red", "a1", "ember"), /slot/);
  const restored = readProfile(JSON.stringify({ xp: 0, loadouts: {
    w: { b1: "ember", g1: "royal", a9: "frost", c1: "unknown", d1: null },
    b: ["ember"],
  } }));
  assert.deepEqual(restored.loadouts, { w: { b1: "ember" }, b: {} });
});
test("match rewards unlock skins and survive save/reload without duplicate XP", () => {
  const profile = readProfile('{"xp":190,"skin":"ember"}');
  const amount = matchXP("b", "b", 2, 1);
  const reward = claimXP(profile, "match-1", amount, true, true);
  assert.equal(reward.profile.xp, 320);
  assert.equal(reward.profile.wins, 1);
  assert.equal(reward.profile.matches, 1);
  assert.deepEqual(reward.unlocked, ["astral"]);
  const restored = readProfile(JSON.stringify(reward.profile));
  assert.equal(claimXP(restored, "match-1", 200, true, true).added, false);
  assert.equal(restored.xp, 320);
  assert.equal(levelProgress(restored.xp).current, 120);
});
test("each first-clear reward is independent and royal skin unlocks at level four", () => {
  let profile = readProfile('{"xp":560}');
  const reward = claimXP(profile, "training:knight", 40);
  profile = reward.profile;
  assert.deepEqual(reward.unlocked, ["royal"]);
  assert.equal(levelProgress(profile.xp).level, 4);
  assert.equal(claimXP(profile, "training:knight", 40).added, false);
  assert.equal(claimXP(profile, "training:bishop", 40).added, true);
  assert.equal(profile.matches, 0);
  assert.throws(() => claimXP(profile, "invalid", -40));
});
