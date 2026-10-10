import assert from 'node:assert/strict';
import {existsSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createServer} from 'vite';
const vite=await createServer({server:{host:'127.0.0.1',port:0,watch:{ignored:['**/offline/**','**/dist*/**']}},plugins:[{name:'dimension-fixture',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url!='/dimension-test')return next();res.setHeader('Content-Type','text/html');res.end('<html><link rel="icon" href="data:,"><body style="margin:0;background:#030611"><div id="stage" style="position:relative;width:100vw;height:100vh;overflow:hidden"></div></body></html>');});}}]});
let browser;
try{
 await vite.listen();browser=await chromium.launch({executablePath:existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1000,height:760}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/dimension-test`);
 await page.evaluate(async()=>{const [{ChessScene},{Chess}]=await Promise.all([import('/src/scene.ts'),import('/node_modules/chess.js/dist/esm/chess.js')]);window.fixture=new ChessScene(document.querySelector('#stage'));window.Chess=Chess;fixture.setQuality('low');fixture.cinematic=true;fixture.cinematicScope='all';fixture.setPaused(true);});
 mkdirSync('test-results',{recursive:true});
 for(const width of [1000,390]){
  await page.setViewportSize({width,height:width===390?844:760});
  for(const theme of ['solar','veil','wyrm','glacier','machine','nebula','sanctum','abyss']){
   const result=await page.evaluate(async theme=>{
    const [{analyzeMove},{finisherThemes}]=await Promise.all([import('/shared/events.js'),import('/shared/presentation.js')]);
    const before=new Chess('7k/8/8/3q4/8/2N5/7P/K7 w - - 0 1'),after=new Chess(before.fen()),move=after.move('Nxd5');
    fixture.resetPacing();fixture.setPresentation({dimension:`dimension-${theme}`,finisher:`finisher-${finisherThemes[['solar','veil','wyrm','glacier','machine','nebula','sanctum','abyss'].indexOf(theme)].id}`});
    fixture.setAppearances({c3:theme==='wyrm'?'dragon':theme==='veil'?'phantom':'nova',d5:'frost'},{d5:'nova'});
    fixture.setPaused(false);fixture.play(before,after,move,analyzeMove(before,after,move));fixture.setPaused(true);
    window.transitions=[];fixture.onDimension=active=>transitions.push(active);
    const seek=t=>{const a=fixture.animation,now=performance.now();fixture.setPaused(false);a.duration=100000;a.start=now-t*a.duration;fixture.frame(now);fixture.setPaused(true);fixture.renderer.render(fixture.scene,fixture.camera);};window.seek=seek;
    seek(.35);const inside={domain:document.querySelector('#stage').dataset.combatDimension,board:fixture.board.visible,pieces:fixture.pieces.visible,environment:fixture.environment.root.visible,fog:fixture.scene.fog,calls:fixture.renderer.info.render.calls};
    seek(.74);return {inside,actors:[fixture.animation.avatar.visible,fixture.animation.defenderAvatar.visible],batches:fixture.combatDimension.root.children.length};
   },theme);
   assert.equal(result.inside.domain,theme);assert.equal(result.inside.board,false);assert.equal(result.inside.pieces,false);assert.equal(result.inside.environment,false);assert.equal(result.inside.fog,null);assert.ok(result.actors.every(Boolean));assert.ok(result.batches<=4);assert.ok(result.inside.calls<190);
   await page.screenshot({path:`test-results/dimension-${theme}-${width}.png`});
   await page.evaluate(()=>{seek(.97);if(!fixture.board.visible||fixture.combatDimension.root.visible||document.querySelector('#stage').dataset.combatDimension)throw Error('Board did not return');seek(.65);fixture.skip();if(fixture.animation||!fixture.board.visible||!fixture.pieces.visible||!fixture.environment.root.visible||fixture.combatDimension.root.visible||!fixture.scene.fog)throw Error('Skip leaked dimension state');if(JSON.stringify(transitions)!=='[true,false,true,false]')throw Error('Domain cues repeat or fail to return');fixture.setPaused(true);});
  }
 }
 await page.evaluate(async()=>{const {analyzeMove}=await import('/shared/events.js');fixture.reduced=true;const before=new Chess('7k/8/8/3q4/8/2N5/7P/K7 w - - 0 1'),after=new Chess(before.fen()),move=after.move('Nxd5');fixture.setPaused(false);fixture.play(before,after,move,analyzeMove(before,after,move));fixture.setPaused(true);seek(.35);if(fixture.combatDimension.root.visible||!fixture.board.visible)throw Error('Reduced motion should keep the board');fixture.finish();});
 assert.deepEqual(errors,[]);console.log('PASS: eight alternate battle sets and finishers at desktop/portrait sizes, board isolation, bounded calls, exact return/skip cleanup, one-shot domain cues and reduced motion.');
}finally{await browser?.close();await vite.close();}
