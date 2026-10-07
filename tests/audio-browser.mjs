import assert from "node:assert/strict";
import { existsSync } from "node:fs";
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
      const context = new OfflineAudioContext(2, 44100 * 1.8, 44100);
      const sound = new SpaceAudio(context, () => variant / SOUND_VARIANTS);
      const selected = sound.play(piece, phase, 0.65, true, 0.3);
      const buffer = await context.startRendering();
      results.push({ key: `${piece}:${phase}`, variant, selected, ...metrics(buffer), voices: sound.activeVoices });
      sound.dispose();
    }
    for (const event of events) for (let variant = 0; variant < SOUND_VARIANTS; variant++) {
      const context = new OfflineAudioContext(2, 44100 * 1.8, 44100);
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
    // Variant 1 has future FM carrier/modulator pairs; queen/event layers also start later.
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
    return { results, mixes, cancellation };
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
  assert.ok(audio.cancellation.voicesBeforeCancel > 10);
  assert.equal(audio.cancellation.voices, 0);
  assert.ok(audio.cancellation.tail < 0.0001, `Canceled FM/scheduled audio remains audible (${audio.cancellation.tail})`);
  assert.deepEqual(errors, []);
  console.log(`PASS: ${audio.results.length} rendered variations (144 piece / 88 event), four distinct waveforms per action, cleanup and full-volume combat mix headroom`);
  console.log(`PASS: cancel stops future FM/stereo/event layers; silent tail ${audio.cancellation.tail.toExponential(2)}`);
  console.log(`Audio peaks: individual ${Math.max(...audio.results.map(({ peak }) => peak)).toFixed(3)}, combined at full volume ${Math.max(...audio.mixes.map(({ peak }) => peak)).toFixed(3)}`);
} finally {
  await browser?.close();
  await vite.close();
}
