import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync,readFileSync,mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { chooseMode,launchPrepared,enterGame,openPanel,closePanel } from './enter-game.mjs';
const html=readFileSync('offline/Special-Chess-Offline.html','utf8');let endpoint,child,browser;
const front=createServer((req,res)=>{if(req.url.split('?')[0]==='/IAHCARUS-Idle/online-config.json'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({server:endpoint}));}else{res.writeHead(200,{'Content-Type':'text/html'});res.end(html);}});
try{
 await new Promise(r=>front.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${front.address().port}`,base=origin+'/IAHCARUS-Idle/';
 child=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'0',GUEST_DUEL_ONLY:'true',DUEL_ALLOWED_ORIGINS:origin},stdio:['ignore','pipe','pipe']});
 const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),5000);child.stdout.on('data',d=>{const m=String(d).match(/port (\d+)/);if(m){clearTimeout(timer);resolve(Number(m[1]));}});child.on('exit',()=>reject(Error('Server exited')));});endpoint=`http://127.0.0.1:${port}`;
 browser=await chromium.launch({executablePath:existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const errors=[];async function player(){const context=await browser.newContext({viewport:{width:1100,height:850}});await context.addInitScript(()=>{localStorage.setItem('special-chess-graphics-quality','low');localStorage.setItem('special-chess-reduced','true');});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return page;}
 const a=await player();await a.goto(base);await chooseMode(a,'online');await launchPrepared(a);
 await a.waitForFunction(()=>document.querySelector('#duel-connection').dataset.state==='connected');await a.locator('#create').click();await a.waitForFunction(()=>document.querySelector('#code').textContent.length===6);
 await a.evaluate(()=>{navigator.clipboard.writeText=async text=>{window.invitation=text;};});await a.locator('#copy').click();const invite=await a.evaluate(()=>window.invitation);assert.equal(new URL(invite).searchParams.has('token'),false);assert.match(new URL(invite).searchParams.get('server'),new RegExp(`:${port}/ws$`));
 const b=await player();await b.addInitScript(()=>localStorage.setItem("special-chess-offline-game",JSON.stringify({mode:"local",specialDuel:true,initialFen:"7k/8/8/3q4/8/2N5/7P/K7 w - - 0 1",history:[],humanColor:"w"})));await b.goto(invite);await enterGame(b);await openPanel(b,'room');await b.waitForFunction(()=>document.querySelector('#duel-connection').dataset.state==='connected');await b.locator('#join').click();await b.waitForFunction(()=>!document.querySelector('#duel-ready').hidden);
 assert.equal(await a.locator('#white-clock').innerText(),'5:00');await b.waitForTimeout(1100);assert.equal(await a.locator('#white-clock').innerText(),'5:00');
 mkdirSync('test-results',{recursive:true});for(const width of [390,320]){await b.setViewportSize({width,height:844});assert.equal(await b.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await b.screenshot({path:`test-results/friend-lobby-${width}.png`});}await b.setViewportSize({width:1100,height:850});
 await a.locator('#duel-ready').click();assert.equal(await a.locator('#duel-ready').getAttribute('aria-pressed'),'true');await b.locator('#duel-ready').click();
 await a.waitForFunction(()=>document.querySelector('#arena-drawer').hidden);await b.waitForFunction(()=>document.querySelector('#arena-drawer').hidden);
 await a.locator('#board-details summary').click();await a.locator('[data-square="e2"]').click();await a.locator('[data-square="e4"]').click();await b.waitForFunction(()=>document.querySelectorAll('#moves .san').length===1);
 await b.locator('#board-details summary').click();await b.locator('[data-square="e7"]').click();await b.locator('[data-square="e5"]').click();await a.waitForFunction(()=>document.querySelectorAll('#moves .san').length===2);
 assert.equal(await a.locator('#moves').innerText(),await b.locator('#moves').innerText());
 await a.reload();await enterGame(a);await a.waitForFunction(()=>document.querySelectorAll('#moves .san').length===2);assert.match(await a.locator('#connection').innerText(),/เชื่อมต่อแล้ว/);
 assert.deepEqual(errors,[]);console.log('PASS: Pages HTML, separate frontend/backend origins, two isolated players, invitation, ready gate, frozen lobby clock, identical moves, refresh resume and 320/390px lobby.');
}finally{await browser?.close();child?.kill();await new Promise(r=>front.close(r));}
