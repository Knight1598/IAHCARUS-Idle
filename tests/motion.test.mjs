import test from "node:test";
import assert from "node:assert/strict";
import { captureFrame } from "../src/combat.ts";
import { fighterPose, defenderPose } from "../src/motion.ts";

const classes = ["p", "n", "b", "r", "q", "k"];
const sample = (type, progress) => {
  const frame = captureFrame(progress);
  return fighterPose(type, frame.charge, frame.strike, progress * 2.8, { progress, approach: frame.approach });
};
const values = (pose) => Object.values(pose).flat();

test("all six fighters have distinct windups, finishing gestures and guards", () => {
  for (const progress of [0.44, 0.54, 0.62]) {
    const signatures = classes.map((type) => {
      const pose = sample(type, progress);
      return JSON.stringify([pose.torso, pose.leftArm, pose.rightArm, pose.weapon]);
    });
    assert.equal(new Set(signatures).size, 6);
  }
  assert.equal(new Set(classes.map((type) => JSON.stringify(defenderPose(type, 0.75, 1.2)))).size, 6);
});

test("capture choreography is bounded and continuous through phase boundaries", () => {
  for (const type of classes) {
    let previous = values(sample(type, 0));
    for (let i = 1; i <= 1000; i++) {
      const current = values(sample(type, i / 1000));
      for (let j = 0; j < current.length; j++) {
        assert.ok(Number.isFinite(current[j]) && Math.abs(current[j]) < 4, `${type} pose out of bounds at ${i}`);
        assert.ok(Math.abs(current[j] - previous[j]) < 0.15, `${type} snapped at ${i}`);
      }
      previous = current;
    }
  }
});

test("attacks shift weight and recover rather than holding their strike forever", () => {
  for (const type of classes) {
    const charged = sample(type, 0.45), strike = sample(type, 0.56), recovery = sample(type, 0.86);
    assert.notDeepEqual(charged.torso, strike.torso);
    assert.notDeepEqual(charged.leftLeg, recovery.leftLeg);
    assert.notDeepEqual([strike.weapon, strike.weaponOffset], [recovery.weapon, recovery.weaponOffset]);
    assert.ok(Math.abs(recovery.torso[1]) < Math.abs(charged.torso[1]) + 0.001);
    assert.deepEqual(sample(type, 0.56), strike, "sampling a frame must be deterministic");
  }
});

test("heavy defenders keep their footing longer and guard transitions remain smooth", () => {
  assert.ok(Math.abs(defenderPose("r", 1, 0).body[2]) < Math.abs(defenderPose("p", 1, 0).body[2]));
  for (const type of classes) {
    let previous = values(defenderPose(type, 0, 0));
    for (let i = 1; i <= 200; i++) {
      const current = values(defenderPose(type, i / 200, i / 200));
      current.forEach((value, j) => assert.ok(Number.isFinite(value) && Math.abs(value - previous[j]) < 0.04));
      previous = current;
    }
  }
});
