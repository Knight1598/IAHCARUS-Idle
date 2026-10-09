import { enterGame, openPanel, closePanel, resetGame } from "./enter-game.mjs";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { training } from "../src/training.ts";
const child = spawn(process.execPath, ["server/index.mjs"], {
  env: { ...process.env, PORT: "0" },
  stdio: ["ignore", "pipe", "pipe"],
});
let browser;
try {
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("server startup timed out")),
      5000,
    );
    child.stdout.on("data", (d) => {
      const m = String(d).match(/port (\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve(Number(m[1]));
      }
    });
    child.on("error", reject);
  });
  const base = `http://127.0.0.1:${port}`;
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : existsSync("/usr/bin/chromium")
        ? { executablePath: "/usr/bin/chromium" }
        : {}),
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const errors = [];
  const context = await browser.newContext({
    viewport: { width: 1100, height: 800 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error("browser error", e.message);
  });
  page.setDefaultTimeout(15000);
  await page.goto(base);
  await enterGame(page, "local");
  console.log("browser loaded");
  await page.waitForSelector("canvas");
  // Exercise raycasting on the actual 3D board before using the accessible board.
  async function canvasSquare(s) {
    const r = await page.locator("canvas").first().boundingBox();
    const x = s.charCodeAt(0) - 97 - 3.5,
      z = 3.5 - (Number(s[1]) - 1),
      distance =
        (2 * Math.max(10, (10 * 1.05) / (r.width / r.height)) - z) *
        Math.SQRT1_2,
      tan = Math.tan((21 * Math.PI) / 180);
    await page.mouse.click(
      r.x + (r.width * (1 + x / (distance * tan * (r.width / r.height)))) / 2,
      r.y + (r.height * (1 + (z * Math.SQRT1_2) / (distance * tan))) / 2,
    );
  }
  await canvasSquare("e2");
  await canvasSquare("e4");
  await page.waitForFunction(
    () => document.querySelectorAll("#moves .san").length === 1,
  );
  await page.locator("#skip").click();
  await resetGame(page);
  await closePanel(page);
  await page.locator("#board-details summary").click();
  async function square(p, s) {
    await closePanel(p);
    await closePanel(p);
    await p.locator(`[data-square="${s}"]`).click();
  }
  async function move(p, from, to) {
    await square(p, from);
    await square(p, to);
    await p.waitForTimeout(100);
    await p.locator("#skip").click();
  }
  console.log("local moves");
  await move(page, "e2", "e4");
  await move(page, "d7", "d5");
  await move(page, "e4", "d5");
  assert.match(await page.locator("#moves").innerText(), /exd5/);
  await page.locator("#undo").click();
  assert.doesNotMatch(await page.locator("#moves").innerText(), /exd5/);
  await page.reload();
  await enterGame(page);
  await closePanel(page);
  await page.locator("#board-details summary").click();
  assert.match(await page.locator("#moves").innerText(), /d5/);
  console.log("checkmate test");
  await resetGame(page);
  for (const [f, t] of [
    ["f2", "f3"],
    ["e7", "e5"],
    ["g2", "g4"],
  ])
    await move(page, f, t);
  await square(page, "d8");
  await square(page, "h4");
  await page.waitForFunction(
    () => document.querySelector("#event strong").textContent === "CHECKMATE",
  );
  await page.locator("#skip").click();
  assert.match(await page.locator("#status").innerText(), /รุกฆาต/);
  assert.equal(
    await page
      .locator('#flat-board [data-square="h4"] [data-piece="q"][data-color="b"]')
      .count(),
    1,
  );
  console.log("castling test");
  // Castling is represented by both pieces, even when animation is skipped.
  await resetGame(page);
  for (const [f, t] of [
    ["e2", "e4"],
    ["e7", "e5"],
    ["g1", "f3"],
    ["b8", "c6"],
    ["f1", "c4"],
    ["g8", "f6"],
    ["e1", "g1"],
  ])
    await move(page, f, t);
  assert.equal(await page.locator('[data-square="f1"] svg[data-piece="r"][data-color="w"]').count(), 1);
  assert.equal(await page.locator('[data-square="g1"] svg[data-piece="k"][data-color="w"]').count(), 1);
  console.log("promotion/bot tests");
  // Local snapshot can resume a position one move before promotion.
  await page.evaluate(() =>
    localStorage.setItem(
      "special-chess-local",
      JSON.stringify({
        mode: "local",
        history: ["a4", "h5", "a5", "h4", "a6", "h3", "axb7", "hxg2"],
      }),
    ),
  );
  await page.reload();
  await enterGame(page);
  await closePanel(page);
  await page.locator("#board-details summary").click();
  await square(page, "b7");
  await square(page, "a8");
  await page.locator('#promotion button[data-piece="n"]').click();
  await page.locator("#skip").click();
  assert.equal(await page.locator('[data-square="a8"] svg[data-piece="n"][data-color="w"]').count(), 1);
  console.log("special animations");
  await openPanel(page, "training");
  await page.locator("#training-panel summary").click();
  for (const [key, t] of Object.entries(training)) {
    await openPanel(page, "training");
    await page.locator("#training-select").selectOption(key);
    // Record this move's emitted ribbon before input. Software WebGL may delay
    // the click response until a completed trial hides it behind the result UI.
    await page.evaluate(() => {
      window.__trainingEvents = [];
      window.__trainingEventObserver = new MutationObserver(() => {
        const event = document.querySelector("#event");
        const title = event.querySelector("strong").textContent;
        if (title && event.classList.contains("visible")) window.__trainingEvents.push(title);
      });
      window.__trainingEventObserver.observe(document.querySelector("#event"), {
        attributes: true, attributeFilter: ["class"], childList: true, subtree: true,
      });
    });
    await square(page, t.from);
    await square(page, t.to);
    if (key === "promotion")
      await page.locator('#promotion button[data-piece="q"]').click();
    await page.waitForTimeout(key === "knight" ? 950 : 80);
    if (key === "knight") {
      mkdirSync("test-results", { recursive: true });
      await page.screenshot({ path: "test-results/knight-cinematic.png" });
    }
    await page.waitForFunction(() => window.__trainingEvents.length > 0);
    const emitted = await page.evaluate(() => {
      window.__trainingEventObserver.disconnect();
      return window.__trainingEvents;
    });
    assert.ok(emitted.some((title) => title.trim()), `${key} must emit a visible event ribbon`);
    assert.equal(await page.locator("#moves .san").count(), 1, `${key} must complete its legal move`);
    if (key === "bishop")
      await page.waitForFunction(
        () => !document.querySelector("#stage").classList.contains("cinematic"),
      );
    else await page.locator("#skip").click();
  }
  await openPanel(page, "training");
  await page.locator("#training-panel summary").click();
  await openPanel(page, "room");
  await page.locator('[data-mode="bot"]').click();
  await openPanel(page, "settings");
  await page.locator("#reduced").check();
  await move(page, "e2", "e4");
  await page.waitForFunction(
    () => document.querySelectorAll("#moves .san").length === 2,
    {},
    { timeout: 15000 },
  );
  await page.locator("#skip").click();
  assert.match(await page.locator("#status").innerText(), /ตาฝ่ายขาว/);
  mkdirSync("test-results", { recursive: true });
  await closePanel(page);
  await page.locator("#board-details summary").click();
  await page.screenshot({ path: "test-results/desktop.png" });
  console.log("online test");
  // Isolated contexts represent two different players.
  await openPanel(page, "room");
  await page.locator('[data-mode="online"]').click();
  await page.waitForFunction(() =>
    document.querySelector("#connection").textContent.includes("เชื่อมต่อแล้ว"),
  );
  await openPanel(page, "room");
  await page.locator("#create").click();
  await page.waitForFunction(
    () => document.querySelector("#code").textContent.length === 6,
  );
  const code = await page.locator("#code").innerText();
  const guestContext = await browser.newContext({
    viewport: { width: 1000, height: 800 },
  });
  const guest = await guestContext.newPage();
  guest.on("pageerror", (e) => errors.push(e.message));
  await guest.goto(`${base}/?room=${code}`);
  await enterGame(guest);
  await guest.waitForFunction(() =>
    document.querySelector("#connection").textContent.includes("เชื่อมต่อแล้ว"),
  );
  await openPanel(guest, "room");
  await guest.locator("#join").click();
  await guest.waitForFunction(
    () => !document.querySelector("#room-info").hidden,
  );
  await page.locator("#duel-ready").click();
  await guest.locator("#duel-ready").click();
  await closePanel(page);
  await page.locator("#board-details summary").click();
  await closePanel(guest);
  await guest.locator("#board-details summary").click();
  await openPanel(guest, "settings");
  await guest.locator("#reduced").check();
  assert.match(await guest.locator(".pause-caption").textContent(), /นาฬิกาจะไม่หยุด/);
  const clockBefore = await guest.locator("#white-clock").textContent();
  await guest.waitForTimeout(1200);
  assert.notEqual(await guest.locator("#white-clock").textContent(), clockBefore, "online clock keeps running in the menu");
  await move(page, "e2", "e4");
  await guest.waitForFunction(
    () => document.querySelectorAll("#moves .san").length === 1,
  );
  await closePanel(guest);
  await guest.locator("#skip").click();
  await move(guest, "e7", "e5");
  await page.waitForFunction(
    () => document.querySelectorAll("#moves .san").length === 2,
  );
  await page.locator("#skip").click();
  await guest.reload();
  await enterGame(guest);
  await guest.waitForFunction(
    () => document.querySelectorAll("#moves .san").length === 2,
  );
  assert.match(await guest.locator("#black-label").innerText(), /คุณ/);
  await openPanel(guest, "pause"); await guest.locator("#resign").click();
  await page.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("ยอมแพ้"),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: rendered 3D, legal play/capture/undo, saved local game, checkmate, castling, promotion picker, six unique attacks and contextual scenes, bot, two-browser PvP, reconnect, resign, mobile layout; no browser errors.",
  );
} finally {
  await browser?.close();
  child.kill();
}
