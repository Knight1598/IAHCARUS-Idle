import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { dailyChallenge } from '../src/daily.ts';
import { enterMenu, chooseMode, launchPrepared, enterGame, openPanel, closePanel } from './enter-game.mjs';

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH || existsSync('/usr/bin/chromium') ? { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
try {
  const context = await browser.newContext({ offline: true, viewport: { width: 1200, height: 850 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Freeze only the calendar. Animation frames, timers and performance.now stay real.
  await page.addInitScript(() => {
    const NativeDate = Date;
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [Number(sessionStorage.getItem('daily-test-time') || NativeDate.UTC(2026, 9, 10, 12))])); }
      static now() { return Number(sessionStorage.getItem('daily-test-time') || NativeDate.UTC(2026, 9, 10, 12)); }
    };
  });
  const url = 'http://localhost:31467/daily-test';
  await page.route(url, route => route.fulfill({ contentType: 'text/html', body: readFileSync('offline/Special-Chess-Offline.html', 'utf8') }));
  await page.goto(url);
  await page.locator('#lobby-preview canvas').waitFor();
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/royal-title.png' });
  await enterMenu(page);
  assert.match(await page.locator('#daily-reward').innerText(), /80 XP/);
  await page.screenshot({ path: 'test-results/royal-menu.png' });
  await page.locator('#daily-enter').click();
  assert.equal(await page.locator('#title-screen').getAttribute('data-menu-view'), 'setup');
  assert.equal(await page.locator('#daily-brief').isVisible(), true);
  assert.equal(await page.locator('#launch-side').inputValue(), 'b');
  assert.equal(await page.locator('#stage').getAttribute('data-arena'), dailyChallenge('2026-10-10').arena);
  for (const viewport of [{ width: 1200, height: 850 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight + 1), false);
    const box = await page.locator('#flow-next').boundingBox();
    assert.ok(box && box.y >= 0 && box.y + box.height <= viewport.height);
    await page.screenshot({ path: `test-results/daily-brief-${viewport.width}.png` });
  }
  await page.setViewportSize({ width: 1200, height: 850 });
  await enterMenu(page);
  await page.locator('#lobby-battle-tab').click();
  const colors = await page.locator('[data-title-mode]').evaluateAll(buttons => buttons.map(b => getComputedStyle(b).getPropertyValue('--mode-color')));
  assert.equal(new Set(colors).size, colors.length, 'each mode has its own accent');
  await page.screenshot({ path: 'test-results/royal-modes.png' });
  await chooseMode(page, 'daily');
  await launchPrepared(page);
  assert.equal(await page.locator('#objective-peek').isVisible(), true);
  assert.match(await page.locator('#objective-label').innerText(), /ศึกประจำวัน/);
  await page.locator('#objective-peek').click();
  assert.equal(await page.locator('#arena-drawer').getAttribute('data-panel'), 'missions');
  assert.equal(await page.locator('#objective-peek').getAttribute('aria-expanded'), 'true');
  await closePanel(page);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'objective-peek');
  await openPanel(page, 'settings'); await page.locator('#reduced').check(); await closePanel(page);
  async function ensureBoard() {
    if (!await page.locator('#board-details').evaluate(el => el.open)) await page.locator('#board-details summary').click();
  }
  async function move(from, to) {
    await ensureBoard();
    await page.locator(`[data-square="${from}"]`).click();
    await page.locator(`[data-square="${to}"]`).click();
    await page.locator('#skip').click();
    await page.locator('.battle-result').waitFor();
  }
  const profile = () => page.evaluate(() => JSON.parse(localStorage.getItem('special-chess-profile')));
  // Escaping without eliminating the checking knight is legal but loses this objective.
  await move('e8', 'd8');
  assert.equal((await profile()).xp, 0);
  await page.locator('[data-result="continue"]').click();
  await move('g7', 'f6');
  assert.match(await page.locator('.battle-result h2').innerText(), /พิชิตศึกประจำวัน/);
  assert.match(await page.locator('.battle-result-xp').innerText(), /80 XP/);
  assert.equal((await profile()).xp, 80);
  assert.equal((await profile()).claimed.includes('daily:2026-10-10'), true);
  await page.screenshot({ path: 'test-results/daily-victory.png' });
  await page.locator('.battle-result-close').click();
  await page.locator('#undo').click();
  await move('g7', 'f6');
  assert.equal((await profile()).xp, 80);
  await page.locator('[data-result="continue"]').click();
  assert.match(await page.locator('#daily-reward').innerText(), /สำเร็จแล้ววันนี้.*1 วัน/);
  // Start again before midnight, then resume after midnight: this is still yesterday's puzzle.
  await page.locator('#daily-enter').click(); await launchPrepared(page);
  await page.evaluate(() => sessionStorage.setItem('daily-test-time', String(Date.UTC(2026, 9, 11, 1))));
  await page.reload(); await enterGame(page);
  assert.match(await page.locator('#objective-progress').innerText(), /0\s*\/\s*1/);
  await move('g7', 'f6');
  assert.equal((await profile()).xp, 80);
  assert.equal((await profile()).claimed.includes('daily:2026-10-11'), false);
  await page.locator('[data-result="continue"]').click();
  assert.match(await page.locator('#daily-reward').innerText(), /90 XP.*1 วัน/);
  await page.locator('#daily-enter').click();
  assert.equal(await page.locator('#launch-side').inputValue(), 'w');
  await launchPrepared(page);
  await move('c3', 'd5');
  assert.equal((await profile()).xp, 170);
  assert.match(await page.locator('.battle-result p').first().innerText(), /2 วัน/);
  await page.locator('[data-result="home"]').click();
  await page.reload(); await enterGame(page);
  await page.locator('.battle-result').waitFor();
  assert.equal((await profile()).xp, 170);
  assert.deepEqual(errors, []);
  console.log('PASS: daily menu/mobile layouts, distinct mode accents, objective drawer, failure/retry, once-per-date XP, undo/reload, midnight resume and consecutive-day bonus');
} finally { await browser.close(); }
