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
  await page.waitForSelector("canvas");
  assert.equal(await page.locator(".tabs").isVisible(), false);
  assert.equal(await page.locator("#online-panel").isVisible(), false);
  assert.equal(await page.locator("#difficulty").isVisible(), true);
  assert.match(await page.locator("#mode-tag").innerText(), /SOLO/);
  await page.locator("#reduced").check();
  await page.locator("#board-details summary").click();
  async function move(from, to) {
    await page.locator(`[data-square="${from}"]`).click();
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
  await page.waitForSelector("canvas");
  assert.equal(await page.locator("#difficulty").inputValue(), "3");
  assert.equal(await page.locator("#moves .san").count(), 2);
  await page.locator("#board-details summary").click();
  await page.locator("#undo").click();
  assert.equal(await page.locator("#moves .san").count(), 0);
  // Reset while the bot is thinking must prevent stale replies.
  await move("d2", "d4");
  await page.waitForTimeout(260);
  await page.locator("#reset").click();
  await page.waitForTimeout(600);
  assert.equal(await page.locator("#moves .san").count(), 0);
  // Exercise the full anime sequence, then ensure skip and reduced mode clean up.
  await page.locator("#training-panel summary").click();
  await page.locator("#training-select").selectOption("knight");
  await page.locator("#reduced").uncheck();
  await page.locator("#sound").check();
  await page.locator('[data-square="c3"]').click();
  await page.locator('[data-square="d5"]').click();
  await page.waitForFunction(
    () => document.querySelector("#stage").dataset.battlePhase === "charge",
  );
  mkdirSync("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/anime-charge.png" });
  await page.waitForFunction(
    () => document.querySelector("#stage").dataset.battlePhase === "aftermath",
    {},
    { timeout: 10000 },
  );
  await page.screenshot({ path: "test-results/anime-impact.png" });
  await page.waitForFunction(
    () => !document.querySelector("#stage").dataset.battlePhase,
    {},
    { timeout: 10000 },
  );
  assert.match(await page.locator("#moves").innerText(), /Nxd5/);
  assert.match(await page.locator('[data-square="d5"]').innerText(), /♘/);
  // A normal 3D pick after completion exercises camera and pointer restoration.
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
  await page.locator("#training-select").selectOption("queen");
  await page.locator('[data-square="d1"]').click();
  await page.locator('[data-square="d5"]').click();
  await page.waitForFunction(
    () => !!document.querySelector("#stage").dataset.battlePhase,
  );
  await page.locator("#skip").click();
  assert.equal(
    await page.locator("#stage").getAttribute("data-battle-phase"),
    null,
  );
  await page.locator("#training-select").selectOption("bishop");
  await page.locator("#cinematic").uncheck();
  await move("c3", "f6");
  assert.equal(
    await page.locator("#stage").getAttribute("data-battle-phase"),
    null,
  );
  await page.locator("#cinematic").check();
  await page.locator("#reduced").check();
  await page.locator("#sound").uncheck();
  // Training remains available without a multiplayer mode.
  await page.locator("#training-select").selectOption("rescue");
  await move("g7", "f6");
  assert.match(await page.locator("#moves").innerText(), /gxf6/);
  await page.locator("#reset").click();
  assert.equal(await page.locator("#difficulty").isVisible(), true);
  assert.match(await page.locator("#mode-tag").innerText(), /SOLO/);
  await page.locator("#board-details summary").click();
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
} finally {
  await browser.close();
}
