import assert from 'node:assert/strict';
import { readFileSync,existsSync,mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { chooseMode,launchPrepared,enterGame,openPanel,closePanel } from './enter-game.mjs';
const browser=await chromium.launch({executablePath:existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const html=readFileSync('offline/Special-Chess-Offline.html','utf8'),url='http://localhost:31881/duel-draft',errors=[];
try {
  const page=await browser.newPage({viewport:{width:1100,height:850},offline:true});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|webgl|three/i.test(m.text()))errors.push(m.text());});
  await page.route(url,r=>r.fulfill({contentType:'text/html',body:html}));
  await page.addInitScript(()=>{if(!localStorage.getItem('draft-initialized')){localStorage.setItem('special-chess-profile',JSON.stringify({xp:1400,skin:'prism'}));localStorage.setItem('special-chess-graphics-quality','low');localStorage.setItem('draft-initialized','1');}});
  await page.goto(url);await chooseMode(page,'special');
  await page.locator('#special-opponent').selectOption('local');await page.locator('#special-format').selectOption('draft');await page.locator('#special-events').selectOption('live');
  await page.locator('#special-seed').fill('2');await page.locator('#special-seed').dispatchEvent('change');await page.locator('#flow-next').click();
  assert.equal(await page.locator('#flow-next').isDisabled(),true);
  await page.locator('#draft-ban').selectOption('n:signature');assert.equal(await page.locator('#draft-phase-confirm').isDisabled(),true);
  await page.locator('[data-draft-side="b"]').click();await page.locator('#draft-ban').selectOption('p:alternate');await page.locator('#draft-phase-confirm').click();
  assert.equal(await page.locator('[data-rule-piece="n"][data-rule-skill="signature"]').isDisabled(),true);
  await page.locator('[data-draft-side="w"]').click();assert.equal(await page.locator('[data-rule-piece="p"][data-rule-skill="alternate"]').isDisabled(),true);
  await page.locator('[data-rule-piece="n"][data-rule-skill="alternate"]').click();
  // Equal budget prevents a costly set without silently removing another skill.
  await page.locator('[data-rule-piece="b"][data-rule-skill="alternate"]').click();
  assert.equal(await page.locator('[data-rule-piece="r"][data-rule-skill="alternate"]').isDisabled(),true);
  await page.locator('#draft-phase-confirm').click();assert.equal(await page.locator('#flow-next').isDisabled(),false);
  assert.match(await page.locator('#draft-reveal').innerText(),/ฝ่ายขาว.*12\/12/s);
  mkdirSync('test-results',{recursive:true});
  for(const viewport of [{width:1100,height:850},{width:390,height:844},{width:844,height:390},{width:320,height:568}]){
    await page.setViewportSize(viewport);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1),false);
    await page.screenshot({path:`test-results/duel-draft-${viewport.width}.png`});
  }
  await page.setViewportSize({width:1100,height:850});await launchPrepared(page);
  assert.match(await page.locator('#field-hud').innerText(),/เริ่มใน 2 รอบ/);
  let save=await page.evaluate(()=>JSON.parse(localStorage.getItem('special-chess-offline-game')));
  assert.equal(save.specialConfig.drafted,true);assert.equal(save.specialConfig.teams.w.n,'alternate');assert.equal(save.specialConfig.teams.b.n,'off');
  // Replay six rounds: the portal is active at the same phase after restore.
  await page.evaluate(()=>{
    const save=JSON.parse(localStorage.getItem('special-chess-offline-game'));
    save.initialFen='7k/8/6q1/8/8/1N6/7P/K7 w - - 0 1';
    save.history=['Ka2','Kg8','Ka1','Kh8','Ka2','Kg8','Ka1','Kh8','Ka2','Kg8','Ka1','Kh8'];
    localStorage.setItem('special-chess-offline-game',JSON.stringify(save));
  });
  await page.reload();await enterGame(page);assert.match(await page.locator('#field-hud').innerText(),/DIMENSION GATE/);
  await openPanel(page,'settings');await page.locator('#reduced').check();await closePanel(page);
  await page.locator('#board-details summary').click();await page.locator('[data-square="b3"]').click();await page.locator('[data-square="g6"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#moves .san').length===13);
  assert.match(await page.locator('#moves').innerText(),/P:Nb3xg6/);assert.equal(await page.locator('#ultimate-white .charged').count(),3);
  await page.reload();await enterGame(page);assert.match(await page.locator('#moves').innerText(),/P:Nb3xg6/);
  assert.deepEqual(errors,[]);console.log('Draft budget, bans, reveal, responsive flow, field forecast and portal replay passed.');
}finally{await browser.close();}
