import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { CombatVFX } from "../src/vfx.ts";

function frame(progress, contactAt = .56) {
  return { time: progress * 2.8, progress, contactAt, phase: "impact", charge: 1,
    travel: 1, strike: 1, defeat: 0, contact: progress >= contactAt, dead: false,
    from: new THREE.Vector3(-2, 0, 1), to: new THREE.Vector3(2, 0, -1),
    actor: new THREE.Vector3(1, 0, -1), target: new THREE.Vector3(2, 0, -1) };
}
function effect(quality = "auto", captured = true) {
  return new CombatVFX({ piece: "n", skin: "ember", color: 0xff782a, quality, captured });
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
