import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { CombatVFX } from "../src/vfx.ts";
import { captureFrame, CAPTURE_CLASH, CAPTURE_CONTACT, CAPTURE_DEATH } from "../src/combat.ts";
import { combatProfile } from "../src/combat-profiles.ts";

function frame(progress, contactAt = .56) {
  return { time: progress * 2.8, progress, contactAt, phase: "impact", charge: 1,
    travel: 1, strike: 1, defeat: 0, contact: progress >= contactAt, dead: false,
    from: new THREE.Vector3(-2, 0, 1), to: new THREE.Vector3(2, 0, -1),
    actor: new THREE.Vector3(1, 0, -1), target: new THREE.Vector3(2, 0, -1) };
}
function effect(quality = "auto", captured = true) {
  return new CombatVFX({ piece: "n", skin: "ember", color: 0xff782a, quality, captured });
}
function duelFrame(progress) {
  const motion = captureFrame(progress);
  return { ...frame(progress, CAPTURE_CONTACT), ...motion, progress,
    contact: progress >= CAPTURE_CONTACT, dead: progress >= CAPTURE_DEATH,
    opening: motion.opening, counter: motion.counter, finisher: motion.finisher,
    recovery: motion.recovery, clash: motion.clash };
}
function dispose(vfx) {
  vfx.group.traverse((part) => {
    if (!part.geometry) return;
    part.geometry.dispose(); part.material.dispose();
    if (part.isInstancedMesh) part.dispose();
  });
}

test("contact hold freezes energy motion for ordinary, cinematic and capture timings", () => {
  for (const [contactAt, captured] of [[.62, false], [.52, false], [.56, true]]) {
    const vfx = effect("auto", captured);
    const values = [];
    for (const progress of [contactAt, contactAt + .025, contactAt + .06]) {
      vfx.update(frame(progress, contactAt));
      values.push(vfx.group.children[0].material.uniforms.uTime.value);
    }
    assert.ok(values.every((value) => Math.abs(value - values[0]) < 1e-10));
    vfx.update(frame(contactAt + .15, contactAt));
    assert.ok(vfx.group.children[0].material.uniforms.uTime.value > values[0]);
    dispose(vfx);
  }
});

test("thousands of updates retain bounded GPU buffers and reference-safe actor inputs", () => {
  for (const quality of ["low", "auto", "high"]) {
    const vfx = effect(quality), parts = [...vfx.group.children];
    const geometry = parts.map((part) => part.geometry.uuid);
    const motes = parts.find((part) => part.isPoints);
    assert.ok(motes.geometry.attributes.position.count <= 96);
    assert.equal(parts.length, quality === "low" ? 4 : 5);
    if (quality === "low") assert.ok(parts.every((part) => !part.isInstancedMesh));
    const input = frame(.5), actor = input.actor.toArray(), target = input.target.toArray();
    for (let i = 0; i < 2000; i++) vfx.update({ ...input, progress: i / 2000 });
    assert.deepEqual(vfx.group.children.map((part) => part.geometry.uuid), geometry);
    assert.deepEqual(input.actor.toArray(), actor); assert.deepEqual(input.target.toArray(), target);
    assert.notEqual(parts[0].material.uniforms.uActor.value, input.actor);
    vfx.update(frame(1)); assert.equal(vfx.group.visible, false);
    assert.equal(parts[0].material.uniforms.uFade.value, 0);
    dispose(vfx);
  }
});

test("capture energy faces the actual defender, including an off-destination en passant victim", () => {
  const vfx = effect(), input = frame(.5);
  input.target.set(1, 0, 1);
  vfx.update(input);
  const direction = vfx.group.children[0].material.uniforms.uForward.value;
  assert.ok(direction.distanceTo(input.target.clone().sub(input.actor).normalize()) < 1e-10);
  assert.ok(vfx.lockGroup.position.distanceTo(new THREE.Vector3(1, .057, 1)) < 1e-10);
  dispose(vfx);
});

test("the blocked opening, finisher and disintegration use separate choreography signals", () => {
  const vfx = effect(), uniforms = vfx.group.children[0].material.uniforms;
  const blocked = duelFrame(CAPTURE_CLASH);
  vfx.update(blocked);
  assert.equal(uniforms.uClash.value, 1);
  assert.ok(uniforms.uCounter.value > .4);
  assert.equal(uniforms.uImpact.value, 0);
  assert.equal(uniforms.uContact.value, 0);
  assert.equal(uniforms.uDeath.value, 0);
  const expectedContact = blocked.actor.clone().add(blocked.target).multiplyScalar(.5);
  expectedContact.y = 1.05;
  assert.ok(uniforms.uClashPoint.value.distanceTo(expectedContact) < 1e-10);

  vfx.update(duelFrame(CAPTURE_CONTACT - .015));
  assert.ok(uniforms.uAttack.value > .6);
  assert.ok(uniforms.uFinisher.value > .5);
  assert.equal(uniforms.uClash.value, 0);
  assert.equal(uniforms.uDeath.value, 0);
  const held = [];
  for (const offset of [0, .025, .055]) {
    vfx.update(duelFrame(CAPTURE_CONTACT + offset));
    held.push(uniforms.uTime.value);
    assert.equal(uniforms.uContact.value, 1);
  }
  assert.ok(held.every(value => Math.abs(value - held[0]) < 1e-10));

  vfx.update(duelFrame(CAPTURE_DEATH));
  assert.equal(uniforms.uDeath.value, 0, "death cannot jump midway through the dissolution");
  const defeat = duelFrame(CAPTURE_DEATH + .035);
  vfx.update(defeat);
  assert.ok(uniforms.uDeath.value > 0 && uniforms.uDeath.value < 1);
  assert.equal(uniforms.uDeath.value, defeat.defeat);
  dispose(vfx);
});

