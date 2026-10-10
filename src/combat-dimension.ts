import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {dimensionThemes,finisherThemes,type CosmeticTheme} from '../shared/presentation.js';
import {CAPTURE_CONTACT,CAPTURE_DEATH,CAPTURE_DURATION} from './combat';
import './combat-dimension.css';
export const DIMENSION_ENTER = .07;
export const DIMENSION_EXIT = .94;
export function dimensionWindow(t:number,reduced=false){return !reduced&&t>=DIMENSION_ENTER&&t<DIMENSION_EXIT;}
export function dimensionTransition(t:number){
 const tent=(centre:number,width:number)=>Math.max(0,1-Math.abs(t-centre)/width);
 return Math.max(tent(DIMENSION_ENTER,.045),tent(DIMENSION_EXIT,.035));
}
const vertex='varying vec3 vPoint; void main(){vPoint=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
const fragment=`varying vec3 vPoint;uniform float uTime,uKind,uSky;uniform vec3 uTint;
 float line(float n,float w){return 1.0-smoothstep(w,w+.018,abs(n));}
 void main(){vec2 p=vPoint.xz;float r=length(p),a=atan(p.y,p.x);float shape=0.0;
 if(uKind<.5)shape=line(sin(r*2.5-uTime*.5),.04)+pow(max(0.0,cos(a*12.0)),24.0)*exp(-r*.28);
 else if(uKind<1.5)shape=line(sin(p.x*.7+p.y*.3),.06)*step(.25,fract(p.y*.4+uTime*.15));
 else if(uKind<2.5)shape=line(sin(p.x*.8-p.y*.45),.06)*exp(-abs(p.y)*.08);
 else if(uKind<3.5)shape=line(sin(p.x*1.7),.04)+line(sin((p.x*.5+p.y*.866)*1.7),.04)+line(sin((p.x*.5-p.y*.866)*1.7),.04);
 else if(uKind<4.5)shape=max(line(sin(p.x*1.5),.025),line(sin(p.y*1.5),.025));
 else if(uKind<5.5)shape=line(sin(a*3.0+r*.9-uTime*.3),.07)*exp(-r*.1);
 else if(uKind<6.5)shape=line(r-3.0,.03)+line(r-5.0,.03)+line(r-7.0,.03)+pow(max(0.0,cos(a*8.0)),24.0)*.35;
 else shape=line(sin(r*.8+uTime*.6),.03)*(.4+.6*pow(abs(cos(a*2.0)),4.0));
 if(uSky>.5){float stars=pow(max(0.0,sin(vPoint.x*7.7)*sin(vPoint.y*9.3)*sin(vPoint.z*8.1)),48.0);shape=stars*.65+shape*.045;}
 // The fighters keep a quiet centre; scenery and field lines frame their silhouettes.
 float field=uSky>.5?1.0:mix(.38,1.0,smoothstep(1.4,4.5,r));
 float glow=shape*field*(uSky>.5?.18:.16);vec3 base=uTint*(uSky>.5?.008:.021);
 gl_FragColor=vec4(base+uTint*glow,1.0);
 #include <colorspace_fragment>
 }`;
function merged(parts:THREE.BufferGeometry[]){
 const prepared=parts.map(g=>g.index?g.toNonIndexed():g),geometry=mergeGeometries(prepared)!;
 new Set([...parts,...prepared]).forEach(g=>g.dispose());return geometry;
}

