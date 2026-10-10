import test from "node:test";
import assert from "node:assert/strict";
import { SoundVariantBag, SOUND_VARIANTS, pieceSoundRecipe, eventSoundRecipe, combatSoundRecipe, SpaceAudio, AUDIO_VOICE_LIMIT, AUDIO_CACHE_LIMIT } from "../src/sound.ts";

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

// PCM source scheduling is observable without a browser. Internal delayed layers and room
// reflections must stop together when the owning visual sequence is canceled.
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
    createBuffer: (channels, length, sampleRate) => {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { length, numberOfChannels: channels, sampleRate, duration: length / sampleRate, getChannelData: (channel) => data[channel] };
    },
    createOscillator: source, createBufferSource: source,
  });
  return context;
}

test("cancel stops every PCM voice including its delayed layer and reverberation content", () => {
  const context = audioContext(), sound = new SpaceAudio(context, () => 0.5);
  for (let i = 0; i < SOUND_VARIANTS; i++) sound.play("n", "charge", 0.7, true);
  sound.play("q", "dash"); sound.play("r", "death"); sound.playEvent("mate");
  assert.equal(context.scheduled.length, 7, "one voice owns all layered sound content per cue");
  assert.ok(context.scheduled.some((source) => source.buffer.duration > .8));
  assert.equal(sound.activeVoices, context.scheduled.length);
  context.currentTime = 0.05;
  sound.cancel();
  assert.ok(context.scheduled.every((source) => source.stopped === 0.07500000000000001));
  context.scheduled.forEach((source) => source.onended());
  assert.equal(sound.activeVoices, 0);
  sound.dispose();
});


test("skin combat signatures change material and rhythm for all forty-eight class/skin combinations", () => {
  const signatures = new Set();
  for (const piece of pieces) for (const skin of ["classic", "ember", "frost", "astral", "royal", "storm", "void", "prism"]) {
    const recipe = combatSoundRecipe(piece, skin, "impact", 0);
    assert.ok(recipe.every((layer) => layer.kind !== "tone" || layer.wave === "sine"));
    signatures.add(JSON.stringify(recipe));
  }
  assert.equal(signatures.size, 48);
});

test("effect cancellation preserves music buses, mute and volume remain independent", () => {
  const context = audioContext(), sound = new SpaceAudio(context);
  sound.setBusVolume("music", .2); sound.setBusVolume("cinematic", .8); sound.setVolume(.6);
  sound.play("p", "dash"); sound.playCombatCue("n", "astral", "release");
  sound.cancelEffects();
  assert.ok(context.scheduled.every((source) => source.stopped === .025));
  assert.equal(sound.diagnostics.busLevels.music, .2); assert.equal(sound.diagnostics.busLevels.cinematic, .8);
  assert.equal(sound.diagnostics.busLevels.master, .6);
  sound.setMuted(true); const before = context.scheduled.length; sound.playEvent("mate");
  assert.equal(context.scheduled.length, before);
  sound.setMuted(false); sound.setPaused(true); sound.playCombatCue("r", "royal", "impact");
  assert.equal(context.scheduled.length, before);
  sound.dispose(); assert.equal(sound.activeVoices, 0); assert.equal(sound.diagnostics.cacheBytes, 0);
});

test("PCM cache and source graph remain bounded under repeated attacks", () => {
  const context = audioContext(), sound = new SpaceAudio(context);
  for (let i = 0; i < 100; i++) sound.playCombatCue("p", "classic", "impact");
  assert.ok(sound.activeVoices <= AUDIO_VOICE_LIMIT);
  assert.ok(sound.diagnostics.cacheBytes <= AUDIO_CACHE_LIMIT);
  assert.equal(sound.diagnostics.cacheEntries, 4, "takes reuse their PCM buffers");
  sound.dispose(); assert.equal(sound.activeVoices, 0);
});


test("a cold frame racing worker preparation keeps one cache entry per take", async () => {
  const context = audioContext(), sound = new SpaceAudio(context, () => .25);
  const warming = sound.prepareCombat("n", "astral");
  sound.playCombatCue("n", "astral", "impact");
  await warming;
  assert.equal(sound.diagnostics.cacheEntries, 9);
  assert.equal(sound.diagnostics.cacheBytes, sound.diagnostics.residentBytes, "in-flight preparation must not count or retain a duplicate buffer");
  sound.dispose();
});


test("rapid preview cancellation resolves obsolete preparation and never starts effects", async () => {
  const context = audioContext(), sound = new SpaceAudio(context);
  const requests = [];
  for (const skin of ["classic", "ember", "frost", "astral", "royal", "storm", "void", "prism"]) {
    requests.push(sound.prepareCombat("q", skin)); sound.cancelEffects();
  }
  await Promise.all(requests);
  assert.equal(sound.activeVoices, 0);
  assert.ok(sound.diagnostics.cacheEntries <= 1, "only the active worker job may finish after cancellation");
  sound.dispose();
});

