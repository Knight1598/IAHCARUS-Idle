import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Chess, type Square, type PieceSymbol } from 'chess.js';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<main id="stage"><div id="event"></div></main><aside><small>PURE CODE · LOCAL DUEL</small><h1>Special Chess 3D</h1><p id="status"></p><p>แตะหมากแล้วแตะช่องเพื่อเดิน<br>ลากเพื่อหมุนกระดาน · เลื่อนเพื่อซูม</p><button id="reset">เริ่มใหม่</button><button id="view">กลับมุมกล้อง</button><button id="skip">ข้ามเอฟเฟกต์</button><p>ต้นแบบเล่นสองคนบนเครื่องเดียว<br>ทุกโมเดลสร้างด้วยโค้ด ไม่มี asset ภายนอก</p><h3>ประวัติการเดิน</h3><div id="moves"></div></aside><dialog id="promotion"><p>เลือกหมากเพื่อเลื่อนขั้น</p>${['q','r','b','n'].map(p=>`<button data-piece="${p}">${({q:'ควีน',r:'รุก',b:'บิชอป',n:'ม้า'} as Record<string,string>)[p]}</button>`).join('')}</dialog>`;
const stage = document.querySelector<HTMLElement>('#stage')!;
const status = document.querySelector<HTMLElement>('#status')!;
const event = document.querySelector<HTMLElement>('#event')!;
const dialog = document.querySelector<HTMLDialogElement>('#promotion')!;
const game = new Chess();
const scene = new THREE.Scene(); scene.background = new THREE.Color('#0b101a');
const camera = new THREE.PerspectiveCamera(42,1,.1,100); camera.position.set(0,10,10);
const renderer = new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true; stage.append(renderer.domElement);
const controls = new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.minDistance=7; controls.maxDistance=20; controls.maxPolarAngle=Math.PI/2.25; controls.target.set(0,0,0);
scene.add(new THREE.HemisphereLight(0xb9e9ff,0x192336,2));
const sun = new THREE.DirectionalLight(0xffffff,3); sun.position.set(3,9,4); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); Object.assign(sun.shadow.camera,{left:-6,right:6,top:6,bottom:-6}); scene.add(sun);
const board = new THREE.Group(); scene.add(board);
const pieces = new THREE.Group(); scene.add(pieces);
const markers = new THREE.Group(); scene.add(markers);
const material = (color:number,metalness=.3)=>new THREE.MeshStandardMaterial({color,metalness,roughness:.32});
const mesh = (g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Group,x=0,y=0,z=0)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
const coords = (s:Square)=>new THREE.Vector3(s.charCodeAt(0)-97-3.5,0,3.5-(Number(s[1])-1));
for(let rank=1;rank<=8;rank++)for(let file=0;file<8;file++){const square=`${String.fromCharCode(97+file)}${rank}` as Square;const p=coords(square);const tile=mesh(new THREE.BoxGeometry(.98,.16,.98),material((rank+file)%2?0x344b62:0x97b3c2),board,p.x,-.08,p.z);tile.userData.square=square;}
mesh(new THREE.BoxGeometry(8.35,.25,8.35),material(0x182637,.7),board,0,-.27,0);
function makePiece(type:PieceSymbol,color:'w'|'b'){
 const group=new THREE.Group(); const body=material(color==='w'?0xe4edf4:0x222937,.55); const accent=material(color==='w'?0x39d9e8:0xae70ff,.6);
 mesh(new THREE.CylinderGeometry(.27,.33,.13,24),body,group,0,.1);
 mesh(new THREE.CylinderGeometry(.12,.23,.38,24),body,group,0,.34);
 mesh(new THREE.TorusGeometry(.2,.035,8,24),accent,group,0,.17).rotation.x=Math.PI/2;
 if(type==='p')mesh(new THREE.SphereGeometry(.18,20,12),body,group,0,.65);
 if(type==='r'){mesh(new THREE.CylinderGeometry(.25,.2,.25,16),body,group,0,.66);for(let i=0;i<4;i++){const a=i*Math.PI/2;mesh(new THREE.BoxGeometry(.13,.16,.13),accent,group,Math.cos(a)*.2,.85,Math.sin(a)*.2);}}
 if(type==='b'){mesh(new THREE.ConeGeometry(.21,.46,16),body,group,0,.74);mesh(new THREE.SphereGeometry(.07,12,8),accent,group,0,1);}
 if(type==='n'){const neck=mesh(new THREE.BoxGeometry(.23,.42,.22),body,group,0,.67);neck.rotation.x=-.25;mesh(new THREE.BoxGeometry(.23,.2,.4),body,group,0,.86,-.09);for(const x of [-.065,.065])mesh(new THREE.ConeGeometry(.055,.15,4),accent,group,x,1,-.01);for(const x of [-.12,.12])mesh(new THREE.SphereGeometry(.035,8,8),accent,group,x,.9,-.2);group.rotation.y=color==='w'?0:Math.PI;}
 if(type==='q'||type==='k'){mesh(new THREE.CylinderGeometry(.16,.12,.23,16),body,group,0,.65);mesh(new THREE.CylinderGeometry(.23,.15,.16,16),accent,group,0,.85);if(type==='q'){for(let i=0;i<6;i++){const a=i*Math.PI/3;mesh(new THREE.ConeGeometry(.06,.2,8),body,group,Math.cos(a)*.17,1,Math.sin(a)*.17);}}else{mesh(new THREE.BoxGeometry(.08,.3,.08),accent,group,0,1.06);mesh(new THREE.BoxGeometry(.24,.08,.08),accent,group,0,1.1);}}
 return group;
}
let selected:Square|null=null;
let pending:{from:Square;to:Square}|null=null;
let animation:{object:THREE.Group;from:THREE.Vector3;to:THREE.Vector3;start:number;type:PieceSymbol;duration:number}|null=null;
const sparks: {object:THREE.Mesh;velocity:THREE.Vector3;life:number}[]=[];
function clear(group:THREE.Group){for(const child of [...group.children]){group.remove(child);child.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});}}
function rebuild(){clear(pieces);for(const row of game.board())for(const p of row)if(p){const obj=makePiece(p.type,p.color);obj.position.copy(coords(p.square));obj.userData.square=p.square;pieces.add(obj);}clear(markers);selected=null;updateStatus();}
function updateStatus(){status.textContent=game.isCheckmate()?'รุกฆาต — '+(game.turn()==='w'?'ดำ':'ขาว')+' ชนะ':game.isDraw()?'เสมอ':`ตาฝ่าย${game.turn()==='w'?'ขาว':'ดำ'}${game.isCheck()?' — รุก!':''}`;const h=game.history();document.querySelector('#moves')!.textContent=h.map((s,i)=>`${i%2===0?`${Math.floor(i/2)+1}. `:''}${s}${i%2?'\n':'  '}`).join('');}
function select(square:Square){clear(markers);selected=square;for(const move of game.moves({square,verbose:true})){const p=coords(move.to);const ring=mesh(new THREE.RingGeometry(.19,.3,24),new THREE.MeshBasicMaterial({color:move.captured?0xff687b:0x51f1dc,side:THREE.DoubleSide}),markers,p.x,.015,p.z);ring.rotation.x=-Math.PI/2;}}
function burst(position:THREE.Vector3,color:number){for(let i=0;i<30;i++){const s=new THREE.Mesh(new THREE.IcosahedronGeometry(.05),material(color));s.position.copy(position).add(new THREE.Vector3(0,.5,0));scene.add(s);sparks.push({object:s,velocity:new THREE.Vector3((Math.random()-.5)*3,Math.random()*3,(Math.random()-.5)*3),life:1});}}
function move(from:Square,to:Square,promotion:PieceSymbol='q'){
 const object=pieces.children.find(o=>o.userData.square===from) as THREE.Group|undefined;
 const legal=game.moves({square:from,verbose:true}).find(m=>m.to===to&&(!m.promotion||m.promotion===promotion));if(!legal||!object)return;
 const wasCheck=game.isCheck();const result=game.move({from,to,promotion});if(!result)return;
 clear(markers);selected=null;
 if(result.captured){const capturedSquare=result.flags.includes('e')?`${to[0]}${from[1]}`:to;const victim=pieces.children.find(o=>o.userData.square===capturedSquare);if(victim)pieces.remove(victim);burst(coords(to),result.color==='w'?0x51f1dc:0xc592ff);}
 event.textContent=game.isCheckmate()?'CHECKMATE':game.isCheck()?'CHECK':wasCheck&&result.captured?'ROYAL RESCUE':result.flags.includes('k')||result.flags.includes('q')?'ROYAL GUARD':result.promotion?'ASCENSION':result.captured?({p:'BRAVE STRIKE',n:'PHANTOM CHARGE',b:'PRISM JUDGMENT',r:'SIEGE BREAKER',q:'ROYAL ECLIPSE',k:'SOVEREIGN’S VERDICT'}[result.piece]):'';
 animation={object,from:coords(from),to:coords(to),start:performance.now(),type:result.piece,duration:result.captured?850:450};updateStatus();
}
let down={x:0,y:0};renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener('pointerup',e=>{
 if(animation||game.isGameOver()||Math.hypot(e.clientX-down.x,e.clientY-down.y)>8)return;
 const rect=renderer.domElement.getBoundingClientRect();const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
 const hits=ray.intersectObjects([...pieces.children,...board.children],true);let square:Square|undefined;
 for(const hit of hits){let o:THREE.Object3D|null=hit.object;while(o&&!o.userData.square)o=o.parent;if(o?.userData.square){square=o.userData.square;break;}}if(!square)return;
 if(selected){const moves=game.moves({square:selected,verbose:true}).filter(m=>m.to===square);if(moves.length){if(moves.some(m=>m.promotion)){pending={from:selected,to:square};dialog.showModal();}else move(selected,square);return;}}
 const p=game.get(square);if(p?.color===game.turn())select(square);else{selected=null;clear(markers);}
});
dialog.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.onclick=()=>{if(pending)move(pending.from,pending.to,b.dataset.piece as PieceSymbol);pending=null;dialog.close();});dialog.addEventListener('cancel',()=>{pending=null;});
document.querySelector<HTMLButtonElement>('#reset')!.onclick=()=>{animation=null;event.textContent='';game.reset();rebuild();};
document.querySelector<HTMLButtonElement>('#skip')!.onclick=()=>{animation=null;event.textContent='';rebuild();};
document.querySelector<HTMLButtonElement>('#view')!.onclick=()=>{camera.position.set(0,10,10);controls.target.set(0,0,0);};
new ResizeObserver(()=>{camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();renderer.setSize(stage.clientWidth,stage.clientHeight);}).observe(stage);
rebuild();let previous=performance.now();
renderer.setAnimationLoop(()=>{const now=performance.now();const dt=Math.min((now-previous)/1000,.05);previous=now;controls.update();if(animation){const t=Math.min((now-animation.start)/animation.duration,1);const eased=t*t*(3-2*t);animation.object.position.lerpVectors(animation.from,animation.to,eased);animation.object.position.y=Math.sin(t*Math.PI)*(animation.type==='n'?1.5:animation.type==='q'?.5:.18);if(t===1){animation=null;rebuild();event.textContent='';}}
 for(let i=sparks.length-1;i>=0;i--){const s=sparks[i];s.life-=dt;s.velocity.y-=dt*4;s.object.position.addScaledVector(s.velocity,dt);s.object.scale.setScalar(Math.max(0,s.life));if(s.life<=0){scene.remove(s.object);s.object.geometry.dispose();(s.object.material as THREE.Material).dispose();sparks.splice(i,1);}}renderer.render(scene,camera);});
