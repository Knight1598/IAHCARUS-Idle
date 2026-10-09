import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { enterMenu, chooseMode, launchPrepared, enterGame, openPanel, closePanel, returnToMenu } from './enter-game.mjs';

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH || existsSync('/usr/bin/chromium') ? { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
try {
  const context = await browser.newContext({ offline: true, viewport: { width: 1200, height: 850 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const url = 'http://localhost:31468/special-test';
  await page.route(url, route => route.fulfill({ contentType: 'text/html', body: readFileSync('offline/Special-Chess-Offline.html', 'utf8') }));
  await page.goto(url); await chooseMode(page, 'special');
  assert.equal(await page.locator('#skills-slot .skill-loadout-card').count(), 6);
  await page.locator('#special-opponent').selectOption('local');
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/special-duel-brief.png' });
  await launchPrepared(page);
  assert.match(await page.locator('#mode-tag').innerText(), /SPECIAL DUEL/);
  assert.equal(await page.locator('#ultimate-hud').isVisible(), true);
  assert.equal(await page.locator('#ultimate-white .charged').count(), 3);
  await page.evaluate(() => localStorage.setItem('special-chess-offline-game', JSON.stringify({
    mode: 'local', specialDuel: true, humanColor: 'w', initialFen: '7k/8/8/2r5/8/2N5/7P/K7 w - - 0 1', history: [], matchId: 'special-test',
  })));
  await page.reload(); await enterGame(page);
  if (!await page.locator('#board-details').getAttribute('open').then(x => x !== null)) await page.locator('#board-details summary').click();
  await page.locator('[data-square="c3"]').click();
  assert.equal(await page.locator('[data-square="c5"]').getAttribute('class').then(s => s.includes('legal')), false);
  const before = await page.evaluate(() => localStorage.getItem('special-chess-offline-game'));
  await page.locator('#ultimate-arm').click();
  await page.locator('[data-square="c5"]').hover();
  assert.match(await page.locator('#tactical-readout span').innerText(), /กิน.*C5/);
  assert.equal(await page.locator('[data-square="c5"]').getAttribute('class').then(s => s.includes('capture')), true);
  await page.locator('[data-square="c5"]').click();
  assert.equal(await page.locator('#moves .san').count(), 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('special-chess-offline-game')), before);
  assert.equal(await page.locator('#ultimate-confirm').isVisible(), true);
  await page.locator('#ultimate-arm').click(); // cancel; no charge spent
  assert.equal(await page.locator('#ultimate-confirm').isVisible(), false);
  assert.equal(await page.locator('#ultimate-white .charged').count(), 3);
  await page.locator('#ultimate-arm').click(); await page.locator('[data-square="c5"]').click();
  for (const viewport of [{ width: 1200, height: 850 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    const box = await page.locator('#ultimate-hud').boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= viewport.width && box.y + box.height < viewport.height - 70);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight + 1), false);
    await page.screenshot({ path: `test-results/special-duel-${viewport.width}.png` });
  }
  await page.setViewportSize({ width: 1200, height: 850 });
  await page.locator('#board-details summary').click();
  await page.locator('#ultimate-confirm').click();
  assert.equal(await page.locator('#stage').getAttribute('data-ultimate'), 'n');
  await page.waitForTimeout(220);
  await page.screenshot({ path: 'test-results/special-ultimate-release.png' });
  await page.locator('#skip').click();
  assert.equal(await page.locator('#moves .san').count(), 1);
  assert.match(await page.locator('#moves').innerText(), /U:Nc3xc5/);
  assert.equal(await page.locator('#ultimate-white .charged').count(), 2);
  const after = await page.evaluate(() => localStorage.getItem('special-chess-offline-game'));
  await page.reload(); await enterGame(page);
  assert.equal(await page.locator('#ultimate-white .charged').count(), 2);
  assert.equal(await page.evaluate(() => localStorage.getItem('special-chess-offline-game')), after);
  await page.locator('#undo').click();
  assert.equal(await page.locator('#ultimate-white .charged').count(), 3);
  assert.equal(await page.locator('#moves .san').count(), 0);
  await page.locator('#ultimate-help').click(); await page.locator('#ultimate-enemy').selectOption('c5');
  assert.match(await page.locator('#ultimate-enemy-note').innerText(), /หักมุมทะลวง/);
  await page.locator('#ultimate-guide-close').click();
  assert.equal(await page.locator('#moves .san').count(), 0);
  // Replay reads special snapshots without trying to submit an illegal standard move.
  if (!await page.locator('#board-details').getAttribute('open').then(x => x !== null)) await page.locator('#board-details summary').click(); await page.locator('[data-square="c3"]').click();
  await page.locator('#ultimate-arm').click(); await page.locator('[data-square="c5"]').click(); await page.locator('#ultimate-confirm').click(); await page.locator('#skip').click();
  await openPanel(page, 'history'); await page.locator('#replay-capture').click(); await closePanel(page); await page.locator('#skip').click();
  assert.equal(await page.locator('#moves .san').count(), 1);
  assert.equal(await page.locator('#ultimate-white .charged').count(), 2);
  await page.evaluate(() => localStorage.setItem('special-chess-offline-game', JSON.stringify({ mode: 'local', specialDuel: true, humanColor: 'w', initialFen: '7k/7B/6K1/8/2N5/8/8/8 w - - 0 1', history: [], matchId: 'special-mate-test' })));
  await page.reload(); await enterGame(page);
  await page.locator('#board-details summary').click(); await page.locator('[data-square="c4"]').click(); await page.locator('#ultimate-arm').click();
  await page.locator('[data-square="f7"]').click(); await page.locator('#ultimate-confirm').click(); await page.locator('#skip').click();
  await page.locator('[data-result="rematch"]').waitFor({ state: 'visible' });
  assert.match(await page.locator('#status').innerText(), /รุกฆาต/);
  await page.reload(); await enterGame(page);
  await page.locator('[data-result="rematch"]').waitFor({ state: 'visible' });
  assert.match(await page.locator('#moves').innerText(), /U:Nc4-f7#/);
  await page.locator('[data-result="rematch"]').click();
  assert.equal(await page.locator('#moves .san').count(), 0); assert.equal(await page.locator('#ultimate-white .charged').count(), 3);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('special-chess-offline-game')).humanColor), 'b');
  assert.equal(await page.locator('#flat-board [data-square]').first().getAttribute('data-square'), 'h1');
  assert.equal(await page.locator('#black-label').innerText(), 'ผู้เล่น 1');
  assert.equal(await page.locator('#white-label').innerText(), 'ผู้เล่น 2');
  await returnToMenu(page); await chooseMode(page, 'bot'); await launchPrepared(page);
  assert.equal(await page.locator('#ultimate-hud').isVisible(), false);
  console.log('PASS: local skills, mobile controls, persistence, replay and mode isolation');
  // A bot special match runs in its inline worker and returns a legal response.
  await returnToMenu(page); await chooseMode(page, 'special');
  await page.locator('#special-opponent').selectOption('bot'); await page.locator('#launch-side').selectOption('w'); await page.locator('#launch-depth').selectOption('1'); await launchPrepared(page);
  await openPanel(page, 'settings'); await page.locator('#reduced').check(); await closePanel(page);
  if (!await page.locator('#board-details').getAttribute('open').then(x => x !== null)) await page.locator('#board-details summary').click(); await page.locator('[data-square="e2"]').click(); await page.locator('[data-square="e4"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#moves .san').length === 2, undefined, { timeout: 15000 });
  assert.equal(await page.locator('#ultimate-black .charged').count(), 3);
  assert.deepEqual(errors, []);
  console.log('PASS: six skill cards, separate local/bot mode, queen-range knight reticles, preview/cancel/confirm, all viewports, ultimate animation, save/reload/undo, enemy inspection and replay without state changes, standard mode isolation and actual worker reply');
} finally { await browser.close(); }
