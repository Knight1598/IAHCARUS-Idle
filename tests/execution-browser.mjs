import assert from 'node:assert/strict';
import { existsSync,mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const vite=await createServer({server:{host:'127.0.0.1',port:0,watch:{ignored:['**/dist/**','**/dist-offline/**','**/dist-pages/**','**/offline/Special-Chess-Offline.html']}},plugins:[{name:'execution-fixture',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url!='/execution-test')return next();res.setHeader('Content-Type','text/html');res.end('<html><link rel="icon" href="data:,"><body style="margin:0;background:#101b30"><div id="stage" style="width:100vw;height:100vh"></div></body></html>');});}}]});
let browser;
try{
 await vite.listen();browser=await chromium.launch({executablePath:existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1000,height:760}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/execution-test`);
 await page.evaluate(async()=>{const [{ChessScene},{Chess}]=await Promise.all([import('/src/scene.ts'),import('/node_modules/chess.js/dist/esm/chess.js')]);window.fixture=new ChessScene(document.querySelector('#stage'));window.Chess=Chess;fixture.quality='low';fixture.cinematic=true;fixture.cinematicScope='all';fixture.setPaused(true);});
 mkdirSync('test-results',{recursive:true});
 for(const width of [1000,390]){
  await page.setViewportSize({width,height:width===390?844:760});
  await page.waitForTimeout(150);
  for(const skin of ['storm','void','prism']){
   const result=await page.evaluate(async skin=>{
    const {analyzeMove}=await import('/shared/events.js');const before=new Chess('7k/8/8/3q4/8/2N5/7P/K7 w - - 0 1'),after=new Chess(before.fen()),move=after.move('Nxd5');
    fixture.resetPacing();fixture.setAppearances({c3:skin,d5:'frost'},{d5:skin});fixture.setPaused(false);fixture.play(before,after,move,analyzeMove(before,after,move));fixture.setPaused(true);
    let quiet=0;fixture.onAnticipation=()=>quiet++;const a=fixture.animation,calls=[];
    for(const t of [.62,.673,.72,.86]){const now=performance.now();fixture.setPaused(false);a.duration=100000;a.start=now-t*a.duration;fixture.frame(now);fixture.setPaused(true);fixture.renderer.render(fixture.scene,fixture.camera);calls.push(fixture.renderer.info.render.calls);}
    return {quiet,calls,collapse:fixture.animation.defenderAvatar.scale.x,effectChildren:a.execution.group.children.length,skin:document.querySelector('#stage').dataset.skinExecution};
   },skin);
   assert.equal(result.quiet,1);assert.ok(result.calls.every(n=>n<190));assert.ok(result.effectChildren<=3);assert.match(result.skin,new RegExp(`^${skin}:`));if(skin==='void')assert.ok(result.collapse<.5);
   await page.evaluate(()=>{const a=fixture.animation,now=performance.now();fixture.setPaused(false);a.start=now-.66*a.duration;fixture.frame(now);fixture.setPaused(true);fixture.renderer.render(fixture.scene,fixture.camera);});
   await page.screenshot({path:`test-results/execution-${skin}-${width}.png`});
   await page.evaluate(()=>{fixture.setPaused(false);fixture.finish();fixture.setPaused(true);if(fixture.animation||document.querySelector('#stage').dataset.skinExecution||fixture.fx.children.length)throw Error('Execution resources survived finish');});
  }
 }
 assert.deepEqual(errors,[]);console.log('Premium execution shaders, anticipation once, bounded calls, portrait framing and cleanup passed.');
}finally{await browser?.close();await vite.close();}