test('new skin combat cues produce finite, audible PCM with bounded levels and distinct takes', async () => {
  const { renderSoundRecipe } = await import('../src/audio-synthesis.ts');
  for (const skin of ['storm','void','prism','nova','phantom','dragon']) for (const piece of pieces) {
    const fingerprints=new Set();
    for (const cue of ['charge','release','clash','impact','disintegrate']) for (let take=0;take<SOUND_VARIANTS;take++) {
      const pcm=renderSoundRecipe(combatSoundRecipe(piece,skin,cue,take),12000,417+take);
      let peak=0,energy=0;
      for(const channel of [pcm.left,pcm.right])for(const value of channel){assert.ok(Number.isFinite(value));peak=Math.max(peak,Math.abs(value));energy+=value*value;}
      assert.ok(peak>.001 && peak<.75,`${skin}:${piece}:${cue} silent/clipping`);
      if(cue==='impact')fingerprints.add(energy.toFixed(5));
    }
    assert.equal(fingerprints.size,SOUND_VARIANTS,`${skin}:${piece} repeats identical takes`);
  }
});

test('new skins change actual instruments and rhythms beyond pitch, with four takes and class accents',()=>{
 for(const skin of ['nova','phantom','dragon'])for(const piece of pieces)for(const cue of ['charge','release','impact','disintegrate']){
  const recipes=Array.from({length:4},(_,v)=>combatSoundRecipe(piece,skin,cue,v));
  assert.equal(new Set(recipes.map(structure)).size,4,`${skin}:${piece}:${cue}`);
  assert.ok(recipes.every(r=>r.length<=8&&r.every(l=>Number.isFinite(l.level)&&l.level<=.24)));
 }
 const signatures=['nova','phantom','dragon'].map(skin=>structure(combatSoundRecipe('n',skin,'impact',0)));
 assert.equal(new Set(signatures).size,3);
});
test('modern interface feedback stays short and dry; portal transitions have a separate room',()=>{
 for(const event of ['ui-select','ui-confirm','ui-error','purchase','ready','portal-enter','portal-exit']){
  const recipes=Array.from({length:4},(_,v)=>eventSoundRecipe(event,v));assert.equal(new Set(recipes.map(structure)).size,4,event);
  for(const recipe of recipes)assert.ok(recipe.every(l=>l.room<=.5&&l.duration+l.offset<1));
 }
 assert.ok(eventSoundRecipe('ui-select',0).every(l=>l.room<.05));
 assert.ok(eventSoundRecipe('portal-enter',0).some(l=>l.texture==='void'));
});
test('low priority feedback cannot steal important danger voices when the voice budget is full',()=>{
 const context=audioContext(),sound=new SpaceAudio(context);
 for(let i=0;i<AUDIO_VOICE_LIMIT;i++)sound.playEvent('check');
 assert.equal(sound.activeVoices,AUDIO_VOICE_LIMIT);const prior=context.scheduled.length;
 sound.playEvent('ui');assert.equal(context.scheduled.length,prior);
 const stops=context.scheduled.map(v=>v.stopped);sound.anticipateImpact();assert.deepEqual(context.scheduled.map(v=>v.stopped),stops,'king warnings should survive the combat hush');
 sound.dispose();
});

test('quiet ordinary landings stay below full capture impacts across every skin after scoring and DSP',()=>{
 const rms=buffer=>{let power=0;for(let c=0;c<2;c++)for(const sample of buffer.getChannelData(c))power+=sample*sample;return Math.sqrt(power/(buffer.length*2));};
 for(const skin of ['classic','ember','frost','astral','royal','storm','void','prism','nova','phantom','dragon']){
  const quietContext=audioContext(),fullContext=audioContext(),quiet=new SpaceAudio(quietContext,()=>.25),full=new SpaceAudio(fullContext,()=>.25);
  quiet.play('n','impact',.3,false,0,skin);full.play('n','impact',.3,true,0,skin);
  const ratio=rms(quietContext.scheduled[0].buffer)/rms(fullContext.scheduled[0].buffer);
  assert.ok(ratio>.12&&ratio<.6,`${skin} landing/capture RMS ${ratio}`);quiet.dispose();full.dispose();
 }
});

test('processing switch keeps independent buffers and recovers the same cached original take',()=>{
 const context=audioContext(),sound=new SpaceAudio(context,()=>.25);
 sound.setProcessingMode('dry');sound.auditionCombatCue('n','frost','impact',0);const original=context.scheduled.at(-1).buffer;
 sound.setProcessingMode('cinematic');sound.auditionCombatCue('n','frost','impact',0);const cinematic=context.scheduled.at(-1).buffer;
 assert.notEqual(original,cinematic);assert.notEqual(original.length,cinematic.length);
 sound.setProcessingMode('dry');sound.auditionCombatCue('n','frost','impact',0);assert.equal(context.scheduled.at(-1).buffer,original);assert.equal(sound.diagnostics.addon.name,'@thi.ng/dsp');sound.dispose();
});
