import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createAvatar,animateAvatar} from './avatar';
import {ExecutionVFX} from './execution-vfx';
import {bgColors,type BGGame,type BGEvent} from '../shared/battleground.js';
import {type SkinId} from './profile';
/** Independent lazy context. Fixed pixel budget; no shadows or post-processing. */
export class BattlegroundScene {
 private renderer:THREE.WebGLRenderer;private world=new THREE.Scene();private camera=new THREE.PerspectiveCamera(43,1,.1,70);private controls:OrbitControls;
 private units=new THREE.Group();private tiles:THREE.Mesh[]=[];private effects:{fx:ExecutionVFX;event:BGEvent;start:number;actor:THREE.Group}[]=[];private active=true;private frameId=0;private last=0;private stamp='';private dirty=true;
 constructor(private host:HTMLElement,select:(cell:number)=>void){
  this.renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'low-power'});this.renderer.setPixelRatio(Math.min(1.25,devicePixelRatio));host.prepend(this.renderer.domElement);this.world.background=new THREE.Color(0x070e20);this.world.add(new THREE.HemisphereLight(0xa8eaff,0x382437,3),this.units);const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,10,5);this.world.add(light);
  this.camera.position.set(0,13,13);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(0,0,0);this.controls.minDistance=8;this.controls.maxDistance=24;this.controls.maxPolarAngle=Math.PI*.43;this.controls.addEventListener('change',()=>{this.dirty=true;});
  const geometry=new THREE.BoxGeometry(.96,.15,.96);for(let cell=0;cell<100;cell++){const tile=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:(cell+Math.floor(cell/10))%2?0x19394c:0x28536b,roughness:.6,metalness:.25}));tile.position.set(cell%10-4.5,-.1,Math.floor(cell/10)-4.5);tile.userData.cell=cell;this.tiles.push(tile);this.world.add(tile);}
  for(let seat=0;seat<4;seat++){const angle=Math.PI/4+seat*Math.PI/2,crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.5),new THREE.MeshStandardMaterial({color:bgColors[seat],emissive:bgColors[seat],emissiveIntensity:.5,metalness:.6,roughness:.3}));crystal.position.set(Math.cos(angle)*8,1,Math.sin(angle)*8);this.world.add(crystal);const base=new THREE.Mesh(new THREE.CylinderGeometry(.7,.9,.3,6),new THREE.MeshStandardMaterial({color:0x223b51}));base.position.set(crystal.position.x,.15,crystal.position.z);this.world.add(base);}
  let down={x:0,y:0};this.renderer.domElement.onpointerdown=e=>{down={x:e.clientX,y:e.clientY};};this.renderer.domElement.onpointerup=e=>{if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>8)return;const bounds=this.renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-bounds.left)/bounds.width*2-1,-(e.clientY-bounds.top)/bounds.height*2+1),this.camera);const hit=ray.intersectObjects(this.tiles)[0];if(hit)select(hit.object.userData.cell);};
  new ResizeObserver(()=>this.resize()).observe(host);this.resize();this.loop();
 }
 private resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.dirty=true;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
 private dispose(group:THREE.Object3D){const materials=new Set<THREE.Material>();group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});materials.forEach(m=>m.dispose());}
 render(game:BGGame,seatSkins:SkinId[],selected:number|null,targets:number[]=[]){
  this.dirty=true;this.tiles.forEach((tile,cell)=>{(tile.material as THREE.MeshStandardMaterial).emissive.set(cell===selected?0x276e91:targets.includes(cell)?0x7e2828:0x000000);});
  const stamp=JSON.stringify([game.revision,game.id,seatSkins]);if(stamp===this.stamp)return;this.stamp=stamp;
  this.units.children.forEach(o=>this.dispose(o));this.units.clear();
  for(const p of game.board){const skin=seatSkins[p.seat]||'classic',avatar=createAvatar(p.type,p.seat%2?'b':'w',skin);avatar.scale.setScalar(.48);avatar.position.set(p.cell%10-4.5,0,Math.floor(p.cell/10)-4.5);avatar.rotation.y=p.seat*Math.PI/2;this.units.add(avatar);const ring=new THREE.Mesh(new THREE.RingGeometry(.35,.41,20),new THREE.MeshBasicMaterial({color:bgColors[p.seat],side:THREE.DoubleSide,transparent:true,opacity:.85}));ring.rotation.x=-Math.PI/2;ring.position.copy(avatar.position);ring.position.y=.015;this.units.add(ring);}
  this.clearEffects();for(const event of game.events.filter(e=>e.kind==='capture'||e.kind==='clash').slice(0,8)){const skin=seatSkins[event.seat]||'classic',fx=new ExecutionVFX(skin),actor=createAvatar(event.attackerType||'n',event.seat%2?'b':'w',skin);actor.scale.setScalar(.65);actor.position.set((event.from??event.cell!)%10-4.5,0,Math.floor((event.from??event.cell!)/10)-4.5);this.world.add(fx.group,actor);this.effects.push({fx,event,start:performance.now(),actor});}
 }
 private clearEffects(){for(const e of this.effects){this.world.remove(e.fx.group,e.actor);this.dispose(e.fx.group);this.dispose(e.actor);}this.effects=[];}
 setActive(active:boolean){this.active=active;if(active){this.resize();this.loop();}else cancelAnimationFrame(this.frameId);}
 private loop=()=>{cancelAnimationFrame(this.frameId);if(!this.active)return;const now=performance.now();if(!document.hidden&&now-this.last>=40&&(this.dirty||this.effects.length)){this.dirty=false;this.last=now;this.controls.update();for(const e of this.effects){const p=Math.min(1,(now-e.start)/1800),target=new THREE.Vector3(e.event.cell!%10-4.5,0,Math.floor(e.event.cell!/10)-4.5),from=e.actor.position.clone();e.fx.update(p,from,target);animateAvatar(e.actor,e.event.attackerType||'n',Math.sin(p*Math.PI),Math.max(0,Math.sin((p-.35)*Math.PI*2)),0,now/1000);e.actor.visible=p<.9;}if(this.effects[0]&&now-this.effects[0].start>1900)this.clearEffects();this.renderer.render(this.world,this.camera);}this.frameId=requestAnimationFrame(this.loop);};
}
