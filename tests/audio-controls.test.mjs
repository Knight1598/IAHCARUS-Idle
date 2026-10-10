import test from "node:test";
import assert from "node:assert/strict";
import { readAudioPreferences, mixDefaults } from "../src/audio-controls.ts";

test("saved mix rejects invalid values and clamps each independent audio bus", () => {
  assert.deepEqual(readAudioPreferences("broken"), { levels: mixDefaults, muted: false, processing: "cinematic" });
  const saved = readAudioPreferences(JSON.stringify({ levels: { music: 2, ambience: -1, cinematic: .65, sfx: "loud" }, muted: true }));
  assert.equal(saved.levels.music, 1); assert.equal(saved.levels.ambience, 0);
  assert.equal(saved.levels.cinematic, .65); assert.equal(saved.levels.sfx, mixDefaults.sfx);
  assert.equal(saved.muted, true);
  assert.equal(saved.processing, "cinematic");
});

test("existing saved bus levels and mute survive adoption of cinematic processing", () => {
  const levels = { master: .63, music: .17, ambience: .31, sfx: .92, cinematic: .74 };
  assert.deepEqual(readAudioPreferences(JSON.stringify({ levels, muted: true })), {
    levels, muted: true, processing: "cinematic",
  });
  assert.deepEqual(readAudioPreferences(null), { levels: mixDefaults, muted: false, processing: "cinematic" });
});

test("processing modes persist independently and untrusted saved modes use cinematic", () => {
  for (const processing of ["cinematic", "focused", "dry"]) {
    const saved = readAudioPreferences(JSON.stringify({ levels: { music: .12 }, muted: true, processing }));
    assert.equal(saved.processing, processing);
    assert.equal(saved.levels.music, .12);
    assert.equal(saved.levels.sfx, mixDefaults.sfx);
    assert.equal(saved.muted, true);
    assert.deepEqual(readAudioPreferences(JSON.stringify(saved)), saved);
  }
  for (const processing of [undefined, null, false, 0, "", "unknown", "__proto__", { mode: "dry" }, ["focused"]]) {
    const saved = readAudioPreferences(JSON.stringify({ levels: { ambience: .44 }, processing }));
    assert.equal(saved.processing, "cinematic");
    assert.equal(saved.levels.ambience, .44);
  }
});
