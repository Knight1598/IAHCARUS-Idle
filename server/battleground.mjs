import {randomBytes} from 'node:crypto';
import {newBattleground,submitDeployment,resolveDeployments} from '../shared/battleground.js';
import {cosmeticSkins} from '../shared/cosmetics.js';
/** Isolated room namespace. All deadlines, reserves and captures are server-owned. */
export function battlegroundService(send){
 const rooms=new Map(),peers=new WeakMap();
 const skin=id=>cosmeticSkins.includes(id)?id:'classic';
 const snapshot=(room,ws)=>{const peer=peers.get(ws);send(ws,{type:'bg:state',code:room.code,seat:peer?.seat,host:room.players.findIndex(p=>p?.token===room.host),started:room.started,deadline:room.deadline,now:Date.now(),roundSeconds:room.roundSeconds,game:{...room.game,orders:peer&&room.game.orders[peer.seat]?{[peer.seat]:room.game.orders[peer.seat]}:{}},submitted:room.game.players.map(p=>!!room.game.orders[p.seat]),members:room.players.map(p=>p?{connected:p.ws?.readyState===1,ready:p.ready,skin:p.skin}:null)});};
 const broadcast=room=>room.players.forEach(p=>{if(p)snapshot(room,p.ws);});
 const duration=room=>Math.max(100,Math.min(room.roundSeconds*1000,Number(process.env.BG_ROUND_MS)||60000));
 const expire=room=>{if(room.started&&!room.game.result&&Date.now()>=room.deadline){resolveDeployments(room.game);room.deadline=Date.now()+duration(room);broadcast(room);}};
 function detach(ws){const peer=peers.get(ws);if(!peer)return;const room=rooms.get(peer.code);if(room?.players[peer.seat]?.ws===ws){room.players[peer.seat].ws=null;if(!room.started)room.players[peer.seat].ready=false;room.touched=Date.now();broadcast(room);}peers.delete(ws);}
 function handle(ws,m){
  if(typeof m.type!=='string'||!m.type.startsWith('bg:'))return false;
  if(['bg:create','bg:join','bg:resume'].includes(m.type)){
   if(peers.has(ws))throw Error('ออกจากห้อง Battleground ก่อน');
   let room,seat,token;
   if(m.type==='bg:create'){
    if(rooms.size>=1000)throw Error('ห้องเต็ม');if(![10,20,30].includes(m.roundSeconds))throw Error('เลือกรอบละ 10 / 20 / 30 วินาที');
    let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));room={code,players:[null,null,null,null],game:newBattleground(randomBytes(12).toString('hex')),roundSeconds:m.roundSeconds,started:false,deadline:0,host:null,touched:Date.now()};rooms.set(code,room);seat=0;
   }else{const code=typeof m.code==='string'?m.code.trim().toUpperCase():'';room=rooms.get(code);if(!room)throw Error('ไม่พบห้อง Battleground');
    if(m.type==='bg:resume'){seat=room.players.findIndex(p=>p&&p.token===m.token);if(seat<0)throw Error('กู้ที่นั่งไม่ได้');token=room.players[seat].token;const previous=room.players[seat].ws;if(previous&&previous!==ws){peers.delete(previous);send(previous,{type:'bg:replaced'});previous.close();}}
    else{if(room.started)throw Error('ห้องเริ่มแล้ว');seat=room.players.findIndex(p=>!p);if(seat<0)throw Error('ห้องครบ 4 คนแล้ว');}
   }
   token ||=randomBytes(24).toString('hex');const old=room.players[seat];room.players[seat]={ws,token,skin:m.type==='bg:resume'?old.skin:skin(m.skin),ready:m.type==='bg:resume'&&room.started?old.ready:false};room.host ||=token;room.touched=Date.now();peers.set(ws,{code:room.code,seat});send(ws,{type:'bg:session',code:room.code,seat,token});expire(room);broadcast(room);return true;
  }
  const peer=peers.get(ws),room=peer&&rooms.get(peer.code);if(!room)throw Error('เข้าห้อง Battleground ก่อน');room.touched=Date.now();expire(room);
  if(m.type==='bg:leave'){
   if(room.started&&!room.game.result){const p=room.game.players[peer.seat];p.alive=false;p.hand=[];room.game.board=room.game.board.filter(p=>p.seat!==peer.seat);room.game.revision++;const alive=room.game.players.filter(p=>p.alive);if(alive.length<=1)room.game.result={winners:alive.map(p=>p.seat),reason:'last-hand'};}
   const leaving=room.players[peer.seat];room.players[peer.seat]=null;peers.delete(ws);if(leaving.token===room.host)room.host=room.players.find(Boolean)?.token||null;if(!room.started)room.players.forEach(p=>{if(p)p.ready=false;});broadcast(room);if(room.players.every(p=>!p))rooms.delete(room.code);return true;
  }
  if(m.type==='bg:equip'){if(room.started)throw Error('เปลี่ยนสกินก่อนเริ่มเท่านั้น');room.players[peer.seat].skin=skin(m.skin);room.players.forEach(p=>{if(p)p.ready=false;});broadcast(room);return true;}
  if(m.type==='bg:rematch'){if(!room.game.result||room.players[peer.seat].token!==room.host)throw Error('เจ้าของห้องเริ่มรอบใหม่ได้หลังจบเกม');room.game=newBattleground(randomBytes(12).toString('hex'));room.started=false;room.deadline=0;room.players.forEach(p=>{if(p)p.ready=false;});broadcast(room);return true;}
  if(m.type==='bg:ready'){if(room.started||typeof m.ready!=='boolean')throw Error('พร้อมได้เฉพาะก่อนเริ่ม');room.players[peer.seat].ready=m.ready;if(room.players.every(p=>p?.ready&&p.ws?.readyState===1)){room.started=true;room.deadline=Date.now()+duration(room);}broadcast(room);return true;}
  if(m.type==='bg:deploy'){if(!room.started||room.game.result)throw Error('รอเริ่มรอบ');if(m.round!==room.game.round)throw Error('รอบเปลี่ยนแล้ว เลือกใหม่');submitDeployment(room.game,peer.seat,m.order);snapshot(room,ws);broadcast(room);return true;}
  throw Error('คำสั่ง Battleground ไม่ถูกต้อง');
 }
 const timer=setInterval(()=>{for(const room of rooms.values()){expire(room);if(!room.players.some(p=>p?.ws?.readyState===1)&&Date.now()-room.touched>3600000){rooms.delete(room.code);continue;}const second=Math.ceil((room.deadline-Date.now())/1000);if(room.lastSecond!==second){room.lastSecond=second;broadcast(room);}}},100);timer.unref();
 return {handle,detach,has:ws=>peers.has(ws),close:()=>clearInterval(timer)};
}
