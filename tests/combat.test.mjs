import test from "node:test";
import assert from "node:assert/strict";
import { moveFrame } from "../src/combat.ts";

test("every move charges, launches, slows its approach and holds at contact", () => {
  assert.equal(moveFrame(0.2).travel, 0);
  assert.equal(moveFrame(0.3).phase, "dash");
  assert.equal(moveFrame(0.5).phase, "slowmo");
  const fastSpeed = (moveFrame(0.4).travel - moveFrame(0.35).travel) / 0.05;
  const slowSpeed = (moveFrame(0.55).travel - moveFrame(0.5).travel) / 0.05;
  assert.ok(fastSpeed > slowSpeed * 3);
  for (const t of [0.62, 0.65, 0.7]) {
    assert.equal(moveFrame(t).travel, 1);
    assert.equal(moveFrame(t).particleSpeed, 0);
    assert.equal(moveFrame(t).impact, true);
  }
  let previous = 0;
  for (let i = 0; i <= 1000; i++) {
    const frame = moveFrame(i / 1000);
    assert.ok(frame.travel >= previous && frame.travel <= 1);
    previous = frame.travel;
  }
  assert.equal(moveFrame(-1).travel, 0);
  assert.equal(moveFrame(2).travel, 1);
});
