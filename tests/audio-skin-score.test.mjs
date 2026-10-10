import test from "node:test";
import assert from "node:assert/strict";
import { rescoreLegacySkin } from "../src/audio-skin-score.ts";
import { pieceSoundRecipe } from "../src/sound.ts";
import { renderSoundRecipe } from "../src/audio-synthesis.ts";

const skins = ["ember", "frost", "astral", "royal", "storm", "void", "prism"];
const pieces = ["p", "n", "b", "r", "q", "k"];
const cues = ["draw", "charge", "release", "clash", "counter", "finisher", "impact", "armor", "disintegrate", "check"];
const base = (piece = "n") => pieceSoundRecipe(piece, "impact", 0, .4, true, .2);
// Ignore pitch and gain: different takes must change the material or temporal arrangement.
const structure = recipe => JSON.stringify(recipe.map(({ kind, texture, duration, offset, envelope, filter, partials }) =>
  ({ kind, texture, duration, offset, envelope, filter, partials })));
const metrics = pcm => {
  let energy = 0, peak = 0;
  for (const channel of [pcm.left, pcm.right]) for (const value of channel) {
    assert.ok(Number.isFinite(value), "all rendered samples must be finite");
    peak = Math.max(peak, Math.abs(value)); energy += value * value;
  }
  return { peak, rms: Math.sqrt(energy / (pcm.left.length + pcm.right.length)) };
};

test("skin rescoring leaves classic and newer dedicated skin scores untouched", () => {
  for (const skin of ["classic", "nova", "phantom", "dragon"]) assert.equal(rescoreLegacySkin(base(), skin, "impact", "n", 0), null);
  const original = base(), snapshot = structuredClone(original);
  for (const skin of skins) assert.ok(rescoreLegacySkin(original, skin, "impact", "n", 0));
  assert.deepEqual(original, snapshot, "scoring must not modify the incoming class recipe");
});

test("seven skin materials have distinct source and timing signatures, with four arranged takes", () => {
  for (const piece of pieces) for (const cue of cues) {
    const signatures = new Set();
    for (const skin of skins) {
      const takes = Array.from({ length: 4 }, (_, take) => rescoreLegacySkin(base(piece), skin, cue, piece, take));
      assert.ok(takes.every(recipe => recipe.length <= 8), `${skin}:${piece}:${cue} layer budget`);
      assert.equal(new Set(takes.map(structure)).size, 4, `${skin}:${piece}:${cue} must vary more than pitch`);
      signatures.add(structure(takes[0]));
    }
    assert.equal(signatures.size, skins.length, `${piece}:${cue} materials must not be recolored instruments`);
  }
});

test("actions stay distinct and skin scores retain all six class weapon accents", () => {
  for (const skin of skins) {
    for (let take = 0; take < 4; take++) {
      const recipes = cues.map(cue => rescoreLegacySkin(base(), skin, cue, "n", take));
      assert.equal(new Set(recipes.map(structure)).size, cues.length, `${skin}:${take} action identities`);
    }
    const classScores = pieces.map(piece => rescoreLegacySkin(base(piece), skin, "impact", piece, 0));
    assert.equal(new Set(classScores.map(structure)).size, pieces.length, `${skin} weapon accents`);
  }
});

test("contact starts immediately and charge builds gradually within the capture clock", () => {
  for (const skin of skins) for (const piece of pieces) for (let take = 0; take < 4; take++) {
    const impact = rescoreLegacySkin(base(piece), skin, "impact", piece, take);
    assert.ok(impact.some(layer => layer.offset === 0 && layer.envelope === "punch"), `${skin} cannot delay impact`);
    const charge = rescoreLegacySkin(base(piece), skin, "charge", piece, take);
    assert.ok(charge.some(layer => layer.offset === 0 && layer.envelope === "rise"), `${skin} charge should swell`);
    for (const cue of cues) for (const layer of rescoreLegacySkin(base(piece), skin, cue, piece, take)) {
      for (const key of ["duration", "offset", "cutoff", "level", "pan", "room"]) assert.ok(Number.isFinite(layer[key]), `${skin}:${cue}:${key}`);
      assert.ok(layer.duration > 0 && layer.duration + layer.offset <= 1.8, `${skin} voice extends beyond the scene`);
      assert.ok(layer.offset >= 0 && layer.level > 0 && layer.level <= .24 && Math.abs(layer.pan) <= .75);
      if (layer.kind === "tone") {
        assert.equal(layer.wave, "sine", "no retro square/saw voice");
        assert.ok(layer.from > 0 && layer.to > 0 && layer.fm >= 0);
      }
    }
  }
});

test("material scores render audible finite PCM with comfortable family energy", () => {
  const hitRms = [];
  for (const skin of skins) {
    const energies = new Set();
    for (const cue of ["draw", "charge", "release", "impact", "disintegrate"]) for (let take = 0; take < 4; take++) {
      const recipe = rescoreLegacySkin(base(), skin, cue, "n", take);
      const pcm = renderSoundRecipe(recipe, 12000, 7723 + take), { peak, rms } = metrics(pcm);
      assert.ok(peak > .005 && peak < .55, `${skin}:${cue}:${take} peak ${peak}`);
      assert.ok(rms > .001 && rms < .08, `${skin}:${cue}:${take} RMS ${rms}`);
      assert.ok(pcm.duration <= 1.8, `${skin}:${cue} cancellable voice duration`);
      if (cue === "impact") { hitRms.push(rms); energies.add(rms.toFixed(7)); }
    }
    assert.equal(energies.size, 4, `${skin} four impact takes must have different rendered articulation`);
  }
  assert.ok(Math.max(...hitRms) / Math.min(...hitRms) < 4, "changing skin must not create a huge loudness jump");
});