test("all forty-eight class and skin signatures resolve geometry and profile values within every budget", () => {
  for (const quality of ["low", "auto", "high"]) for (const piece of ["p", "n", "b", "r", "q", "k"]) {
    const signatures = [];
    for (const skin of ["classic", "ember", "frost", "astral", "royal", "storm", "void", "prism"]) {
      const vfx = new CombatVFX({ piece, skin, color: 0xffffff, quality, captured: true,
        defenderPiece: "r", defenderSkin: "frost", defenderColor: 0x699eff, reaction: "brace" });
      const profile = combatProfile(piece, skin), u = vfx.group.children[0].material.uniforms;
      assert.equal(vfx.group.userData.profile, profile.id);
      assert.equal(vfx.group.userData.flourish, profile.vfx.flourish);
      assert.equal(vfx.group.children.length, quality === "low" ? 4 : 5);
      assert.equal(u.uLobes.value, profile.vfx.lobes);
      assert.equal(u.uRings.value, profile.vfx.rings);
      assert.equal(u.uTrailWidth.value, profile.vfx.trailWidth);
      assert.equal(u.uBurstScale.value, profile.vfx.burstScale);
      assert.equal(u.uOrbitSpeed.value, profile.vfx.orbitSpeed);
      assert.ok(u.uShardRatio.value >= 0 && u.uShardRatio.value <= 1);
      assert.equal(u.uDefenderPiece.value, 3);
      assert.equal(u.uDefenderSkin.value, 2);
      assert.equal(u.uReaction.value, 4);
      assert.equal(u.uDefenderColor.value.getHex(), 0x699eff);
      // Width, ring structure, burst and direction give each skin a distinct signature.
      signatures.push([u.uLobes.value, u.uRings.value, u.uTrailWidth.value, u.uBurstScale.value, u.uOrbitSpeed.value].join(":"));
      for (const progress of [0, CAPTURE_CLASH, CAPTURE_CONTACT, CAPTURE_DEATH, 1]) {
        vfx.update(duelFrame(progress));
        for (const uniform of Object.values(u)) if (typeof uniform.value === "number") assert.ok(Number.isFinite(uniform.value));
      }
      dispose(vfx);
    }
    assert.equal(new Set(signatures).size, 8);
  }
});

test("every defensive response retains two local counter paths without another draw batch", () => {
  for (const [index, reaction] of ["parry", "shield", "barrier", "dodge", "brace"].entries()) {
    const vfx = new CombatVFX({ piece: "p", skin: "classic", color: 0xffffff, quality: "low",
      captured: true, defenderPiece: "n", defenderSkin: "astral", reaction });
    const ribbons = vfx.group.children[1], u = ribbons.material.uniforms;
    assert.equal(u.uReaction.value, index);
    assert.equal(u.uOffensePaths.value, 4);
    assert.equal(Math.max(...ribbons.geometry.attributes.aPath.array), 5);
    assert.equal(vfx.group.children.length, 4);
    vfx.update(duelFrame(CAPTURE_CLASH));
    assert.ok(u.uCounter.value > .4);
    assert.ok(u.uClashPoint.value.x > frame(0).actor.x && u.uClashPoint.value.x < frame(0).target.x);
    dispose(vfx);
  }
});

test("repeat captures reuse immutable CPU geometry arrays and own disposable GPU wrappers", () => {
  const first = effect("high"), second = effect("high");
  for (const [index, object] of first.group.children.entries()) {
    const other = second.group.children[index];
    assert.notEqual(object.geometry, other.geometry);
    assert.notEqual(object.material, other.material);
    assert.equal(object.geometry.userData.template, other.geometry.userData.template);
    for (const [name, attribute] of Object.entries(object.geometry.attributes)) {
      assert.notEqual(attribute, other.geometry.attributes[name]);
      assert.equal(attribute.array, other.geometry.attributes[name].array);
    }
    if (object.geometry.index) assert.equal(object.geometry.index.array, other.geometry.index.array);
  }
  let disposed = 0;
  first.group.children.forEach(part => part.geometry.addEventListener("dispose", () => disposed++));
  dispose(first);
  assert.equal(disposed, 5);
  // Cancelling one move cannot dispose the next move's geometry or change its uniforms.
  second.update(duelFrame(CAPTURE_CONTACT));
  assert.equal(second.group.children[0].material.uniforms.uContact.value, 1);
  dispose(second);
});
