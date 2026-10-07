import test from "node:test";
import assert from "node:assert/strict";
import { cinematicFrame } from "../src/cinematic.ts";
test("choreography charges before travelling and holds exactly at impact", () => {
  assert.equal(cinematicFrame(0.2).travel, 0);
  assert.equal(cinematicFrame(0.4).phase, "dash");
  assert.ok(cinematicFrame(0.4).travel > 0 && cinematicFrame(0.4).travel < 1);
  for (const t of [0.52, 0.55, 0.59]) {
    const f = cinematicFrame(t);
    assert.equal(f.phase, "impact");
    assert.equal(f.travel, 1);
    assert.equal(f.impact, true);
    assert.equal(f.release, 0);
  }
});
test("camera return finishes completely and progress is clamped", () => {
  assert.equal(cinematicFrame(-1).phase, "charge");
  assert.equal(cinematicFrame(0.7).phase, "aftermath");
  assert.equal(cinematicFrame(0.9).phase, "return");
  assert.equal(cinematicFrame(2).returning, 1);
});
test("impact has a single bounded pulse with no repeating flash", () => {
  let risingEdges = 0,
    previous = false;
  for (let i = 0; i <= 1000; i++) {
    const f = cinematicFrame(i / 1000);
    assert.ok(f.flash >= 0 && f.flash <= 1);
    const on = f.flash > 0;
    if (on && !previous) risingEdges++;
    previous = on;
  }
  assert.equal(risingEdges, 1);
});
