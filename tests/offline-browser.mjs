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
  // Training remains available without a multiplayer mode.
  await page.locator("#training-panel summary").click();
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
