import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const vite=await createServer({server:{host:'127.0.0.1',port:0,watch:{ignored:['**/offline/**','**/dist*/**']}},plugins:[{
  name:'duel-fixture',configureServer(server){server.middlewares.use((req,res,next)=>{
    if(req.url!='/duel-test')return next();
    res.setHeader('Content-Type','text/html');
    res.end('<html><head><link rel="icon" href="data:,"></head><body style="margin:0;background:#030611"><div id="stage" style="position:relative;width:100vw;height:100vh;overflow:hidden"></div></body></html>');
  });}
}]});
let browser;
try{
  await vite.listen();
  browser=await chromium.launch({executablePath:existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined,args:['--no-sandbox','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1100,height:780}}),errors=[],reports=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/duel-test`);
  await page.evaluate(async()=>{
    const [{ChessScene},{Chess},THREE,{training},{analyzeMove},{captureCuePoints}]=await Promise.all([
      import('/src/scene.ts'),import('/node_modules/chess.js/dist/esm/chess.js'),import('/node_modules/three/build/three.module.js'),
      import('/src/training.ts'),import('/shared/events.js'),import('/src/combat.ts')
    ]);
    Object.assign(window,{Chess,THREE,training,analyzeMove,captureCuePoints});
    window.fixture=new ChessScene(document.querySelector('#stage'));fixture.setQuality('low');fixture.setPaused(true);
    window.seek=milliseconds=>{
      const a=fixture.animation,now=performance.now();fixture.setPaused(false);a.start=now-milliseconds;fixture.frame(now);fixture.setPaused(true);
      fixture.renderer.render(fixture.scene,fixture.camera);
    };
    window.start=key=>{
      fixture.finish();fixture.resetPacing();fixture.cinematic=true;fixture.reduced=false;fixture.captureDuration=5000;
      const sample=training[key],before=new Chess(sample.fen),after=new Chess(before.fen());
      const move=after.move({from:sample.from,to:sample.to}),event=analyzeMove(before,after,move);
      fixture.setAppearances({[move.from]:'astral',[event.capturedSquare]:'frost'},{[move.to]:'astral'});
      window.finished=0;window.cues=[];window.dimensions=[];
      fixture.onFinish=()=>finished++;fixture.onCombatCue=(_move,_event,cue,actor,skin)=>cues.push({cue,actor,skin});
      fixture.onDimension=active=>dimensions.push(active);
      fixture.play(before,after,move,event);
      return {before,after,move,event};
    };
  });
  mkdirSync('test-results',{recursive:true});
  for(const viewport of [{width:1100,height:780},{width:390,height:844},{width:844,height:390}]){
    await page.setViewportSize(viewport);
    for(const key of ['pawn','knight','bishop','rook','queen','king']){
      const report=await page.evaluate(key=>{
        const {before,after,move}=start(key),fen=after.fen(),history=after.history();
        const a=fixture.animation,duration=a.duration,renderer=fixture.renderer.getContext(),poses=[];
        for(const milliseconds of [700,1080,1480,1860,2480,2830,3500,3850,4260,4520]){
          seek(milliseconds);
          if(fixture.board.visible||fixture.pieces.visible||fixture.environment.root.visible||!fixture.combatDimension.root.visible||fixture.scene.fog!==null)throw Error('Fight leaked the board or other pieces');
          const actors=fixture.fx.children.filter(child=>child.userData.bones);
          if(actors.length!==2)throw Error('Duel must contain exactly two fighter rigs');
          if(milliseconds<3850&&(!a.avatar.visible||!a.defenderAvatar.visible))throw Error('An active fighter disappeared before the finisher');
          if(milliseconds<3850){
            const facing=new THREE.Vector3(-Math.sin(a.avatar.rotation.y),0,-Math.cos(a.avatar.rotation.y));
            const target=a.defenderAvatar.position.clone().sub(a.avatar.position);target.y=0;target.normalize();
            if(target.distanceTo(facing)>.00001)throw Error('Fighter does not face its opponent');
          }
          for(const actor of actors.filter(actor=>actor.visible)){
            const box=new THREE.Box3().setFromObject(actor);
            for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
              const screen=new THREE.Vector3(x,y,z).project(fixture.camera);
              if(![screen.x,screen.y,screen.z].every(Number.isFinite)||Math.abs(screen.x)>.98||Math.abs(screen.y)>.9||screen.z>1)throw Error(`Clipped ${key} at ${milliseconds}ms`);
            }
          }
          poses.push({milliseconds,exchange:document.querySelector('#stage').dataset.duelExchange,
            attacker:a.avatar.position.toArray(),defender:a.defenderAvatar.position.toArray(),calls:fixture.renderer.info.render.calls});
          if(after.fen()!==fen||JSON.stringify(after.history())!==JSON.stringify(history))throw Error('Cosmetic fight changed chess authority');
        }
        // Same stage and renderer despite changing the board's arena during a duel.
        const background=fixture.scene.background.getHex();fixture.setArena('frost');
        if(fixture.scene.background.getHex()!==background||fixture.scene.fog!==null)throw Error('Arena snapshot leaked into combat dimension');
        seek(4750);
        if(!fixture.board.visible||!fixture.pieces.visible||fixture.combatDimension.root.visible||!fixture.scene.fog)throw Error('Portal did not return to the board');
        if(fixture.renderer.getContext()!==renderer)throw Error('Duel created another WebGL context');
        seek(4999);if(!fixture.animation||finished)throw Error('Default duel finished before five seconds');
        seek(5000);
        if(fixture.animation||finished!==1||fixture.fx.children.length||document.querySelector('#stage').dataset.duelExchange)throw Error('Duel cleanup or settlement repeated');
        if(fixture.pieces.children.some(piece=>piece.userData.square===move.from)||fixture.pieces.children.filter(piece=>piece.userData.square===move.to&&piece.userData.color===move.color).length!==1)throw Error('Capture did not settle exactly once');
        if(cues.map(point=>`${point.actor}:${point.cue}`).join()!==captureCuePoints.map(point=>`${point.actor}:${point.cue}`).join())throw Error('Exchange sound cues repeated or missing');
        if(dimensions.join()!=='true,false')throw Error('Dimension transitions repeated');
        a.duel.dispose();
        return {key,duration,poses,cues:cues.length,dimensions,finished,before:before.fen(),after:fen};
      },key);
      assert.equal(report.duration,5000);assert.ok(report.poses.every(pose=>pose.calls<190));reports.push({viewport,...report});
      if(key==='knight'||viewport.width===1100){
        await page.evaluate(key=>{start(key);seek(3500);},key);
        await page.screenshot({path:`test-results/duel-${key}-${viewport.width}.png`});
        await page.evaluate(()=>{fixture.skip();fixture.setPaused(true);});
      }
    }
  }
  const frozen=await page.evaluate(()=>{
    start('knight');seek(1600);
    const a=fixture.animation,positions=[a.avatar.position.toArray(),a.defenderAvatar.position.toArray()],emitted=cues.length;
    fixture.frame(performance.now()+60000);
    if(cues.length!==emitted||JSON.stringify(positions)!==JSON.stringify([a.avatar.position.toArray(),a.defenderAvatar.position.toArray()]))throw Error('Paused timeline moved or emitted audio');
    fixture.skip();fixture.skip();
    if(finished!==1||fixture.animation||fixture.combatDimension.root.visible||!fixture.board.visible)throw Error('Skip did not restore the board once');
    let disposed=false;try{a.duel.sample(.5);}catch{disposed=true;}
    if(!disposed)throw Error('Canceled Anime timeline remains usable');
    fixture.reduced=true;
    const sample=training.pawn,before=new Chess(sample.fen),next=new Chess(before.fen()),move=next.move({from:sample.from,to:sample.to});
    fixture.play(before,next,move,analyzeMove(before,next,move));
    if(fixture.animation.duration!==180||fixture.animation.duel)throw Error('Reduced effects did not bypass the duel');
    seek(100);if(fixture.combatDimension.root.visible||!fixture.board.visible)throw Error('Reduced effects entered the dimension');
    fixture.finish();return {disposed,emitted};
  });
  assert.ok(frozen.disposed);assert.deepEqual(errors,[]);
  writeFileSync('test-results/cinematic-duel.json',JSON.stringify({reports,frozen,errors},null,2));
  console.log('PASS: six classes, desktop/portrait/landscape framing, isolated two-fighter exchanges, exact 5000ms settlement, ordered cues, arena updates, pause/skip/reduced effects and one WebGL context.');
}finally{await browser?.close();await vite.close();}
