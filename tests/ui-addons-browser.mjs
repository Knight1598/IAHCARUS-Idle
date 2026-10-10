import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { enterMenu, enterGame, chooseMode, launchPrepared, returnToMenu, openPanel, closePanel } from './enter-game.mjs';

const html = readFileSync('offline/Special-Chess-Offline.html', 'utf8');
const url = 'http://localhost:31917/ui-addons';
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH || existsSync('/usr/bin/chromium')
    ? { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});

try {
  const context = await browser.newContext({ offline: true, hasTouch: true, viewport: { width: 1100, height: 850 } });
  const page = await context.newPage(), errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await page.route(url, route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.addInitScript(() => {
    localStorage.setItem('special-chess-graphics-quality', 'low');
    // CSS ornaments remain separate from the addon-controlled native animations.
    window.managedMenuAnimations = () => document.getAnimations().filter(animation => {
      if (animation instanceof CSSAnimation || animation instanceof CSSTransition) return false;
      const target = animation.effect?.target;
      return target instanceof Element && !!target.closest('#title-screen [data-menu-view], #title-screen dialog');
    });
  });
  await page.goto(url);
  await page.locator('#title-screen').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#title-screen').getAttribute('data-motion-engine'), 'animejs');
  assert.equal(await page.locator('[data-title-mode="special"]').count(), 1);
  assert.equal(await page.locator('[data-rule-skill]').count(), 12);
  assert.equal(await page.locator('[data-arena-option]').count(), 8);

  // Observe actual WAAPI instances in the same task that starts the navigation.
  const started = await page.evaluate(() => {
    document.querySelector('#title-enter').click();
    const animations = managedMenuAnimations();
    return { count: animations.length, opacity: animations.some(animation =>
      animation.effect.getKeyframes().some(frame => frame.opacity === '0') &&
      animation.effect.getKeyframes().some(frame => frame.opacity === '1')) };
  });
  assert.ok(started.count > 0 && started.opacity, 'navigation creates real native opacity animations');
  await page.waitForFunction(() => document.querySelector('#title-screen').dataset.motionActive === '0');
  assert.equal(await page.evaluate(() => managedMenuAnimations().length), 0, 'completed transitions release their native animation effects');
  assert.equal(await page.locator('.menu-page[data-menu-view="menu"]').evaluate(element => element.style.opacity), '');

  const rapid = await page.evaluate(() => {
    document.querySelector('#lobby-battle-tab').click();
    const outgoing = managedMenuAnimations();
    document.querySelector('#flow-back').click();
    return {
      previousCount: outgoing.length,
      canceled: outgoing.every(animation => animation.playState === 'idle'),
      activeHidden: managedMenuAnimations().some(animation => animation.effect.target.closest('[hidden]')),
      view: document.querySelector('#title-screen').dataset.menuView,
    };
  });
  assert.ok(rapid.previousCount > 0 && rapid.canceled, 'rapid navigation cancels the outgoing page animations');
  assert.equal(rapid.activeHidden, false);
  assert.equal(rapid.view, 'menu');
  await page.waitForFunction(() => document.querySelector('#title-screen').dataset.motionActive === '0');
  await page.evaluate(() => document.querySelector('#lobby-battle-tab').click());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('#title-screen').dataset.motionMode === 'reduced' && document.querySelector('#title-screen').dataset.motionActive === '0');
  assert.equal(await page.evaluate(() => { document.querySelector('#flow-back').click(); return managedMenuAnimations().length; }), 0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => document.querySelector('#title-screen').dataset.motionMode === 'full');

  // The game setting works independently of the operating system preference.
  await page.locator('[data-menu-go="settings"]').click();
  await page.locator('#reduced').check();
  assert.equal(await page.locator('#title-screen').getAttribute('data-motion-mode'), 'reduced');
  assert.equal(await page.evaluate(() => { document.querySelector('#flow-back').click(); return managedMenuAnimations().length; }), 0);
  await page.locator('[data-menu-go="settings"]').click();
  await page.locator('#reduced').uncheck();
  assert.equal(await page.locator('#title-screen').getAttribute('data-motion-mode'), 'full');
  await page.locator('#flow-back').click();
  await page.locator('#lobby-battle-tab').click();
  await page.waitForFunction(() => document.querySelector('#title-screen').dataset.motionActive === '0');

  const help = page.locator('#game-context-help');
  const chapter = page.locator('[data-menu-view="mode"] > h1 .game-help-trigger');
  const waitHelp = async () => {
    await help.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('#game-context-help').style.visibility === 'visible');
    assert.equal(await help.getAttribute('data-position-engine'), 'floating-ui');
    assert.ok(await help.locator('header').evaluate(element => element.getBoundingClientRect().height <= 38), 'help uses a compact game header rather than inheriting the page banner height');
  };
  const helpFits = async (label) => {
    const box = await help.boundingBox(), viewport = page.viewportSize();
    assert.ok(box && box.x >= 11 && box.y >= 11 && box.x + box.width <= viewport.width - 11 && box.y + box.height <= viewport.height - 11,
      `${label}: help must stay within the viewport: ${JSON.stringify({ box, viewport })}`);
  };
  mkdirSync('test-results', { recursive: true });
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await chapter.tap(); await waitHelp(); await helpFits(`chapter ${viewport.width}`);
    assert.equal(await chapter.getAttribute('aria-expanded'), 'true');
    await page.screenshot({ path: `test-results/ui-help-${viewport.width}.png` });
    await page.keyboard.press('Escape');
    assert.equal(await help.isVisible(), false);
    assert.equal(await page.locator('#title-screen').getAttribute('data-menu-view'), 'mode', 'Escape closes help without navigating');
    assert.equal(await chapter.getAttribute('aria-expanded'), 'false');
  }
  await page.setViewportSize({ width: 1100, height: 850 });
  await chapter.focus(); await page.keyboard.press('Enter'); await waitHelp();
  assert.equal(await help.locator('header button').evaluate(element => element === document.activeElement), true, 'keyboard opening focuses the help close button');
  await help.locator('header button').click();
  assert.equal(await chapter.evaluate(element => element === document.activeElement), true, 'closing restores keyboard focus');
  await chapter.tap(); await waitHelp();
  await page.touchscreen.tap(2, 2);
  assert.equal(await help.isVisible(), false, 'outside touch dismisses help');
  const closedPosition = await help.evaluate(element => [element.style.left, element.style.top]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(80);
  assert.deepEqual(await help.evaluate(element => [element.style.left, element.style.top]), closedPosition, 'a closed panel stops positioning updates');
  await chapter.tap(); await waitHelp();
  await page.evaluate(() => document.querySelector('#flow-next').click());
  await help.waitFor({ state: 'hidden' });
  assert.equal(await chapter.getAttribute('aria-expanded'), 'false', 'page changes clean up the old help anchor');

  // A per-piece comparison describes both real skill choices and never changes them.
  await page.setViewportSize({ width: 1100, height: 850 });
  await chooseMode(page, 'special');
  await page.locator('#special-opponent').selectOption('local');
  await page.locator('#flow-next').click();
  const knightCard = page.locator('.skill-loadout-card').filter({ has: page.locator('[data-rule-piece="n"]') });
  const comparison = knightCard.locator('.game-help-trigger');
  const labels = await knightCard.locator('[data-rule-skill] strong').allTextContents();
  const chosenSkills = await page.locator('[data-rule-skill][aria-pressed="true"]').evaluateAll(buttons => buttons.map(button => `${button.dataset.rulePiece}:${button.dataset.ruleSkill}`));
  await comparison.focus(); await page.keyboard.press('Enter'); await waitHelp();
  for (const label of labels) assert.ok((await help.locator('p').innerText()).includes(label));
  assert.match(await help.locator('h2').innerText(), /เปรียบเทียบสกิลม้า/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#title-screen').getAttribute('data-menu-view'), 'skills');
  assert.deepEqual(await page.locator('[data-rule-skill][aria-pressed="true"]').evaluateAll(buttons => buttons.map(button => `${button.dataset.rulePiece}:${button.dataset.ruleSkill}`)), chosenSkills);
  await page.setViewportSize({ width: 320, height: 568 });
  await comparison.tap(); await waitHelp(); await helpFits('skill comparison at 320px');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(80); await helpFits('open help follows resize');
  await page.keyboard.press('Escape');

  // Put the existing comparison trigger near a screen edge to exercise actual flip.
  await page.setViewportSize({ width: 844, height: 390 });
  const originalStyle = await comparison.getAttribute('style');
  await comparison.evaluate(button => { button.style.position = 'fixed'; button.style.bottom = '20px'; button.style.right = '12px'; button.style.zIndex = '79'; });
  await comparison.tap(); await waitHelp(); await helpFits('bottom-edge skill comparison');
  assert.ok((await help.getAttribute('data-placement')).startsWith('top'), 'the actual floating panel flips above a bottom-edge anchor');
  await page.keyboard.press('Escape');
  await comparison.evaluate((button, style) => { if (style == null) button.removeAttribute('style'); else button.setAttribute('style', style); }, originalStyle);

  // Selection and preview provide useful information while leaving the game untouched.
  await page.setViewportSize({ width: 1100, height: 850 });
  await chooseMode(page, 'training');
  await page.locator('#launch-scenario').selectOption('knight');
  await launchPrepared(page);
  await openPanel(page, 'settings'); await page.locator('#reduced').check(); await closePanel(page);
  await page.locator('#board-details summary').click();
  await page.locator('[data-square="c3"]').tap();
  assert.match(await page.locator('#tactical-readout .tactical-head strong').innerText(), /ม้า C3/);
  assert.match(await page.locator('#tactical-options').innerText(), /8 ช่องเดิน · 1 ช่องกิน/);
  await page.locator('#tactics-expand').click();
  assert.equal(await page.locator('#tactical-detail').isVisible(), true);
  const save = () => page.evaluate(() => localStorage.getItem('special-chess-offline-game'));
  const trainingSave = await save();
  await page.locator('[data-square="d5"]').hover();
  await page.waitForFunction(() => document.querySelector('#stage').dataset.previewTarget === 'd5');
  assert.match(await page.locator('#tactical-readout .tactical-move').innerText(), /กิน.*D5/);
  assert.equal(await page.locator('#tactics-expand').getAttribute('aria-expanded'), 'true');
  await page.locator('[data-square="d5"]').focus();
  assert.equal(await page.locator('#tactical-detail').isVisible(), true);
  assert.equal(await save(), trainingSave);
  assert.equal(await page.locator('#moves .san').count(), 0);
  await page.locator('#tactical-detail .game-help-trigger').tap(); await waitHelp();
  assert.match(await help.locator('p').innerText(), /ถูกตรึง|ไม่ใช่การรับประกัน/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#arena-drawer').isVisible(), false, 'Escape closes field help without opening the pause drawer');

  // A separate saved board makes the attacker identities observable, not just counts.
  await page.evaluate(() => {
    localStorage.setItem('special-chess-offline-game', JSON.stringify({
      mode: 'local', humanColor: 'w', initialFen: '7k/1b6/8/2rr4/8/2N5/8/K7 w - - 0 1',
      history: [], matchId: 'ui-inspection-fixture',
    }));
  });
  await page.reload(); await enterGame(page);
  await page.locator('#board-details summary').click();
  await page.locator('[data-square="c3"]').click();
  await page.locator('#tactics-expand').click();
  assert.match(await page.locator('#tactical-controls').innerText(), /C3:.*C5/);
  const fixtureSave = await save();
  await page.locator('[data-square="d5"]').hover();
  await page.waitForFunction(() => document.querySelector('#stage').dataset.previewTarget === 'd5');
  const attackers = await page.locator('#tactical-controls').innerText();
  assert.match(attackers, /D5:/); assert.match(attackers, /B7/); assert.match(attackers, /C5/);
  await page.locator('[data-square="d5"]').focus();
  assert.equal(await save(), fixtureSave);
  assert.equal(await page.locator('#moves .san').count(), 0);
  assert.equal(await page.locator('#tactics-expand').getAttribute('aria-expanded'), 'true');

  await returnToMenu(page); await chooseMode(page, 'special');
  await page.locator('#special-opponent').selectOption('local');
  await page.locator('#special-events').selectOption('live');
  await launchPrepared(page);
  if (!await page.locator('#board-details').evaluate(element => element.open)) await page.locator('#board-details summary').click();
  await page.locator('[data-square="b1"]').click();
  await page.locator('#field-hud').waitFor({ state: 'visible' });
  assert.match(await page.locator('#field-hud').innerText(), /FIELD FORECAST/);
  assert.match(await page.locator('#tactical-scope').innerText(), /ไม่รวมการขู่อัลติและอีเวนท์/);
  for (const viewport of [{ width: 1100, height: 850 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    const field = await page.locator('#field-hud').boundingBox(), tactical = await page.locator('#tactical-readout').boundingBox(), rail = await page.locator('#arena-intel').boundingBox();
    assert.ok(field && tactical && rail && field.y + field.height <= tactical.y + 1, 'field and selected-piece panels occupy separate rows');
    assert.ok(rail.x >= 0 && rail.y >= 0 && rail.x + rail.width <= viewport.width && rail.y + rail.height <= viewport.height - 50, 'the scrollable information rail stays clear of the bottom game controls');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight + 1), false);
  }
  await page.setViewportSize({ width: 1100, height: 850 });
  await page.screenshot({ path: 'test-results/ui-field-and-inspection.png' });
  await returnToMenu(page); await chooseMode(page, 'score');
  await page.locator('#special-opponent').selectOption('local');
  await launchPrepared(page);
  if (!await page.locator('#board-details').evaluate(element => element.open)) await page.locator('#board-details summary').click();
  await page.locator('[data-square="e2"]').click();
  await page.locator('#variant-hud').waitFor({ state: 'visible' });
  assert.match(await page.locator('#variant-progress').innerText(), /0.*0.*12/);
  for (const viewport of [{ width: 1100, height: 850 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    const variant = await page.locator('#variant-hud').boundingBox(), tactical = await page.locator('#tactical-readout').boundingBox(), rail = await page.locator('#arena-intel').boundingBox();
    assert.ok(variant && tactical && rail && variant.y + variant.height <= tactical.y + 1,
      `variant rules and inspection occupy separate rows at ${viewport.width}px`);
    assert.ok(rail.x >= 0 && rail.x + rail.width <= viewport.width && rail.y + rail.height <= viewport.height - 50);
    assert.equal(await page.locator('#field-hud').isVisible(), false, 'normal variants do not keep the previous special field panel');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/ui-variant-and-inspection-390.png' });
  assert.deepEqual(errors, []);
  assert.deepEqual(requests.filter(request => request !== url), [], 'the exact standalone game needs no external library requests');
  console.log('PASS: real Anime WAAPI creation/cancellation/cleanup, both reduced-motion controls, touch/keyboard Floating UI help and viewport flip/shift, skill comparison, immutable tactical selection/previews with attacker identities, and separate field/variant/inspection rail.');
} finally {
  await browser.close();
}
