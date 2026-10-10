import test from "node:test";
import assert from "node:assert/strict";
import { moveFrame, captureFrame, CAPTURE_DURATION, CAPTURE_CONTACT, CAPTURE_CLASH, CAPTURE_COUNTER_CLASH, CAPTURE_FINISHER,
  CAPTURE_RELEASE, CAPTURE_DEATH, CAPTURE_RETURN, clampCaptureDuration, captureCuePoints, resumeAnimationStart } from "../src/combat.ts";

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

test("five-second capture gives a block, counter and second combo before final defeat and occupation", () => {
  const at = seconds => captureFrame(seconds / 5);
  assert.equal(CAPTURE_DURATION, 5000);
  assert.equal(at(.2).approach, 0);
  for (const [seconds, phase] of [[.2, "faceoff"], [.7, "opening"], [1.7, "defense"], [2.5, "opening"], [3.8, "finisher"], [4.4, "defeat"]]) {
    assert.equal(at(seconds).combatPhase, phase);
  }
  assert.equal(at(1).approach, 1);
  assert.equal(at(1.25).phase, "windup");
  assert.equal(at(3.7).phase, "strike");
  assert.ok(at(1.08).defenderGuard > .999);
  assert.ok(at(1.86).attackerGuard > .999);
  assert.ok(at(1.86).defenderStrike > .98, "defender visibly counterattacks before losing");
  for (const seconds of [1.08, 1.86, 2.48, 2.83]) {
    assert.equal(at(seconds).impact, false, "an exchange never repeats the legal capture impact");
    assert.equal(at(seconds).death, false);
  }
  assert.equal(at(3.9).impact, true);
  assert.equal(at(3.9).death, false);
  assert.equal(at(3.9).particleSpeed, 0);
  assert.equal(at(4.3).death, true);
  for (const seconds of [.9, 1.86, 2.83, 3.85, 4.25, 4.64]) assert.equal(at(seconds).occupy, 0);
  assert.equal(at(4.8).phase, "occupy");
  assert.ok(at(4.8).occupy > 0);
  assert.equal(at(4.65).defeat, 1, "the defender has dissolved before occupation starts");
  assert.equal(at(5).seconds, 5);
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
  for (const seconds of [1.09, 1.14, 1.87, 1.93, 2.5, 2.54, 2.85, 2.89, 3.86, 3.96]) assert.equal(captureFrame(seconds / 5).particleSpeed, 0);
  assert.equal(captureFrame(3.65 / 5).particleSpeed, .3);
  assert.equal(captureFrame(1).particleSpeed, 1);
  assert.equal(captureCuePoints.filter(point => point.cue === "impact").length, 1);
  assert.equal(captureCuePoints.filter(point => point.cue === "disintegrate").length, 1);
  assert.equal(captureCuePoints.filter(point => point.cue === "clash").length, 4);
  assert.ok(captureCuePoints.some(point => point.cue === "release" && point.actor === "defender"));
  assert.equal(captureCuePoints.find(point => point.at === CAPTURE_COUNTER_CLASH).actor, "attacker");
  assert.ok(CAPTURE_FINISHER < CAPTURE_RELEASE && CAPTURE_RELEASE < CAPTURE_CONTACT);
  assert.ok(CAPTURE_CONTACT < CAPTURE_DEATH && CAPTURE_DEATH < CAPTURE_RETURN);
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
  for (let i = 1; i <= CAPTURE_DURATION; i++) {
    const frame = captureFrame(i / CAPTURE_DURATION);
    for (const field of fields) {
      assert.ok(frame[field] >= previous[field] && frame[field] <= 1, `${field} at ${i}ms`);
    }
    assert.ok(frame.clash >= 0 && frame.clash <= 1);
    for (const field of ["attackerStrike", "defenderStrike", "attackerCharge", "defenderCharge", "attackerGuard", "defenderGuard", "contactPulse", "block"]) {
      assert.ok(frame[field] >= 0 && frame[field] <= 1, `${field} at ${i}ms`);
    }
    previous = frame;
  }
  for (const field of fields) assert.equal(captureFrame(NaN)[field], 0);
  for (const duration of [-100, 1000, 2000]) assert.equal(clampCaptureDuration(duration), 2000);
  for (const duration of [5000, 6000]) assert.equal(clampCaptureDuration(duration), 5000);
  for (const duration of [2600, 3000, 4200]) assert.equal(clampCaptureDuration(duration), duration);
  assert.equal(clampCaptureDuration(2750), 2750);
  for (const duration of [NaN, Infinity, -Infinity]) assert.equal(clampCaptureDuration(duration), CAPTURE_DURATION);
});


test("resume freezes existing elapsed motion and does not delay new online updates into the future", () => {
  assert.equal(resumeAnimationStart(5, 10, 20), 15, "existing animation retains five elapsed time units");
  assert.equal(resumeAnimationStart(12, 10, 20), 20, "presentation received during pause resumes immediately");
  assert.equal(resumeAnimationStart(59, 10, 60), 60, "a long hidden tab must not add its full pause to the latest server move");
  assert.equal(resumeAnimationStart(70, 10, 60), 70, "intentionally future-started presentations retain their start");
});
