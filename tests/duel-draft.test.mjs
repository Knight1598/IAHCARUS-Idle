import test from 'node:test';
import assert from 'node:assert/strict';
import { SpecialChess,readSpecialConfig } from '../src/special.ts';
import { defaultSkillTeam,skillSpend,normalizeTeam,botDraft,botBan } from '../src/duel-draft.ts';
import { fieldState } from '../src/field-events.ts';
import { battleMVP } from '../src/progression.ts';
import { executionFrame } from '../src/skin-execution.ts';
import { CAPTURE_CONTACT, CAPTURE_RELEASE } from '../src/combat.ts';
const config=extra=>readSpecialConfig({fieldEvents:true,seed:2,charges:3,...extra});
function at(fen,plies,remaining={w:3,b:3},extra={}){
  const g=new SpecialChess(fen,undefined,config(extra)),s=g.snapshot();s.plies=plies;s.remaining=remaining;
  return new SpecialChess(fen,s);
}
test('enemy bans, equal budgets and disabled class skills are enforced by rules and save normalization',()=>{
  const teams={w:{...defaultSkillTeam(),n:'alternate'},b:defaultSkillTeam()};
  const g=new SpecialChess('7k/2n5/8/8/8/2N5/7P/K7 w - - 0 1',undefined,readSpecialConfig({drafted:true,teams,bans:{w:'n:signature',b:'p:alternate'}}));
  assert.equal(g.choice('n','w'),'alternate');assert.equal(g.choice('n','b'),'off');
  assert.ok(g.ultimateMoves('c3').some(m=>m.to==='e5'));assert.ok(!g.ultimateMoves('c3').some(m=>m.to==='c5'));
  g.move('h3');assert.equal(g.available('c7'),false);assert.equal(g.ultimateMoves('c7').length,0);
  for(let seed=0;seed<120;seed++){const ban=botBan(seed),team=botDraft(seed,ban);assert.ok(skillSpend(team)<=12);const [p,choice]=ban.split(':');assert.notEqual(team[p],choice);}
  assert.ok(skillSpend(normalizeTeam(Object.fromEntries(['p','n','b','r','q','k'].map(p=>[p,'alternate']))))<=12);
  assert.equal(readSpecialConfig().drafted,false);assert.equal(readSpecialConfig().fieldEvents,false);
});
test('forecasts give two complete rounds and event identity repeats only after 48 plies',()=>{
  assert.equal(fieldState(0,0).startsIn,2);assert.equal(fieldState(1,0).startsIn,2);
  assert.equal(fieldState(2,0).startsIn,1);assert.equal(fieldState(4,0).active.kind,'charge');
  assert.equal(fieldState(8,0).forecast.kind,'portal');assert.equal(fieldState(12,0).active.kind,'portal');
  for(let p=0;p<48;p++)assert.deepEqual({...fieldState(p,7),round:0},{...fieldState(p+48,7),round:0});
});
test('charge awards only at round end, once per occupying side, capped and reversible',()=>{
  const g=at('7k/8/8/4p3/3P4/8/8/K7 w - - 0 1',4,{w:1,b:2},{seed:0});
  const before=g.snapshot();g.move('Kb1');assert.deepEqual(g.remaining,{w:1,b:2});
  g.move('Kg8');assert.deepEqual(g.remaining,{w:2,b:3});g.undo();g.undo();assert.deepEqual(g.snapshot(),before);
  g.move('Kb1');g.move('Kg8');g.move('Ka1');g.move('Kh8');assert.deepEqual(g.remaining,{w:3,b:3});
});
test('portal capture uses one ordinary turn, preserves charge/origin, can replay and undo',()=>{
  const fen='7k/8/6q1/8/8/1N6/7P/K7 w - - 0 1',g=at(fen,12),snapshot=g.snapshot();
  const action=g.portalMoves('b3').find(m=>m.to==='g6');assert.ok(action);assert.equal(action.captured,'q');
  const move=g.move({from:'b3',to:'g6',portal:true});assert.equal(move.portal,true);assert.equal(g.turn(),'b');
  assert.deepEqual(g.remaining,{w:3,b:3});assert.equal(g.snapshot().origins.g6,snapshot.origins.b3);
  assert.equal(g.get('g6').type,'n');assert.match(move.san,/P:Nb3xg6/);
  const replay=new SpecialChess(fen,snapshot);replay.move(move.san);assert.equal(replay.fen(),g.fen());assert.deepEqual(replay.snapshot(),g.snapshot());
  const mvp=battleMVP(fen,[move],'w',()=>new SpecialChess(fen,snapshot));assert.equal(mvp.origin,'b3');assert.equal(mvp.kills,1);
  g.undo();assert.equal(g.fen(),fen);assert.deepEqual(g.snapshot(),snapshot);
  const off=at(fen,10);assert.deepEqual(off.portalMoves(),[]);
});
test('portals forbid own pieces, kings, exposure and stale event actions',()=>{
  for(const fen of ['7k/8/6P1/8/8/1N6/7P/K7 w - - 0 1','8/8/6k1/8/8/1N6/7P/K7 w - - 0 1','7k/8/8/8/8/1K6/8/7R w - - 0 1','7k/8/8/8/8/rN5K/8/8 w - - 0 1']){
    const g=at(fen,12);assert.equal(g.portalMoves('b3').length,0,fen);assert.throws(()=>g.move({from:'b3',to:'g6',portal:true}));
  }
  const zero=at('7k/8/8/8/8/2N5/8/K7 w - - 0 1',4,{w:0,b:0},{charges:0});assert.equal(zero.isInsufficientMaterial(),true);
});
test('three premium executions retain contact clock and different visual signatures',()=>{
  const anticipation=CAPTURE_RELEASE+.005,impact=CAPTURE_CONTACT;
  for(const skin of ['storm','void','prism']){assert.equal(executionFrame(skin,anticipation).quiet,true);assert.equal(executionFrame(skin,impact).quiet,false);assert.equal(executionFrame(skin,1).strength,0);}
  assert.ok(executionFrame('prism',3.45/5).echo>0);assert.equal(executionFrame('storm',3.45/5).echo,0);
  assert.ok(executionFrame('void',.9).collapse>0);assert.equal(executionFrame('prism',.9).collapse,0);
  assert.equal(executionFrame('classic',anticipation).quiet,false);
});

