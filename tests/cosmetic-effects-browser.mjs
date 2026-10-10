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

 const results=await page.evaluate(async()=>{
  const [{boardThemes,skillThemes,finisherThemes},{analyzeMove}]=await Promise.all([import('/shared/presentation.js'),import('/shared/events.js')]);
  const boards=[],skills=[],finishers=[];
  for(const theme of boardThemes){fixture.setPresentation({board:`board-${theme.id}`});const tile=fixture.board.children.find(v=>v.isInstancedMesh),canvas=tile.material.map.image;const data=canvas.getContext('2d').getImageData(0,0,128,128).data;let hash=0;for(const n of data)hash=(hash*31+n)|0;boards.push(hash);fixture.setArena('citadel');if(tile.material.map.image!==canvas)throw Error('Arena reset lost board skin');}
  fixture.setPresentation({});if(document.querySelector('#stage').dataset.boardCosmetic)throw Error('Unequip board failed');const tile=fixture.board.children.find(v=>v.isInstancedMesh);if(tile.material.map!==tile.userData.baseMap)throw Error('Original tile texture was not restored');
  for(const theme of skillThemes){
   const before=new Chess(),after=new Chess(),move=after.move('Nf3');fixture.resetPacing();fixture.setPresentation({skill:`skill-${theme.id}`});fixture.setPaused(false);fixture.play(before,after,move,analyzeMove(before,after,move));fixture.setPaused(true);
   const a=fixture.animation,now=performance.now();fixture.setPaused(false);a.duration=100000;a.start=now-.18*a.duration;fixture.frame(now);fixture.setPaused(true);fixture.renderer.render(fixture.scene,fixture.camera);
   skills.push({vertices:a.skillFx.mesh.geometry.attributes.position.count,position:Array.from(a.skillFx.mesh.geometry.attributes.position.array).slice(0,30).join(','),visible:a.skillFx.mesh.visible,calls:fixture.renderer.info.render.calls});
   fixture.skip();if(fixture.animation||fixture.fx.children.length||document.querySelector('#stage').dataset.skillCosmetic)throw Error('Skill cleanup failed');fixture.setPaused(true);
  }
  for(const theme of finisherThemes.slice(8)){
   fixture.combatDimension.root.visible=true;fixture.combatDimension.update(.74,fixture.camera.position.clone().set(0,0,0),'solar',theme.id);
   fixture.renderer.render(fixture.scene,fixture.camera);const mesh=fixture.combatDimension.root.children.at(-1);finishers.push({count:mesh.geometry.attributes.position.count,positions:Array.from(mesh.geometry.attributes.position.array).slice(0,30).join(',')});
  }
  return {boards,skills,finishers};
 });
 assert.equal(new Set(results.boards).size,8);assert.equal(new Set(results.skills.map(v=>`${v.vertices}:${v.position}`)).size,8);assert.ok(results.skills.every(v=>v.visible&&v.calls<190));assert.equal(new Set(results.finishers.map(v=>`${v.count}:${v.positions}`)).size,8);assert.deepEqual(errors,[]);
 console.log('PASS: eight unique board textures persist across arena changes, eight distinct skill geometries animate on real moves and clean up, eight new finisher geometries are distinct, no shader errors and draw calls stay bounded.');
}finally{await browser?.close();await vite.close();}
