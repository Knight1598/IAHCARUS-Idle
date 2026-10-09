import assert from "node:assert/strict";
import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";
import { enterMenu, enterGame } from "./enter-game.mjs";

const vite = await createServer({ server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/dist/**", "**/dist-offline/**", "**/dist-pages/**", "**/offline/Special-Chess-Offline.html"] } } });
let browser;
try {
  await vite.listen();
  browser = await chromium.launch({ ...(existsSync("/usr/bin/chromium") ? { executablePath: "/usr/bin/chromium" } : {}), args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(() => {
    window.audioContexts = 0;
    const Native = window.AudioContext;
    window.AudioContext = class extends Native { constructor(...args) { super(...args); window.audioContexts++; } };
  });
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}`);
  await enterMenu(page);
  assert.equal(await page.evaluate(() => audioContexts), 0, "title never starts audio automatically");
  // Keep the software renderer economical; real device performance is a separate check.
  await page.locator('[data-menu-go="settings"]').click();
  await page.locator("#graphics-quality").selectOption("low");
  await page.locator("#audio-music").evaluate(input => { input.value = "47"; input.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.locator("#capture-duration").selectOption("2600");
  await page.keyboard.press("Escape");
  await enterGame(page, "local");
  await page.locator("#pause-game").click(); await page.locator("#title-return").click();
  const saved = await page.evaluate(() => localStorage.getItem("special-chess-local"));
  const xp = await page.evaluate(() => localStorage.getItem("special-chess-profile"));
  await page.evaluate(async () => {
    const { SpaceAudio } = await import("/src/sound.ts");
    const { ChessScene } = await import("/src/scene.ts");
    const pause = ChessScene.prototype.setPaused;
    ChessScene.prototype.setPaused = function(...args) { window.lastScene = this; return pause.apply(this, args); };
    const play = SpaceAudio.prototype.playCombatCue;
    window.cues = [];
    SpaceAudio.prototype.playCombatCue = function(...args) {
      window.lastEngine = this;
      window.cues.push({ piece: args[0], skin: args[1], cue: args[2], time: performance.now() });
      return play.apply(this, args);
    };
    const volume = SpaceAudio.prototype.setBusVolume;
    SpaceAudio.prototype.setBusVolume = function(...args) { window.lastEngine = this; return volume.apply(this, args); };
    const state = SpaceAudio.prototype.setMusicState;
    SpaceAudio.prototype.setMusicState = function(...args) { window.lastEngine = this; return state.apply(this, args); };
  });
  await page.locator("#open-showcase").click();
  await page.locator("#showcase-preview canvas").waitFor();
  assert.equal(await page.evaluate(() => audioContexts), 0);
  assert.equal(await page.locator("#showcase-attacker-skin option").count(), 8);
  assert.equal(await page.locator("#showcase-defender-skin option").count(), 8);
  assert.equal(await page.locator("#showcase-arena option").count(), 8);
  await page.locator("#showcase-enable-sound").click();
  assert.equal(await page.evaluate(() => audioContexts), 1);
  const diagnostics = await page.evaluate(() => lastEngine.diagnostics);
  assert.equal(diagnostics.busLevels.music, .47);
  // Real visibility handler must freeze a menu preview despite its normal pause exemption.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
    if (!lastScene.presentationPaused || !lastEngine.diagnostics.paused) throw Error("Hidden showcase did not freeze scene/audio");
    delete document.hidden; document.dispatchEvent(new Event("visibilitychange"));
    if (lastScene.presentationPaused || lastEngine.diagnostics.paused) throw Error("Showcase did not resume on tab return");
  });
  await page.evaluate(() => { window.cues = []; });
  await page.locator("#showcase-play").click();
  await page.waitForFunction(() => window.cues.length >= 5);
  mkdirSync("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/combat-v2-desktop.png" });
  await page.waitForFunction(() => !document.querySelector("#showcase-play").disabled);
  const sequence = await page.evaluate(() => window.cues);
  assert.deepEqual(sequence.map(c => c.cue), ["draw", "charge", "release", "clash", "counter", "finisher", "impact", "armor", "disintegrate"]);
  assert.deepEqual(sequence.filter(c => ["clash", "counter", "armor", "disintegrate"].includes(c.cue)).map(c => [c.piece,c.skin]), Array(4).fill(["r", "frost"]));
  assert.ok(sequence.find(c => c.cue === "impact").time > sequence.find(c => c.cue === "counter").time);
  // Exercise every class/skin resolution and immediate repeated Skip without committing a move.
  for (const piece of ["p", "n", "b", "r", "q", "k"]) for (const skin of ["classic", "ember", "frost", "astral", "royal", "storm", "void", "prism"]) {
    await page.locator(`[data-showcase-role="attacker"][data-showcase-piece="${piece}"]`).click();
    await page.locator("#showcase-attacker-skin").selectOption(skin);
    await page.locator("#showcase-play").click();
    await page.locator("#showcase-stop").click();
    await page.evaluate(() => { document.querySelector("#showcase-stop").click(); document.querySelector("#showcase-stop").click(); });
    assert.equal(await page.locator("#showcase-play").isEnabled(), true);
  }
  // Portrait and landscape keep the stage and immediate skip on screen.
  for (const viewport of [{ width: 430, height: 932 }, { width: 932, height: 430 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    const bounds = await page.locator("#showcase-preview").boundingBox();
    assert.ok(bounds && bounds.width > 100 && bounds.height > 100);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight + 1), false);
    const playBounds = await page.locator("#showcase-play").boundingBox();
    assert.ok(playBounds && playBounds.y >= 0 && playBounds.y + playBounds.height <= viewport.height);
    await page.screenshot({ path: `test-results/combat-v2-${viewport.width}.png` });
  }
  await page.setViewportSize({ width: 1100, height: 850 });
  await page.locator('[data-showcase-tab="audio"]').click();
  await page.locator("#showcase-cue").selectOption("impact");
  await page.locator("#showcase-listen-a").click(); await page.locator("#showcase-listen-b").click();
  for (const state of ["menu", "normal", "threat", "check", "capture", "ultimate", "mate", "victory", "defeat"]) {
    await page.locator("#showcase-music").selectOption(state); await page.locator("#showcase-listen-music").click();
  }
  await page.locator("#showcase-close").click();
  assert.equal(await page.locator("#title-screen").isVisible(), true);
  assert.equal(await page.evaluate(() => localStorage.getItem("special-chess-local")), saved);
  assert.equal(await page.evaluate(() => localStorage.getItem("special-chess-profile")), xp);
  assert.equal(await page.evaluate(() => audioContexts), 1);
  // Returning to the title from a paused battle restores menu music and ungates beds.
  await enterGame(page);
  await page.locator("#pause-game").click();
  assert.equal(await page.evaluate(() => lastEngine.diagnostics.paused), true);
  await page.locator("#title-return").click();
  assert.equal(await page.evaluate(() => lastEngine.diagnostics.musicState), "menu");
  assert.equal(await page.evaluate(() => lastEngine.diagnostics.paused), false);
  await page.locator('[data-menu-go="settings"]').click();
  await page.locator("#audio-mute").check();
  assert.equal(await page.evaluate(() => lastEngine.diagnostics.muted), true);
  await page.reload(); await enterMenu(page); await page.locator('[data-menu-go="settings"]').click();
  assert.equal(await page.locator("#audio-mute").isChecked(), true);
  assert.equal(await page.locator("#audio-music").inputValue(), "47");
  assert.equal(await page.evaluate(() => audioContexts), 0, "reload requires a new explicit sound gesture");
  assert.deepEqual(errors, []);
  writeFileSync("test-results/showcase-v2.json", JSON.stringify({ sequence, diagnostics, classes: 6, skins: 8, realDevice: false }, null, 2));
  console.log("Showcase passed: 48 class/skin pairs, reactive synchronized cues, repeated Skip, viewport bounds, A/B, saved mix, one opt-in context, unchanged match and XP.");
} finally { await browser?.close(); await vite.close(); }
