import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {shopCatalog} from '../shared/economy.js';
import {readProfile,isSkinUnlocked} from '../src/profile.ts';
import {enterMenu} from './enter-game.mjs';
const url='http://localhost:31901/gacha',html=readFileSync('offline/Special-Chess-Offline.html','utf8'),profile=readProfile(null);profile.economy.credits=5000;profile.economy.shards=1000;
const browser=await chromium.launch({executablePath:existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({offline:true,viewport:{width:1100,height:850}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(url,r=>r.fulfill({contentType:'text/html',body:html}));await page.addInitScript(profile=>{if(!localStorage.getItem('gacha-fixture')){localStorage.setItem('special-chess-profile',JSON.stringify(profile));localStorage.setItem('gacha-fixture','1');localStorage.setItem('special-chess-graphics-quality','low');}const native=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=a=>a instanceof Uint32Array?(a.fill(0),a):native(a);},profile);
 const wallet=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('special-chess-profile')).economy);
 const shop=async()=>{await enterMenu(page);await page.locator('[data-menu-go="treasury"]').click();};
 await page.goto(url);await shop();assert.equal(await page.locator('.shop-card').count(),76);
 await page.locator('[data-gacha-banner="combat"]').click();await page.locator('[data-capsule-count="10"]').click();await page.locator('#capsule-reveal').waitFor({state:'visible'});
 let w=await wallet();assert.equal(w.credits,3800);assert.equal(w.lootHistory.length,10);assert.ok(w.lootHistory.some(v=>v.rarity!=='common'));assert.equal(await page.locator('#capsule-reveal .loot-card').count(),10);assert.equal(w.shards,1120);
 const result=w.lootHistory[0].product;await page.locator('#capsule-reveal [data-reward-equip]').first().click();assert.equal((await wallet()).equipped.finisher,result);
 await page.keyboard.press('Escape');assert.equal((await wallet()).credits,3800);await page.waitForTimeout(650);
 await page.locator('[data-capsule-count="1"]').click();await page.locator('#capsule-reveal .loot-card').waitFor();assert.match(await page.locator('#capsule-reveal').innerText(),/ของซ้ำ/);await page.locator('#loot-close').click();
 assert.equal((await wallet()).credits,3680);await page.waitForTimeout(650);
 await page.locator('#shop-filter').selectOption('board');await page.locator('[data-cosmetic-forge="board-circuit"]').click();await page.locator('[data-shop-equip="board-circuit"]').click();assert.equal((await wallet()).equipped.board,'board-circuit');
 await page.locator('#shop-filter').selectOption('skill');await page.locator('[data-shop-buy="skill-orbit"]').click();await page.locator('#shop-confirm-buy').click();await page.waitForTimeout(550);await page.locator('[data-shop-equip="skill-orbit"]').click();assert.equal((await wallet()).equipped.skill,'skill-orbit');assert.equal((await wallet()).credits,3180);
 const expected=await wallet();await page.reload();await shop();assert.deepEqual(await wallet(),expected);assert.equal(await page.locator('#stage').getAttribute('data-board-cosmetic'),'circuit');
 await page.locator('#shop-filter').selectOption('owned');assert.equal(await page.locator('.shop-card').count(),shopCatalog.filter(item=>item.cosmetic?expected.inventory.includes(item.id):item.skin&&isSkinUnlocked({...profile,economy:expected},item.skin)).length);
 await page.locator('[data-gacha-banner="arena"]').click();await page.locator('.capsule-odds summary').click();assert.equal(await page.locator('.capsule-odds>div>span').count(),16);
 mkdirSync('test-results',{recursive:true});for(const width of [1100,390,320]){await page.setViewportSize({width,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`test-results/gacha-${width}.png`});}
 assert.deepEqual(errors,[]);console.log('PASS: ten-pull rewards, duplicate conversion, saved reveal/close, equip, cosmetic forge, shop buy, independent board/skill slots, reload, actual banner odds, owned filter and mobile widths.');
}finally{await browser.close();}
