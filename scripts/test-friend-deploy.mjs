import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { once } from 'node:events';
const name='iahcarus-friend-test-'+randomUUID().slice(0,8),image=process.env.FRIEND_TEST_IMAGE||'iahcarus-friend:test';
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const peers=[];
try{
 docker('run','-d','--rm','--name',name,'-p','127.0.0.1::3000','-e','GUEST_DUEL_ONLY=true','-e','DUEL_ALLOWED_ORIGINS=https://knight1598.github.io',image);
 const mapped=docker('port',name,'3000/tcp'),port=Number(mapped.split(':').at(-1));
 let healthy=false;for(let n=0;n<40;n++){try{healthy=(await(await fetch(`http://127.0.0.1:${port}/health`)).json()).ok;if(healthy)break;}catch{}await new Promise(r=>setTimeout(r,150));}assert.equal(healthy,true);
 async function peer(){const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`,{headers:{Origin:'https://knight1598.github.io'}}),messages=[],waiters=[];peers.push(ws);ws.on('message',raw=>{const value=JSON.parse(raw),i=waiters.findIndex(w=>w.p(value));if(i>=0){const [w]=waiters.splice(i,1);clearTimeout(w.timer);w.resolve(value);}else messages.push(value);});await once(ws,'open');return {send:m=>ws.send(JSON.stringify(m)),wait:p=>{const i=messages.findIndex(p);if(i>=0)return Promise.resolve(messages.splice(i,1)[0]);return new Promise((resolve,reject)=>waiters.push({p,resolve,timer:setTimeout(()=>reject(Error('Missing container reply')),4000)}));}};}
 const a=await peer();a.send({type:'create'});const room=await a.wait(m=>m.type==='session');const b=await peer();b.send({type:'join',code:room.code});const waiting=await b.wait(m=>m.type==='state');assert.equal(waiting.started,false);
 a.send({type:'ready',ready:true});b.send({type:'ready',ready:true});const start=await a.wait(m=>m.type==='state'&&m.started);
 a.send({type:'move',from:'e2',to:'e4',revision:start.revision});assert.deepEqual((await b.wait(m=>m.type==='state'&&m.history.length===1)).history,['e4']);
 assert.equal(docker('exec',name,'id','-u'),'1000');docker('exec',name,'sh','-c','test ! -e /app/data/accounts.sqlite');
 console.log('PASS: production Docker image, non-root guest service, allowed Pages origin, ready gate, two-player move and no account database.');
}finally{peers.forEach(ws=>ws.terminate());try{docker('rm','-f',name);}catch{}}
