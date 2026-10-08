import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { enterMenu, chooseMode, launchPrepared, openPanel, closePanel } from './enter-game.mjs';

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH || existsSync('/usr/bin/chromium') ? { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
try {
  const context = await browser.newContext({ offline: true, viewport: { width: 1200, height: 850 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const url = 'http://localhost:31468/tactics-test';
  await page.route(url, route => route.fulfill({ contentType: 'text/html', body: readFileSync('offline/Special-Chess-Offline.html', 'utf8') }));
  await page.goto(url);
  await enterMenu(page);
  assert.match(await page.locator('.menu-page[data-menu-view="menu"] > h1').innerText(), /ทุกตาเดิน/);
  assert.equal(await page.locator('#commander-level').innerText(), 'TACTICAL CHESS');
  assert.equal(await page.locator('#title-xp-bar').isVisible(), false);
  assert.equal(await page.evaluate(() => !!(document.querySelector('#lobby-battle-tab').compareDocumentPosition(document.querySelector('#daily-enter')) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/board-duel-menu.png' });
  await chooseMode(page, 'training');
  await page.locator('#launch-scenario').selectOption('knight');
  await launchPrepared(page);
  await openPanel(page, 'settings'); await page.locator('#reduced').check(); await closePanel(page);
  await page.locator('#board-details summary').click();
  await page.locator('[data-square="c3"]').click();
  assert.equal(await page.locator('[data-square="d5"]').getAttribute('class').then(s => s.includes('capture')), true);
  const saved = await page.evaluate(() => localStorage.getItem('special-chess-offline-game'));
  await page.locator('[data-square="d5"]').hover();
  await page.waitForFunction(() => document.querySelector('#stage').dataset.previewTarget === 'd5');
  assert.match(await page.locator('#tactical-readout span').innerText(), /กิน.*D5/);
  assert.equal(await page.evaluate(() => localStorage.getItem('special-chess-offline-game')), saved);
  assert.equal(await page.locator('#moves .san').count(), 0);
  for (const viewport of [{ width: 1200, height: 850 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    const box = await page.locator('#tactical-readout').boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= viewport.width && box.y + box.height < viewport.height - 70);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight + 1), false);
    await page.screenshot({ path: `test-results/board-preview-${viewport.width}.png` });
  }
  await page.setViewportSize({ width: 1200, height: 850 });
  await page.locator('[data-square="d5"]').focus();
  assert.match(await page.locator('#tactical-readout span').innerText(), /กิน.*D5/);
  assert.equal(await page.locator('#moves .san').count(), 0);
  await page.locator('[data-square="d5"]').click(); await page.locator('#skip').click();
  assert.equal(await page.locator('#moves .san').count(), 1);
  assert.equal(await page.locator('#tactical-readout').isVisible(), false);
  assert.equal(await page.locator('#stage').getAttribute('data-preview-target'), null);
  assert.equal(await page.locator('[data-square="d5"]').getAttribute('class').then(s => s.includes('last')), true);
  assert.deepEqual(errors, []);
  console.log('PASS: duel-first menu, cosmetic progress in armory, 2D capture marker, mouse/keyboard preview without commits, mobile layout and cleanup after real move');
} finally { await browser.close(); }
