import test from "node:test";
import assert from "node:assert/strict";
import { SoundVariantBag, SOUND_VARIANTS, pieceSoundRecipe, eventSoundRecipe, SpaceAudio } from "../src/sound.ts";

const pieces = ["p", "n", "b", "r", "q", "k"];
const phases = ["lock", "charge", "dash", "impact", "death", "check"];
const events = ["check", "fork", "mate", "double-check", "discovered-check", "promotion", "rescue", "escape", "block", "castle", "en-passant", "first-blood", "recapture", "queen-fallen", "comeback", "capture-streak", "endgame", "mission", "intro", "victory", "defeat", "ui"];
const structure = (recipe) => JSON.stringify(recipe.map(({ kind, duration, offset, envelope, wave, filter, fm }) => ({ kind, duration, offset, envelope, wave, filter, fm })));

test("variant bags exhaust every variant and avoid repeats at bag boundaries", () => {
  let seed = 314159;
  for (const random of [() => 0, () => 0.9999, () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }]) {
    const bag = new SoundVariantBag(random);
    for (const key of ["p:dash", "r:impact", "event:fork"]) {
      const sequence = Array.from({ length: 400 }, () => bag.next(key));
      for (let i = 0; i < sequence.length; i += SOUND_VARIANTS) assert.equal(new Set(sequence.slice(i, i + SOUND_VARIANTS)).size, SOUND_VARIANTS);
      for (let i = 1; i < sequence.length; i++) assert.notEqual(sequence[i], sequence[i - 1]);
    }
  }
});

test("each piece/action has four variations in rhythm, envelope or layers, beyond pitch", () => {
  for (const piece of pieces) for (const phase of phases) {
    const recipes = Array.from({ length: SOUND_VARIANTS }, (_, v) => pieceSoundRecipe(piece, phase, v, 0.35, true));
    assert.equal(new Set(recipes.map(structure)).size, SOUND_VARIANTS, `${piece}:${phase}`);
  }
});

test("event cues have four structures and fork and mate have distinct signatures", () => {
  for (const event of events) {
    const recipes = Array.from({ length: SOUND_VARIANTS }, (_, v) => eventSoundRecipe(event, v));
    assert.equal(new Set(recipes.map(structure)).size, SOUND_VARIANTS, event);
  }
  for (let v = 0; v < SOUND_VARIANTS; v++) {
    assert.notDeepEqual(eventSoundRecipe("fork", v), eventSoundRecipe("mate", v));
    assert.notDeepEqual(eventSoundRecipe("victory", v), eventSoundRecipe("defeat", v));
  }
});

test("all recipes use bounded finite levels, positive frequencies and short scheduled tails", () => {
  const recipes = [];
  for (const piece of pieces) for (const phase of phases) for (let v = 0; v < SOUND_VARIANTS; v++) {
    recipes.push(pieceSoundRecipe(piece, phase, v, 1.2, true, -0.65));
  }
  for (const event of events) for (let v = 0; v < SOUND_VARIANTS; v++) recipes.push(eventSoundRecipe(event, v));
  for (const recipe of recipes) {
    assert.ok(recipe.length > 0 && recipe.length <= 8);
    for (const layer of recipe) {
      for (const key of ["duration", "level", "cutoff", "pan", "offset"]) assert.ok(Number.isFinite(layer[key]), key);
      assert.ok(layer.duration > 0 && layer.duration + layer.offset < 2);
      assert.ok(layer.level > 0 && layer.level <= 0.2);
      assert.ok(layer.cutoff >= 300 && layer.cutoff <= 4400);
      assert.ok(layer.offset >= 0);
      assert.ok(Math.abs(layer.pan) <= 0.75);
      if (layer.kind === "tone") assert.ok(layer.from > 0 && layer.to > 0 && layer.fm >= 0);
    }
  }
});

test("move/attack aliases retain their bags and ordinary arrival impacts remain quiet", () => {
  for (const piece of pieces) for (let v = 0; v < SOUND_VARIANTS; v++) {
    assert.deepEqual(pieceSoundRecipe(piece, "move", v), pieceSoundRecipe(piece, "dash", v));
    assert.deepEqual(pieceSoundRecipe(piece, "attack", v), pieceSoundRecipe(piece, "charge", v));
    const arrival = pieceSoundRecipe(piece, "impact", v, 0.3, false), capture = pieceSoundRecipe(piece, "impact", v, 0.3, true);
    arrival.forEach((layer, i) => assert.equal(layer.level, capture[i].level * 0.32));
  }
});

// Source scheduling is observable without a speaker or browser: catch future FM carriers
// that were previously left alive when an animation was skipped or sound was muted.
function audioContext() {
  const params = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  const context = { currentTime: 0, sampleRate: 44100, destination: {}, scheduled: [] };
  const node = () => ({ connect() { return this; }, disconnect() {}, gain: params(), frequency: params(), Q: params(), pan: params(), delayTime: params() });
  const source = () => {
    const result = { ...node(), start(time) { this.started = time; }, stop(time) { this.stopped = time; } };
    context.scheduled.push(result);
    return result;
  };
  Object.assign(context, {
    createGain: node, createBiquadFilter: node, createStereoPanner: node, createDelay: node,
    createDynamicsCompressor: () => ({ ...node(), threshold: params(), knee: params(), ratio: params(), attack: params(), release: params() }),
    createBuffer: (_, length) => ({ getChannelData: () => new Float32Array(length) }),
    createOscillator: source, createBufferSource: source,
  });
  return context;
}

test("cancel stops every scheduled carrier, FM modulator and noise voice, including future starts", () => {
  const context = audioContext(), sound = new SpaceAudio(context, () => 0.5);
  for (let i = 0; i < SOUND_VARIANTS; i++) sound.play("n", "charge", 0.7, true);
  sound.play("q", "dash"); sound.play("r", "death"); sound.playEvent("mate");
  assert.ok(context.scheduled.some((source) => source.started > 0.2));
  assert.equal(sound.activeVoices, context.scheduled.length);
  context.currentTime = 0.05;
  sound.cancel();
  assert.ok(context.scheduled.every((source) => source.stopped === 0.07500000000000001));
  context.scheduled.forEach((source) => source.onended());
  assert.equal(sound.activeVoices, 0);
  sound.dispose();
});
