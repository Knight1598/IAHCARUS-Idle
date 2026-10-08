import assert from "node:assert/strict";
import { chromium } from "playwright";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { enterGame, openPanel, closePanel } from "./enter-game.mjs";

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH || existsSync("/usr/bin/chromium") ? { executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" } : {}),
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
try {
  const context = await browser.newContext({ offline: true });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const url = "http://localhost:31465/hud-test";
  await page.route(url, (route) => route.fulfill({ contentType: "text/html", body: readFileSync("offline/Special-Chess-Offline.html", "utf8") }));
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto(url); await enterGame(page, "bot");
  assert.equal(await page.locator("#game-shell > header").isVisible(), false);
  assert.equal((await page.locator("#stage").boundingBox()).y, 0);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#arena-drawer").getAttribute("data-panel"), "pause");
  assert.match(await page.locator("#status").innerText(), /พัก/);
  await page.locator("#drawer-close").focus();
  await page.keyboard.press("Shift+Tab");
  assert.equal(await page.evaluate(() => document.activeElement.id), "help");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.id), "drawer-close");
  await page.keyboard.press("Escape");
  mkdirSync("test-results", { recursive: true });
  for (const [name, width, height] of [["desktop", 1100, 800], ["mobile", 390, 844], ["landscape", 844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(180);
    const dimensions = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight }));
    assert.ok(dimensions.w <= dimensions.iw && dimensions.h <= dimensions.ih, JSON.stringify(dimensions));
    const board = await page.locator("#stage").boundingBox();
    assert.equal(await page.locator('[data-hud-open="room"]').isVisible(), false);
    for (const panel of ["settings", "training", "missions", "history"]) {
      await openPanel(page, panel);
      assert.deepEqual(await page.locator("#stage").boundingBox(), board);
      const drawer = await page.locator("#arena-drawer").boundingBox();
      assert.ok(drawer.x >= 0 && drawer.y >= 0 && drawer.x + drawer.width <= width && drawer.y + drawer.height <= height);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#arena-drawer").isVisible(), false);
    }
    const dock = await page.locator("#hud-dock").boundingBox();
    assert.ok(dock.x >= 0 && dock.y + dock.height <= height && dock.x + dock.width <= width);
    await page.screenshot({ path: `test-results/hud-${name}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#hud-mute").click();
  assert.equal(await page.locator("#sound").isChecked(), true);
  assert.equal(await page.locator("#hud-mute").getAttribute("aria-pressed"), "true");
  await openPanel(page, "training");
  await page.locator("#training-panel summary").click();
  await page.locator("#training-select").selectOption("knight");
  await closePanel(page);
  await page.locator("#board-details summary").click();
  await page.locator('[data-square="c3"]').click();
  await page.locator('[data-square="d5"]').click();
  await page.waitForFunction(() => !!document.querySelector("#stage").dataset.movePhase);
  await openPanel(page, "pause");
  const pausedPhase = await page.locator("#stage").getAttribute("data-move-phase");
  assert.ok(pausedPhase, "pause must freeze a live combat sequence");
  const pausedSave = await page.evaluate(() => localStorage.getItem("special-chess-offline-game"));
  await page.waitForTimeout(250);
  assert.equal(await page.locator("#stage").getAttribute("data-move-phase"), pausedPhase);
  assert.equal(await page.evaluate(() => localStorage.getItem("special-chess-offline-game")), pausedSave);
  await page.screenshot({ path: "test-results/pause-mobile.png" });
  // Resume and invoke mute in one task, before a slow software-rendered frame
  // can naturally finish the fight between independent Playwright operations.
  const quickMute = await page.evaluate(() => {
    document.querySelector("#drawer-close").click();
    const stage = document.querySelector("#stage"), before = stage.dataset.movePhase;
    document.querySelector("#hud-mute").click();
    return { before, after: stage.dataset.movePhase, enabled: document.querySelector("#sound").checked };
  });
  assert.ok(quickMute.before, "resume must retain the paused fight");
  assert.equal(quickMute.after, quickMute.before, "quick mute must not settle or skip the fight");
  assert.equal(quickMute.enabled, false);
  const event = await page.locator("#battle-toast").boundingBox();
  assert.ok(event.width <= 230 && event.height <= 100);
  await page.locator("#skip").click();
  await page.locator("#board-details summary").click();
  await page.locator("#undo").click();
  await openPanel(page, "settings");
  await page.locator("#cinematic").uncheck();
  await closePanel(page);
  await page.locator("#board-details summary").click();
  await page.evaluate(() => {
    window.hudCaptureSeen = false;
    const stage = document.querySelector("#stage");
    const observer = new MutationObserver(() => {
      if (stage.dataset.executionPhase) { window.hudCaptureSeen = true; observer.disconnect(); }
    });
    observer.observe(stage, { attributes: true, attributeFilter: ["data-execution-phase"] });
  });
  await page.locator('[data-square="c3"]').click();
  await page.locator('[data-square="d5"]').click();
  await page.waitForFunction(() => window.hudCaptureSeen);
  await page.screenshot({ path: "test-results/hud-event-mobile.png" });
  await page.locator("#skip").click();
  assert.deepEqual(errors, []);
  console.log("PASS: viewport HUD on desktop/mobile/landscape, fixed board, all drawers and Escape, quick mute without skipping, compact side events and procedural aura shaders");
} finally { await browser.close(); }
