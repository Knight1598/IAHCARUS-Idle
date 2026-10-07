import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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
    assert.ok(after.calls <= 102, `Orbit still draws ${after.calls} batches`);
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
    const theme = await page.evaluate(() => {
      const game = new fixtureChess();
      fixture.setSkin("classic"); fixture.renderBoard(game);
      const original = fixture.pieces.children.find((p) => p.userData.square === "a2").children.map((m) => m.geometry.attributes.position.count);
      const squares = fixture.pieces.children.map((p) => p.userData.square).sort();
      fixture.setSkin("frost"); fixture.renderBoard(game);
      const pawn = fixture.pieces.children.find((p) => p.userData.square === "a2");
      return {
        original, themed: pawn.children.map((m) => m.geometry.attributes.position.count),
        color: pawn.children[0].material.color.getHex(),
        squares, themedSquares: fixture.pieces.children.map((p) => p.userData.square).sort(),
        fen: game.fen(),
      };
    });
    assert.notDeepEqual(theme.themed, theme.original);
    assert.equal(theme.color, 0xe1f5ff);
    assert.deepEqual(theme.themedSquares, theme.squares);
    await page.evaluate(() => {
      for (const skin of ["classic", "ember", "frost", "astral", "royal"]) {
        fixture.setSkin(skin); fixture.renderBoard(new fixtureChess());
        if (fixture.pieces.children.length !== 32) throw Error(`Incomplete army for ${skin}`);
      }
    });
    await page.evaluate(() => {
      window.pausedDraws = 0;
      const render = fixture.renderer.render.bind(fixture.renderer);
      fixture.renderer.render = (...args) => { pausedDraws++; return render(...args); };
      fixture.setPaused(true);
    });
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => pausedDraws), 0);
    await page.evaluate(() => fixture.setPaused(false));
    await page.waitForTimeout(100);
    assert.ok(await page.evaluate(() => pausedDraws) > 0);
    console.log("PASS: procedural skin changes actual pawn geometry/colors without moving pieces; title pause stops GPU drawing");
    await page.evaluate(async () => {
      const { analyzeMove } = await import("/shared/events.js");
      fixture.setSkin("classic"); fixture.cinematic = false; fixture.reduced = false;
      fixture.onDash = () => window.launchCount++;
      fixture.onImpact = () => window.contactCount++;
      window.launchCount = window.contactCount = 0;
      const before = new fixtureChess(), after = new fixtureChess();
      const move = after.move("e4");
      fixture.play(before, after, move, analyzeMove(before, after, move));
      fixture.animation.duration = 10000;
    });
    await page.waitForFunction(() => document.querySelector("#stage").dataset.movePhase === "charge");
    assert.equal(await page.evaluate(() => fixture.animation.object.position.distanceTo(fixture.animation.from)), 0);
    assert.equal(await page.evaluate(() => fixture.animation.lock.name), "destination-lock");
    await page.evaluate(() => fixture.animation.start = performance.now() - 5000);
    await page.waitForFunction(() => document.querySelector("#stage").dataset.movePhase === "slowmo");
    assert.equal(await page.evaluate(() => launchCount), 1);
    assert.equal(await page.evaluate(() => contactCount), 0);
    await page.evaluate(() => fixture.setPaused(true));
    mkdirSync("test-results", { recursive: true });
    await page.locator("#stage").screenshot({ path: "test-results/space-move-slowmo.png" });
    await page.evaluate(() => {
      fixture.animation.start = performance.now() - 6500;
      fixture.setPaused(false);
    });
    await page.waitForFunction(() => document.querySelector("#stage").dataset.movePhase === "impact");
    assert.equal(await page.evaluate(() => contactCount), 1);
    await page.evaluate(() => fixture.finish());
    assert.equal(await page.locator("#stage").getAttribute("data-move-phase"), null);
    assert.equal(await page.evaluate(() => fixture.fx.children.length), 0);
    await page.evaluate(async () => {
      const { training } = await import("/src/training.ts");
      const { analyzeMove } = await import("/shared/events.js");
      for (const key of ["pawn", "knight", "bishop", "rook", "queen", "king"]) {
        const scene = training[key], before = new fixtureChess(scene.fen), after = new fixtureChess(scene.fen);
        const move = after.move({ from: scene.from, to: scene.to });
        fixture.play(before, after, move, analyzeMove(before, after, move));
        if (fixture.animation.aura.name !== `charge-${move.piece}`) throw Error("Lost piece charge identity");
        if (fixture.animation.lock.name !== "enemy-lock") throw Error("Enemy lock missing");
        fixture.finish();
      }
      fixture.reduced = true; fixture.renderBoard(new fixtureChess());
      if (fixture.groundAuras.children.length) throw Error("Reduced effects left ambient runes");
      fixture.reduced = false; fixture.renderBoard(new fixtureChess());
      if (fixture.groundAuras.children.length !== 2) throw Error("Ground auras must use two batches");
    });
    console.log("PASS: normal moves charge/lock/slow approach/contact once, all six attack identities, cancellation and reduced-effects cleanup");
    const audio = await page.evaluate(async () => {
      const { SpaceAudio } = await import("/src/sound.ts");
      const results = [], samples = [];
      for (const piece of ["p", "n", "b", "r", "q", "k"]) {
        const context = new OfflineAudioContext(2, 44100 * 1.6, 44100);
        const sound = new SpaceAudio(context);
        sound.play(piece, "lock"); sound.play(piece, "charge", 0.35);
        const suspended = context.suspend(0.35), rendered = context.startRendering();
        await suspended;
        sound.play(piece, "dash");
        const contact = context.suspend(0.65); await context.resume(); await contact;
        sound.play(piece, "impact", 0.3, true); await context.resume();
        const buffer = await rendered, data = buffer.getChannelData(0);
        let peak = 0, energy = 0, fingerprint = 0;
        for (let i = 0; i < data.length; i++) {
          peak = Math.max(peak, Math.abs(data[i])); energy += data[i] ** 2;
          if (i % 100 === 0) fingerprint += data[i] * Math.sin(i);
        }
        results.push({ piece, peak, rms: Math.sqrt(energy / data.length), fingerprint, voices: sound.activeVoices });
        for (let i = 0; i < buffer.length; i++) samples.push((data[i] + buffer.getChannelData(1)[i]) * 0.5);
        sound.dispose();
      }
      const context = new OfflineAudioContext(1, 44100 * 0.8, 44100), sound = new SpaceAudio(context);
      sound.play("b", "charge", 0.7);
      const suspended = context.suspend(0.1), rendered = context.startRendering();
      await suspended; sound.cancel(); await context.resume();
      const buffer = await rendered;
      const tail = buffer.getChannelData(0).slice(44100 * 0.4);
      return { results, samples, canceledVoices: sound.activeVoices, canceledPeak: Math.max(...tail.map(Math.abs)) };
    });
    for (const voice of audio.results) {
      assert.ok(voice.rms > 0.001 && voice.peak < 0.95, `${voice.piece} is silent or clipping: ${voice.peak}`);
      assert.equal(voice.voices, 0);
    }
    assert.equal(new Set(audio.results.map((voice) => voice.fingerprint.toFixed(5))).size, 6);
    assert.equal(audio.canceledVoices, 0);
    assert.ok(audio.canceledPeak < 0.0001);
    const wav = Buffer.alloc(44 + audio.samples.length * 2);
    wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(44100, 24); wav.writeUInt32LE(88200, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
    wav.write("data", 36); wav.writeUInt32LE(wav.length - 44, 40);
    audio.samples.forEach((sample, i) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + i * 2));
    writeFileSync("test-results/space-audio-six-pieces.wav", wav);
    console.log("PASS: six distinct rendered sci-fi sound sequences, bounded output, voice cleanup and canceled audio silence");
  }
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  await vite.close();
}
