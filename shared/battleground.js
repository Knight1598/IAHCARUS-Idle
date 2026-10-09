/** Four-seat simultaneous deployment. Pure rules shared by bots and the server. */
export const bgTypes=['p','n','b','r','q','k'];
export const bgValues={p:1,n:3,b:3,r:5,q:9,k:2};
export const bgSize=10;
export const bgColors=['#72edff','#ff9877','#cb9cff','#a9f486'];
export function newBattleground(id='local') {
 return {id,round:1,revision:0,board:[],players:Array.from({length:4},(_,seat)=>({seat,hand:['p','p','p','p','n','n','b','b','r','r','q','k'],alive:true,captured:0,missed:0})),orders:{},events:[],result:null};
}
export function submitDeployment(game,seat,order){
 if(game.result||!game.players[seat]?.alive)throw Error('คุณไม่ได้อยู่ในรอบนี้');
 if(!order||!bgTypes.includes(order.type)||!Number.isInteger(order.cell)||order.cell<0||order.cell>=100)throw Error('ช่องหรือหมากไม่ถูกต้อง');
 if(!game.players[seat].hand.includes(order.type))throw Error('ไม่มีหมากนี้ในมือ');
 if(game.board.some(p=>p.cell===order.cell&&p.seat===seat))throw Error('ช่องนี้มีหมากของคุณอยู่');
 game.orders[seat]={type:order.type,cell:order.cell};
}
function threatened(piece,target,board){
 const x=piece.cell%10,y=Math.floor(piece.cell/10),dx=target.cell%10-x,dy=Math.floor(target.cell/10)-y;
 if(piece.type==='n')return Math.abs(dx)*Math.abs(dy)===2;
 if(piece.type==='p')return Math.abs(dx)===1&&Math.abs(dy)===1;
 if(piece.type==='k')return Math.max(Math.abs(dx),Math.abs(dy))===1;
 const diagonal=Math.abs(dx)===Math.abs(dy)&&dx!==0,straight=(dx===0)!==(dy===0);
 if(!(piece.type==='q'&&(diagonal||straight)||piece.type==='r'&&straight||piece.type==='b'&&diagonal))return false;
 const steps=Math.max(Math.abs(dx),Math.abs(dy));for(let i=1;i<steps;i++)if(board.some(p=>p.cell===(y+Math.sign(dy)*i)*10+x+Math.sign(dx)*i))return false;
 return true;
}
export function deploymentTargets(game,seat,order){
 const piece={seat,...order};return game.board.filter(p=>p.seat!==seat&&(p.cell===order.cell||threatened(piece,p,game.board))).map(p=>p.cell);
}
export function resolveDeployments(game){
 if(game.result)return game;
 const events=[],priority=seat=>(seat-(game.round-1)%4+4)%4,arrivals=[];
 for(const player of game.players){if(!player.alive)continue;const order=game.orders[player.seat];
  if(!order){const type=player.hand.shift();player.missed++;events.push({kind:'timeout',seat:player.seat,type});continue;}
  const index=player.hand.indexOf(order.type);if(index<0)throw Error('หมากในมือเปลี่ยนแล้ว');player.hand.splice(index,1);player.missed=0;
  arrivals.push({id:`${game.round}:${player.seat}`,seat:player.seat,type:order.type,cell:order.cell});
 }
 const steal=(attacker,victim,kind)=>{game.players[attacker.seat].hand.push(victim.type);game.players[attacker.seat].captured++;events.push({kind,seat:attacker.seat,victim:victim.seat,type:victim.type,attackerType:attacker.type,from:attacker.cell,cell:victim.cell});};
 const deployed=[];
 for(const cell of [...new Set(arrivals.map(p=>p.cell))]){
  const rivals=arrivals.filter(p=>p.cell===cell).sort((a,b)=>priority(a.seat)-priority(b.seat)),winner=rivals[0];
  for(const loser of rivals.slice(1))steal(winner,loser,'clash');
  const old=game.board.find(p=>p.cell===cell);if(old){steal(winner,old,'capture');game.board=game.board.filter(p=>p.id!==old.id);}
  game.board.push(winner);deployed.push(winner);events.push({kind:'deploy',seat:winner.seat,type:winner.type,cell});
 }
 // Attacks resolve from one immutable board snapshot: trades are possible.
 const targets=new Map();
 for(const attacker of deployed){const target=game.board.filter(p=>p.seat!==attacker.seat&&threatened(attacker,p,game.board)).sort((a,b)=>Math.max(Math.abs(a.cell%10-attacker.cell%10),Math.abs(Math.floor(a.cell/10)-Math.floor(attacker.cell/10)))-Math.max(Math.abs(b.cell%10-attacker.cell%10),Math.abs(Math.floor(b.cell/10)-Math.floor(attacker.cell/10)))||a.cell-b.cell)[0];if(target){const contenders=targets.get(target.id)||[];contenders.push(attacker);targets.set(target.id,contenders);}}
 for(const [id,attackers] of targets){const victim=game.board.find(p=>p.id===id),attacker=attackers.sort((a,b)=>priority(a.seat)-priority(b.seat))[0];steal(attacker,victim,'capture');}
 game.board=game.board.filter(p=>!targets.has(p.id));
 for(const player of game.players)if(player.alive&&!player.hand.length){player.alive=false;game.board=game.board.filter(p=>p.seat!==player.seat);events.push({kind:'eliminated',seat:player.seat});}
 const survivors=game.players.filter(p=>p.alive);
 if(survivors.length<=1)game.result={winners:survivors.map(p=>p.seat),reason:'last-hand'};
 else if(game.round>=40){const score=p=>p.hand.length*100+p.captured,top=Math.max(...survivors.map(score));game.result={winners:survivors.filter(p=>score(p)===top).map(p=>p.seat),reason:'round-limit'};}
 game.events=events;game.orders={};game.round++;game.revision++;return game;
}
export function botDeployment(game,seat,random=Math.random){
 const player=game.players[seat];if(!player?.alive)return null;
 let best=-Infinity,options=[];
 for(const type of new Set(player.hand))for(let cell=0;cell<100;cell++){
  if(game.board.some(p=>p.cell===cell&&p.seat===seat))continue;
  const order={type,cell},targets=deploymentTargets(game,seat,order);const score=targets.reduce((sum,c)=>sum+bgValues[game.board.find(p=>p.cell===c).type],0)*8+(game.board.some(p=>p.cell===cell)?5:0)-bgValues[type]*.1;
  if(score>best){best=score;options=[order];}else if(score===best)options.push(order);
 }
 return options[Math.floor(random()*options.length)]||null;
}