/** Different architecture for each domain, built once and reused between captures. */
function monumentGeometry(kind:number){
 const parts:THREE.BufferGeometry[]=[];
 if(kind===0){
  // Solar instruments: tilted orbital rings around a faceted core.
  parts.push(new THREE.OctahedronGeometry(.4));
  for(let i=0;i<3;i++)parts.push(new THREE.TorusGeometry(.65+i*.12,.018,3,24).rotateX(i*Math.PI/3));
 }else if(kind===1){
  // Veil: tall portal lintels, leaving an actual empty opening.
  parts.push(new THREE.BoxGeometry(.12,1.9,.12).translate(-.6,.6,0),new THREE.BoxGeometry(.12,1.9,.12).translate(.6,.6,0),new THREE.BoxGeometry(1.35,.12,.12).translate(0,1.55,0));
 }else if(kind===2){
  // Wyrm: three inclined claws rather than generic pillar crystals.
  for(let i=-1;i<=1;i++)parts.push(new THREE.ConeGeometry(.16,1.8,3).rotateZ(-i*.18-.28).translate(i*.4,.6,0));
 }else if(kind===3){
  // Glacier: three hexagonal shafts with staggered pointed crowns.
  for(let i=-1;i<=1;i++){const h=i===0?1.8:1.1;parts.push(new THREE.CylinderGeometry(.18,.25,h,6).translate(i*.34,h*.5-.25,0),new THREE.ConeGeometry(.18,.4,6).translate(i*.34,h-.05,0));}
 }else if(kind===4){
  // Machine: square reactor cages with two separated circuit rings.
  parts.push(new THREE.BoxGeometry(.55,1.55,.55));
  for(const y of [-.55,.55])parts.push(new THREE.TorusGeometry(.58,.025,3,4).rotateX(Math.PI/2).rotateY(Math.PI/4).translate(0,y,0));
 }else if(kind===5){
  // Nebula: asymmetric orbital triangles around paired star cores.
  parts.push(new THREE.OctahedronGeometry(.27).translate(-.22,0,0),new THREE.OctahedronGeometry(.13).translate(.35,.4,0),new THREE.TorusGeometry(.95,.018,3,3).rotateZ(Math.PI/6),new THREE.TorusGeometry(.68,.018,3,3).rotateY(Math.PI/3));
 }else if(kind===6){
  // Sanctum: an eight-sided plinth crowned by rays and a judgment halo.
  parts.push(new THREE.CylinderGeometry(.22,.4,1.5,8),new THREE.TorusGeometry(.65,.025,3,24).translate(0,.9,0));
  for(let i=0;i<5;i++)parts.push(new THREE.ConeGeometry(.065,.55,4).translate((i-2)*.2,1.22,0));
 }else{
  // Abyss: broken obelisks surrounded by an off-centre event horizon.
  parts.push(new THREE.ConeGeometry(.42,2.1,4).rotateZ(.15),new THREE.ConeGeometry(.22,1.1,4).rotateZ(-.18).translate(.55,-.25,0),new THREE.TorusGeometry(.85,.023,3,28,Math.PI*1.6).rotateY(.5).translate(0,.3,0));
 }
 return merged(parts);
}

