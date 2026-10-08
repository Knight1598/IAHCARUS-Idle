import test from "node:test";
import assert from "node:assert/strict";
import { readAudioPreferences, mixDefaults } from "../src/audio-controls.ts";

test("saved mix rejects invalid values and clamps each independent audio bus", () => {
  assert.deepEqual(readAudioPreferences("broken"), { levels: mixDefaults, muted: false });
  const saved = readAudioPreferences(JSON.stringify({ levels: { music: 2, ambience: -1, cinematic: .65, sfx: "loud" }, muted: true }));
  assert.equal(saved.levels.music, 1); assert.equal(saved.levels.ambience, 0);
  assert.equal(saved.levels.cinematic, .65); assert.equal(saved.levels.sfx, mixDefaults.sfx);
  assert.equal(saved.muted, true);
});
