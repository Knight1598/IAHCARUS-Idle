import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {skins,type SkinId } from './profile.ts';
import { executionFrame } from './skin-execution.ts';
/** At most three procedural draw batches; new families use spatial geometry instead of recoloured panels. */
export class ExecutionVFX {
  readonly group=new THREE.Group();
  private shader:THREE.ShaderMaterial;
  private seal!:THREE.Mesh;
  private volumes:THREE.Mesh[]=[];
  private direction=new THREE.Vector3();
  readonly skin:SkinId;
  constructor(skin:SkinId) {
    this.skin=skin;
    const index=skin==='nova'?3:skin==='phantom'?4:skin==='dragon'?5:skin==='storm'?0:skin==='void'?1:2;
    this.shader=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false,forceSinglePass:true,
      uniforms:{uTime:{value:0},uPower:{value:0},uRelease:{value:0},uKind:{value:index},uTint:{value:new THREE.Color(skins[skin].glow)}},
      vertexShader:'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 vUv; uniform float uTime,uPower,uRelease,uKind; uniform vec3 uTint;
      void main(){vec2 p=vUv*2.-1.;float a=0.;vec3 c=vec3(.5,.8,1.);
        if(uKind<.5){float zig=sin(p.y*33.+uTime*19.)*.075+sin(p.y*67.-uTime*27.)*.025;
          float bolt=pow(max(0.,1.-abs(fract((p.x-zig)*3.+.5)-.5)*24.),3.);
          float branches=pow(max(0.,1.-abs(sin(p.x*15.+p.y*24.))*9.),3.)*uRelease;
          a=max(bolt,branches)*(1.-smoothstep(.7,1.,abs(p.y)));c=vec3(.44,.76,1.);}
        else if(uKind<1.5){float d=length(p);float eclipse=exp(-abs(d-(.62-.25*uRelease))*65.);
          float spiral=pow(max(0.,sin(atan(p.y,p.x)*9.+d*35.-uTime*8.)),12.);
          a=eclipse+spiral*.35*(1.-smoothstep(.25,.9,d));c=mix(vec3(.42,.12,.8),vec3(.9,.55,1.),eclipse);}
        else if(uKind>2.5){float d=length(p),angle=atan(p.y,p.x);
          if(uKind<3.5){a=exp(-abs(d-(.22+.52*uRelease))*45.)+pow(max(0.,cos(angle*12.-uTime*5.)),10.)*(1.-smoothstep(.2,.95,d))*.65;}
          else if(uKind<4.5){a=exp(-abs(d-(.65-.45*uRelease))*60.)+pow(max(0.,sin(angle*5.+d*26.+uTime*7.)),14.)*(1.-smoothstep(.15,.9,d))*.6;}
          else {float fang=exp(-abs(abs(p.x)-(.16+.4*abs(p.y)))*45.)*(1.-smoothstep(.2,1.,abs(p.y)));a=fang+pow(max(0.,cos(angle*3.+uTime*2.)),8.)*exp(-abs(d-.65)*20.)*uRelease;}
          c=uTint;}
        else {float x=abs(p.x);float head=step(length(vec2(p.x,p.y-.68)),.12);
          float body=step(x,.18*(1.-abs(p.y-.1)))*step(-.35,p.y)*step(p.y,.52);
          float arms=step(abs(x-(.25+.1*sin(p.y*3.))),.07)*step(-.1,p.y)*step(p.y,.43);
          float legs=step(abs(x-.12),.06)*step(-.92,p.y)*step(p.y,-.3);
          float blade=step(abs(p.x-.52),.023)*step(-.05,p.y)*step(p.y,.9);
          a=max(max(head,body),max(max(arms,legs),blade))*.7;
          c=.6+.4*cos(vec3(0.,2.,4.)+p.y*3.+uTime*2.);}
        gl_FragColor=vec4(mix(c,uTint,.35)*1.7,min(.95,a*uPower));
        #include <colorspace_fragment>
      }`});
    if (['nova','phantom','dragon'].includes(skin)) {
      this.shader.dispose();
      const batch=(parts:THREE.BufferGeometry[],name:string)=>{
        const prepared=parts.map(g=>g.index?g.toNonIndexed():g),geometry=mergeGeometries(prepared)!;
        new Set([...parts,...prepared]).forEach(g=>g.dispose());
        const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:skins[skin].glow,
          transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,
          blending:THREE.AdditiveBlending,toneMapped:false}));
        mesh.name=name;this.volumes.push(mesh);this.group.add(mesh);return mesh;
      };
      if(skin==='nova') {
        batch([new THREE.IcosahedronGeometry(.28,1)],'solar-core');
        batch([0,1,2].map(i=>new THREE.TorusGeometry(.52+i*.13,.018,4,32).rotateX(i*Math.PI/3)),'solar-gyroscope');
        batch([new THREE.CylinderGeometry(.08,.23,1,12,1,true).rotateX(Math.PI/2).translate(0,0,.5)],'solar-lance');
      } else if(skin==='phantom') {
        batch([-1,1].map(sign=>new THREE.TorusGeometry(.65,.025,4,32,Math.PI*1.7).scale(.55,1.3,1).translate(sign*.75,0,0)),'veil-gates');
        batch([-1,1].map(sign=>new THREE.ConeGeometry(.06,1.8,3).rotateZ(sign*.65).translate(sign*.6,0,0)),'crossed-spectral-blades');
        batch([new THREE.TorusGeometry(1.05,.045,4,40,Math.PI*1.2).rotateX(Math.PI/2)],'veil-draw-cut');
      } else {
        const wings:THREE.BufferGeometry[]=[];
        for(const sign of [-1,1]) {
          const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(sign*1.7,1.05);shape.lineTo(sign*1.35,.1);
          shape.lineTo(sign*.9,.35);shape.lineTo(sign*.55,-.3);shape.closePath();
          wings.push(new THREE.ShapeGeometry(shape).translate(0,0,-.35));
        }
        batch(wings,'wyrm-wings');
        batch([-1,1].flatMap(sign=>[0,1,2].map(i=>new THREE.ConeGeometry(.09,.75,3).rotateZ(sign*Math.PI).translate((i-1)*.28,sign*.5,.6))),'closing-fangs');
        batch([-1,0,1].map(i=>new THREE.TorusGeometry(.85,.035,4,24,Math.PI*.8).rotateZ(-.7).translate(i*.22,0,.3)),'triple-claw-rake');
      }
      this.group.visible=false;return;
    }
    const count=['prism','dragon'].includes(skin)?2:1;
    for(let i=0;i<count;i++){const panel=new THREE.Mesh(new THREE.PlaneGeometry(['prism','dragon'].includes(skin)?1.5:2.2,['prism','dragon'].includes(skin)?2.6:2.4),this.shader);panel.position.x=count===2?(i?1:-1)*.7:0;this.group.add(panel);}
    this.seal=new THREE.Mesh(new THREE.RingGeometry(.52,.57,['prism','dragon'].includes(skin)?6:skin==='storm'?12:48),new THREE.MeshBasicMaterial({color:skins[skin].glow,transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,blending:THREE.AdditiveBlending}));
    this.seal.rotation.x=-Math.PI/2;this.group.add(this.seal);this.group.visible=false;
  }
  update(t:number,from:THREE.Vector3,target:THREE.Vector3){
    const f=executionFrame(this.skin,t);this.group.visible=f.strength>.001;
    if(this.volumes.length) {
      this.direction.copy(target).sub(from);
      const distance=Math.max(.1,this.direction.length());
      this.group.rotation.y=Math.atan2(this.direction.x,this.direction.z);
      const [a,b,c]=this.volumes,release=f.release,power=f.strength;
      this.group.position.copy(this.skin==='phantom'?target:from);this.group.position.y=0;
      for(const mesh of this.volumes)(mesh.material as THREE.MeshBasicMaterial).opacity=power*.65;
      if(this.skin==='nova') {
        a.position.set(0,2.1-release*.9,0);a.scale.setScalar(.5+f.gather*.7+release*.3);
        b.position.copy(a.position);b.rotation.set(t*6,t*4,t*3);b.scale.setScalar(1-release*.3);
        c.position.set(0,1.2,0);c.scale.set(.7+release*1.3,1,distance*release);
        (c.material as THREE.MeshBasicMaterial).opacity=power*release*.9;
      } else if(this.skin==='phantom') {
        a.position.set(0,1.15,0);a.scale.setScalar(1-release*.8);a.rotation.z=-t*2;
        b.position.set(0,1.2,0);b.scale.setScalar(.4+release*.9);b.rotation.z=release*1.6;
        c.position.set(0,1.1,0);c.rotation.z=-.25;c.scale.setScalar(.2+release*1.2);
        (c.material as THREE.MeshBasicMaterial).opacity=power*release;
      } else {
        a.position.set(0,1.45,0);a.scale.set(1+f.gather*.5-release*.5,1,1);a.rotation.x=-release*.6;
        b.position.set(0,1.2,distance*release);b.scale.set(1,1-release*.8,1);
        c.position.set(0,1.2,distance*release);c.rotation.z=-release*.8;c.scale.setScalar(.3+release*1.4);
        (c.material as THREE.MeshBasicMaterial).opacity=power*release*.9;
      }
      return;
    }
    this.group.position.copy(['prism','dragon'].includes(this.skin)?from:target);this.group.position.y=0;
    this.direction.copy(target).sub(from);this.group.rotation.y=Math.atan2(this.direction.x,this.direction.z);
    this.shader.uniforms.uTime.value=t*2.6;this.shader.uniforms.uPower.value=f.strength;this.shader.uniforms.uRelease.value=f.release;
    this.group.children.forEach((node,i)=>{if(node===this.seal)return;node.position.y=1.15;if(['prism','dragon'].includes(this.skin))node.position.x=(i?1:-1)*(.9*(1-f.release));});
    this.seal.position.y=.035;this.seal.rotation.z=t*4;this.seal.scale.setScalar(['void','phantom'].includes(this.skin)?1-f.dissolve*.9:1+f.release*.6);
    (this.seal.material as THREE.MeshBasicMaterial).opacity=f.strength*.8;
  }
}
