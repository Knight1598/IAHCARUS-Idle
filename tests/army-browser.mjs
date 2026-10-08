import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { enterGame, openPanel, closePanel, enterMenu, chooseMode, launchPrepared, returnToMenu } from './enter-game.mjs';

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH || existsSync('/usr/bin/chromium') ? { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
try {
  const context = await browser.newContext({ offline: true, viewport: { width: 1200, height: 850 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /shader|webgl|three/i.test(message.text())) errors.push(message.text()); });
  const url = 'http://localhost:31465/army-test';
  await page.route(url, route => route.fulfill({ contentType: 'text/html', body: readFileSync('offline/Special-Chess-Offline.html', 'utf8') }));
  await page.goto(url);
  await page.locator('#lobby-preview canvas').waitFor();
  const profile = () => page.evaluate(() => JSON.parse(localStorage.getItem('special-chess-profile')));
  // Two identical classes receive independent cosmetics; both armies retain them.
  await enterMenu(page);
  await page.locator('[data-menu-go="armory"]').click();
  await page.locator('[data-piece-origin="b1"]').click();
  await page.locator('[data-piece-skin-option="ember"]').click();
  await page.locator('[data-piece-origin="g1"]').click();
  await page.locator('[data-piece-skin-option="frost"]').click();
  await page.locator('[data-armory-side="b"]').click();
  await page.locator('[data-piece-origin="e7"]').click();
  await page.locator('[data-piece-skin-option="ember"]').click();
  const equipped = await profile();
  assert.equal(equipped.loadouts.w.b1, 'ember');
  assert.equal(equipped.loadouts.w.g1, 'frost');
  assert.equal(equipped.loadouts.b.e7, 'ember');
  assert.equal(equipped.skin, 'classic');
  await page.reload();
  await page.locator('#lobby-preview canvas').waitFor();
  assert.deepEqual((await profile()).loadouts, equipped.loadouts);
  // Selecting black in the launch options must also select a real black origin slot.
  await chooseMode(page, 'bot');
  await page.locator('#launch-side').selectOption('b');
  await page.locator('#flow-next').click();
  await page.locator('#lobby-armory-tab').click();
  assert.match(await page.locator('#armory-slot').innerText(), /b8/);
  await page.locator('[data-piece-skin-option="frost"]').click();
  assert.equal((await profile()).loadouts.b.b8, 'frost');
  assert.equal((await profile()).loadouts.b.b1, undefined);
  const saveBefore = await page.evaluate(() => localStorage.getItem('special-chess-offline-game'));
  const xpBefore = (await profile()).xp;
  await page.locator('#preview-attack').click();
  await page.waitForFunction(() => document.querySelector('#stage').dataset.executionPhase === 'windup' || document.querySelector('#stage').dataset.executionPhase === 'strike');
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/armory-finisher.png' });
  await page.waitForFunction(() => !document.querySelector('#stage').dataset.executionPhase);
  assert.equal(await page.locator('#lobby-preview canvas').count(), 1);
  assert.equal((await profile()).xp, xpBefore);
  assert.equal(await page.evaluate(() => localStorage.getItem('special-chess-offline-game')), saveBefore);
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight + 1), false);
    await page.screenshot({ path: `test-results/armory-${viewport.width}.png` });
  }
  await page.setViewportSize({ width: 1200, height: 850 });
  await enterGame(page, 'local');
  assert.equal(await page.locator('#stage canvas:not(.battle-overlay)').count(), 1);
  assert.equal(await page.locator('#lobby-preview canvas').count(), 0);
  assert.deepEqual((await profile()).loadouts, { w: { b1: 'ember', g1: 'frost' }, b: { e7: 'ember', b8: 'frost' } });
  await openPanel(page, 'settings'); await page.locator('#reduced').check(); await closePanel(page);
  await returnToMenu(page);
  async function ensureBoard() {
    if (!await page.locator('#board-details').evaluate(el => el.open)) await page.locator('#board-details summary').click();
  }
  async function launchTrial(key) {
    await chooseMode(page, 'campaign');
    await page.locator('#launch-trial').selectOption(key);
    await launchPrepared(page);
    await page.locator('#stage canvas:not(.battle-overlay)').waitFor();
    await ensureBoard();
  }
  async function move(from, to) {
    await page.locator(`[data-square="${from}"]`).click();
    await page.locator(`[data-square="${to}"]`).click();
    await page.locator('#skip').click();
  }
  await launchTrial('rescue');
  await move('g7', 'f6');
  await page.locator('.battle-result').waitFor();
  assert.match(await page.locator('.battle-result h2').innerText(), /ภารกิจสำเร็จ/);
  assert.equal((await profile()).xp, xpBefore + 60);
  const savedHistory = await page.evaluate(() => JSON.parse(localStorage.getItem('special-chess-offline-game')).history);
  // Replay never rewrites history/XP and brings the result/continue controls back.
  await page.locator('[data-result="replay"]').click();
  await page.locator('#skip').click();
  await page.locator('.battle-result').waitFor();
  assert.equal((await profile()).xp, xpBefore + 60);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('special-chess-offline-game')).history), savedHistory);
  await page.locator('.battle-result-close').click();
  await page.locator('#undo').click();
  assert.equal(await page.locator('.battle-result').count(), 0);
  await move('g7', 'f6');
  assert.equal((await profile()).xp, xpBefore + 60);
  await page.locator('[data-result="home"]').click();
  await page.reload(); await enterGame(page);
  await page.locator('.battle-result').waitFor();
  assert.equal((await profile()).xp, xpBefore + 60);
  await page.locator('[data-result="continue"]').click();
  await ensureBoard();
  await move('c3', 'd5');
  await page.locator('.battle-result').waitFor();
  assert.equal((await profile()).xp, xpBefore + 140);
  assert.equal(await page.locator('[data-result="replay"]').isVisible(), false);
  await page.locator('[data-result="continue"]').click();
  await ensureBoard();
  // An incorrect final-budget attempt fails and has no reward; undo restores the chapter.
  await move('a1', 'a2');
  await page.waitForFunction(() => document.querySelectorAll('#moves .san').length === 2);
  await page.locator('#skip').click();
  await move('a2', 'a3');
  await page.locator('.battle-result').waitFor();
  assert.match(await page.locator('.battle-result h2').innerText(), /วางแผนใหม่/);
  assert.equal((await profile()).xp, xpBefore + 140);
  await page.locator('[data-result="continue"]').click();
  await ensureBoard();
  await move('a1', 'a7');
  await page.waitForFunction(() => document.querySelectorAll('#moves .san').length === 2);
  await page.locator('#skip').click();
  await move('a7', 'g7');
  await page.locator('.battle-result').waitFor();
  assert.match(await page.locator('.battle-result h2').innerText(), /ภารกิจสำเร็จ/);
  assert.equal((await profile()).xp, xpBefore + 240);
  assert.match(await page.locator('.battle-result-mvp').innerText(), /ควีน|ราชินี/);
  await page.screenshot({ path: 'test-results/campaign-victory.png' });
  assert.equal(await page.locator('#stage').getAttribute('data-victory-pose'), 'w');
  // Deployed training pieces keep the equipped class skin, even away from b1.
  await page.locator('[data-result="home"]').click();
  await chooseMode(page, "training");
  await page.locator('#launch-scenario').selectOption('knight');
  await launchPrepared(page);
  await openPanel(page, 'settings'); await page.locator('#battle-events').uncheck(); await closePanel(page);
  await ensureBoard(); await move('c3', 'd5');
  await page.locator('.battle-result').waitFor();
  assert.match(await page.locator('.battle-result-mvp').innerText(), /อัศวินเถ้าถ่าน/);
  assert.match(await page.locator('#event strong').textContent(), /รอยฟันเถ้าถ่าน/);
  assert.equal((await profile()).xp, xpBefore + 280);
  assert.deepEqual(errors, []);
  console.log('PASS: independent piece skins and reload, black origin selection, one WebGL canvas, read-only finisher audition, mobile lobby, all chapters, failure/retry, reward deduplication, MVP and replay restoration');
} finally { await browser.close(); }
