import test from "node:test";
import assert from "node:assert/strict";
import { engine } from "animejs/engine";
import { DuelChoreography } from "../src/duel-choreography.ts";
import { combatProfile } from "../src/combat-profiles.ts";
import { CAPTURE_DURATION } from "../src/combat.ts";

const pieces = ["p", "n", "b", "r", "q", "k"];
const skins = ["classic", "ember", "frost", "astral", "royal", "storm", "void", "prism", "nova", "phantom", "dragon"];
const make = (piece = "n", skin = "classic", defender = "p") =>
  new DuelChoreography(combatProfile(piece, skin), combatProfile(defender, "classic"));
const copy = frame => JSON.parse(JSON.stringify(frame));
const at = (duel, seconds) => duel.sample(seconds / 5);

test("Anime.js duel uses exactly the scene's five-second clock and stays paused", async () => {
  const duel = make();
  assert.equal(duel.duration, CAPTURE_DURATION);
  assert.equal(duel.paused, true);
  assert.equal(engine._head, null, "the duel must never attach a second animation loop");
  assert.deepEqual([at(duel, 0).attacker.x, at(duel, 0).defender.x], [-2.1, 2.1]);
  const frame = copy(at(duel, 1.86));
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(copy(duel.sample(1.86 / 5)), frame, "wall-clock time cannot advance a paused scene");
  assert.equal(engine._head, null);
  duel.dispose();
  duel.dispose();
  assert.throws(() => duel.sample(.4), /disposed/);
  assert.equal(engine._head, null, "skip/dispose leaves no timer to fire after board restoration");
});

test("opening, counter, double combo and final blow each hold visible contact before recovering", () => {
  const duel = make("p");
  for (const contact of [1.08, 2.48, 2.83, 3.85]) {
    for (const seconds of [contact, contact + .07]) {
      const frame = at(duel, seconds);
      assert.equal(frame.attacker.strike, 1);
      assert.equal(frame.attacker.aimWeight, 1);
      assert.ok(frame.defender.guard >= .9, `${contact}s defender must try to resist`);
      assert.equal(frame.defender.strike, 0, "both actors must not swing through one another");
    }
  }
  assert.equal(at(duel, 3.96).attacker.aimWeight, 1, "final impact has a longer 120ms hold");
  for (const seconds of [1.86, 1.93]) {
    const frame = at(duel, seconds);
    assert.equal(frame.defender.strike, 1);
    assert.equal(frame.defender.aimWeight, 1);
    assert.equal(frame.attacker.guard, 1);
    assert.equal(frame.attacker.strike, 0);
    assert.ok(frame.attacker.recoil > .3);
  }
  assert.equal(at(duel, 2.705).attacker.strike, 0, "the second combo resets the weapon before its next strike");
  assert.equal(at(duel, 5).attacker.strike, 0);
  assert.equal(at(duel, 5).defender.guard, 0);
  duel.dispose();
});

test("timeline seek is deterministic in any direction and reuses the two actor frames", () => {
  const duel = make("n", "astral", "q");
  const reference = new Map([0, .09, .216, .372, .496, .566, .77, .85, 1].map(t => [t, copy(duel.sample(t))]));
  const frame = duel.sample(0), attacker = frame.attacker, defender = frame.defender;
  for (const t of [.85, .216, 1, .09, .77, .372, 0, .496, .566, .216]) {
    assert.equal(duel.sample(t), frame);
    assert.equal(frame.attacker, attacker);
    assert.equal(frame.defender, defender);
    assert.deepEqual(copy(frame), reference.get(t), `seek drift at ${t}`);
  }
  assert.deepEqual(copy(duel.sample(NaN)), reference.get(0));
  assert.deepEqual(copy(duel.sample(-3)), reference.get(0));
  assert.deepEqual(copy(duel.sample(4)), reference.get(1));
  duel.dispose();
});

test("all six classes and eleven skins retain readable separation and continuous stage movement", () => {
  const signatures = [];
  for (const piece of pieces) for (const skin of skins) {
    const duel = make(piece, skin, pieces[(pieces.indexOf(piece) + 1) % pieces.length]);
    let previous = copy(duel.sample(0));
    for (let i = 1; i <= 1000; i++) {
      const frame = duel.sample(i / 1000);
      assert.ok(frame.defender.x - frame.attacker.x >= 1.33, `${piece}:${skin} overlapping bodies at ${i}`);
      assert.ok(frame.attacker.x < 0 && frame.defender.x > 0, "fighters cannot cross through one another");
      for (const actor of ["attacker", "defender"]) for (const [field, value] of Object.entries(frame[actor])) {
        assert.ok(Number.isFinite(value) && Math.abs(value) < 3.3, `${piece}:${skin} ${actor}.${field} out of bounds`);
        if (!["x", "z"].includes(field)) assert.ok(value >= 0 && value <= 1, `${field} must remain normalized`);
        assert.ok(Math.abs(value - previous[actor][field]) < .2, `${piece}:${skin} snapped ${field} at ${i}`);
      }
      previous = copy(frame);
    }
    if (skin === "classic") signatures.push(JSON.stringify([copy(at(duel, .92)), copy(at(duel, 2.72))]));
    duel.dispose();
  }
  assert.equal(new Set(signatures).size, 6, "class movement patterns cannot be simple recolours");
  const ranged = make("r"), melee = make("p");
  assert.ok(Math.abs(at(ranged, 1.08).attacker.x) > Math.abs(at(melee, 1.08).attacker.x) + .6,
    "cannons/spells fight at a different range from spear/slash fighters");
  ranged.dispose(); melee.dispose();
});

test("mixed-class pairs use the active striker's reach and hold both actors' spatial contact", () => {
  for (const attacker of pieces) for (const defender of pieces) {
    const duel = make(attacker, "classic", defender);
    for (const contact of [1.08, 1.86, 2.48, 2.83, 3.85]) {
      const striker = contact === 1.86 ? defender : attacker;
      const distance = ["b", "r", "q"].includes(striker) ? 3.2 : 1.34;
      const first = copy(at(duel, contact)), held = copy(at(duel, contact + .07));
      assert.ok(Math.abs(first.defender.x - first.attacker.x - distance) < 1e-8, `${attacker}/${defender} ${contact}s reach`);
      for (const actor of ["attacker", "defender"]) for (const field of ["x", "z", "lift"]) {
        assert.ok(Math.abs(first[actor][field] - held[actor][field]) < 1e-8, `${actor}.${field} drifts during contact hold`);
      }
    }
    duel.dispose();
  }
});
