import test from "node:test";
import assert from "node:assert/strict";
import { readEconomy, enterContract, settleContract, rollSkin, forgeSkin, dailyCredits, economicModes } from "../shared/economy.js";
import { readProfile, isSkinUnlocked, equipPiece, pieceSkin } from "../src/profile.ts";
import { cosmeticProgression } from "../server/accounts.mjs";

test("legacy profiles keep their army and receive a one-time starter wallet", () => {
  const old = readProfile('{"xp":600,"skin":"royal","loadouts":{"w":{"b1":"astral"}}}');
  assert.equal(old.economy.credits, 750);
  assert.equal(old.skin, "royal"); assert.equal(pieceSkin(old, "w", "b1"), "astral");
  old.economy.credits = 0;
  assert.equal(readProfile(JSON.stringify(old)).economy.credits, 0, "reload must not refill an empty wallet");
  const bad = readEconomy({ credits: -1, shards: Infinity, pity: 50, owned: ["royal", "invalid"], log: [{ label: "bad", delta: NaN }] });
  assert.equal(bad.credits, 0); assert.equal(bad.shards, 0); assert.equal(bad.pity, 7); assert.deepEqual(bad.owned, ["royal"]);
});
test("entry fees and outcomes are atomic and survive reload without duplicate charges or rewards", () => {
  let wallet = enterContract(readEconomy(), "match-1", "stakes").wallet;
  assert.equal(wallet.credits, 600);
  assert.equal(enterContract(wallet, "match-1", "stakes").added, false);
  wallet = settleContract(wallet, "match-1", "stakes", { won: true, draw: false }).wallet;
  assert.equal(wallet.credits, 1050);
  assert.equal(settleContract(readEconomy(JSON.parse(JSON.stringify(wallet))), "match-1", "stakes", { won: true }).added, false);
  assert.throws(() => settleContract(wallet, "unpaid", "stakes", { won: true }));
  assert.throws(() => settleContract(enterContract(readEconomy(), "wrong-mode", "bounty").wallet, "wrong-mode", "stakes", { won: true }), /เปิดสัญญา/);
  assert.throws(() => enterContract({ ...wallet, credits: 100 }, "poor", "stakes"), /เครดิตไม่พอ/);
  assert.equal(wallet.credits, 1050, "failed entry never mutates the original");
});
test("all five contracts settle wins, draws and losses according to published caps", () => {
  for (const mode of economicModes) {
    const paid = enterContract(readEconomy(), mode.id, mode.id).wallet;
    const win = settleContract(paid, mode.id, mode.id, { won: true, solved: 99, capturedValue: 99, controlScore: 99, unusedBudget: 99 });
    assert.equal(win.amount, { bounty: 360, vault: 300, broker: 380, stakes: 450, payday: 500 }[mode.id]);
    assert.equal(settleContract(paid, mode.id, mode.id, { won: false }).amount, 0);
    assert.equal(settleContract(paid, mode.id, mode.id, { draw: true }).amount, mode.id === "payday" ? 0 : mode.entry);
  }
});
test("skin probabilities have exact boundaries, seven distinct results, duplicate shards and eight-pull guarantee", () => {
  const base = { ...readEconomy(), credits: 3000 };
  for (const [value, skin] of [[0,"ember"],[.21999,"ember"],[.22,"frost"],[.44,"astral"],[.60,"royal"],[.68,"storm"],[.88,"void"],[.96,"prism"]]) {
    const reward = rollSkin(base, [], () => value);
    assert.equal(reward.skin, skin); assert.equal(reward.wallet.credits, 2850); assert.equal(reward.duplicate, false);
  }
  let wallet = base;
  for (let i = 0; i < 7; i++) wallet = rollSkin(wallet, ["ember"], () => 0).wallet;
  const guaranteed = rollSkin(wallet, [], () => 0);
  assert.equal(guaranteed.skin, "royal"); assert.equal(guaranteed.guaranteed, true); assert.equal(guaranteed.wallet.pity, 0);
  assert.equal(guaranteed.wallet.shards, 140);
  assert.throws(() => rollSkin({ ...base, credits: 149 }), /150/);
  assert.throws(() => rollSkin(base, [], () => NaN));
});
test("a collected skin equips on an independent piece at level one and survives migration", () => {
  let profile = readProfile(null);
  profile.economy = rollSkin(profile.economy, [], () => .64).wallet;
  assert.equal(profile.xp, 0); assert.equal(isSkinUnlocked(profile, "royal"), true);
  profile = equipPiece(profile, "w", "b1", "royal");
  const restored = readProfile(JSON.stringify(profile));
  assert.equal(pieceSkin(restored, "w", "b1"), "royal"); assert.equal(pieceSkin(restored, "w", "g1"), "classic");
});
test("forge exchanges duplicate shards for a chosen skin once without spending credits", () => {
  const base = { ...readEconomy(), shards: 240 };
  const next = forgeSkin(base, "royal");
  assert.equal(next.shards, 0); assert.equal(next.credits, 750); assert.deepEqual(next.owned, ["royal"]);
  assert.throws(() => forgeSkin({ ...next, shards: 999 }, "royal"), /แล้ว/);
  assert.throws(() => forgeSkin(base, "royal", ["royal"]), /แล้ว/);
});
test("daily credits cannot be reclaimed by reload and dates have separate claims", () => {
  const first = dailyCredits(readEconomy(), "2026-10-09");
  assert.equal(first.wallet.credits, 850);
  assert.equal(dailyCredits(readEconomy(first.wallet), "2026-10-09").added, false);
  assert.equal(dailyCredits(first.wallet, "2026-10-10").wallet.credits, 950);
  assert.throws(() => dailyCredits(first.wallet, "2026-02-30"), /วันที่/);
});
test("account cosmetic backups retain credits, guarantee progress, inventory and claim deduplication", () => {
  const profile = readProfile(null);
  profile.economy = enterContract(profile.economy, "backup", "bounty").wallet;
  profile.economy = rollSkin(profile.economy, [], () => .5).wallet;
  profile.economy.owned.push("void", "prism");
  profile.loadouts.w.b1 = "prism";
  const backup = cosmeticProgression(JSON.parse(JSON.stringify(profile)));
  const restored = readProfile(JSON.stringify(backup));
  assert.deepEqual(restored.economy, profile.economy);
  assert.equal(enterContract(restored.economy, "backup", "bounty").added, false);
  assert.equal(isSkinUnlocked(restored, "astral"), true);
  assert.equal(pieceSkin(restored, "w", "b1"), "prism");
  assert.equal(isSkinUnlocked(restored, "void"), true);
});
