import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { frameCombat } from "../src/framing.ts";
import { arenas, arenaIds, isArena } from "../src/arenas.ts";
import { readProfile } from "../src/profile.ts";

test("wide and portrait combat shots fit both fighters, weapons and raised attacks", () => {
  for (const aspect of [0.45, 0.7, 1, 1.8, 2.8]) for (const path of [[0, 1], [1, 1], [7, 0], [7, 7]]) for (const sign of [-1, 1]) {
    const from = new THREE.Vector3(-3.5, 0, -3.5), to = from.clone().add(new THREE.Vector3(path[0], 0, path[1]));
    const attack = to.clone().sub(from).normalize();
    const direction = new THREE.Vector3(-attack.z * sign, 0.62, attack.x * sign).addScaledVector(attack, 0.22);
    const bounds = [new THREE.Box3().setFromCenterAndSize(from.clone().add(new THREE.Vector3(0, 2.6, 0)), new THREE.Vector3(3, 5.2, 3)),
      new THREE.Box3().setFromCenterAndSize(to.clone().add(new THREE.Vector3(0, 1.75, 0)), new THREE.Vector3(2.6, 3.5, 2.6))];
    const shot = frameCombat(bounds, direction, 42, aspect);
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
    camera.position.copy(shot.position); camera.lookAt(shot.focus); camera.updateMatrixWorld();
    for (const box of bounds) for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const p = new THREE.Vector3(x, y, z).project(camera);
      assert.ok(Math.abs(p.x) < 0.74 && Math.abs(p.y) < 0.74, `Clipped fighter: ${aspect} ${path} ${p.toArray()}`);
      assert.ok(p.z > -1 && p.z < 1);
    }
    assert.ok(shot.distance < 80, "Shot exceeds visible arena/far plane");
  }
});

test("all eight arenas are free cosmetic options and safely persist in legacy profiles", () => {
  assert.equal(arenaIds.length, 8);
  assert.equal(new Set(arenaIds.map((id) => arenas[id].effect)).size, 8);
  for (const id of arenaIds) {
    const profile = readProfile(JSON.stringify({ arena: id, xp: 0 }));
    assert.equal(profile.arena, id);
    assert.equal(readProfile(JSON.stringify(profile)).arena, id);
  }
  for (const arena of [null, 42, {}, "unknown", "__proto__", "constructor"]) {
    assert.equal(isArena(arena), false);
    assert.equal(readProfile(JSON.stringify({ arena })).arena, "citadel");
  }
  assert.equal(readProfile(null).arena, "citadel");
});
