import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
import { createServer } from "vite";

// An isolated renderer fixture measures drawing work, without a second game loop.
const vite = await createServer({
  server: { host: "127.0.0.1", port: 0 },
  plugins: [{
    name: "renderer-test-page",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== "/render-test") return next();
        res.setHeader("Content-Type", "text/html");
        res.end('<html><body style="margin:0"><div id="stage" style="width:900px;height:700px;position:relative"></div></body></html>');
      });
    },
  }],
});
let browser;
try {
  await vite.listen();
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH || existsSync("/usr/bin/chromium")
      ? { executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" } : {}),
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/render-test`);
  await page.evaluate(async () => {
    const [{ ChessScene }, { Chess }] = await Promise.all([
      import("/src/scene.ts"), import("/node_modules/chess.js/dist/esm/chess.js"),
    ]);
    window.fixtureChess = Chess;
    window.fixture = new ChessScene(document.querySelector("#stage"));
    window.fixture.renderBoard(new Chess());
    window.picks = [];
    window.fixture.onPick = (square) => window.picks.push(square);
  });
  await page.waitForTimeout(400);
  const initial = await page.evaluate(() => ({
    calls: fixture.renderer.info.render.calls,
    geometries: fixture.renderer.info.memory.geometries,
    ratio: fixture.renderer.getPixelRatio(),
  }));
  const before = await page.evaluate(() => fixture.camera.position.toArray());
  await page.mouse.move(450, 350);
  await page.mouse.down();
  await page.mouse.move(640, 400, { steps: 14 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  // Stop residual orbit damping before comparing camera positions across settings.
  await page.evaluate(() => {
    fixture.controls.enableDamping = false;
    fixture.controls.update();
  });
  const after = await page.evaluate(() => ({
    calls: fixture.renderer.info.render.calls,
    camera: fixture.camera.position.toArray(), picks,
  }));
  assert.notDeepEqual(after.camera, before);
  assert.deepEqual(after.picks, []);
  console.log("Renderer workload:", JSON.stringify({ initial, orbitDrawCalls: after.calls }));
  if (!process.env.RENDER_BASELINE) {
    assert.ok(after.calls <= 100, `Orbit still draws ${after.calls} batches`);
    assert.ok(initial.geometries <= 80, `Board uses ${initial.geometries} geometries`);
    await page.evaluate(() => {
      for (let i = 0; i < 5; i++) fixture.renderBoard(new fixtureChess());
    });
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => fixture.renderer.info.memory.geometries), initial.geometries);
    await page.evaluate(() => {
      window.savedCamera = fixture.camera.position.toArray();
      fixture.setQuality("low");
    });
    assert.deepEqual(await page.evaluate(() => fixture.camera.position.toArray()), after.camera);
    assert.equal(await page.evaluate(() => fixture.renderer.shadowMap.enabled), false);
    assert.ok(await page.evaluate(() => fixture.renderer.getPixelRatio()) <= 1);
    await page.evaluate(() => fixture.setQuality("high"));
    assert.equal(await page.evaluate(() => fixture.renderer.shadowMap.enabled), true);
    assert.deepEqual(await page.evaluate(() => fixture.camera.position.toArray()), after.camera);
    await page.evaluate(async () => {
      const { analyzeMove } = await import("/shared/events.js");
      const before = new fixtureChess("7k/8/7p/3r4/8/2N5/8/K7 w - - 0 1");
      const game = new fixtureChess(before.fen());
      const move = game.move("Nxd5");
      fixture.resetPacing();
      fixture.play(before, game, move, analyzeMove(before, game, move));
    });
    await page.waitForFunction(() => document.querySelector("#stage").dataset.battlePhase === "aftermath");
    assert.equal(await page.evaluate(() => fixture.fx.children.filter((o) => o.isInstancedMesh).length), 1);
    await page.evaluate(() => fixture.finish());
    await page.evaluate(() => fixture.renderBoard(new fixtureChess()));
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => fixture.pieces.children.every((piece) => piece.children.every((mesh) => mesh.material.opacity === 1))), true);
    assert.equal(await page.evaluate(() => fixture.renderer.info.memory.geometries), initial.geometries);
    await page.evaluate(async () => {
      const { analyzeMove } = await import("/shared/events.js");
      const game = new fixtureChess("7k/8/8/3r3r/8/8/8/K2Q4 w - - 0 1");
      fixture.resetPacing();
      function play(san) {
        const before = new fixtureChess(game.fen());
        const move = game.move(san);
        fixture.play(before, game, move, analyzeMove(before, game, move));
        return fixture.animation.dramatic;
      }
      if (!play("Qxd5")) throw Error("First major capture lost its camera cut");
      fixture.finish();
      play("Kh7"); fixture.finish();
      if (play("Qxh5+")) throw Error("Nearby check ignored cinematic cooldown");
      fixture.finish();
      const mate = new fixtureChess();
      for (const san of ["f3", "e5", "g4"]) mate.move(san);
      const before = new fixtureChess(mate.fen());
      const move = mate.move("Qh4#");
      fixture.play(before, mate, move, analyzeMove(before, mate, move));
      if (!fixture.animation.dramatic) throw Error("Cooldown suppressed checkmate");
      fixture.finish();
    });
    console.log("PASS: orbit batches/geometry budgets, mesh reuse, drag without accidental moves and quality changes preserving camera");
  }
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  await vite.close();
}
