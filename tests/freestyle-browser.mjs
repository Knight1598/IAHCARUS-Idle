import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { enterMenu, chooseMode, launchPrepared, enterGame, returnToMenu, openPanel, closePanel } from './enter-game.mjs';
const browser = await chromium.launch({executablePath:existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const url='http://localhost:31881/freestyle',html=readFileSync('offline/Special-Chess-Offline.html','utf8');
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1100,height:850},offline:true});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/shader|webgl|three/i.test(m.text()))errors.push(m.text());});
  await page.route(url,r=>r.fulfill({contentType:'text/html',body:html}));
  await page.addInitScript(()=>{
    if(!localStorage.getItem('freestyle-initialized')) {
      localStorage.setItem('special-chess-profile',JSON.stringify({xp:1400,skin:'classic'}));
      localStorage.setItem('special-chess-graphics-quality','low');
      localStorage.setItem('freestyle-initialized','true');
    }
  });
  await page.goto(url);await enterMenu(page);
  await page.locator('[data-menu-go="armory"]').click();
  assert.deepEqual((await page.locator('[data-piece-skin-option]').evaluateAll(buttons=>buttons.map(button=>button.dataset.pieceSkinOption))).sort(),
    ['astral','classic','dragon','ember','frost','nova','phantom','prism','royal','storm','void']);
  await page.locator('#piece-skin-filter').selectOption('5');
  assert.deepEqual((await page.locator('[data-piece-skin-option]:visible').evaluateAll(buttons=>buttons.map(button=>button.dataset.pieceSkinOption))).sort(),['dragon','prism']);
  await page.locator('#piece-skin-filter').selectOption('all');
  for(const skin of ['storm','void','prism']){
    await page.locator(`[data-piece-skin-option="${skin}"]`).click();
    await page.locator('#preview-attack').click();
    await page.waitForFunction(()=>!!document.querySelector('#stage').dataset.executionPhase);
    await page.waitForFunction(()=>!document.querySelector('#stage').dataset.executionPhase);
  }
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('special-chess-profile')).loadouts.w.b1),'prism');
  await chooseMode(page,'special');await page.locator('#special-opponent').selectOption('local');
  await page.locator('#special-charges').selectOption('9');await page.locator('#special-reusable').selectOption('repeat');
  await page.locator('#special-formation').selectOption('skirmish');
  await page.locator('#special-seed').fill('42');await page.locator('#special-seed').dispatchEvent('change');
  await page.locator('#flow-next').click();
  assert.equal(await page.locator('#title-screen').getAttribute('data-menu-view'),'skills');
  assert.equal(await page.locator('[data-rule-skill]').count(),12);
  for(const piece of ['p','n','b','r','q','k']) await page.locator(`[data-rule-piece="${piece}"][data-rule-skill="alternate"]`).click();
  mkdirSync('test-results',{recursive:true});
  for(const viewport of [{width:1100,height:850},{width:390,height:844},{width:844,height:390},{width:320,height:568}]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1),false);
    const b=await page.locator('#flow-next').boundingBox();assert.ok(b.y>=0&&b.y+b.height<=viewport.height);
    await page.screenshot({path:`test-results/freestyle-skills-${viewport.width}.png`});
  }
  await page.setViewportSize({width:1100,height:850});await launchPrepared(page);
  const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('special-chess-offline-game')));
  assert.equal(save.specialConfig.charges,9);assert.equal(save.specialConfig.reusable,true);assert.equal(save.specialConfig.seed,42);
  assert.equal(save.specialConfig.skills.n,'alternate');assert.equal(save.initialFen.split('/').length,8);
  assert.equal(await page.locator('#ultimate-white .charged').count(),9);
  await page.setViewportSize({width:320,height:568});
  const meterFits=await page.locator('#ultimate-hud').evaluate(hud=>{const box=hud.getBoundingClientRect();return [...hud.querySelectorAll('.ultimate-meter i')].every(i=>{const p=i.getBoundingClientRect();return p.left>=box.left&&p.right<=box.right;});});
  assert.equal(meterFits,true,'nine charges stay inside the compact HUD');
  await page.setViewportSize({width:1100,height:850});
  await page.evaluate(()=>{
    const save=JSON.parse(localStorage.getItem('special-chess-offline-game'));
    save.initialFen='7k/8/8/4r3/8/2N5/7P/K7 w - - 0 1';save.history=[];
    localStorage.setItem('special-chess-offline-game',JSON.stringify(save));
  });
  await page.reload();await enterGame(page);
  await openPanel(page,'settings');await page.locator('#reduced').check();await closePanel(page);
  await page.locator('#board-details summary').click();
  await page.locator('[data-square="c3"]').click();assert.match(await page.locator('#ultimate-arm').innerText(),/ก้าวเงาทแยง/);
  await page.locator('#ultimate-arm').click();await page.locator('[data-square="e5"]').click();await page.locator('#ultimate-confirm').click();
  await page.waitForFunction(()=>document.querySelectorAll('#moves .san').length===1);
  assert.match(await page.locator('#moves').innerText(),/U:Nc3xe5/);
  assert.equal(await page.locator('#ultimate-white .charged').count(),8);
  await page.reload();await enterGame(page);assert.equal(await page.locator('#ultimate-white .charged').count(),8);
  await page.locator('#undo').click();
  assert.equal(await page.locator('#ultimate-white .charged').count(),9);
  await returnToMenu(page);await chooseMode(page,'special');
  assert.equal(await page.locator('#special-reusable').inputValue(),'repeat');assert.equal(await page.locator('#special-charges').inputValue(),'9');
  await page.locator('#flow-next').click();assert.equal(await page.locator('[data-rule-piece="n"][data-rule-skill="alternate"]').getAttribute('aria-pressed'),'true');
  assert.deepEqual(errors,[]);
  console.log('PASS: all three new skin previews render without shader errors; independent skill step at four sizes; custom formation and all six skills persist; alternate capture, reload and undo use real rules.');
} finally {await browser.close();}
