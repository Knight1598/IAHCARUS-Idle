import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { createServer } from "vite";

// Rendering audio offline is fast and reproducible; this fixture never loads the game.
const vite = await createServer({
  server: { host: "127.0.0.1", port: 0 },
  plugins: [{
    name: "audio-test-page",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== "/audio-test") return next();
        res.setHeader("Content-Type", "text/html");
        res.end("<html><body>Procedural sound library fixture</body></html>");
      });
    },
  }],
});
let browser;
try {
  await vite.listen();
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH || existsSync("/usr/bin/chromium")
      ? { executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" } : {}),
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/audio-test`);
  const audio = await page.evaluate(async () => {
    const { SpaceAudio, SOUND_VARIANTS } = await import("/src/sound.ts");
    const pieces = ["p", "n", "b", "r", "q", "k"];
    const phases = ["lock", "charge", "dash", "impact", "death", "check"];
    const events = ["check", "fork", "mate", "double-check", "discovered-check", "promotion", "rescue", "escape", "block", "castle", "en-passant", "first-blood", "recapture", "queen-fallen", "comeback", "capture-streak", "endgame", "mission", "intro", "victory", "defeat", "ui"];
    const results = [];
    function metrics(buffer) {
      let peak = 0, energy = 0, fingerprint = 0, finite = true;
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < data.length; i++) {
          finite &&= Number.isFinite(data[i]);
          peak = Math.max(peak, Math.abs(data[i])); energy += data[i] ** 2;
          if (i % 23 === 0) fingerprint += data[i] * Math.sin(i * 0.13 + channel * 0.71);
        }
      }
      return { peak, rms: Math.sqrt(energy / (buffer.length * buffer.numberOfChannels)), fingerprint, finite };
    }
    // A constant RNG v/4 places v at the end of the first Fisher-Yates bag.
    for (const piece of pieces) for (const phase of phases) for (let variant = 0; variant < SOUND_VARIANTS; variant++) {
      const context = new OfflineAudioContext(2, 44100 * 2.6, 44100);
      const sound = new SpaceAudio(context, () => variant / SOUND_VARIANTS);
      const selected = sound.play(piece, phase, 0.65, true, 0.3);
      const buffer = await context.startRendering();
      results.push({ key: `${piece}:${phase}`, variant, selected, ...metrics(buffer), voices: sound.activeVoices });
      sound.dispose();
    }
    for (const event of events) for (let variant = 0; variant < SOUND_VARIANTS; variant++) {
      const context = new OfflineAudioContext(2, 44100 * 2.6, 44100);
      const sound = new SpaceAudio(context, () => variant / SOUND_VARIANTS);
      const selected = sound.playEvent(event, -0.3);
      const buffer = await context.startRendering();
      results.push({ key: `event:${event}`, variant, selected, ...metrics(buffer), voices: sound.activeVoices });
      sound.dispose();
    }
    const mixes = [];
    for (let variant = 0; variant < SOUND_VARIANTS; variant++) {
      const context = new OfflineAudioContext(2, 44100 * 2, 44100);
      const sound = new SpaceAudio(context, () => variant / SOUND_VARIANTS);
      sound.setVolume(1);
      sound.play("r", "impact", 0.4, true, -0.4);
      sound.play("n", "death", 0.4, true, 0.4);
      sound.play("k", "check", 0.4, true);
      sound.playEvent("double-check");
      sound.playEvent("queen-fallen");
      const buffer = await context.startRendering();
      mixes.push({ variant, ...metrics(buffer), voices: sound.activeVoices });
      sound.dispose();
    }
    // Delayed attacks and room reflections live inside each cancellable PCM voice.
    const context = new OfflineAudioContext(2, 44100 * 1.4, 44100);
    const sound = new SpaceAudio(context, () => 0.25);
    sound.play("n", "charge", 1.1, true); sound.play("q", "dash"); sound.playEvent("mate");
    const suspended = context.suspend(0.05), rendered = context.startRendering();
    await suspended;
    const voicesBeforeCancel = sound.activeVoices;
    sound.cancel(); await context.resume();
    const buffer = await rendered;
    let canceledTail = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 44100 * 0.4; i < data.length; i++) canceledTail = Math.max(canceledTail, Math.abs(data[i]));
    }
    const cancellation = { voicesBeforeCancel, voices: sound.activeVoices, tail: canceledTail };
    sound.dispose();
    const { combatSoundRecipe } = await import("/src/sound.ts");
    const { renderSoundRecipe, renderAmbience } = await import("/src/audio-synthesis.ts");
    const { renderMusic } = await import("/src/audio-music.ts");
    const pcmBuffer = pcm => ({ numberOfChannels: 2, length: pcm.left.length, getChannelData: channel => channel ? pcm.right : pcm.left });
    function spectrum(data, rate, offset = 0) {
      const count = Math.min(4096, data.length - offset), powers = {};
      for (const frequency of [36.7, 73.416, 110, 146.83, 155.56, 220, 440, 880, 1760]) {
        let real = 0, imaginary = 0;
        for (let i = 0; i < count; i++) {
          const window = .5 - .5 * Math.cos(2 * Math.PI * i / (count - 1));
          const phase = 2 * Math.PI * frequency * i / rate;
          real += data[offset + i] * window * Math.cos(phase); imaginary -= data[offset + i] * window * Math.sin(phase);
        }
        powers[frequency] = (real * real + imaginary * imaginary) / (count * count);
      }
      return powers;
    }
    const combat = [], synthesisStart = performance.now();
    for (const piece of pieces) for (const skin of ["classic", "ember", "frost", "astral", "royal"])
      for (const cue of ["draw", "charge", "release", "clash", "counter", "finisher", "impact", "armor", "disintegrate"])
        for (let variant = 0; variant < SOUND_VARIANTS; variant++) {
          const pcm = renderSoundRecipe(combatSoundRecipe(piece, skin, cue, variant, .3), 24000, 613 + variant);
          combat.push({ piece, skin, cue, variant, duration: pcm.duration, ...metrics(pcmBuffer(pcm)) });
        }
    const music = [];
    for (const state of ["menu", "normal", "threat", "check", "capture", "ultimate", "mate", "victory", "defeat"]) {
      const pcm = renderMusic(state, 417);
      let first = 0, middle = 0, end = 0;
      for (let i = 0; i < pcm.left.length; i++) {
        const power = pcm.left[i] ** 2;
        if (i < 1200) first += power;
        if (i >= pcm.left.length / 2 && i < pcm.left.length / 2 + 1200) middle += power;
        if (i > pcm.left.length - 1200) end += power;
      }
      music.push({ state, duration: pcm.duration, ...metrics(pcmBuffer(pcm)), envelope: { first, middle, end }, spectrum: spectrum(pcm.left, 12000, 12000 * 1.5) });
    }
    const ambience = [];
    for (const preset of ["citadel", "ember", "frost", "astral", "storm", "grove", "reactor", "eclipse"]) {
      const pcm = renderAmbience(417, 12000, 31.7, preset);
      ambience.push({ preset, duration: pcm.duration, ...metrics(pcmBuffer(pcm)), spectrum: spectrum(pcm.left, 12000, 24000) });
    }
    // Real OfflineAudioContext verifies worker preparation, independent buses,
    // soundtrack ducking, and whole-sequence cancellation with music still playing.
    const mixedContext = new OfflineAudioContext(2, 44100 * 2.7, 44100);
    const engine = new SpaceAudio(mixedContext, () => .25);
    engine.setVolume(1); engine.setMusicState("normal");
    await engine.prepareMusic(["normal"]); await engine.prepareCombat("n", "astral");
    engine.play("p", "dash"); engine.playCombatCue("n", "astral", "impact");
    const ducked = engine.diagnostics;
    const hold = mixedContext.suspend(.1), mixRendering = mixedContext.startRendering();
    await hold; engine.cancelEffects();
    const afterSkip = engine.diagnostics;
    await mixedContext.resume(); const mixedBuffer = await mixRendering;
    const mixedMetrics = metrics(mixedBuffer);
    engine.dispose(); const disposed = engine.diagnostics;
    const silentContext = new OfflineAudioContext(2, 44100 * 1.5, 44100), muted = new SpaceAudio(silentContext);
    for (const bus of ["music", "ambience", "sfx", "cinematic"]) muted.setBusVolume(bus, 0);
    muted.setMusicState("normal"); await muted.prepareMusic(["normal"]);
    muted.play("r", "impact", .4, true); muted.playCombatCue("k", "royal", "impact");
    const silentBuffer = await silentContext.startRendering(); const silentMetrics = metrics(silentBuffer); muted.dispose();
    return { results, mixes, cancellation, combat, music, ambience, synthesisMs: performance.now() - synthesisStart,
      soundtrack: { ducked, afterSkip, disposed, mixedMetrics, silentMetrics } };
  });
  assert.equal(audio.results.length, 144 + 88);
  for (const result of audio.results) {
    const label = `${result.key} variant ${result.variant}`;
    assert.equal(result.selected, result.variant, label);
    assert.equal(result.finite, true, label);
    assert.ok(result.rms > 0.00005, `${label} is silent (${result.rms})`);
    assert.ok(result.peak < 0.9, `${label} clips (${result.peak})`);
    assert.equal(result.voices, 0, `${label} retains voices`);
  }
  for (const key of new Set(audio.results.map(({ key }) => key))) {
    const group = audio.results.filter((result) => result.key === key);
    assert.equal(new Set(group.map(({ fingerprint }) => fingerprint.toFixed(8))).size, 4, `${key} variants render the same waveform`);
  }
  for (const mix of audio.mixes) {
    assert.equal(mix.finite, true);
    assert.ok(mix.rms > 0.001);
    assert.ok(mix.peak < 0.9, `Combined combat/events clip at full volume (${mix.peak})`);
    assert.equal(mix.voices, 0);
  }
  assert.equal(audio.cancellation.voicesBeforeCancel, 3, "three layered cues own exactly three PCM sources");
  assert.equal(audio.cancellation.voices, 0);
  assert.ok(audio.cancellation.tail < 0.0001, `Canceled PCM/reflections remain audible (${audio.cancellation.tail})`);
  assert.equal(audio.combat.length, 1080);
  for (const cue of audio.combat) {
    assert.equal(cue.finite, true); assert.ok(cue.peak < .9 && cue.rms > .00005, JSON.stringify(cue));
    assert.ok(cue.duration > .1 && cue.duration < 2.6);
  }
  for (const piece of ["p", "n", "b", "r", "q", "k"]) for (const cue of ["draw", "charge", "release", "clash", "counter", "finisher", "impact", "armor", "disintegrate"]) {
    const group = audio.combat.filter(result => result.piece === piece && result.cue === cue);
    assert.equal(new Set(group.map(result => result.fingerprint.toFixed(8))).size, 20, `${piece}:${cue}: skins/takes must differ`);
  }
  for (const music of audio.music) {
    assert.equal(music.finite, true); assert.ok(music.rms > .002 && music.peak < .3);
    assert.ok(music.duration > (music.state === "mate" || music.state === "victory" || music.state === "defeat" ? 3 : 50));
    assert.ok(music.envelope.middle > music.envelope.first && music.envelope.middle > music.envelope.end);
    assert.ok(music.spectrum["73.416"] + music.spectrum["110"] > 1e-6, `${music.state} lacks D/A body`);
  }
  assert.equal(new Set(audio.music.filter(item => !["capture", "check"].includes(item.state)).map(item => item.fingerprint.toFixed(8))).size, 7);
  assert.equal(new Set(audio.ambience.map(item => item.fingerprint.toFixed(8))).size, 8);
  const { soundtrack } = audio;
  assert.equal(soundtrack.ducked.worker, true, "long music and anticipation preparation run in worker");
  assert.ok(soundtrack.ducked.duckDb >= 3 && soundtrack.ducked.duckDb <= 6);
  assert.equal(soundtrack.afterSkip.duckDb, 0);
  assert.equal(soundtrack.afterSkip.musicState, "normal");
  assert.ok(soundtrack.mixedMetrics.rms > .001 && soundtrack.mixedMetrics.peak < .9);
  assert.ok(soundtrack.silentMetrics.peak < 1e-8, "all four bus sliders silence their sources");
  assert.equal(soundtrack.disposed.voices, 0); assert.equal(soundtrack.disposed.cacheBytes, 0);
  assert.deepEqual(errors, []);
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/audio-v2-analysis.json", JSON.stringify(audio, null, 2));
  console.log(`PASS: ${audio.results.length} rendered variations (144 piece / 88 event), four distinct waveforms per action, cleanup and full-volume combat mix headroom`);
  console.log(`PASS: cancel stops PCM/stereo/event tails; silent tail ${audio.cancellation.tail.toExponential(2)}`);
  console.log(`PASS: 1080 combat takes (30 class/skin profiles), nine modal music states, eight arena beds, worker preparation, duck/restoration, independent bus silence and disposal`);
  console.log(`Audio peaks: individual ${Math.max(...audio.results.map(({ peak }) => peak)).toFixed(3)}, combined at full volume ${Math.max(...audio.mixes.map(({ peak }) => peak)).toFixed(3)}`);
} finally {
  await browser?.close();
  await vite.close();
}
