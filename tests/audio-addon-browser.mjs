import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import { enterGame, openPanel, closePanel } from "./enter-game.mjs";

const vite = await createServer({
  server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/offline/**", "**/dist*/**"] } },
  plugins: [{
    name: "audio-addon-fixture",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== "/audio-addon-test") return next();
        res.setHeader("Content-Type", "text/html");
        res.end('<html><head><link rel="icon" href="data:,"></head><body>Audio DSP fixture</body></html>');
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
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/audio-addon-test`);
  const result = await page.evaluate(async () => {
    const [{ SpaceAudio, combatSoundRecipe }, { renderSoundRecipe, audioSeed }, { processEffectPCM, AUDIO_DSP_ADDON }] = await Promise.all([
      import("/src/sound.ts"), import("/src/audio-synthesis.ts"), import("/src/audio-processing.ts"),
    ]);
    function metrics(left, right = left, offset = 0) {
      let peak = 0, power = 0, finite = true;
      for (const channel of [left, right]) for (let i = offset; i < channel.length; i++) {
        const sample = channel[i]; finite &&= Number.isFinite(sample);
        peak = Math.max(peak, Math.abs(sample)); power += sample ** 2;
      }
      return { finite, peak, rms: Math.sqrt(power / Math.max(1, (left.length - offset) * 2)) };
    }
    function difference(a, b) {
      let delta = 0, reference = 0;
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        delta += (a[i] - b[i]) ** 2; reference += a[i] ** 2;
      }
      return Math.sqrt(delta / Math.max(1e-12, reference));
    }
    function amplitude(data, rate, frequency, count = data.length) {
      let real = 0, imaginary = 0;
      for (let i = 0; i < count; i++) {
        const angle = i * Math.PI * 2 * frequency / rate;
        real += data[i] * Math.cos(angle); imaginary += data[i] * Math.sin(angle);
      }
      return Math.hypot(real, imaginary) / count;
    }
    // Equal-level test tones make actual low-pass processing observable. A metadata
    // change, a copied buffer or an entirely bypassed addon fails this check.
    const rate = 24000, input = new Float32Array(rate / 2);
    for (let i = 0; i < input.length; i++) input[i] = [300, 900, 8000].reduce((sum, f) => sum + Math.sin(i * Math.PI * 2 * f / rate) * .012, 0);
    const before = input.slice(), pcm = { left: input, right: input.slice(), sampleRate: rate, duration: input.length / rate };
    const recipe = combatSoundRecipe("n", "void", "impact", 0);
    const dry = processEffectPCM(pcm, recipe, "dry", "combat:n:void:impact");
    const processed = processEffectPCM(pcm, recipe, "cinematic", "combat:n:void:impact");
    const sentinel = {
      dryIsOriginal: dry === pcm,
      unchangedInput: difference(before, input),
      difference: difference(input, processed.left),
      dryHighRatio: amplitude(input, rate, 8000) / amplitude(input, rate, 900),
      processedHighRatio: amplitude(processed.left, rate, 8000, input.length) / amplitude(processed.left, rate, 900, input.length),
      ...metrics(processed.left, processed.right),
    };
    const skins = ["classic", "ember", "frost", "astral", "royal", "storm", "void", "prism", "nova", "phantom", "dragon"];
    const families = [];
    for (const piece of ["p", "n", "b", "r", "q", "k"]) for (const skin of skins) {
      const recipe = combatSoundRecipe(piece, skin, "impact", 0);
      const key = `combat:${piece}:${skin}:impact:0:.3:false`, seed = audioSeed(key);
      const dry = renderSoundRecipe(recipe, 24000, seed, "dry", key);
      const cinematic = renderSoundRecipe(recipe, 24000, seed, "cinematic", key);
      const focused = renderSoundRecipe(recipe, 24000, seed, "focused", key);
      families.push({
        piece, skin, dry: metrics(dry.left, dry.right), cinematic: metrics(cinematic.left, cinematic.right), focused: metrics(focused.left, focused.right),
        difference: difference(dry.left, cinematic.left),
        focusedDuration: focused.duration, cinematicDuration: cinematic.duration,
      });
    }

    // Record the real AudioBuffers prepared by the bundled synthesis worker, then
    // compare every sample to the same main-thread recipe/seed/mode.
    const workerContext = new OfflineAudioContext(2, 44100 * 2, 44100), prepared = [];
    const createBuffer = workerContext.createBuffer.bind(workerContext);
    workerContext.createBuffer = (...args) => { const buffer = createBuffer(...args); prepared.push(buffer); return buffer; };
    const engine = new SpaceAudio(workerContext, () => .25);
    await engine.prepareCombat("n", "phantom");
    const warmed = engine.diagnostics;
    const cues = ["draw", "charge", "release", "clash", "counter", "finisher", "impact", "armor", "disintegrate"];
    const workerComparisons = prepared.map((buffer, i) => {
      const cue = cues[i], duration = cue === "charge" ? .55 : cue === "finisher" ? .35 : .3;
      const key = `combat:n:phantom:${cue}:1:${duration}:false`;
      const expected = renderSoundRecipe(combatSoundRecipe("n", "phantom", cue, 1, duration), 24000, audioSeed(key), "cinematic", key);
      return { cue, samples: buffer.length, expectedSamples: expected.left.length,
        difference: difference(expected.left, buffer.getChannelData(0)),
        rightDifference: difference(expected.right, buffer.getChannelData(1)) };
    });
    engine.auditionCombatCue("n", "phantom", "impact", 1);
    const afterCachedPlay = engine.diagnostics;
    engine.setProcessingMode("focused");
    await engine.prepareCombat("n", "phantom");
    const afterFocused = engine.diagnostics;
    engine.setProcessingMode("dry");
    await engine.prepareCombat("n", "phantom");
    const afterDry = engine.diagnostics;
    engine.setProcessingMode("cinematic");
    await engine.prepareCombat("n", "phantom");
    const afterReturn = engine.diagnostics;
    engine.dispose();
    const disposed = engine.diagnostics;

    // A switch during preparation must neither cache the old take under the new
    // mode nor start an obsolete effect. The new mode must prepare all nine cues.
    const queueContext = new OfflineAudioContext(2, 44100, 44100), queued = new SpaceAudio(queueContext, () => .25);
    const obsolete = queued.prepareCombat("q", "astral");
    queued.setProcessingMode("focused");
    await Promise.all([obsolete, queued.prepareCombat("q", "astral")]);
    const afterObsolete = queued.diagnostics;
    queued.dispose();

    // All added DSP echoes live inside the owning PCM source. Skip must cancel
    // those echoes too; it must not gate the independently playing music bed.
    const effectsContext = new OfflineAudioContext(2, 44100 * 1.8, 44100), effects = new SpaceAudio(effectsContext);
    effects.playCombatCue("q", "void", "impact");
    const effectsHold = effectsContext.suspend(.1), effectsRendering = effectsContext.startRendering();
    await effectsHold; effects.cancelEffects(); await effectsContext.resume();
    const effectsBuffer = await effectsRendering;
    const cancellation = { tail: metrics(effectsBuffer.getChannelData(0), effectsBuffer.getChannelData(1), Math.round(.35 * 44100)), voices: effects.activeVoices };
    effects.dispose();
    const musicContext = new OfflineAudioContext(2, 44100 * 2.2, 44100), music = new SpaceAudio(musicContext);
    music.setMusicState("normal"); await music.prepareMusic(["normal"]); await music.prepareCombat("n", "astral");
    music.playCombatCue("n", "astral", "impact");
    const musicHold = musicContext.suspend(.1), musicRendering = musicContext.startRendering();
    await musicHold; music.cancelEffects(); const musicAfterSkip = music.diagnostics; await musicContext.resume();
    const musicBuffer = await musicRendering;
    const musicTail = metrics(musicBuffer.getChannelData(0), musicBuffer.getChannelData(1), Math.round(.5 * 44100));
    music.dispose();
    return { addon: AUDIO_DSP_ADDON, sentinel, families, warmed, workerComparisons, afterCachedPlay,
      afterFocused, afterDry, afterReturn, disposed, afterObsolete, cancellation, musicAfterSkip, musicTail };
  });
  assert.deepEqual(result.addon, { name: "@thi.ng/dsp", version: "4.7.123", license: "Apache-2.0" });
  assert.equal(result.sentinel.dryIsOriginal, true);
  assert.equal(result.sentinel.unchangedInput, 0, "processing mutates its input PCM");
  assert.ok(result.sentinel.difference > .2, "addon processing was bypassed");
  assert.ok(result.sentinel.dryHighRatio > .9);
  assert.ok(result.sentinel.processedHighRatio < .15, "actual DSP low-pass response is absent");
  assert.equal(result.sentinel.finite, true); assert.ok(result.sentinel.peak < .61);
  assert.equal(result.families.length, 66);
  for (const family of result.families) {
    const key = `${family.piece}:${family.skin}`;
    assert.ok(family.difference > .1, `${key}: processed output is effectively dry`);
    assert.ok(family.focusedDuration < family.cinematicDuration, `${key}: focused room tail is not shorter`);
    for (const mode of ["dry", "cinematic", "focused"]) {
      assert.equal(family[mode].finite, true, `${key}:${mode}`);
      assert.ok(family[mode].peak < .61 && family[mode].rms > .00005, `${key}:${mode}: silent or clipping`);
    }
  }
  assert.equal(result.warmed.worker, true, "combat preparation did not use the bundled worker");
  assert.equal(result.warmed.cacheEntries, 9); assert.equal(result.warmed.voices, 0);
  assert.equal(result.workerComparisons.length, 9);
  for (const cue of result.workerComparisons) {
    assert.equal(cue.samples, cue.expectedSamples, `${cue.cue}: worker uses different processing`);
    assert.ok(cue.difference < 1e-6 && cue.rightDifference < 1e-6, `${cue.cue}: worker/main DSP samples disagree`);
  }
  assert.equal(result.afterCachedPlay.voices, 1, "one PCM source must own the entire processed cue");
  assert.equal(result.afterCachedPlay.cacheEntries, 9);
  assert.equal(result.afterFocused.processing, "focused"); assert.equal(result.afterFocused.cacheEntries, 18);
  assert.equal(result.afterDry.processing, "dry"); assert.equal(result.afterDry.cacheEntries, 27);
  assert.equal(result.afterReturn.processing, "cinematic"); assert.equal(result.afterReturn.cacheEntries, 27, "returning to a warmed mode needlessly regenerates takes");
  assert.equal(result.disposed.voices, 0); assert.equal(result.disposed.cacheBytes, 0);
  assert.equal(result.afterObsolete.processing, "focused");
  assert.equal(result.afterObsolete.cacheEntries, 9, "mode switch failed to prepare every new-mode cue or cached an obsolete take");
  assert.equal(result.afterObsolete.voices, 0, "obsolete preparation unexpectedly played an effect");
  assert.equal(result.cancellation.voices, 0);
  assert.ok(result.cancellation.tail.peak < .0001, "processed echo survives cancellation");
  assert.equal(result.musicAfterSkip.musicState, "normal"); assert.equal(result.musicAfterSkip.duckDb, 0);
  assert.ok(result.musicTail.finite && result.musicTail.rms > .0001 && result.musicTail.peak < .9, "skip silenced or corrupted the independent music bed");
  assert.deepEqual(errors, []);
  mkdirSync("test-results", { recursive: true });
  console.log("PASS: real addon spectral shaping, dry comparison, 66 class/skin families in three modes, shorter focused tails and finite PCM/headroom");
  console.log("PASS: bundled worker/main DSP samples agree; mode-specific caches, obsolete preparation, owned echo cancellation and continuous music");

  // Opt in only after rebuilding the single-file game. This also proves the
  // production inline worker has no external script/sample/impulse dependency.
  if (process.env.AUDIO_ADDON_OFFLINE_TEST === "1") {
    const context = await browser.newContext({ offline: true, viewport: { width: 1100, height: 800 } });
    const offline = await context.newPage(), requests = [], offlineErrors = [];
    offline.on("request", request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    offline.on("pageerror", error => offlineErrors.push(error.message));
    await offline.addInitScript(() => {
      localStorage.setItem("special-chess-graphics-quality", "low");
      localStorage.setItem("special-chess-reduced", "true");
      window.__audioContexts = 0; window.__audioWorkerPosts = 0; window.__audioWorkerResults = 0;
      const NativeAudio = window.AudioContext;
      window.AudioContext = class extends NativeAudio { constructor(...args) { super(...args); window.__audioContexts++; } };
      const NativeWorker = window.Worker;
      window.Worker = class extends NativeWorker {
        constructor(...args) {
          super(...args);
          this.addEventListener("message", event => {
            const pcm = event.data;
            if (pcm?.left instanceof Float32Array && pcm?.right instanceof Float32Array && pcm.left.length > 0
              && pcm.left.length === pcm.right.length && Number.isFinite(pcm.sampleRate) && pcm.sampleRate > 0
              && pcm.left.every(Number.isFinite) && pcm.right.every(Number.isFinite)) window.__audioWorkerResults++;
          });
        }
        postMessage(message, ...args) { if (message && Object.hasOwn(message, "processing")) window.__audioWorkerPosts++; return super.postMessage(message, ...args); }
      };
    });
    const memory = process.env.OFFLINE_TEST_TRANSPORT === "memory";
    const documentUrl = memory ? "http://localhost:31460/audio-offline-test" : pathToFileURL(resolve("offline/Special-Chess-Offline.html")).href;
    if (memory) {
      await offline.route(documentUrl, route => route.fulfill({ contentType: "text/html", body: readFileSync(resolve("offline/Special-Chess-Offline.html"), "utf8") }));
      console.log("Using in-memory delivery of the standalone HTML: file navigation is unverified in this environment.");
    }
    await offline.goto(documentUrl);
    await offline.locator("#title-screen").waitFor({ state: "visible" });
    assert.equal(await offline.evaluate(() => window.__audioContexts), 0, "opening the game started audio without a gesture");
    await enterGame(offline, "local"); await openPanel(offline, "settings");
    await offline.locator("#audio-processing").selectOption("focused");
    assert.match(await offline.locator("#audio-processing-help").innerText(), /ลดหางเสียง/);
    await offline.locator("#audio-music").evaluate(input => { input.value = "17"; input.dispatchEvent(new Event("input", { bubbles: true })); });
    await offline.locator("#sound").check();
    // The settings drawer pauses play; music starts when the match resumes.
    await closePanel(offline);
    await offline.waitForFunction(() => window.__audioWorkerPosts > 0 && window.__audioWorkerResults > 0);
    assert.equal(await offline.evaluate(() => window.__audioContexts), 1);
    const standalone = await offline.evaluate(() => ({ audioContexts: window.__audioContexts, workerPosts: window.__audioWorkerPosts, finitePCMReplies: window.__audioWorkerResults }));
    await openPanel(offline, "settings");
    await offline.locator("#audio-processing").selectOption("dry");
    assert.equal(await offline.evaluate(() => JSON.parse(localStorage.getItem("special-chess-audio-mix")).processing), "dry");
    await offline.reload(); await enterGame(offline, "local"); await openPanel(offline, "settings");
    assert.equal(await offline.locator("#audio-processing").inputValue(), "dry");
    assert.equal(await offline.locator("#audio-music").inputValue(), "17");
    assert.equal(await offline.evaluate(() => window.__audioContexts), 0, "reload automatically enabled audio");
    assert.deepEqual(requests.filter(url => !memory || url !== documentUrl), [], "offline game requested external audio assets");
    assert.deepEqual(offlineErrors, []);
    result.offline = { ...standalone, transport: memory ? "memory" : "file", persistedProcessing: "dry", persistedMusic: .17,
      contextsAfterReload: await offline.evaluate(() => window.__audioContexts), externalRequests: 0, browserErrors: offlineErrors };
    console.log("PASS: standalone HTML with network disabled prepares its inline audio worker, uses one gesture-created context, persists processing/buses and makes no external requests");
    await context.close();
  }
  writeFileSync("test-results/audio-addon-analysis.json", JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  await vite.close();
}
