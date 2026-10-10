import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { Chess } from 'chess.js';
import { enterMenu, chooseMode, launchPrepared, enterGame, openPanel, closePanel, returnToMenu } from './enter-game.mjs';
import { newModeSession } from '../src/mode-session.ts';
import { createVariant, encodeChallenge, decodeChallenge, rushPuzzle } from '../src/variants.ts';

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH || existsSync('/usr/bin/chromium') ? { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
let debugPage = null, debugErrors = [];

try {
  const context = await browser.newContext({ offline: true, viewport: { width: 1200, height: 850 } });
  const page = await context.newPage(), errors = [], externalRequests = [];
  debugPage = page; debugErrors = errors;
  const url = 'http://localhost:31469/modes-test';
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url()) && request.url() !== url) externalRequests.push(request.url()); });
  await page.addInitScript(() => {
    localStorage.setItem('special-chess-reduced', 'true');
    window.WebSocket = class { constructor() { throw Error('Offline mode attempted WebSocket'); } };
  });
  await page.route(url, route => route.fulfill({ contentType: 'text/html', body: readFileSync('offline/Special-Chess-Offline.html', 'utf8') }));
  await page.goto(url);
  mkdirSync('test-results', { recursive: true });

  async function openBoard() {
    await closePanel(page);
    if (!await page.locator('#board-details').evaluate(element => element.open)) await page.locator('#board-details summary').click();
  }
  async function move(from, to) {
    await openBoard();
    await page.locator(`[data-square="${from}"]`).click();
    await page.locator(`[data-square="${to}"]`).click();
    await page.locator('#skip').click();
  }
  async function saved() { return page.evaluate(() => JSON.parse(localStorage.getItem('special-chess-offline-game'))); }
  async function seed(id, initialFen, history = [], options = {}, saveOptions = {}) {
    const session = { ...newModeSession(id, { seed: 12345 }, 'w'), ...options };
    // Pause the old Rush clock before replacing its save: an interval can
    // otherwise rewrite this fixture while reload navigation is starting.
    if (await page.locator('#game-shell').isVisible()) await openPanel(page, 'pause');
    await page.evaluate(({ initialFen, history, session, saveOptions }) => localStorage.setItem('special-chess-offline-game', JSON.stringify({
      mode: 'local', specialDuel: false, humanColor: 'w', initialFen, history,
      matchId: `mode-${session.id}-${Date.now()}`, activeVariant: session, ...saveOptions,
    })), { initialFen, history, session, saveOptions });
    await page.reload(); await enterGame(page);
    const restored = (await saved()).activeVariant;
    assert.equal(restored.id, id);
    assert.equal(restored.rushFailures, session.rushFailures);
    assert.equal(restored.rushSolved, session.rushSolved);
  }
  async function setup(id) {
    await chooseMode(page, id);
    assert.equal(await page.locator('#title-screen').getAttribute('data-menu-view'), 'setup');
    if (id !== 'rush') await page.locator('#special-opponent').selectOption('local');
    await page.locator('#variant-seed').fill('12345');
    await page.locator('#variant-seed').dispatchEvent('change');
    await page.locator('#variant-seed').press('Tab');
  }
  async function verifyViewport(label) {
    for (const viewport of [{ width: 1200, height: 850 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight + 1), false, `${label} stays within viewport ${viewport.width}`);
      await page.screenshot({ path: `test-results/modes-${label}-${viewport.width}.png` });
    }
    await page.setViewportSize({ width: 1200, height: 850 });
  }
  async function noStockGraphics() {
    const stock = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const matches = [];
      while (walker.nextNode()) {
        const node = walker.currentNode, parent = node.parentElement;
        if (!parent || !parent.getClientRects().length || ['SCRIPT', 'STYLE'].includes(parent.tagName)) continue;
        if (/[\p{Extended_Pictographic}\u2654-\u265f\ufe0f]/u.test(node.textContent || '')) matches.push(node.textContent);
      }
      return matches;
    });
    assert.deepEqual(stock, [], 'visible interface uses custom geometric graphics rather than stock emoji or chess glyphs');
  }

  await noStockGraphics();
  assert.ok(await page.locator('.iah-logo').count() > 0);
  const createButton = page.locator('#player-create-title');
  await createButton.dispatchEvent('pointerdown', { button: 0, clientX: 100, clientY: 100 });
  assert.equal(await createButton.getAttribute('class').then(value => value?.includes('iah-pressed')), true);
  assert.equal(await createButton.locator('.iah-tap').count(), 1);
  assert.ok(await createButton.evaluate(element => element.getAnimations({ subtree: true }).length) > 0, 'game buttons emit an animated geometric pulse');
  await createButton.dispatchEvent('pointerup', { button: 0 });
  assert.equal(await createButton.getAttribute('class').then(value => value?.includes('iah-pressed')), false);
  await page.locator('#player-create-title').click();
  await page.locator('#player-name').fill('Geometry Commander');
  await page.locator('[data-player-silhouette]').last().click();
  await page.locator('[data-player-crest]').last().click();
  await page.locator('[data-player-accent]').last().click();
  await page.locator('#player-save').click();
  if (await page.locator('#player-close').isVisible()) await page.locator('#player-close').click();
  await page.locator('#player-name').waitFor({ state: 'hidden' });
  await verifyViewport('title');
  await enterMenu(page); await page.locator('#lobby-battle-tab').click();
  assert.equal(await page.locator('[data-mode-category]').count(), 4);
  for (const group of ['duel', 'arena', 'tactics', 'economy']) {
    await page.locator(`[data-mode-category="${group}"]`).click();
    const cards = page.locator('[data-title-mode]:visible');
    assert.ok(await cards.count() >= 3);
    for (const card of await cards.all()) assert.equal(await card.getAttribute('data-mode-group'), group);
  }
  await verifyViewport('mode-categories');
  await noStockGraphics();

  await setup('draft');
  const draftBudgetBefore = await page.locator('#draft-budget').innerText();
  // Blurring a changed seed must not replace the roster button before its click.
  await page.locator('#variant-seed').fill('54321');
  await page.locator('[data-draft-remove="1"]').click(); // Replace the queen with a second knight.
  assert.notEqual(await page.locator('#draft-budget').innerText(), draftBudgetBefore, 'first roster click works immediately after editing the seed');
  await page.locator('[data-draft-add="n"]').click();
  assert.notEqual(await page.locator('#draft-budget').innerText(), draftBudgetBefore);
  assert.equal(await page.locator('[data-draft-remove]').count(), 8, 'the mandatory king cannot be removed');
  assert.equal(await page.locator('[data-draft-add="q"]').isDisabled(), true, 'full roster blocks additions');
  await verifyViewport('draft');
  await page.locator('#variant-copy').click();
  const draftCode = await page.locator('#variant-code').inputValue();
  const parsedDraft = decodeChallenge(draftCode);
  assert.equal(parsedDraft?.mode, 'draft');
  assert.equal(parsedDraft?.draft?.filter(piece => piece === 'n').length, 2);
  await launchPrepared(page);
  const draftSave = await saved();
  assert.equal(draftSave.activeVariant.options.draft.filter(piece => piece === 'n').length, 2);
  const draftedBoard = new Chess(draftSave.initialFen);
  assert.equal(draftedBoard.isCheck(), false);
  const draftedMove = draftedBoard.moves({ verbose: true })[0];
  await move(draftedMove.from, draftedMove.to);
  assert.equal(await page.locator('#moves .san').count(), 1);
  await page.locator('#undo').click();
  assert.equal(await page.locator('#moves .san').count(), 0);
  await returnToMenu(page);
  console.log('PASS: draft roster editing, equal-budget legal launch and undo');

  await setup('score');
  await page.locator('#variant-code').fill(encodeChallenge({ mode: 'control', seed: 8675309, arena: 'astral' }));
  await page.locator('#variant-import').click();
  assert.equal(await page.locator('#variant-seed').inputValue(), '8675309');
  await page.locator('#variant-code').fill('SC1-invalid-code');
  await page.locator('#variant-import').click();
  assert.equal(await page.locator('#variant-seed').inputValue(), '8675309', 'invalid challenge leaves the selected rules intact');
  assert.match(await page.locator('#variant-status').innerText(), /ไม่ถูกต้อง|ตรวจสอบ|ใช้ไม่ได้/);
  await launchPrepared(page);
  assert.equal((await saved()).activeVariant.id, 'control');
  assert.equal(await page.locator('#stage').getAttribute('data-arena'), 'astral');
  await returnToMenu(page);
  console.log('PASS: versioned challenge code imports mode, seed and arena');

  // Every mode is selectable through the title flow, and preserves its own save identity.
  for (const id of ['draft', 'score', 'control', 'mirror', 'rush', 'chaos']) {
    await setup(id);
    await launchPrepared(page);
    assert.equal((await saved()).activeVariant.id, id);
    assert.equal(await page.locator('#variant-hud').isVisible(), true);
    assert.ok((await page.locator('#variant-title').innerText()).trim());
    await noStockGraphics();
    await returnToMenu(page);
    console.log(`PASS: ${id} title launch and mode-specific HUD`);
  }

  // Legal saved positions let the browser exercise full results and transitions
  // without spending most of the suite waiting for quiet opening moves.
  const scoreFen = '7k/8/8/2q5/8/2R5/7P/K7 w - - 0 1';
  await seed('score', scoreFen);
  await move('c3', 'c5');
  assert.match(await page.locator('#variant-progress').innerText(), /9/);
  assert.match(await page.locator('#moves').innerText(), /Rxc5/);
  await page.locator('#undo').click();
  assert.equal(await page.locator('#moves .san').count(), 0);
  assert.doesNotMatch(await page.locator('#variant-progress').innerText(), /9/);
  await move('c3', 'c5');
  const scoreSave = await saved();
  await page.reload(); await enterGame(page);
  assert.deepEqual((await saved()).history, scoreSave.history);
  assert.match(await page.locator('#variant-progress').innerText(), /9/);
  await openPanel(page, 'history'); await page.locator('#replay-capture').click(); await closePanel(page); await page.locator('#skip').click();
  assert.deepEqual((await saved()).history, scoreSave.history);
  assert.match(await page.locator('#variant-progress').innerText(), /9/);

  function extend(game, totalPlies, filter = () => true) {
    const visited = new Set([game.fen().split(' ').slice(0, 4).join(' ')]);
    while (game.history().length < totalPlies) {
      const candidates = game.moves({ verbose: true }).filter(move => !move.captured && !move.promotion && filter(move, game));
      const offset = (game.history().length * 7) % Math.max(1, candidates.length);
      const rotated = [...candidates.slice(offset), ...candidates.slice(0, offset)];
      const next = rotated.find(move => {
        const probe = game.clone(); probe.move(move);
        return (!probe.isGameOver() || game.history().length + 1 === totalPlies) && !visited.has(probe.fen().split(' ').slice(0, 4).join(' '));
      });
      assert.ok(next, `can generate nonterminal legal ${game.variant} round`);
      game.move(next); visited.add(game.fen().split(' ').slice(0, 4).join(' '));
    }
    return game;
  }
  const scoreGame = createVariant('score', { seed: 12345 }, scoreFen); scoreGame.move('Rxc5'); extend(scoreGame, 24);
  assert.equal(scoreGame.outcome()?.reason, 'score-limit');
  const scoreHistory = scoreGame.history({ verbose: true }), lastScore = scoreHistory.at(-1);
  await seed('score', scoreFen, scoreHistory.slice(0, -1).map(move => move.san));
  await move(lastScore.from, lastScore.to);
  await page.locator('.battle-result').waitFor({ state: 'visible' });
  assert.match(await page.locator('.battle-result').innerText(), /12/);
  await page.locator('#undo').click();
  assert.equal(await page.locator('.battle-result').isVisible(), false);
  assert.equal(await page.locator('#moves .san').count(), 23);
  console.log('PASS: Score captures, persistence, replay, undo and 12-turn result');

  const controlFen = '7k/8/8/8/8/3R4/7P/K7 w - - 0 1';
  const controlGame = createVariant('control', { seed: 12345 }, controlFen); controlGame.move('Rd4');
  extend(controlGame, 10, (move, game) => move.color === 'b' || move.piece === 'k' || ['d4', 'e4', 'd5', 'e5'].includes(move.to));
  assert.equal(controlGame.outcome()?.reason, 'control-target');
  const controlHistory = controlGame.history({ verbose: true }), lastControl = controlHistory.at(-1);
  await seed('control', controlFen, controlHistory.slice(0, -1).map(move => move.san));
  assert.match(await page.locator('#variant-progress').innerText(), /4/);
  await move(lastControl.from, lastControl.to);
  await page.locator('.battle-result').waitFor({ state: 'visible' });
  assert.match(await page.locator('.battle-result').innerText(), /5/);
  await page.locator('#undo').click();
  assert.match(await page.locator('#variant-progress').innerText(), /4/);
  assert.equal(await page.locator('.battle-result').isVisible(), false);
  console.log('PASS: Control scores only after full rounds, reaches five and reverses on undo');

  const mirrorFen = '7k/8/5K2/6Q1/8/8/8/8 w - - 0 1';
  await seed('mirror', mirrorFen);
  await move('g5', 'g7');
  await page.locator('[data-result="continue"]').waitFor({ state: 'visible' });
  await page.locator('[data-result="continue"]').click();
  const mirrorRoundTwo = await saved();
  assert.equal(mirrorRoundTwo.activeVariant.options.round, 2);
  assert.equal(mirrorRoundTwo.humanColor, 'b');
  assert.equal(mirrorRoundTwo.activeVariant.mirrorWins.w, 1);
  assert.equal(mirrorRoundTwo.history.length, 0);
  assert.equal(await page.locator('#flat-board [data-square]').first().getAttribute('data-square'), 'h1');
  await page.reload(); await enterGame(page);
  assert.equal((await saved()).activeVariant.options.round, 2);
  assert.equal(await page.locator('#flat-board [data-square]').first().getAttribute('data-square'), 'h1', "resuming Mirror round two restores the original player black-side camera");
  await seed('mirror', mirrorFen, [], mirrorRoundTwo.activeVariant, { humanColor: 'b' });
  await move('g5', 'g7');
  await page.locator('.battle-result').waitFor({ state: 'visible' });
  assert.match(await page.locator('.battle-result').innerText(), /2|สอง/);
  await returnToMenu(page);
  console.log('PASS: Mirror round transition, owner color swap and persisted second round');

  await setup('rush'); await launchPrepared(page);
  let rushSave = await saved();
  const rushBoard = new Chess(rushSave.initialFen);
  const mate = rushBoard.moves({ verbose: true }).find(move => { const probe = new Chess(rushBoard.fen()); probe.move(move); return probe.isCheckmate(); });
  assert.ok(mate, 'the generated Rush puzzle has a legal mate in one');
  await move(mate.from, mate.to);
  await page.locator('#variant-next').waitFor({ state: 'visible' });
  assert.equal((await saved()).activeVariant.rushSolved, 0, 'solved puzzle remains undoable until advancing');
  await page.locator('#variant-next').click();
  rushSave = await saved();
  assert.equal(rushSave.activeVariant.rushSolved, 1);
  assert.equal(rushSave.activeVariant.rushIndex, 1);
  assert.equal(rushSave.history.length, 0);
  const pausedBefore = rushSave.activeVariant.rushRemaining;
  await openPanel(page, 'pause'); await page.waitForTimeout(600);
  assert.ok(Math.abs((await saved()).activeVariant.rushRemaining - pausedBefore) < 500, 'pause drawer stops the Rush timer');
  await closePanel(page);
  await page.waitForTimeout(1200);
  assert.ok((await saved()).activeVariant.rushRemaining < pausedBefore - 500, 'active Rush play consumes time');
  // A legal move can still fail the one-move objective. The third miss ends
  // the run, while its pending strike remains reversible until advancing.
  const missedPuzzle = rushPuzzle(12345, 1);
  await page.evaluate(() => localStorage.setItem('special-chess-rush-best', '1'));
  await seed('rush', missedPuzzle.fen, [], { rushIndex: 1, rushSolved: 4, rushFailures: 2, rushRemaining: 60000 }, { humanColor: missedPuzzle.side });
  const missedBoard = new Chess(missedPuzzle.fen);
  const nonmate = missedBoard.moves({ verbose: true }).find(move => {
    if (move.promotion) return false;
    const probe = new Chess(missedBoard.fen()); probe.move(move);
    return !probe.isCheckmate();
  });
  assert.ok(nonmate, 'Rush has a legal move that fails its mate-in-one objective');
  await move(nonmate.from, nonmate.to);
  await page.locator('.battle-result').waitFor({ state: 'visible' });
  assert.match(await page.locator('.battle-result h2').innerText(), /ลองโจทย์ถัดไป/);
  assert.match(await page.locator('.battle-result p').first().innerText(), /พลาด\s*3\s*\/\s*3/);
  assert.equal((await saved()).activeVariant.rushFailures, 2, 'pending third strike is recorded only when advancing');
  assert.match(await page.locator('#variant-next').innerText(), /เริ่ม Rush ใหม่/);
  assert.match(await page.locator('[data-result="continue"]').innerText(), /เริ่ม Puzzle Rush ใหม่/);
  await page.reload(); await enterGame(page);
  await page.locator('.battle-result').waitFor({ state: 'visible' });
  assert.equal((await saved()).activeVariant.rushFailures, 2, 'reloading a failed puzzle cannot duplicate its strike');
  await page.locator('[data-result="continue"]').click();
  const restartedRush = await saved();
  assert.equal(restartedRush.activeVariant.rushFailures, 0);
  assert.equal(restartedRush.activeVariant.rushSolved, 0);
  assert.equal(restartedRush.activeVariant.rushIndex, 0);
  assert.equal(restartedRush.history.length, 0);
  assert.ok(restartedRush.activeVariant.rushRemaining > 0);
  assert.equal(await page.evaluate(() => Number(localStorage.getItem('special-chess-rush-best'))), 4, 'ending a failed run retains its completed-puzzle best');
  console.log('PASS: legal Rush failure, pending third strike, reload deduplication, run restart and best preservation');
  const expiringPuzzle = rushPuzzle(12345, 1);
  await seed('rush', expiringPuzzle.fen, [], { rushIndex: 1, rushSolved: 1, rushRemaining: 500 }, { humanColor: expiringPuzzle.side });
  await page.locator('.battle-result').waitFor({ state: 'visible', timeout: 10000 });
  assert.equal((await saved()).activeVariant.rushRemaining, 0);
  console.log('PASS: Rush mate, explicit next, pause timer and time expiry');

  const chaosFen = '7k/8/8/8/3p4/2N5/7P/K7 w - - 0 1';
  await seed('chaos', chaosFen);
  assert.match(await page.locator('#variant-forecast').innerText(), /ม้า/);
  await move('a1', 'a2'); await move('h8', 'h7');
  assert.match(await page.locator('#variant-progress').innerText(), /ม้า/);
  await move('c3', 'd4');
  assert.match(await page.locator('#moves').innerText(), /C:Nc3xd4/);
  const chaosSave = await saved();
  await page.reload(); await enterGame(page);
  assert.deepEqual((await saved()).history, chaosSave.history);
  await openPanel(page, 'history'); await page.locator('#replay-capture').click(); await closePanel(page); await page.locator('#skip').click();
  assert.deepEqual((await saved()).history, chaosSave.history);
  await page.locator('#undo').click();
  assert.equal(await page.locator('#moves .san').count(), 2);
  await move('c3', 'd4');
  await page.locator('#board-details summary').click();
  await verifyViewport('chaos-battle');
  await noStockGraphics();
  await returnToMenu(page);
  for (const depth of ['1', '2', '3']) {
    await setup('score');
    await page.locator('#special-opponent').selectOption('bot');
    await page.locator('#launch-side').selectOption('w');
    await page.locator('#launch-depth').selectOption(depth);
    await launchPrepared(page);
    await move('e2', 'e4');
    await page.waitForFunction(() => document.querySelectorAll('#moves .san').length === 2, undefined, { timeout: 30000 });
    await page.locator('#skip').click();
    assert.equal((await saved()).activeVariant.id, 'score');
    assert.equal(await page.locator('#ultimate-hud').isVisible(), false, 'variant bot replies preserve mode isolation');
    await returnToMenu(page);
    console.log(`PASS: variant worker runs bot difficulty ${depth} and preserves Score Clash state`);
  }
  console.log('PASS: all six board modes, categorized responsive geometric UI, animated game buttons, guest commander creation, draft budget/editing, challenge sharing/import, actual captures and objective results, save/reload/undo/replay, Mirror color-swap rounds, Rush puzzles/pause/time expiry, forecasted Chaos movement and all three variant bot levels, with no external requests');
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
} catch (error) {
  if (debugPage) {
    console.error('Browser page errors:', debugErrors);
    console.error(await debugPage.evaluate(() => ({
      view: document.querySelector('#title-screen')?.getAttribute('data-menu-view'),
      draftBudget: document.querySelector('#draft-budget')?.textContent,
      draftError: document.querySelector('#draft-error')?.textContent,
      variant: document.querySelector('#variant-progress')?.textContent,
      notice: document.querySelector('#notice')?.textContent,
      saved: JSON.parse(localStorage.getItem('special-chess-offline-game') || 'null'),
    })).catch(() => null));
    await debugPage.screenshot({ path: 'test-results/modes-failure.png' }).catch(() => {});
  }
  throw error;
} finally { await browser.close(); }
