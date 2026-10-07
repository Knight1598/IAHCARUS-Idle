import test from "node:test";
import assert from "node:assert/strict";
import { readProfile, claimXP, matchXP, levelProgress, isSkinUnlocked } from "../src/profile.ts";

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
