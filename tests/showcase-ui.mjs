import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";

// Exercise controls from current source without constructing a renderer or AudioContext.
const bundle = await build({
  stdin: { contents: `
    import "./src/style.css";
    import "./src/design.css";
    import { CombatShowcase } from "./src/showcase.ts";
    let enabled = false;
    window.calls = [];
    const record = (kind, value) => window.calls.push({ kind, value });
    const showcase = new CombatShowcase(document.body, {
      play: settings => { record("play", settings); showcase.setPlaying(true); },
      stop: () => record("stop"), close: () => record("close"),
      sound: settings => record("sound", settings), music: state => record("music", state),
      event: event => record("event", event), enableSound: () => { enabled = true; record("enable"); },
      soundEnabled: () => enabled,
    });
    window.showcase = showcase;
    showcase.show();
  `, resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", write: false, outfile: "/tmp/iah-showcase-ui.js", logLevel: "silent",
});
const js = bundle.outputFiles.find(file => file.path.endsWith(".js")).text;
const css = bundle.outputFiles.find(file => file.path.endsWith(".css")).text;
const html = `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><script>${js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH || existsSync("/usr/bin/chromium") ? { executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" } : {}),
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({ offline: true, viewport: { width: 1200, height: 850 } });
  const page = await context.newPage(), errors = [], requests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => requests.push(request.url()));
  const url = "http://localhost:31764/showcase-ui";
  await page.route(url, route => route.fulfill({ body: html, contentType: "text/html" }));
  await page.goto(url);
  await page.locator("#combat-showcase").waitFor();
  assert.deepEqual(await page.evaluate(() => calls), [], "showing the showcase neither plays nor enables audio");
  assert.equal(await page.locator("canvas").count(), 0, "control harness creates no renderer");
  assert.equal(await page.locator("#showcase-arena option").count(), 8);
  assert.equal(await page.locator("#showcase-attacker-skin option").count(), 8);
  assert.equal(await page.locator("#showcase-defender-skin option").count(), 8);
  assert.equal(await page.locator('[data-showcase-role="attacker"]').count(), 6);
  assert.equal(await page.locator('[data-showcase-role="defender"]').count(), 6);
  assert.equal(await page.locator("#showcase-stop").isDisabled(), true);
  const pieces = ["p", "n", "b", "r", "q", "k"], skins = ["classic", "ember", "frost", "astral", "royal", "storm", "void", "prism"];
  for (const piece of pieces) {
    await page.locator(`[data-showcase-role="attacker"][data-showcase-piece="${piece}"]`).click();
    for (const skin of skins) {
      await page.locator("#showcase-attacker-skin").selectOption(skin);
      await page.locator("#showcase-play").click();
      const settings = await page.evaluate(() => calls.filter(call => call.kind === "play").at(-1).value);
      assert.equal(settings.attacker, piece); assert.equal(settings.attackerSkin, skin);
      assert.equal(await page.locator("#showcase-play").isDisabled(), true);
      assert.equal(await page.locator("#showcase-attacker-skin").isDisabled(), true);
      assert.equal(await page.locator("#showcase-stop").isDisabled(), false);
      await page.locator("#showcase-stop").click();
      assert.equal(await page.locator("#showcase-play").isDisabled(), false);
    }
  }
  await page.locator('[data-showcase-role="defender"][data-showcase-piece="b"]').click();
  await page.locator("#showcase-defender-skin").selectOption("frost");
  await page.locator("#showcase-arena").selectOption("eclipse");
  await page.locator("#showcase-swap").click();
  assert.deepEqual(await page.evaluate(() => showcase.selection), { attacker: "b", defender: "k", attackerSkin: "frost", defenderSkin: "royal", arena: "eclipse" });
  await page.locator("#showcase-play").click();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#combat-showcase").isVisible(), true, "first Escape skips a running scene");
  assert.equal(await page.locator("#showcase-play").isDisabled(), false);
  await page.locator('[data-showcase-tab="audio"]').click();
  assert.equal(await page.locator("#showcase-listen-a").isDisabled(), true);
  assert.equal(await page.locator("#showcase-listen-music").isDisabled(), true);
  assert.equal(await page.locator("#showcase-cue option").count(), 14);
  assert.equal(await page.locator("#showcase-music option").count(), 9);
  assert.equal(await page.locator("#showcase-event option").count(), 22);
  await page.locator("#showcase-enable-sound").click();
  assert.equal(await page.locator("#showcase-listen-a").isDisabled(), false);
  await page.locator('[data-audio-piece="q"]').click();
  await page.locator("#showcase-cue").selectOption("clash");
  await page.locator("#showcase-skin-a").selectOption("ember");
  await page.locator("#showcase-skin-b").selectOption("astral");
  await page.locator("#showcase-listen-a").click(); await page.locator("#showcase-listen-b").click();
  assert.deepEqual(await page.evaluate(() => calls.filter(call => call.kind === "sound").map(call => call.value)), [
    { piece: "q", skin: "ember", cue: "clash", comparison: "A" }, { piece: "q", skin: "astral", cue: "clash", comparison: "B" },
  ]);
  const states = await page.locator("#showcase-music option").evaluateAll(options => options.map(option => option.value));
  for (const state of states) { await page.locator("#showcase-music").selectOption(state); await page.locator("#showcase-listen-music").click(); }
  assert.deepEqual(await page.evaluate(() => calls.filter(call => call.kind === "music").map(call => call.value)), states);
  const events = await page.locator("#showcase-event option").evaluateAll(options => options.map(option => option.value));
  for (const event of events) { await page.locator("#showcase-event").selectOption(event); await page.locator("#showcase-listen-event").click(); }
  assert.deepEqual(await page.evaluate(() => calls.filter(call => call.kind === "event").map(call => call.value)), events);
  mkdirSync("test-results", { recursive: true });
  for (const panel of ["combat", "audio"]) {
    await page.locator(`[data-showcase-tab="${panel}"]`).click();
    for (const viewport of [{ width: 1200, height: 850 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight + 1), false);
      const stage = await page.locator(".showcase-stage").boundingBox();
      assert.ok(stage.width >= 200 && stage.height >= 120, `${panel} ${viewport.width}: visible preview stage`);
      if (panel === "combat") {
        const play = await page.locator("#showcase-play").boundingBox();
        assert.ok(play.x >= 0 && play.y >= 0 && play.x + play.width <= viewport.width && play.y + play.height <= viewport.height);
      }
      await page.screenshot({ path: `test-results/showcase-ui-${panel}-${viewport.width}.png` });
    }
  }
  assert.equal(await page.evaluate(() => /[\u{1F300}-\u{1FAFF}\u2654-\u265F]/u.test(document.querySelector("#combat-showcase").textContent)), false);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#combat-showcase").isVisible(), false);
  assert.equal(await page.evaluate(() => calls.filter(call => call.kind === "close").length), 1);
  await page.evaluate(() => showcase.dispose());
  assert.equal(await page.locator("#combat-showcase").count(), 0);
  assert.deepEqual(errors, []); assert.deepEqual(requests.filter(request => request !== url), []);
  console.log("PASS: presentation-only showcase, all 48 class/skin selections, Skip/Escape safety, A/B payloads, 22 events and 9 music states, audio opt-in, responsive controls and no renderer/context/network creation");
} finally { await browser.close(); }
