import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {CosmeticTheme} from '../shared/presentation.js';
/** One batch per skill. Geometry, pose and motion change with the selected technique. */
export class SkillCosmetic {
 readonly mesh:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
 constructor(readonly theme:CosmeticTheme){
  const parts:THREE.BufferGeometry[]=[],p=theme.pattern;
  if(p===0)for(let i=0;i<3;i++)parts.push(new THREE.TorusGeometry(.48+i*.18,.018,4,36).rotateX(i*Math.PI/3));
  if(p===1)for(let i=0;i<6;i++){const a=i*Math.PI/3;parts.push(new THREE.ConeGeometry(.055,.65,3).rotateZ(-a).translate(Math.sin(a)*.65,Math.cos(a)*.65,0));}
  if(p===2)for(let i=0;i<5;i++)parts.push(new THREE.OctahedronGeometry(.18).scale(1,2,1).translate(Math.cos(i*1.26)*.6,Math.sin(i*1.26)*.6,0));
  if(p===3)for(let i=0;i<2;i++)parts.push(new THREE.TorusGeometry(.65,.03,4,36,Math.PI*1.65).rotateY(i*Math.PI/2));
  if(p===4)for(let i=0;i<7;i++){
   const a=i*Math.PI*2/7;for(let j=0;j<3;j++)parts.push(new THREE.BoxGeometry(.035,.28,.035).rotateZ((j%2?-.5:.5)+a).translate(Math.sin(a)*(.4+j*.22),Math.cos(a)*(.4+j*.22),0));}
  if(p===5){const pts=Array.from({length:40},(_,i)=>new THREE.Vector3(Math.cos(i*.3)*.5,(i/39-.5)*1.4,Math.sin(i*.3)*.5));parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),40,.022,4));}
  if(p===6){parts.push(new THREE.TorusGeometry(.7,.02,4,8));for(let i=0;i<4;i++)parts.push(new THREE.BoxGeometry(.055,.9,.035).rotateZ(i*Math.PI/4));}
  if(p===7){parts.push(new THREE.IcosahedronGeometry(.45,0));for(let i=0;i<8;i++)parts.push(new THREE.ConeGeometry(.07,.65,3).rotateZ(-i*Math.PI/4).translate(Math.sin(i*Math.PI/4)*.7,Math.cos(i*Math.PI/4)*.7,0));}
  const flat=parts.map(g=>g.index?g.toNonIndexed():g),geometry=mergeGeometries(flat)!;new Set([...parts,...flat]).forEach(g=>g.dispose());
  this.mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:theme.color,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));this.mesh.name=`skill-${theme.id}`;
 }
 update(t:number,actor:THREE.Vector3,target:THREE.Vector3,contact:number){
  const p=this.theme.pattern,charge=Math.min(1,t/.22),impact=Math.max(0,Math.min(1,(t-contact)/.18));
  this.mesh.visible=t>.02&&t<contact+.18;
  this.mesh.position.copy(t<contact?actor:target);this.mesh.position.y+=p===6?.1:1.05;
  this.mesh.rotation.set(p===6?-Math.PI/2:0,t*(p===5?12:4),p===1?-t*10:p===4?Math.sin(t*35)*.12:t*2);
  this.mesh.scale.setScalar(t<contact?.3+charge*.55:1+impact*(p===7?2.3:1.4));
  this.mesh.material.opacity=(t<contact?charge*.42:(1-impact)*.65);
 }
}
/** Small reusable texture, no downloaded art and no change to board coordinates. */
export function boardTexture(theme:CosmeticTheme){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!;
 ctx.fillStyle='#d9e5ef';ctx.fillRect(0,0,128,128);ctx.strokeStyle=theme.color;ctx.lineWidth=2;ctx.globalAlpha=.45;
 const p=theme.pattern;
 if(p===0){for(let i=20;i<110;i+=24){ctx.beginPath();ctx.moveTo(10,i);ctx.lineTo(i,i);ctx.lineTo(i,118);ctx.stroke();}}
 if(p===1){for(let i=0;i<4;i++){ctx.save();ctx.translate(64,64);ctx.rotate(i*Math.PI/2);ctx.strokeRect(15,-7,23,14);ctx.restore();}}
 if(p===2){for(let y=16;y<128;y+=28)for(let x=16;x<128;x+=30){ctx.beginPath();for(let i=0;i<=6;i++){const a=i*Math.PI/3;ctx.lineTo(x+Math.cos(a)*14,y+Math.sin(a)*14);}ctx.stroke();}}
 if(p===3){for(let y=20;y<128;y+=22){ctx.beginPath();for(let x=0;x<=128;x++)ctx.lineTo(x,y+Math.sin(x/16)*8);ctx.stroke();}}
 if(p===4){const pts=[[24,28],[56,18],[90,44],[75,89],[32,102]];ctx.beginPath();for(const [x,y] of pts)ctx.lineTo(x,y);ctx.stroke();for(const [x,y] of pts){ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.stroke();}}
 if(p===5){for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(i*32,0);ctx.lineTo(128-i*24,128);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*32);ctx.lineTo(128,128-i*24);ctx.stroke();}}
 if(p===6){for(const radius of [22,42,54]){ctx.beginPath();ctx.arc(64,64,radius,0,Math.PI*2);ctx.stroke();}for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.beginPath();ctx.moveTo(64+Math.cos(a)*42,64+Math.sin(a)*42);ctx.lineTo(64+Math.cos(a)*54,64+Math.sin(a)*54);ctx.stroke();}}
 if(p===7){ctx.beginPath();for(let i=0;i<=16;i++){const a=i*Math.PI/8,r=i%2?22:53;ctx.lineTo(64+Math.cos(a)*r,64+Math.sin(a)*r);}ctx.stroke();}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
