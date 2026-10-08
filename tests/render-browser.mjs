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
        res.end('<html><head><link rel="icon" href="data:,"></head><body style="margin:0"><div id="stage" style="width:900px;height:700px;position:relative"></div></body></html>');
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
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
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
    // Coordinates share one atlas/batch; all four luminous edge rails share one mesh.
    assert.ok(after.calls <= 92, `Orbit still draws ${after.calls} batches`);
    assert.ok(initial.geometries <= 80, `Board uses ${initial.geometries} geometries`);
    await page.evaluate(() => {
      for (let i = 0; i < 5; i++) fixture.renderBoard(new fixtureChess());
    });
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => fixture.renderer.info.memory.geometries), initial.geometries);
    const controlZones = await page.evaluate(async () => {
      const { VariantChess } = await import('/src/variants.ts');
      for (let i = 0; i < 8; i++) fixture.renderBoard(new VariantChess('control', { seed: 1 }));
      const zone = fixture.groundAuras.children.find(node => node.userData.role === 'control-zones');
      const result = { batches: fixture.groundAuras.children.filter(node => node.userData.role === 'control-zones').length, count: zone?.count, instances: zone?.instanceColor?.count };
      fixture.renderBoard(new fixtureChess());
      return result;
    });
    assert.deepEqual(controlZones, { batches: 1, count: 4, instances: 4 }, 'the objective has four colored tiles in one reusable draw batch');
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => fixture.renderer.info.memory.geometries), initial.geometries, 'leaving Control disposes every objective geometry');
    const hoverPoint = await page.evaluate(async () => {
      const { coords } = await import('/src/scene.ts');
      window.tacticalBoard = new fixtureChess('7k/8/8/3r4/8/2N5/8/K7 w - - 0 1');
      fixture.renderBoard(tacticalBoard); fixture.select(tacticalBoard, 'c3');
      const targets = fixture.markers.children.filter(o => o.isInstancedMesh);
      if (targets.length !== 2 || targets.find(o => o.userData.role === 'capture-targets').userData.squares.join() !== 'd5') throw Error('Capture markers must be distinct and batched');
      const point = coords('d5').project(fixture.camera), rect = fixture.renderer.domElement.getBoundingClientRect();
      return { x: rect.left + (point.x + 1) / 2 * rect.width, y: rect.top + (1 - point.y) / 2 * rect.height };
    });
    await page.mouse.move(hoverPoint.x, hoverPoint.y);
    await page.waitForFunction(() => document.querySelector('#stage').dataset.previewTarget === 'd5');
    assert.equal(await page.evaluate(() => tacticalBoard.history().length), 0);
    assert.ok(await page.evaluate(() => fixture.aim.children.some(o => o.userData.role === 'move-preview')));
    await page.screenshot({ path: 'test-results/tactical-reticle.png' });
    await page.mouse.move(960, 730);
    await page.waitForFunction(() => !document.querySelector('#stage').dataset.previewTarget);
    assert.equal(await page.evaluate(() => fixture.aim.children.length), 0);
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => { fixture.select(tacticalBoard, 'c3'); fixture.previewTarget('d5'); });
      await page.waitForTimeout(40);
      await page.evaluate(() => { fixture.select(tacticalBoard, null); fixture.renderBoard(new fixtureChess()); });
    }
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => fixture.renderer.info.memory.geometries), initial.geometries, 'target previews must release transient geometry');
    console.log('PASS: procedural board plates, batched coordinates/reticles, real 3D hover capture preview without moving, leave cleanup and repeated selection memory');
    await page.evaluate(async () => {
      const { SpecialChess } = await import('/src/special.ts');
      const { analyzeMove } = await import('/shared/events.js');
      const board = new SpecialChess('7k/8/8/2r5/8/2N5/7P/K7 w - - 0 1');
      fixture.renderBoard(board); board.armed = 'c3'; fixture.select(board, 'c3'); fixture.previewTarget('c5');
      const route = fixture.aim.children.find(o => o.userData.role === 'move-preview');
      if (route.geometry.attributes.position.count !== 2) throw Error('Knight ultimate must preview a straight queen line');
      if (!fixture.groundAuras.children.some(o => o.userData.role === 'ultimate-ready')) throw Error('Ready pieces need visible badges');
      fixture.showUltimateThreats(['d4', 'e3']); fixture.renderBoard(board);
      if (fixture.aim.children.length) throw Error('Threat geometry survived board rebuild');
      const before = new fixtureChess(board.fen());
      const move = board.move({ from: 'c3', to: 'c5', ultimate: true });
      fixture.play(before, board, move, analyzeMove(before, board, move));
      if (!fixture.animation.dramatic || document.querySelector('#stage').dataset.ultimate !== 'n') throw Error('Ultimate did not trigger its cinematic');
      if (fixture.animation.vfx.chargeGroup.children.length < 2) throw Error('Ultimate charge crown/seal missing');
      fixture.finish();
      if (fixture.fx.children.length || document.querySelector('#stage').dataset.ultimate) throw Error('Ultimate resources survived its animation');
      fixture.renderBoard(new fixtureChess());
    });
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => fixture.renderer.info.memory.geometries), initial.geometries, 'ultimate badges, charge crown and threat inspection must release GPU geometry');
    console.log('PASS: ultimate queen-line preview, ready badges, cinematic charge crown, threat rebuild and GPU cleanup');
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
      const now = performance.now();
      fixture.animation.duration = 10000;
      fixture.animation.start = now - 7400;
      fixture.frame(now); fixture.setPaused(true);
    });
    assert.equal(await page.evaluate(() => fixture.animation.died), true);
    assert.equal(await page.evaluate(() => fixture.fx.children.filter((o) => o.isInstancedMesh).length), 1);
    await page.evaluate(() => fixture.finish());
    await page.evaluate(() => { fixture.renderBoard(new fixtureChess()); fixture.setPaused(false); });
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
      const now = performance.now();
      fixture.animation.start = now - 1000;
      fixture.frame(now); fixture.setPaused(true);
    });
    await page.waitForFunction(() => document.querySelector("#stage").dataset.movePhase === "charge");
    const beforePause = await page.evaluate(() => {
      // Restart the pause window in this call; software rendering may delay the
      // earlier frame/waitForFunction before the timestamp can be sampled.
      fixture.setPaused(false); fixture.setPaused(true);
      return { start: fixture.animation.start, now: performance.now() };
    });
    await page.waitForTimeout(200);
    const afterPause = await page.evaluate(() => {
      fixture.setPaused(false);
      const state = { start: fixture.animation.start, now: performance.now() };
      fixture.setPaused(true); return state;
    });
    assert.ok(afterPause.start - beforePause.start >= 190, "paused combat must preserve its animation time");
    assert.ok(Math.abs((afterPause.now - beforePause.now) - (afterPause.start - beforePause.start)) < 30, "resuming must not jump through the paused portion");
    assert.equal(await page.evaluate(() => fixture.animation.object.position.distanceTo(fixture.animation.from)), 0);
    assert.equal(await page.evaluate(() => fixture.animation.lock.name), "destination-lock");
    await page.evaluate(() => {
      const now = performance.now(); fixture.setPaused(false);
      fixture.animation.start = now - 5000; fixture.frame(now); fixture.setPaused(true);
    });
    await page.waitForFunction(() => document.querySelector("#stage").dataset.movePhase === "slowmo");
    assert.equal(await page.evaluate(() => launchCount), 1);
    assert.equal(await page.evaluate(() => contactCount), 0);
    await page.evaluate(() => fixture.setPaused(true));
    mkdirSync("test-results", { recursive: true });
    await page.locator("#stage").screenshot({ path: "test-results/space-move-slowmo.png" });
    await page.evaluate(() => {
      const now = performance.now(); fixture.setPaused(false);
      fixture.animation.start = now - 6500; fixture.frame(now); fixture.setPaused(true);
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
        const now = performance.now(); fixture.setPaused(false);
        fixture.animation.start = now - fixture.animation.duration * 0.7;
        fixture.frame(now); fixture.setPaused(true); fixture.finish();
        if (fixture.groundScars.children.length > 4) throw Error("Unbounded floor fractures");
      }
      fixture.reduced = true; fixture.renderBoard(new fixtureChess());
      if (fixture.groundAuras.children.length) throw Error("Reduced effects left ambient runes");
      fixture.reduced = false; fixture.renderBoard(new fixtureChess());
      if (fixture.groundAuras.children.length !== 2) throw Error("Ground auras must use two batches");
      fixture.setPaused(false);
    });
    const auraTime = await page.evaluate(() => fixture.groundAuras.children[0].material.uniforms.uTime.value);
    await page.waitForTimeout(250);
    assert.ok(await page.evaluate(() => fixture.groundAuras.children[0].material.uniforms.uTime.value) > auraTime);
    await page.evaluate(() => fixture.setPaused(true));
    console.log("PASS: normal moves charge/lock/slow approach/contact once, all six attack identities, bounded floor fractures, idle aura pulse, cancellation and reduced-effects cleanup");
    const executions = await page.evaluate(async () => {
      const { training } = await import("/src/training.ts");
      const { analyzeMove } = await import("/shared/events.js");
      const memory = [];
      fixture.cinematic = false; fixture.reduced = false;
      for (let cycle = 0; cycle < 3; cycle++) {
        for (const key of ["pawn", "knight", "bishop", "rook", "queen", "king"]) {
          const sample = training[key], before = new fixtureChess(sample.fen), after = new fixtureChess(sample.fen);
          const move = after.move({ from: sample.from, to: sample.to });
          let impact = 0, death = 0;
          fixture.onImpact = () => impact++; fixture.onDeath = () => death++;
          fixture.setAppearances({ [move.from]: "ember", [move.to]: "frost" }, { [move.to]: "ember" });
          fixture.play(before, after, move, analyzeMove(before, after, move));
          const animation = fixture.animation;
          if (animation.avatar.name !== `avatar-${move.piece}-ember`) throw Error("Lost summoned avatar identity");
          function frame(t) {
            const now = performance.now(); fixture.setPaused(false);
            animation.duration = 100000; animation.start = now - t * animation.duration;
            fixture.frame(now); fixture.setPaused(true);
          }
          frame(0.4);
          if (animation.object.position.distanceTo(animation.to) < 0.7) throw Error("Attacker overlaps during windup");
          if (impact || death) throw Error("Execution contacts before its strike");
          frame(0.6);
          if (impact !== 1 || death !== 0 || !animation.victim.visible) throw Error("Defender vanished at contact");
          frame(0.75); frame(0.76);
          if (impact !== 1 || death !== 1) throw Error("Execution callbacks are repeated or missing");
          frame(0.95);
          if (animation.object.position.distanceTo(animation.to) > 0.01) throw Error("Attacker failed to occupy final square");
          fixture.finish();
          if (fixture.fx.children.length) throw Error("Finisher left temporary FX");
          const piece = fixture.pieces.children.find(piece => piece.userData.square === move.to);
          if (piece.userData.skin !== "ember" || piece.children.some(mesh => mesh.material.opacity !== 1)) throw Error("Capture lost skin or damaged cached material");
        }
        fixture.setAppearances({}); fixture.renderBoard(new fixtureChess());
        fixture.renderer.render(fixture.scene, fixture.camera);
        memory.push(fixture.renderer.info.memory.geometries);
      }
      const host = document.createElement("div"); host.style.cssText = "width:900px;height:700px"; document.body.append(host);
      const canvas = fixture.renderer.domElement, context = fixture.renderer.getContext();
      fixture.setShowcase(host); fixture.showcasePiece("b1"); fixture.frame(performance.now());
      if (canvas.parentElement !== host || fixture.renderer.getContext() !== context) throw Error("Lobby created or lost WebGL context");
      fixture.setShowcase(null); host.remove();
      if (canvas.parentElement.id !== "stage") throw Error("Canvas did not return to arena");
      return memory;
    });
    assert.equal(new Set(executions).size, 1, `Finisher geometry leaks: ${executions}`);
    console.log("PASS: all six staged executions, living defender at contact, once-only impact/death, skin continuity, replayed FX cleanup and single-context lobby; geometries", executions);
    const fields = await page.evaluate(async () => {
      const { arenaIds } = await import("/src/arenas.ts");
      const THREE = await import("/node_modules/three/build/three.module.js");
      fixture.setPaused(true); fixture.renderBoard(new fixtureChess()); fixture.resetView();
      const memories = [], families = [], themes = [];
      for (let cycle = 0; cycle < 3; cycle++) {
        for (const id of arenaIds) {
          const camera = fixture.camera.position.toArray(); fixture.setArena(id);
          if (JSON.stringify(camera) !== JSON.stringify(fixture.camera.position.toArray())) throw Error("Field selection moved camera");
          if (fixture.environment.root.children.length !== 4) throw Error("Unbatched arena ornaments");
          fixture.environment.update(10, false, false); fixture.environment.react(new THREE.Vector3(1, 0, 2));
          fixture.environment.update(10.2, false, false);
          const field = fixture.environment.root.children.find((o) => o.name.startsWith("arena-field"));
          if (field.material.uniforms.uStrength.value < 0.8) throw Error("Missing field reaction");
          if (cycle === 0) {
            families.push(field.material.uniforms.uFamily.value);
            themes.push(fixture.board.children[0].material.color.getHex());
          }
          fixture.renderer.render(fixture.scene, fixture.camera);
          if (fixture.renderer.info.render.calls > 106) throw Error("Field exceeds orbit budget");
        }
        memories.push(fixture.renderer.info.memory.geometries);
      }
      fixture.environment.update(12, true, false);
      const particles = fixture.environment.root.children.find((o) => o.isPoints);
      if (particles.geometry.drawRange.count !== 32) throw Error("Low quality does not bound field particles");
      fixture.reduced = true; fixture.renderBoard(new fixtureChess()); fixture.frame(performance.now());
      fixture.environment.update(13, true, true);
      const field = fixture.environment.root.children.find((o) => o.name.startsWith("arena-field"));
      if (particles.visible || field.material.uniforms.uTime.value || field.material.uniforms.uStrength.value) throw Error("Reduced effects left animated field");
      fixture.reduced = false; fixture.setArena("citadel"); fixture.setQuality("auto");
      return { memories, families, themes };
    });
    assert.equal(new Set(fields.memories).size, 1, `Arena geometry leaks: ${fields.memories}`);
    assert.equal(new Set(fields.families).size, 8);
    assert.equal(new Set(fields.themes).size, 8);
    for (const id of ["citadel", "ember", "frost", "astral", "storm", "grove", "reactor", "eclipse"]) {
      await page.evaluate((id) => {
        fixture.setArena(id); fixture.renderBoard(new fixtureChess()); fixture.resetView(); fixture.setPaused(false);
        fixture.frame(performance.now()); fixture.setPaused(true);
      }, id);
      await page.locator("#stage").screenshot({ path: `test-results/arena-${id}.png` });
    }
    const poses = [], combatWork = [];
    for (const aspect of [1.28, 0.48]) {
      await page.evaluate((aspect) => {
        document.querySelector("#stage").style.width = aspect < 1 ? "390px" : "900px";
        document.querySelector("#stage").style.height = aspect < 1 ? "810px" : "700px";
      }, aspect);
      await page.waitForTimeout(100);
      for (const key of ["pawn", "knight", "bishop", "rook", "queen", "king"]) {
        const pose = await page.evaluate(async (key) => {
          const { training } = await import("/src/training.ts");
          const { analyzeMove } = await import("/shared/events.js");
          const THREE = await import("/node_modules/three/build/three.module.js");
          const sample = training[key], before = new fixtureChess(sample.fen), after = new fixtureChess(sample.fen);
          const move = after.move({ from: sample.from, to: sample.to });
          fixture.cinematic = true; fixture.cinematicScope = "all"; fixture.resetPacing(); fixture.setArena("astral");
          fixture.setAppearances({ [move.from]: "ember", [move.to]: "frost" }, { [move.to]: "ember" });
          fixture.play(before, after, move, analyzeMove(before, after, move));
          const a = fixture.animation;
          if (!a.dramatic || !a.defenderAvatar || !a.defenderAura || !a.avatarAura) throw Error("Missing combat pair or auras");
          const saved = a.camera.toArray();
          const drawCalls = [];
          for (const t of [0.15, 0.3, 0.42, 0.54, 0.59, 0.69]) {
            const now = performance.now(); fixture.setPaused(false); a.duration = 100000; a.start = now - t * a.duration;
            fixture.frame(now); fixture.setPaused(true); fixture.camera.updateMatrixWorld();
            fixture.renderer.render(fixture.scene, fixture.camera);
            drawCalls.push(fixture.renderer.info.render.calls);
            if (fixture.renderer.info.render.calls > 180) throw Error(`Unbounded ${key} combat draw calls`);
            if (a.vfx.group.children.length !== 5) throw Error("Combat effects lost their shared batches");
            for (const actor of [a.avatar, a.defenderAvatar, a.avatarAura, a.defenderAura]) {
              const box = new THREE.Box3().setFromObject(actor);
              for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
                const p = new THREE.Vector3(x, y, z).project(fixture.camera);
                if (Math.abs(p.x) > 0.82 || Math.abs(p.y) > 0.82) throw Error(`Clipped ${key} at ${t}: ${p.toArray()}`);
              }
            }
          }
          const now = performance.now(); fixture.setPaused(false); a.start = now - 0.54 * a.duration; fixture.frame(now); fixture.setPaused(true);
          const signature = a.avatar.userData.arms.map((arm) => arm.rotation.toArray().slice(0, 3));
          window.combatSavedCamera = saved;
          return { signature: JSON.stringify(signature), drawCalls };
        }, key);
        poses.push(pose.signature); combatWork.push(...pose.drawCalls);
        await page.locator("#stage").screenshot({ path: `test-results/combat-${key}-${aspect < 1 ? "portrait" : "wide"}.png` });
        await page.evaluate(() => {
          const a = fixture.animation, now = performance.now(); fixture.setPaused(false);
          a.start = now - .6 * a.duration; fixture.frame(now); fixture.setPaused(true);
          fixture.renderer.render(fixture.scene, fixture.camera);
        });
        await page.locator("#stage").screenshot({ path: `test-results/combat-${key}-impact-${aspect < 1 ? "portrait" : "wide"}.png` });
        await page.evaluate(() => {
          fixture.finish();
          if (JSON.stringify(fixture.camera.position.toArray()) !== JSON.stringify(combatSavedCamera)) throw Error("Combat did not restore camera");
          if (fixture.fx.children.length) throw Error("Combat pair left summons");
        });
      }
    }
    assert.equal(new Set(poses.slice(0, 6)).size, 6, "Classes share their arm poses");
    console.log("Combat draw calls:", Math.min(...combatWork), "–", Math.max(...combatWork));
    console.log("PASS: eight distinct fields, stable geometry after 24 switches, field reactions/Low/reduced controls, and six full combat pairs framed on wide/portrait screens");
    await page.evaluate(async () => {
      const { analyzeMove } = await import("/shared/events.js");
      const THREE = await import("/node_modules/three/build/three.module.js");
      const before = new fixtureChess("7k/8/8/3pP3/8/8/8/K7 w - d6 0 1"), after = new fixtureChess(before.fen());
      const move = after.move("exd6"); fixture.resetPacing();
      fixture.play(before, after, move, analyzeMove(before, after, move));
      const a = fixture.animation, now = performance.now(); fixture.setPaused(false);
      a.duration = 100000; a.start = now - .42 * a.duration; fixture.frame(now); fixture.setPaused(true);
      const direction = a.defenderAvatar.position.clone().sub(a.avatar.position); direction.y = 0; direction.normalize();
      const facing = new THREE.Vector3(-Math.sin(a.avatar.rotation.y), 0, -Math.cos(a.avatar.rotation.y));
      if (direction.distanceTo(facing) > .00001) throw Error("En passant fighter faces the empty destination");
      const beamDirection = a.vfx.group.children[0].material.uniforms.uForward.value;
      if (direction.distanceTo(beamDirection) > .00001) throw Error("En passant attack misses the defender");
      fixture.finish();
      if (fixture.pieces.children.some((piece) => piece.userData.square === "d5") ||
          !fixture.pieces.children.some((piece) => piece.userData.square === "d6" && piece.userData.color === "w"))
        throw Error("En passant spectacle changed the legal board");
    });
    console.log("PASS: en passant fighters and energy aim at the actual defender while legal occupation stays on d6");
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
