import { enterGame, openPanel, closePanel } from "./enter-game.mjs";
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const executable =
  process.env.CHROMIUM_PATH ||
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const browser = await chromium.launch({
  ...(executable ? { executablePath: executable } : {}),
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
try {
  const context = await browser.newContext({
    offline: true,
    viewport: { width: 1100, height: 800 },
  });
  const page = await context.newPage();
  const errors = [],
    network = [];
  let sockets = 0;
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("websocket", () => sockets++);
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) network.push(r.url());
  });
  await page.addInitScript(() => {
    window.__botStarts = 0;
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      postMessage(...args) {
        window.__botStarts++;
        return super.postMessage(...args);
      }
    };
    window.WebSocket = class {
      constructor() {
        throw Error("Offline build attempted WebSocket");
      }
    };
  });
  const url = pathToFileURL(resolve("offline/Special-Chess-Offline.html")).href;
  const memory = process.env.OFFLINE_TEST_TRANSPORT === "memory";
  const documentUrl = memory
    ? "http://localhost:31460/offline-test?room=ABCDEF"
    : url + "?room=ABCDEF";
  if (memory) {
    await page.route(
      "http://localhost:31460/offline-test?room=ABCDEF",
      (route) =>
        route.fulfill({
          contentType: "text/html",
          body: readFileSync(
            resolve("offline/Special-Chess-Offline.html"),
            "utf8",
          ),
        }),
    );
    console.log(
      "Using in-memory document delivery: file navigation is unrun in this environment.",
    );
  }
  await page.goto(documentUrl);
  await enterGame(page);
  await page.waitForSelector("canvas");
  assert.equal(await page.locator(".tabs").isVisible(), false);
  assert.equal(await page.locator("#online-panel").isVisible(), false);
  assert.equal(await page.locator("#difficulty").isVisible(), true);
  assert.match(await page.locator("#mode-tag").innerText(), /SOLO/);
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
  for (const depth of ["1", "2", "3"]) {
    await page.locator("#reset").click();
    await page.locator("#difficulty").selectOption(depth);
    await move("e2", "e4");
    await page.waitForFunction(
      () => document.querySelectorAll("#moves .san").length === 2,
      {},
      { timeout: 30000 },
    );
    await page.locator("#skip").click();
    assert.match(await page.locator("#status").innerText(), /ตาฝ่ายขาว/);
    console.log(`PASS: offline bot level ${depth} answered a legal move`);
  }
  await page.reload();
  await enterGame(page);
  await page.waitForSelector("canvas");
  assert.equal(await page.locator("#difficulty").inputValue(), "3");
  assert.equal(await page.locator("#moves .san").count(), 2);
  await closePanel(page);
  await page.locator("#board-details summary").click();
  await page.locator("#undo").click();
  assert.equal(await page.locator("#moves .san").count(), 0);
  // Reset while the bot is thinking must prevent stale replies.
  await move("d2", "d4");
  await page.waitForTimeout(260);
  await page.locator("#reset").click();
  await page.waitForTimeout(600);
  assert.equal(await page.locator("#moves .san").count(), 0);
  // Bad destinations preserve the selected piece and provide useful feedback.
  await closePanel(page);
  await page.locator('[data-square="e2"]').click();
  await closePanel(page);
  await page.locator('[data-square="e5"]').click();
  assert.match(await page.locator("#notice").innerText(), /เดินไม่ได้/);
  assert.equal(await page.locator('[data-square="e2"]').evaluate((el) => el.classList.contains("selected")), true);
  assert.equal(await page.locator("#moves .san").count(), 0);
  // Black-side games: bot opens, orientation, undo, persistence and cancellation.
  await page.locator("#difficulty").selectOption("1");
  await openPanel(page, "settings");
  await page.locator("#human-side").selectOption("b");
  await page.waitForFunction(() => document.querySelectorAll("#moves .san").length === 1);
  await page.locator("#skip").click();
  assert.match(await page.locator("#white-label").innerText(), /อิกนิส/);
  assert.equal(await page.locator("#black-label").innerText(), "คุณ");
  assert.equal(await page.locator("#flat-board button").first().getAttribute("data-square"), "h1");
  assert.equal(await page.locator("#undo").isDisabled(), true);
  await move("h7", "h6");
  await page.waitForFunction(() => document.querySelectorAll("#moves .san").length === 3);
  await page.locator("#skip").click();
  await page.locator("#undo").click();
  assert.equal(await page.locator("#moves .san").count(), 1);
  await page.reload();
  await enterGame(page);
  await page.waitForSelector("canvas");
  assert.equal(await page.locator("#human-side").inputValue(), "b");
  assert.equal(await page.locator("#moves .san").count(), 1);
  await closePanel(page);
  await page.locator("#board-details summary").click();
  await move("h7", "h6");
  await openPanel(page, "settings");
  await page.locator("#human-side").selectOption("w");
  await page.waitForTimeout(400);
  assert.equal(await page.locator("#moves .san").count(), 0);
  // An ordinary pawn capture stays short; all-events mode restores its cutscene.
  await openPanel(page, "training");
  await page.locator("#training-panel summary").click();
  await openPanel(page, "training");
  await page.locator("#training-select").selectOption("pawn");
  await openPanel(page, "settings");
  await page.locator("#reduced").uncheck();
  await closePanel(page);
  await page.locator('[data-square="c4"]').click();
  await closePanel(page);
  await page.locator('[data-square="d5"]').click();
  await page.waitForTimeout(100);
  assert.equal(await page.locator("#stage").getAttribute("data-battle-phase"), null);
  assert.equal(await page.locator("#stage").evaluate((el) => el.classList.contains("cinematic")), false);
  await page.waitForFunction(() => !document.querySelector("#event").classList.contains("visible"));
  assert.equal(await page.locator("#white-captured").innerText(), "♟");
  assert.equal(await page.locator("#white-material").innerText(), "+1");
  await page.locator("#undo").click();
  assert.equal(await page.locator("#white-captured").innerText(), "—");
  await openPanel(page, "settings");
  await page.locator("#cinematic-scope").selectOption("all");
  await closePanel(page);
  await page.locator('[data-square="c4"]').click();
  await closePanel(page);
  await page.locator('[data-square="d5"]').click();
  await page.waitForFunction(() => !!document.querySelector("#stage").dataset.battlePhase);
  await page.locator("#skip").click();
  await openPanel(page, "settings");
  await page.locator("#cinematic-scope").selectOption("key");
  // Bot search starts during a long capture, but cannot mutate the animated board.
  await page.evaluate(() => localStorage.setItem("special-chess-offline-game", JSON.stringify({
    mode: "bot", humanColor: "w", initialFen: "7k/8/8/3r4/8/8/8/K2Q4 w - - 0 1", history: [],
  })));
  await page.reload();
  await enterGame(page);
  await page.waitForSelector("canvas");
  await closePanel(page);
  await page.locator("#board-details summary").click();
  await closePanel(page);
  await page.locator('[data-square="d1"]').click();
  await closePanel(page);
  await page.locator('[data-square="d5"]').click();
  await page.waitForFunction(() => window.__botStarts === 1);
  assert.ok(await page.locator("#stage").getAttribute("data-battle-phase"));
  await page.waitForTimeout(350);
  assert.equal(await page.locator("#moves .san").count(), 1);
  await page.locator("#skip").click();
  await page.waitForFunction(() => document.querySelectorAll("#moves .san").length === 2);
  await page.locator("#skip").click();
  console.log("PASS: black-side play/undo/persistence, illegal-move feedback, captures, cinematic pacing and bot thinking during animation");
  // Exercise the full anime sequence, then ensure skip and reduced mode clean up.
  await openPanel(page, "training");
  await page.locator("#training-panel summary").click();
  await openPanel(page, "training");
  await page.locator("#training-select").selectOption("knight");
  await openPanel(page, "settings");
  await page.locator("#reduced").uncheck();
  await openPanel(page, "settings");
  await page.locator("#sound").check();
  await closePanel(page);
  // Observe the actual stage before input: software WebGL can delay the click
  // response until after a short phase has already appeared and disappeared.
  await page.evaluate(() => {
    window.__battlePhases = [];
    window.__battleObserver = new MutationObserver(() => {
      const phase = document.querySelector("#stage").dataset.battlePhase;
      if (phase && window.__battlePhases.at(-1) !== phase) window.__battlePhases.push(phase);
    });
    window.__battleObserver.observe(document.querySelector("#stage"), {
      attributes: true, attributeFilter: ["data-battle-phase"],
    });
  });
  await page.locator('[data-square="c3"]').click();
  await closePanel(page);
  await page.locator('[data-square="d5"]').click();
  await page.waitForFunction(
    () => window.__battlePhases.includes("charge"),
  );
  mkdirSync("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/anime-sequence-early.png" });
  await page.waitForFunction(
    () => window.__battlePhases.includes("aftermath"),
    {},
    { timeout: 10000 },
  );
  await page.screenshot({ path: "test-results/anime-impact.png" });
  await page.waitForFunction(
    () => !document.querySelector("#stage").dataset.battlePhase,
    {},
    { timeout: 10000 },
  );
  const phases = await page.evaluate(() => {
    window.__battleObserver.disconnect(); return window.__battlePhases;
  });
  assert.deepEqual(phases, ["charge", "dash", "impact", "aftermath", "return"]);
  assert.match(await page.locator("#moves").innerText(), /Nxd5/);
  assert.match(await page.locator('[data-square="d5"]').innerText(), /♘/);
  // A normal 3D pick after completion exercises camera and pointer restoration.
  await closePanel(page);
  await page.locator("#board-details summary").click();
  async function canvasSquare(square) {
    const r = await page.locator("canvas").first().boundingBox();
    const x = square.charCodeAt(0) - 97 - 3.5,
      z = 3.5 - (Number(square[1]) - 1),
      distance =
        (2 * Math.max(10, (10 * 1.05) / (r.width / r.height)) - z) *
        Math.SQRT1_2,
      tan = Math.tan((21 * Math.PI) / 180);
    await page.mouse.click(
      r.x + (r.width * (1 + x / (distance * tan * (r.width / r.height)))) / 2,
      r.y + (r.height * (1 + (z * Math.SQRT1_2) / (distance * tan))) / 2,
    );
  }
  await canvasSquare("h8");
  await canvasSquare("h7");
  await page.locator("#skip").click();
  assert.match(await page.locator("#moves").innerText(), /Kh7/);
  await page.locator("#board-details summary").click();
  await openPanel(page, "training");
  await page.locator("#training-select").selectOption("queen");
  await closePanel(page);
  await page.locator('[data-square="d1"]').click();
  await closePanel(page);
  await page.locator('[data-square="d5"]').click();
  await page.waitForFunction(
    () => !!document.querySelector("#stage").dataset.battlePhase,
  );
  await page.locator("#skip").click();
  assert.equal(
    await page.locator("#stage").getAttribute("data-battle-phase"),
    null,
  );
  await openPanel(page, "training");
  await page.locator("#training-select").selectOption("bishop");
  await openPanel(page, "settings");
  await page.locator("#cinematic").uncheck();
  await move("c3", "f6");
  assert.equal(
    await page.locator("#stage").getAttribute("data-battle-phase"),
    null,
  );
  await openPanel(page, "settings");
  await page.locator("#cinematic").check();
  await openPanel(page, "settings");
  await page.locator("#reduced").check();
  await openPanel(page, "settings");
  await page.locator("#sound").uncheck();
  // Training remains available without a multiplayer mode.
  await openPanel(page, "training");
  await page.locator("#training-select").selectOption("rescue");
  await move("g7", "f6");
  assert.match(await page.locator("#moves").innerText(), /gxf6/);
  // Contextual events are reconstructed from real history and undo with the move.
  await page.evaluate(() => localStorage.setItem("special-chess-offline-game", JSON.stringify({
    mode: "local", humanColor: "w", history: ["e4", "d5", "exd5"],
  })));
  await page.reload();
  await enterGame(page);
  await page.waitForSelector("canvas");
  await closePanel(page);
  await page.locator("#board-details summary").click();
  await openPanel(page, "missions");
  await page.locator("#battle-log-panel summary").click();
  assert.equal(await page.locator('[data-battle-kind="first-blood"]').count(), 1);
  await move("d8", "d5");
  assert.equal(await page.locator("#stage").getAttribute("data-battle-moment"), "recapture");
  assert.match(await page.locator("#battle-toast strong").innerText(), /COUNTER STRIKE/);
  await page.locator("#undo").click();
  assert.equal(await page.locator('[data-battle-kind="recapture"]').count(), 0);
  assert.equal(await page.locator("#battle-toast").evaluate((el) => el.classList.contains("visible")), false);
  await move("d8", "d5");
  await openPanel(page, "settings");
  await page.locator("#graphics-quality").selectOption("low");
  await page.reload();
  await enterGame(page);
  await page.waitForSelector("canvas");
  assert.equal(await page.locator("#graphics-quality").inputValue(), "low");
  assert.equal(await page.locator("#stage").getAttribute("data-graphics"), "low");
  await openPanel(page, "missions");
  await page.locator("#battle-log-panel summary").click();
  assert.equal(await page.locator('[data-battle-kind="recapture"]').count(), 1);
  assert.equal(await page.locator("#battle-toast").evaluate((el) => el.classList.contains("visible")), false);
  // A queen capture from behind changes the battle, awards a mission star and cuts in gold.
  await page.evaluate(() => localStorage.setItem("special-chess-offline-game", JSON.stringify({
    mode: "bot", humanColor: "w", initialFen: "7k/8/7r/3q4/8/8/8/K2Q4 w - - 0 1", history: [],
  })));
  await page.reload();
  await enterGame(page);
  await page.waitForSelector("canvas");
  await closePanel(page);
  await page.locator("#board-details summary").click();
  await openPanel(page, "settings");
  await page.locator("#reduced").uncheck();
  await closePanel(page);
  await page.locator('[data-square="d1"]').click();
  await closePanel(page);
  await page.locator('[data-square="d5"]').click();
  assert.equal(await page.locator("#stage").getAttribute("data-battle-moment"), "comeback");
  assert.match(await page.locator("#event strong").innerText(), /TURNING POINT/);
  assert.equal(await page.locator("#mission-list .complete").count(), 1);
  await page.waitForFunction(() => document.querySelector("#stage").dataset.battlePhase === "aftermath");
  await page.screenshot({ path: "test-results/comeback-event.png" });
  await page.locator("#undo").click();
  assert.equal(await page.locator("#mission-list .complete").count(), 0);
  assert.equal(await page.locator("#moves .san").count(), 0);
  await openPanel(page, "settings");
  await page.locator("#battle-events").uncheck();
  assert.equal(await page.locator("#missions").isVisible(), false);
  assert.equal(await page.locator("#battle-log-panel").isVisible(), false);
  await openPanel(page, "settings");
  await page.locator("#battle-events").check();
  console.log("PASS: counterattacks, comeback cinematic, mission stars, undo/history restoration, event toggle and saved graphics quality");
  await page.locator("#reset").click();
  assert.equal(await page.locator("#difficulty").isVisible(), true);
  assert.match(await page.locator("#mode-tag").innerText(), /SOLO/);
  await closePanel(page);
  await page.locator("#board-details summary").click();
  await openPanel(page, "training");
  await page.locator("#training-panel summary").click();
  mkdirSync("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/offline-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: "test-results/offline-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(
    network.filter((u) => !memory || u !== documentUrl),
    [],
  );
  assert.equal(sockets, 0);
  console.log(
    "PASS: single-file game with network disabled; all three bots, saved game/difficulty, undo, cancellation, training, mobile layout; zero external requests, WebSockets or browser errors.",
  );
} catch (error) {
  const page = browser.contexts()[0]?.pages()[0];
  if (page) {
    console.error("Offline failure state:", await page.evaluate(() => ({
      phases: window.__battlePhases, stage: { ...document.querySelector("#stage")?.dataset },
      status: document.querySelector("#status")?.innerText,
      moves: document.querySelector("#moves")?.innerText,
    })).catch(() => null));
  }
  throw error;
} finally {
  await browser.close();
}
