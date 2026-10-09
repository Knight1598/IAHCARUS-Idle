import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { duelEndpoint,duelInvite,invitationCode } from '../src/online.ts';
import { Chess } from 'chess.js';
import { roomSettings,duelOutcome } from '../shared/duel-room.js';
async function service(t,extra={}) {
 const child=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'0',GUEST_DUEL_ONLY:'true',...extra},stdio:['ignore','pipe','pipe']});t.after(()=>child.kill());
 const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),5000);child.stdout.on('data',d=>{const m=String(d).match(/port (\d+)/);if(m){clearTimeout(timer);resolve(Number(m[1]));}});child.on('exit',()=>{clearTimeout(timer);reject(Error('Server exited'));});});
 async function peer(origin){const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`,origin?{headers:{Origin:origin}}:{}),messages=[],waiters=[];t.after(()=>ws.terminate());
 ws.on('message',raw=>{const value=JSON.parse(raw);const i=waiters.findIndex(w=>w.p(value));if(i>=0){const [w]=waiters.splice(i,1);clearTimeout(w.timer);w.resolve(value);}else messages.push(value);});await once(ws,'open');
 return {ws,send:m=>ws.send(JSON.stringify(m)),wait:p=>{const i=messages.findIndex(p);if(i>=0)return Promise.resolve(messages.splice(i,1)[0]);return new Promise((resolve,reject)=>{waiters.push({p,resolve,timer:setTimeout(()=>reject(Error('Missing message')),4000)});});}};}
 return {port,peer};
}
test('duel links reject unsafe servers and never share the resume token',()=>{
 for(const raw of ['javascript:alert(1)','https://a:b@host/ws','http://public.example','wss://host/ws?token=secret','https://host/api'])assert.equal(duelEndpoint(raw),null);
 assert.equal(duelEndpoint('https://game.example'),'wss://game.example/ws');assert.equal(duelEndpoint('http://127.0.0.1:3000'),'ws://127.0.0.1:3000/ws');
 const invite=new URL(duelInvite('https://knight1598.github.io/IAHCARUS-Idle/?token=private','ABC123','https://game.example'));
 assert.equal(invite.searchParams.has('token'),false);assert.equal(invite.searchParams.get('server'),'wss://game.example/ws');assert.equal(invitationCode('?room=abc123'),'ABC123');
});
test('both seats must ready, disconnect resets waiting readiness, and live resume restores the board',async t=>{
 const s=await service(t),a=await s.peer();a.send({type:'create'});const session=await a.wait(m=>m.type==='session');a.send({type:'ready',ready:true});
 const b=await s.peer();b.send({type:'join',code:session.code});const waiting=await b.wait(m=>m.type==='state'&&m.connected.w&&m.connected.b);assert.equal(waiting.started,false);assert.deepEqual(waiting.ready,{w:true,b:false});
 b.send({type:'move',from:'e7',to:'e5',revision:waiting.revision});assert.match((await b.wait(m=>m.type==='error')).message,/พร้อม/);
 a.ws.close();await once(a.ws,'close');await b.wait(m=>m.type==='state'&&!m.connected.w);
 const resumed=await s.peer();resumed.send({type:'resume',code:session.code,token:session.token});const restored=await resumed.wait(m=>m.type==='state');assert.equal(restored.ready.w,false);
 b.send({type:'ready',ready:true});resumed.send({type:'ready',ready:true});const initial=await resumed.wait(m=>m.type==='state'&&m.started);
 resumed.send({type:'move',from:'e2',to:'e4',revision:initial.revision});const moved=await b.wait(m=>m.type==='state'&&m.history.length===1);assert.deepEqual(moved.history,['e4']);
 resumed.ws.close();await once(resumed.ws,'close');const again=await s.peer();again.send({type:'resume',code:session.code,token:session.token});const back=await again.wait(m=>m.type==='state');assert.equal(back.started,true);assert.equal(back.fen,moved.fen);
 again.send({type:'leave'});assert.deepEqual((await b.wait(m=>m.type==='state'&&m.result)).result,{winner:'b',reason:'resign'});
});
test('lobby clocks stay frozen and leaving permits a replacement player',async t=>{
 const s=await service(t,{CHESS_CLOCK_MS:'200'}),a=await s.peer();a.send({type:'create'});const room=await a.wait(m=>m.type==='session');const b=await s.peer();b.send({type:'join',code:room.code});await b.wait(m=>m.type==='session');
 await new Promise(r=>setTimeout(r,230));b.send({type:'sync'});const state=await b.wait(m=>m.type==='state'&&m.connected.b);assert.equal(state.started,false);assert.deepEqual(state.clocks,{w:200,b:200});
 b.send({type:'leave'});await b.wait(m=>m.type==='left');const c=await s.peer();c.send({type:'join',code:room.code});assert.equal((await c.wait(m=>m.type==='session')).color,'b');
});
test('configured production origin allowlist rejects a foreign website',async t=>{
 const origin='https://knight1598.github.io',s=await service(t,{NODE_ENV:'production',DUEL_ALLOWED_ORIGINS:origin}),a=await s.peer(origin);a.send({type:'create'});assert.ok((await a.wait(m=>m.type==='session')).code);
 const denied=new WebSocket(`ws://127.0.0.1:${s.port}/ws`,{headers:{Origin:'https://foreign.example'}});t.after(()=>denied.terminate());const [error]=await once(denied,'error');assert.match(error.message,/401|403/);
});
test('room presets reject arbitrary modes, clocks and prototype keys',()=>{
 for(const settings of [{rule:'ultimate'},{baseMs:1},{increment:1000},{arena:'unknown'},{allowDraw:'true'},JSON.parse('{"__proto__":{}}')])assert.throws(()=>roomSettings(settings));
 assert.equal(roomSettings({baseMs:60000,increment:2}).baseMs,60000);
});
test('host may choose black, configure rules, and must obtain fresh readiness after edits',async t=>{
 const s=await service(t),a=await s.peer();a.send({type:'create',side:'b',settings:{rule:'threeCheck',baseMs:180000,increment:3,arena:'storm'}});
 const host=await a.wait(m=>m.type==='session');assert.equal(host.color,'b');
 const b=await s.peer();b.send({type:'join',code:host.code});assert.equal((await b.wait(m=>m.type==='session')).color,'w');
 const initial=await a.wait(m=>m.type==='state'&&m.connected.w);assert.equal(initial.host,'b');assert.equal(initial.rule,'threeCheck');assert.equal(initial.settings.arena,'storm');
 b.send({type:'configure',settings:{increment:5},settingsRevision:initial.settingsRevision});assert.match((await b.wait(m=>m.type==='error')).message,/เจ้าของ/);
 b.send({type:'ready',ready:true,settingsRevision:initial.settingsRevision});await a.wait(m=>m.type==='state'&&m.ready.w);
 a.send({type:'configure',settings:{baseMs:600000,increment:5},settingsRevision:initial.settingsRevision});
 const edited=await b.wait(m=>m.type==='state'&&m.settings.baseMs===600000);assert.deepEqual(edited.ready,{w:false,b:false});assert.deepEqual(edited.clocks,{w:600000,b:600000});
 a.send({type:'ready',ready:true,settingsRevision:initial.settingsRevision});assert.match((await a.wait(m=>m.type==='error')).message,/เปลี่ยน/);
 a.send({type:'ready',ready:true,settingsRevision:edited.settingsRevision});b.send({type:'ready',ready:true,settingsRevision:edited.settingsRevision});
 const started=await b.wait(m=>m.type==='state'&&m.started);
 a.send({type:'configure',settings:{rule:'standard'},settingsRevision:edited.settingsRevision});assert.match((await a.wait(m=>m.type==='error')).message,/ก่อนเริ่ม/);
 b.send({type:'move',from:'e2',to:'e4',revision:started.revision});const moved=await a.wait(m=>m.type==='state'&&m.history.length===1);assert.ok(moved.clocks.w>600000&&moved.clocks.w<=605000);
});
test('each player equips only their army in the lobby and cosmetics lock on start',async t=>{
 const s=await service(t),a=await s.peer();a.send({type:'create'});const room=await a.wait(m=>m.type==='session');
 const b=await s.peer();b.send({type:'join',code:room.code});let state=await b.wait(m=>m.type==='state'&&m.connected.b);
 a.send({type:'ready',ready:true});await b.wait(m=>m.type==='state'&&m.ready.w);
 b.send({type:'equip',settingsRevision:state.settingsRevision,cosmetics:{skin:'frost',loadout:{b8:'ember',a1:'void'}}});
 state=await a.wait(m=>m.type==='state'&&m.cosmetics.b.skin==='frost');assert.deepEqual(state.cosmetics.b.loadout,{b8:'ember'});assert.equal(state.cosmetics.w.skin,'classic');assert.deepEqual(state.ready,{w:false,b:false});
 a.send({type:'ready',ready:true});b.send({type:'ready',ready:true});await b.wait(m=>m.type==='state'&&m.started);
 b.send({type:'equip',settingsRevision:state.settingsRevision,cosmetics:{skin:'void'}});assert.match((await b.wait(m=>m.type==='error')).message,/ก่อนเริ่ม/);
});
test('draw requires opponent consent, and rematch requires both votes then a new ready gate',async t=>{
 const s=await service(t),a=await s.peer();a.send({type:'create'});const room=await a.wait(m=>m.type==='session');const b=await s.peer();b.send({type:'join',code:room.code});await b.wait(m=>m.type==='session');
 a.send({type:'ready',ready:true});b.send({type:'ready',ready:true});await b.wait(m=>m.type==='state'&&m.started);
 a.send({type:'draw',action:'offer'});await b.wait(m=>m.type==='state'&&m.drawOffer==='w');
 a.send({type:'draw',action:'accept'});assert.match((await a.wait(m=>m.type==='error')).message,/คู่แข่ง/);
 b.send({type:'draw',action:'accept'});const ended=await a.wait(m=>m.type==='state'&&m.result);assert.deepEqual(ended.result,{winner:null,reason:'agreement'});
 a.send({type:'rematch',ready:true});const pending=await b.wait(m=>m.type==='state'&&m.rematch.w);assert.ok(pending.result);
 b.send({type:'rematch',ready:true});const lobby=await a.wait(m=>m.type==='state'&&!m.started&&!m.result&&m.revision>ended.revision);
 assert.deepEqual(lobby.history,[]);assert.deepEqual(lobby.ready,{w:false,b:false});assert.deepEqual(lobby.checks,{w:0,b:0});assert.equal(lobby.host,'w');
 a.send({type:'move',from:'e2',to:'e4',revision:lobby.revision});assert.match((await a.wait(m=>m.type==='error')).message,/พร้อม/);
});
test('online variant objectives win on their legal triggering move',()=>{
 const check=new Chess('4k3/8/8/3N4/8/8/P7/K7 w - - 0 1'),checks={w:2,b:0};
 assert.deepEqual(duelOutcome(check,'threeCheck',check.move('Nf6+'),checks),{winner:'w',reason:'threeCheck'});assert.equal(checks.w,3);
 const hill=new Chess('7k/7p/8/8/8/3K4/P7/8 w - - 0 1');assert.deepEqual(duelOutcome(hill,'kingHill',hill.move('Kd4'),{w:0,b:0}),{winner:'w',reason:'kingHill'});
 const capture=new Chess('7k/7p/8/8/8/1p6/P7/K7 w - - 0 1');assert.deepEqual(duelOutcome(capture,'firstCapture',capture.move('axb3'),{w:0,b:0}),{winner:'w',reason:'firstCapture'});
});
test('a waiting host transfers ownership on leave and disabled draw offers are enforced',async t=>{
 const s=await service(t),a=await s.peer();a.send({type:'create',settings:{allowDraw:false}});const room=await a.wait(m=>m.type==='session');
 const b=await s.peer();b.send({type:'join',code:room.code});await b.wait(m=>m.type==='session');a.send({type:'leave'});
 const transfer=await b.wait(m=>m.type==='state'&&m.host==='b');assert.equal(transfer.ready.b,false);
 b.send({type:'configure',settings:{increment:2},settingsRevision:transfer.settingsRevision});const changed=await b.wait(m=>m.type==='state'&&m.settings.increment===2);
 const c=await s.peer();c.send({type:'join',code:room.code});assert.equal((await c.wait(m=>m.type==='session')).color,'w');
 b.send({type:'ready',ready:true,settingsRevision:changed.settingsRevision});c.send({type:'ready',ready:true,settingsRevision:changed.settingsRevision});await b.wait(m=>m.type==='state'&&m.started);
 b.send({type:'draw',action:'offer'});assert.match((await b.wait(m=>m.type==='error')).message,/ปิดการเสนอ/);
});
