import * as THREE from 'three';
import { createAvatar, animateAvatar } from './avatar';
import { initialArmySlots } from './cosmetics';
import type { ArmyCosmetics } from '../shared/cosmetics.js';
import type { Color, Square, PieceSymbol } from 'chess.js';
import type { SkinId } from './profile';

/** One lazy, low-resolution context; static armies render only when changed. */
export class ArmyPreview {
  private renderer?:THREE.WebGLRenderer;
  private scene=new THREE.Scene();
  private camera=new THREE.PerspectiveCamera(42,1,.1,50);
  private models=new THREE.Group();
  private featured?:THREE.Group;
  private type:PieceSymbol='n';
  private data?:Record<Color,ArmyCosmetics>;
  private color:Color='w';
  private slot:Square='b1';
  private key='';
  private visible=false;
  private timer=0;
  private start=0;
  private lastDraw=0;
  constructor(private host:HTMLElement) {
    this.scene.background=new THREE.Color(0x0a1628);this.scene.add(new THREE.HemisphereLight(0xaadfff,0x292038,3));
    const light=new THREE.DirectionalLight(0xffffff,4);light.position.set(3,7,5);this.scene.add(light,this.models);
    this.camera.position.set(0,5.5,10);this.camera.lookAt(0,.3,0);
    new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting&&!host.hidden;if(this.visible)this.render();else cancelAnimationFrame(this.timer);}).observe(host);
    new ResizeObserver(()=>{if(this.visible)this.render();}).observe(host);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAnimationFrame(this.timer);else if(this.visible)this.render();});
  }
  private clear(group:THREE.Group){const materials=new Set<THREE.Material>();group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});materials.forEach(m=>m.dispose());group.clear();}
  update(data:Record<Color,ArmyCosmetics>,color:Color,slot:Square){
    this.data=data;this.color=color;this.slot=slot;
    const key=JSON.stringify([data,color,slot]);if(key===this.key)return;this.key=key;
    if(this.renderer){this.build();if(this.visible)this.render();}
  }
  private build(){
    if(!this.data)return;this.clear(this.models);
    for(const color of ['w','b'] as Color[])initialArmySlots(color).forEach((slot,i)=>{
      const skin=(this.data![color].loadout[slot.origin]||this.data![color].skin) as SkinId;
      const avatar=createAvatar(slot.type,color,skin);avatar.scale.setScalar(.34);avatar.position.set((color==='w'?-2.8:2.8)+(i%4-1.5)*.65,0,(Math.floor(i/4)-1.5)*.75);avatar.rotation.y=color==='w'?.3:-.3;this.models.add(avatar);
    });
    const slot=initialArmySlots(this.color).find(s=>s.origin===this.slot)||initialArmySlots(this.color)[1];this.type=slot.type;
    this.featured=createAvatar(slot.type,this.color,(this.data[this.color].loadout[slot.origin]||this.data[this.color].skin) as SkinId);
    this.featured.position.set(0,0,.8);this.featured.scale.setScalar(1.15);this.models.add(this.featured);
    this.host.dataset.slot=slot.origin;this.host.setAttribute('aria-label',`สองกองทัพ 3D · พรีวิวหมาก ${slot.origin}`);
  }
  play(){if(!this.visible||!this.renderer)return;this.start=performance.now();cancelAnimationFrame(this.timer);const frame=(time:number)=>{if(document.hidden||!this.visible)return;const p=Math.min(1,(time-this.start)/2400);if(time-this.lastDraw<50&&p<1){this.timer=requestAnimationFrame(frame);return;}this.lastDraw=time;if(this.featured)animateAvatar(this.featured,this.type,Math.sin(p*Math.PI),Math.max(0,Math.sin((p-.3)*Math.PI*2)),0,time/1000);this.draw();if(p<1)this.timer=requestAnimationFrame(frame);};this.timer=requestAnimationFrame(frame);}
  private render(){
    if(!this.data||document.hidden||!this.visible)return;
    if(!this.renderer){try{this.renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'low-power'});this.renderer.setPixelRatio(1);this.host.append(this.renderer.domElement);this.build();}catch{this.host.textContent='เครื่องนี้เปิดพรีวิว 3D ไม่ได้ · ยังแต่งหมากจากช่องด้านล่างได้';return;}}
    this.draw();
  }
  private draw(){if(!this.renderer)return;const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.render(this.scene,this.camera);}
}
