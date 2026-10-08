import test from "node:test";
import assert from "node:assert/strict";
import { moveFrame, captureFrame, CAPTURE_DURATION, CAPTURE_CONTACT, CAPTURE_CLASH, CAPTURE_DEATH, clampCaptureDuration, captureCuePoints, resumeAnimationStart } from "../src/combat.ts";

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

test("capture staging gives both actors a response before the final blow and legal occupation", () => {
  const at = seconds => captureFrame(seconds / 2.6);
  assert.equal(CAPTURE_DURATION, 2600);
  assert.equal(at(.2).approach, 0);
  for (const [seconds, phase] of [[.2, "faceoff"], [.7, "opening"], [1.25, "defense"], [1.8, "finisher"], [2.4, "defeat"]]) {
    assert.equal(at(seconds).combatPhase, phase);
  }
  assert.equal(at(1).approach, 1);
  assert.equal(at(1.25).phase, "windup");
  assert.equal(at(1.7).phase, "strike");
  assert.equal(at(1.25).impact, false);
  assert.equal(at(1.25).death, false);
  assert.equal(at(1.9).impact, true);
  assert.equal(at(1.9).death, false);
  assert.equal(at(1.9).particleSpeed, 0);
  assert.equal(at(2.15).death, true);
  for (const seconds of [.9, 1.25, 1.85, 2.1, 2.32]) assert.equal(at(seconds).occupy, 0);
  assert.equal(at(2.4).phase, "occupy");
  assert.ok(at(2.4).occupy > 0);
  assert.ok(at(2.33).defeat > .9, "the defender has almost dissolved before occupation starts");
  assert.equal(captureFrame(1).occupy, 1);
  assert.equal(captureFrame(-2).approach, 0);
  assert.equal(captureFrame(2).occupy, 1);
});

test("contact and disintegration share exact audio and animation landmarks", () => {
  assert.equal(captureCuePoints.find(point => point.cue === "clash").at, CAPTURE_CLASH);
  assert.equal(captureCuePoints.find(point => point.cue === "impact").at, CAPTURE_CONTACT);
  assert.equal(captureCuePoints.find(point => point.cue === "disintegrate").at, CAPTURE_DEATH);
  assert.equal(captureFrame(CAPTURE_CONTACT - 1e-8).impact, false);
  assert.equal(captureFrame(CAPTURE_CONTACT).impact, true);
  assert.equal(captureFrame(CAPTURE_DEATH - 1e-8).death, false);
  assert.equal(captureFrame(CAPTURE_DEATH).death, true);
  assert.ok(Math.abs(captureFrame(CAPTURE_CLASH).clash - 1) < 1e-12);
  for (const seconds of [1.13, 1.17, 1.86, 1.93]) assert.equal(captureFrame(seconds / 2.6).particleSpeed, 0);
  assert.equal(captureFrame(1.3 / 2.6).particleSpeed, .3);
  assert.equal(captureFrame(1).particleSpeed, 1);
  assert.equal(captureCuePoints.length, 9);
  let previous = -1;
  for (const cue of captureCuePoints) {
    assert.ok(cue.at > previous && cue.at < 1);
    assert.ok(["attacker", "defender"].includes(cue.actor));
    assert.ok(Object.isFrozen(cue));
    previous = cue.at;
  }
  assert.ok(Object.isFrozen(captureCuePoints));
});

test("capture progress is bounded and monotonic while reactions remain separate", () => {
  const fields = ["charge", "approach", "opening", "counter", "finisher", "strike", "defeat", "occupy", "recovery"];
  let previous = captureFrame(0);
  for (let i = 1; i <= 2600; i++) {
    const frame = captureFrame(i / 2600);
    for (const field of fields) {
      assert.ok(frame[field] >= previous[field] && frame[field] <= 1, `${field} at ${i}ms`);
    }
    assert.ok(frame.clash >= 0 && frame.clash <= 1);
    previous = frame;
  }
  for (const field of fields) assert.equal(captureFrame(NaN)[field], 0);
  for (const duration of [-100, 1000, 2000]) assert.equal(clampCaptureDuration(duration), 2000);
  for (const duration of [3000, 5000]) assert.equal(clampCaptureDuration(duration), 3000);
  assert.equal(clampCaptureDuration(2750), 2750);
  for (const duration of [NaN, Infinity, -Infinity]) assert.equal(clampCaptureDuration(duration), CAPTURE_DURATION);
});


test("resume freezes existing elapsed motion and does not delay new online updates into the future", () => {
  assert.equal(resumeAnimationStart(5, 10, 20), 15, "existing animation retains five elapsed time units");
  assert.equal(resumeAnimationStart(12, 10, 20), 20, "presentation received during pause resumes immediately");
  assert.equal(resumeAnimationStart(59, 10, 60), 60, "a long hidden tab must not add its full pause to the latest server move");
  assert.equal(resumeAnimationStart(70, 10, 60), 70, "intentionally future-started presentations retain their start");
});
