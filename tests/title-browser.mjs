import { chromium } from "playwright";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { enterGame, openPanel, closePanel } from "./enter-game.mjs";

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
  assert.equal(await page.locator('[data-title-mode="online"]').count(), 0);
  assert.equal(await page.locator('[data-skin-option="astral"]').isDisabled(), true);
  assert.equal(await page.locator('[data-skin-option="royal"]').isDisabled(), true);
  await page.locator('[data-skin-option="ember"]').click();
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
  await page.locator("#reset").click();
  assert.equal(await page.locator("#difficulty").isVisible(), false);
  await page.reload();
  await page.locator("#title-screen").waitFor();
  assert.equal(await page.locator("#launch-resume").isVisible(), true);
  await enterGame(page);
  assert.equal(await page.locator("#moves .san").count(), 0);
  assert.equal(await page.locator("#difficulty").isVisible(), false);
  await page.locator("#title-return").click();
  await page.locator('[data-title-mode="training"]').click();
  await page.locator("#launch-scenario").selectOption("pawn");
  await page.locator("#launch-start").click();
  await page.waitForSelector("#stage canvas");
  assert.equal(await page.locator("#stage").getAttribute("data-skin"), "ember");
  await openPanel(page, "settings");
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
  assert.equal(await page.locator("#launch-resume").isVisible(), true);
  await enterGame(page);
  assert.equal(await xp(), 40);
  assert.equal(await page.locator("#moves .san").count(), 1);
  await page.locator("#title-return").click();
  await page.locator('[data-skin-option="frost"]').click();
  await page.locator('[data-title-mode="bot"]').click();
  await page.locator("#launch-side").selectOption("b");
  await page.locator("#launch-depth").selectOption("1");
  await page.locator("#launch-start").click();
  await page.waitForFunction(() => document.querySelectorAll("#moves .san").length === 1);
  await page.locator("#skip").click();
  assert.equal(await page.locator("#stage").getAttribute("data-skin"), "frost");
  assert.match(await page.locator("#status").innerText(), /ตาฝ่ายดำ/);
  await closePanel(page);
  await page.locator("#board-details summary").click();
  await move("h7", "h6");
  await page.locator("#title-return").click();
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
  await page.locator('[data-skin-option="astral"]').click();
  await enterGame(page);
  assert.equal(await page.locator("#stage").getAttribute("data-skin"), "astral");
  assert.match(await page.locator("#xp-reward").innerText(), /130 XP/);
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