test('premium execution effects have bounded batches and releasable independent resources',async()=>{
  const THREE=await import('three'),{ExecutionVFX}=await import('../src/execution-vfx.ts');
  const from=new THREE.Vector3(-1,0,0),target=new THREE.Vector3(1,0,0);
  for(const skin of ['storm','void','prism','nova','phantom','dragon']){
    const fx=new ExecutionVFX(skin);assert.ok(fx.group.children.length<=3);
    fx.update(CAPTURE_RELEASE+.005,from,target);assert.equal(fx.group.visible,true);
    assert.ok(fx.group.children.every(p=>Number.isFinite(p.position.x+p.position.y+p.position.z)));
    fx.update(1,from,target);assert.equal(fx.group.visible,false);
    const materials=new Set();for(const mesh of fx.group.children){mesh.geometry.dispose();materials.add(mesh.material);}materials.forEach(m=>m.dispose());
  }
});

 test('solar, veil and wyrm executions have distinct volumetric geometry and travel',async()=>{
  const THREE=await import('three'),{ExecutionVFX}=await import('../src/execution-vfx.ts');
  const from=new THREE.Vector3(0,0,0),target=new THREE.Vector3(0,0,2);
  const effects=['nova','phantom','dragon'].map(skin=>new ExecutionVFX(skin));
  const geometrySignatures=effects.map(fx=>fx.group.children.map(mesh=>mesh.geometry.getAttribute('position').count).join(':'));
  assert.equal(new Set(geometrySignatures).size,3,'each execution needs different geometry, not only a tint');
  for(const fx of effects){
    const states=[];
    for(const t of [.65,.735,CAPTURE_CONTACT+.01,.88]){fx.update(t,from,target);states.push(fx.group.children.map(mesh=>[...mesh.position.toArray(),...mesh.scale.toArray(),...mesh.rotation.toArray().slice(0,3)]));}
    assert.notDeepEqual(states[0],states[2],'charge must release into a different spatial pose');
    fx.update(CAPTURE_CONTACT+.01,from,target);
    assert.ok(fx.group.children.every(mesh=>mesh.geometry.type!=='PlaneGeometry'),'a flat panel cannot substitute for the volume');
    fx.update(1,from,target);assert.equal(fx.group.visible,false);
    for(const mesh of fx.group.children){mesh.geometry.dispose();mesh.material.dispose();}
  }
});
