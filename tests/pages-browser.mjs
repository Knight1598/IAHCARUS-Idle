import { enterGame } from "./enter-game.mjs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
import assert from "node:assert/strict";
const html = await readFile("dist-pages/index.html");
const prefix = "/IAHCARUS-Idle/";
const server = createServer((req, res) => {
  if (req.url?.split("?")[0] === prefix) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : existsSync("/usr/bin/chromium")
        ? { executablePath: "/usr/bin/chromium" }
        : {}),
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const context = await browser.newContext({
      viewport: { width: 1100, height: 800 },
    }),
    page = await context.newPage();
  const errors = [],
    requests = [];
  let sockets = 0;
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  page.on("websocket", () => sockets++);
  const url = `http://127.0.0.1:${server.address().port}${prefix}`;
  await page.goto(url);
  await enterGame(page);
  await page.waitForSelector("canvas");
  assert.equal(await page.locator(".tabs").isVisible(), false);
  assert.equal(await page.locator("#difficulty").isVisible(), true);
  // Once the single page has loaded, no networking is needed for bot play.
  await context.setOffline(true);
  await page.locator("#reduced").check();
  await page.locator("#board-details summary").click();
  for (const depth of ["1", "2", "3"]) {
    await page.locator("#reset").click();
    await page.locator("#difficulty").selectOption(depth);
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await page.locator("#skip").click();
    await page.waitForFunction(
      () => document.querySelectorAll("#moves .san").length === 2,
      {},
      { timeout: 30000 },
    );
    await page.locator("#skip").click();
    assert.match(await page.locator("#status").innerText(), /ตาฝ่ายขาว/);
  }
  assert.deepEqual(errors, []);
  assert.equal(sockets, 0);
  assert.deepEqual(
    requests.filter((u) => u !== url && !u.endsWith("/favicon.ico")),
    [],
  );
  console.log(
    "PASS: Pages subpath loads a playable 3D bot game; all three levels work after disconnecting network, without external assets, WebSockets or browser errors.",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
