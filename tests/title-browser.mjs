import { chromium } from "playwright";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { enterGame, openPanel, closePanel, enterMenu, chooseMode, launchPrepared, returnToMenu, resetGame, equipArmySkin } from "./enter-game.mjs";

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH || existsSync("/usr/bin/chromium") ? { executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" } : {}),
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
try {
  const context = await browser.newContext({ offline: true, viewport: { width: 1100, height: 850 } });
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
  await page.addInitScript(() => {
    window.botStarts = 0;
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker { postMessage(...args) { window.botStarts++; return super.postMessage(...args); } };
    window.WebSocket = class { constructor() { throw Error("Offline menu attempted WebSocket"); } };
  });
  const url = "http://localhost:31463/title-test";
  await page.route(url, (route) => route.fulfill({ contentType: "text/html", body: readFileSync("offline/Special-Chess-Offline.html", "utf8") }));
  await page.goto(url);
  await page.locator("#title-screen").waitFor();
  assert.equal(await page.locator("#game-shell").isVisible(), false);
  assert.equal(await page.locator("#launch-resume").isVisible(), false);
  assert.equal(await page.locator('[data-title-mode="online"]').count(), 1);
  assert.equal(await page.locator('[data-skin-option="astral"]').isDisabled(), true);
  assert.equal(await page.locator('[data-skin-option="royal"]').isDisabled(), true);
  assert.equal(await page.locator('[data-arena-option]').count(), 8);
  assert.equal(await page.locator("#title-screen").getAttribute("data-menu-view"), "title");
  assert.equal(await page.locator(".title-modes").isVisible(), false);
  assert.equal(await page.locator("#launch-start").isVisible(), false);
  mkdirSync("test-results", { recursive: true });
  async function verifyMenuView(view) {
    assert.equal(await page.locator("#title-screen").getAttribute("data-menu-view"), view);
    assert.equal(await page.locator(".menu-page:visible").count(), 1);
    for (const viewport of [{ width: 1100, height: 850 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight + 1), false, `${view} must stay in the viewport`);
      if (["mode", "setup", "army", "arena"].includes(view)) {
        const button = await page.locator(view === "arena" ? "#launch-start" : "#flow-next").boundingBox();
        assert.ok(button && button.y >= 0 && button.y + button.height <= viewport.height, `${view}: continue stays on screen`);
      }
      await page.screenshot({ path: `test-results/menu-${view}-${viewport.width}.png` });
    }
    await page.setViewportSize({ width: 1100, height: 850 });
  }
  await verifyMenuView("title");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#title-screen").getAttribute("data-menu-view"), "menu");
  await verifyMenuView("menu");
  await page.locator('[data-menu-go="settings"]').click();
  await verifyMenuView("settings");
  assert.equal(await page.locator("#sound-volume").count(), 1, "menu and match share settings controls");
  await page.locator("#sound-volume").evaluate((input) => { input.value = "41"; input.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.keyboard.press("Escape");
  await page.locator('[data-menu-go="help"]').click();
  assert.equal(await page.locator("#help-dialog").isVisible(), true);
  await page.locator("#close-help").click();
  await page.locator("#lobby-battle-tab").click();
  await verifyMenuView("mode");
  await page.keyboard.press("Escape");
  await chooseMode(page, "bot");
  assert.equal(await page.locator("#title-screen").getAttribute("data-menu-view"), "setup");
  await verifyMenuView("setup");
  await page.locator("#flow-next").click();
  await verifyMenuView("army");
  await page.locator('[data-skin-option="ember"]').click();
  await page.locator("#flow-next").click();
  await verifyMenuView("arena");
  await page.locator("#flow-back").click();
  assert.equal(await page.locator('[data-skin-option="ember"]').getAttribute("aria-pressed"), "true");
  await page.locator('[data-journey-step="1"]').click();
  assert.equal(await page.locator("#title-screen").getAttribute("data-menu-view"), "setup");
  await page.locator("#flow-next").click(); await page.locator("#flow-next").click();
  await page.locator('[data-arena-option="astral"]').click();
  assert.equal(await page.locator('[data-arena-option="astral"]').getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator("#stage").getAttribute("data-arena"), "astral");
  assert.match(await page.locator("#arena-description").textContent(), /มิติ/);
  assert.equal(await page.locator(".skin-preview").getAttribute("data-skin"), "ember");
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => botStarts), 0);
  mkdirSync("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/title-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    console.log(await page.evaluate(() => [...document.querySelectorAll("#title-screen *")].map((el) => ({ tag: el.tagName, id: el.id, class: el.className, right: el.getBoundingClientRect().right })).filter((el) => el.right > innerWidth).slice(0, 12)));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: "test-results/title-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1100, height: 850 });
  // A saved match can be resumed even before its first move; local reset stays local.
  await enterGame(page, "local");
  assert.equal(await page.locator("#difficulty").isVisible(), false);
  await resetGame(page);
  assert.equal(await page.locator("#difficulty").isVisible(), false);
  await page.reload();
  await page.locator("#title-screen").waitFor();
  assert.equal(await page.locator('[data-arena-option="astral"]').getAttribute("aria-pressed"), "true");
  await enterMenu(page);
  assert.equal(await page.locator("#launch-resume").isVisible(), true);
  await enterGame(page);
  assert.equal(await page.locator("#moves .san").count(), 0);
  assert.equal(await page.locator("#difficulty").isVisible(), false);
  await returnToMenu(page);
  await chooseMode(page, "training");
  await page.locator("#launch-scenario").selectOption("pawn");
  await launchPrepared(page);
  await page.waitForSelector("#stage canvas");
  assert.equal(await page.locator("#stage").getAttribute("data-skin"), "ember");
  await openPanel(page, "settings");
  assert.equal(await page.locator("#sound-volume").inputValue(), "41");
  await page.locator("#arena-select").selectOption("grove");
  assert.equal(await page.locator("#stage").getAttribute("data-arena"), "grove");
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("special-chess-profile")).arena), "grove");
  await page.locator("#reduced").check();
  await closePanel(page);
  await page.locator("#board-details summary").click();
  async function move(from, to) {
    await closePanel(page);
    await page.locator(`[data-square="${from}"]`).click();
    await closePanel(page);
    await page.locator(`[data-square="${to}"]`).click();
    await page.locator("#skip").click();
  }
  const xp = () => page.evaluate(() => JSON.parse(localStorage.getItem("special-chess-profile")).xp);
  await move("c4", "d5");
  if (await xp() !== 40) {
    console.log(errors, await page.evaluate(() => ({ saved: localStorage.getItem("special-chess-offline-game"), profile: localStorage.getItem("special-chess-profile"), notice: document.querySelector("#notice").textContent, training: document.querySelector("#training-select").value })));
    await page.screenshot({ path: "test-results/title-training-failure.png", fullPage: true });
  }
  assert.equal(await xp(), 40);
  await page.locator("#undo").click();
  await move("c4", "d5");
  assert.equal(await xp(), 40);
  await page.reload();
  await page.locator("#title-screen").waitFor();
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => botStarts), 0);
  await enterMenu(page);
  assert.equal(await page.locator("#launch-resume").isVisible(), true);
  await enterGame(page);
  assert.equal(await xp(), 40);
  assert.equal(await page.locator("#moves .san").count(), 1);
  await returnToMenu(page);
  await equipArmySkin(page, "frost");
  await chooseMode(page, "bot");
  await page.locator("#launch-side").selectOption("b");
  await page.locator("#launch-depth").selectOption("1");
  await launchPrepared(page);
  await page.waitForFunction(() => document.querySelectorAll("#moves .san").length === 1);
  await page.locator("#skip").click();
  assert.equal(await page.locator("#stage").getAttribute("data-skin"), "frost");
  assert.match(await page.locator("#status").innerText(), /ตาฝ่ายดำ/);
  await closePanel(page);
  await page.locator("#board-details summary").click();
  await move("h7", "h6");
  await returnToMenu(page);
  const saved = await page.evaluate(() => localStorage.getItem("special-chess-offline-game"));
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => localStorage.getItem("special-chess-offline-game")), saved);
  await enterGame(page);
  await page.waitForFunction(() => document.querySelectorAll("#moves .san").length === 3);
  await page.locator("#skip").click();
  // Restore a finished standard game: claim once, unlock skin, resume, undo/remate.
  await page.evaluate(() => {
    localStorage.setItem("special-chess-profile", JSON.stringify({ xp: 190, skin: "frost", claimed: [] }));
    localStorage.setItem("special-chess-offline-difficulty", "2");
    localStorage.setItem("special-chess-offline-game", JSON.stringify({ mode: "bot", humanColor: "b", matchId: "title-test-match", history: ["f3", "e5", "g4", "Qh4#"] }));
  });
  await page.reload();
  await page.locator("#title-screen").waitFor();
  assert.equal(await xp(), 320);
  assert.equal(await page.locator('[data-skin-option="astral"]').isDisabled(), false);
  await equipArmySkin(page, "astral");
  await enterGame(page);
  assert.equal(await page.locator("#stage").getAttribute("data-skin"), "astral");
  assert.match(await page.locator(".battle-result-xp").innerText(), /130 XP/);
  await page.reload();
  await enterGame(page);
  assert.equal(await xp(), 320);
  await closePanel(page);
  await page.locator("#board-details summary").click();
  await page.locator("#undo").click();
  await move("d8", "h4");
  assert.equal(await xp(), 320);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("special-chess-profile")).matches), 1);
  assert.deepEqual(errors, []);
  assert.deepEqual(requests.filter((request) => request !== url), []);
  console.log("PASS: title/mobile layout, starter skins, training XP once, paused menu, black-side bot launch, saved-game resume, level unlocks and rematch/reload reward deduplication; no external requests");
} finally { await browser.close(); }
