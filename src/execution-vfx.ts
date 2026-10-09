import * as THREE from 'three';
import {skins,type SkinId } from './profile.ts';
import { executionFrame } from './skin-execution.ts';
/** Two small procedural batches per premium execution, even at low quality. */
export class ExecutionVFX {
  readonly group=new THREE.Group();
  private shader:THREE.ShaderMaterial;
  private seal:THREE.Mesh;
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
    const count=['prism','dragon'].includes(skin)?2:1;
    for(let i=0;i<count;i++){const panel=new THREE.Mesh(new THREE.PlaneGeometry(['prism','dragon'].includes(skin)?1.5:2.2,['prism','dragon'].includes(skin)?2.6:2.4),this.shader);panel.position.x=count===2?(i?1:-1)*.7:0;this.group.add(panel);}
    this.seal=new THREE.Mesh(new THREE.RingGeometry(.52,.57,['prism','dragon'].includes(skin)?6:skin==='storm'?12:48),new THREE.MeshBasicMaterial({color:skins[skin].glow,transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,blending:THREE.AdditiveBlending}));
    this.seal.rotation.x=-Math.PI/2;this.group.add(this.seal);this.group.visible=false;
  }
  update(t:number,from:THREE.Vector3,target:THREE.Vector3){
    const f=executionFrame(this.skin,t);this.group.visible=f.strength>.001;
    this.group.position.copy(['prism','dragon'].includes(this.skin)?from:target);this.group.position.y=0;
    const direction=target.clone().sub(from);this.group.rotation.y=Math.atan2(direction.x,direction.z);
    this.shader.uniforms.uTime.value=t*2.6;this.shader.uniforms.uPower.value=f.strength;this.shader.uniforms.uRelease.value=f.release;
    this.group.children.forEach((node,i)=>{if(node===this.seal)return;node.position.y=1.15;if(['prism','dragon'].includes(this.skin))node.position.x=(i?1:-1)*(.9*(1-f.release));});
    this.seal.position.y=.035;this.seal.rotation.z=t*4;this.seal.scale.setScalar(['void','phantom'].includes(this.skin)?1-f.dissolve*.9:1+f.release*.6);
    (this.seal.material as THREE.MeshBasicMaterial).opacity=f.strength*.8;
  }
}