/** One renderer; floor, sky, three reusable scenery batches and the equipped finisher. */
export class CombatDimension {
 readonly root=new THREE.Group();
 private mats:THREE.ShaderMaterial[]=[];
 private pillars:THREE.InstancedMesh;
 private scenery=new THREE.Group();
 private perimeter:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
 private rifts:THREE.InstancedMesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
 private dummy=new THREE.Object3D();
 private architecture=new Map<number,THREE.BufferGeometry>();
 private themes=new Map(dimensionThemes.map(theme=>[theme.id,theme]));
 private themeId='';
 private final?:THREE.Mesh;
 private finalId='';
 constructor(){
  this.root.name='combat-dimension';this.root.visible=false;
  for(const sky of [false,true]){
   const mat=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uKind:{value:0},uSky:{value:Number(sky)},uTint:{value:new THREE.Color('#c5a3ff')}},vertexShader:vertex,fragmentShader:fragment,side:sky?THREE.BackSide:THREE.DoubleSide,toneMapped:false});
   const mesh=new THREE.Mesh(sky?new THREE.SphereGeometry(40,24,12):new THREE.PlaneGeometry(35,35),mat);
   if(!sky){mesh.rotation.x=-Math.PI/2;mesh.position.y=-.12; // Floor shader uses horizontal local axes.
    mat.vertexShader=vertex.replace('vPoint=position','vPoint=vec3(position.x,0.0,position.y)');}
   this.mats.push(mat);this.root.add(mesh);
  }
  const geometry=monumentGeometry(5);this.architecture.set(5,geometry);
  this.pillars=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({color:'#c5a3ff',wireframe:true,transparent:true,opacity:.24,depthWrite:false,toneMapped:false}),12);
  this.pillars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.pillars.frustumCulled=false;
  const railParts:THREE.BufferGeometry[]=[new THREE.TorusGeometry(5.9,.024,3,48).rotateX(Math.PI/2),new THREE.TorusGeometry(6.1,.012,3,48).rotateX(Math.PI/2)];
  for(let i=0;i<12;i++){const a=i*Math.PI/6;railParts.push(new THREE.BoxGeometry(.04,.035,.6).translate(0,0,6.05).rotateY(a));}
  this.perimeter=new THREE.Mesh(merged(railParts),new THREE.MeshBasicMaterial({color:'#c5a3ff',transparent:true,opacity:.23,depthWrite:false,toneMapped:false}));this.perimeter.position.y=-.08;
  this.rifts=new THREE.InstancedMesh(new THREE.TorusGeometry(1.15,.025,3,36,Math.PI*1.65),new THREE.MeshBasicMaterial({color:'#c5a3ff',transparent:true,opacity:.15,depthWrite:false,toneMapped:false}),3);
  this.rifts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.rifts.frustumCulled=false;
  this.scenery.add(this.pillars,this.perimeter,this.rifts);this.root.add(this.scenery);
 }
 update(t:number,centre:THREE.Vector3,themeId:string,finishId?:string){
  const theme=this.themes.get(themeId)||dimensionThemes[5];
  this.root.position.set(centre.x,0,centre.z);
  const seconds=t*CAPTURE_DURATION/1000,kind=Number(theme.pattern),dummy=this.dummy;
  if(this.themeId!==theme.id){
   this.themeId=theme.id;
   if(!this.architecture.has(kind))this.architecture.set(kind,monumentGeometry(kind));
   this.pillars.geometry=this.architecture.get(kind)!;
   for(const mat of this.mats){mat.uniforms.uKind.value=kind;mat.uniforms.uTint.value.set(theme.color);}
   (this.pillars.material as THREE.MeshBasicMaterial).color.set(theme.color);this.perimeter.material.color.set(theme.color);this.rifts.material.color.set(theme.color);
   this.rifts.visible=kind===0||kind===1||kind===5||kind===7;
  }
  for(const mat of this.mats)mat.uniforms.uTime.value=seconds;
  for(let i=0;i<12;i++){
   const a=i*Math.PI/6,radius=kind===1?9.5:8.5;
   dummy.position.set(Math.cos(a)*radius,kind===4?1.1:1.35+Math.sin(i*1.7+seconds*.65)*.13,Math.sin(a)*radius);
   dummy.rotation.set(0,kind===0||kind===5?a+seconds*.12:a+Math.PI/2,0);dummy.scale.setScalar(kind===1?1.1:kind===3?.85:1);
   dummy.updateMatrix();this.pillars.setMatrixAt(i,dummy.matrix);
  }
  this.pillars.instanceMatrix.needsUpdate=true;
  for(let i=0;i<3;i++){
   const a=(i*2/3+.18)*Math.PI;dummy.position.set(Math.cos(a)*9.5,kind===0?3.8:3,Math.sin(a)*9.5);
   dummy.rotation.set(kind===0?Math.PI/2:.1,a+Math.PI/2,seconds*.09+i*.7);dummy.scale.setScalar(kind===7?1.65:1.2);
   dummy.updateMatrix();this.rifts.setMatrixAt(i,dummy.matrix);
  }
  this.rifts.instanceMatrix.needsUpdate=true;
  this.perimeter.material.opacity=.22+Math.sin(seconds*1.8)*.025;
  if(this.finalId!==(finishId||'')){this.finalId=finishId||'';this.setFinisher(finisherThemes.find(v=>v.id===finishId));}
  if(this.final){const p=Math.max(0,Math.min(1,(t-CAPTURE_CONTACT)/(CAPTURE_DEATH-CAPTURE_CONTACT+.06)));
   this.final.visible=p>0&&p<1;this.final.scale.setScalar(this.final.userData.pattern===11?2.4-p*1.8:.6+p*2.0);
   this.final.position.y=this.final.userData.pattern===10?3-p*4:1;this.final.rotation.y=p*(this.final.userData.pattern===1?-2:1.5);
   (this.final.material as THREE.MeshBasicMaterial).opacity=Math.sin(p*Math.PI)*.7;
  }
 }
 private setFinisher(theme?:CosmeticTheme){
  if(this.final){this.root.remove(this.final);this.final.geometry.dispose();(this.final.material as THREE.Material).dispose();this.final=undefined;}
  if(!theme)return;
  const p=theme.pattern,parts:THREE.BufferGeometry[]=[];
  if(p===0||p===5)for(let i=0;i<3;i++)parts.push(new THREE.TorusGeometry(.5+i*.2,.02,4,32).rotateX(p===0?Math.PI/2:i*Math.PI/3));
  else if(p===1||p===7)for(let i=0;i<2;i++)parts.push(new THREE.TorusGeometry(.8,.03,4,32,Math.PI*1.6).rotateY(i*Math.PI/2));
  else if(p===2)for(let i=-1;i<=1;i++)parts.push(new THREE.TorusGeometry(.75,.03,4,24,Math.PI*.8).rotateZ(-.5).translate(i*.24,0,0));
  else if(p===3||p===6)for(let i=0;i<6;i++){const a=i*Math.PI/3;parts.push(new THREE.ConeGeometry(.08,.7,4).rotateZ(p===6?-a:0).translate(Math.cos(a)*.65,.4,Math.sin(a)*.65));}
  else if(p===8){parts.push(new THREE.CylinderGeometry(.025,.025,3,5));parts.push(new THREE.ConeGeometry(.22,.7,4).translate(0,1.7,0));}
  else if(p===9)for(let i=0;i<8;i++){const a=i*Math.PI/4;parts.push(new THREE.ConeGeometry(.1,1.2,3).rotateZ(-a).translate(Math.sin(a)*.6,Math.cos(a)*.6,0));}
  else if(p===10)for(let i=0;i<7;i++)parts.push(new THREE.OctahedronGeometry(.18).translate((i%3-1)*.6,1+i*.17,(Math.floor(i/3)-1)*.6));
  else if(p===11){parts.push(new THREE.BoxGeometry(1.8,1.8,1.8));}
  else if(p===12){parts.push(new THREE.BoxGeometry(.12,2.3,.12),new THREE.BoxGeometry(1.6,.12,.12).translate(0,.3,0));}
  else if(p===13){const pts=Array.from({length:48},(_,i)=>new THREE.Vector3(Math.cos(i*.3)*.8,(i/47-.5)*2,Math.sin(i*.3)*.8));parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),48,.025,4));}
  else if(p===14){parts.push(new THREE.IcosahedronGeometry(.5));for(let i=0;i<12;i++)parts.push(new THREE.ConeGeometry(.06,.9,3).rotateZ(-i*Math.PI/6).translate(Math.sin(i*Math.PI/6),Math.cos(i*Math.PI/6),0));}
  else if(p===15){parts.push(new THREE.TorusGeometry(1,.1,3,36,Math.PI*1.2).rotateZ(-.6));}
  else for(let i=-1;i<=1;i++){parts.push(new THREE.BoxGeometry(1.7,.025,.025).translate(0,i*.3,0));parts.push(new THREE.BoxGeometry(.025,1.7,.025).translate(i*.3,0,0));}
  const prepared=parts.map(g=>g.index?g.toNonIndexed():g),geometry=mergeGeometries(prepared)!;new Set([...parts,...prepared]).forEach(g=>g.dispose());
  this.final=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:theme.color,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,forceSinglePass:true,wireframe:p===11,toneMapped:false}));
  this.final.userData.pattern=p;this.final.position.y=1;this.root.add(this.final);
 }
}
