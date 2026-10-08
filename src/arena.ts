import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { arenas, arenaIds, type ArenaId } from "./arenas";

const secondaryGlow: Record<ArenaId, number> = {
  citadel: 0xd1baff, ember: 0xff3b5d, frost: 0xbfffe9, astral: 0x6ae8ff,
  storm: 0xd1b0ff, grove: 0xe4f6a4, reactor: 0x60eaff, eclipse: 0xff8963,
};

const fieldVertex = `
  varying vec2 vWorld;
  #include <fog_pars_vertex>
  void main(){
    vec4 worldPosition = modelMatrix * vec4(position,1.0);
    vWorld = worldPosition.xz;
    vec4 mvPosition = viewMatrix * worldPosition;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

// Narrow, layered lines carry the detail; the centre stays transparent so every
// square and move marker remains readable. All reactions use the impact origin.
const fieldFragment = `
  varying vec2 vWorld;
  uniform float uTime,uFamily,uStrength,uAge;
  uniform vec2 uOrigin;
  uniform vec3 uColor,uSecondary;
  #include <fog_pars_fragment>
  float line(float value,float width){ return 1.0-smoothstep(width,width*3.0,abs(value)); }
  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0)),f.x),f.y);
  }
  void main(){
    float r=length(vWorld),a=atan(vWorld.y,vWorld.x);
    vec2 p=vWorld-uOrigin;
    float d=length(p),theta=atan(p.y,p.x);
    if(r>8.0 && d>3.8) discard;
    float border=0.0,reaction=0.0,core=0.0;
    float pulse=0.18+min(uAge,1.35)*2.35;
    float wave=line(d-pulse,0.025);
    float echo=line(d-max(0.0,pulse-0.28),0.013);
    float envelope=1.0-smoothstep(3.05,3.65,d);
    float breathe=0.83+0.17*sin(uTime*0.8);
    if(uFamily<0.5){
      // Royal seal: inset runes, alternating battlements and a double crest.
      float sectors=abs(sin(a*12.0));
      border=line(r-5.83,0.018)*0.14+line(r-6.18,0.012)*0.07;
      border+=line(r-6.0,0.025)*step(0.75,sectors)*0.17;
      border+=line(sectors-0.08,0.015)*step(5.84,r)*(1.0-step(6.15,r))*0.10;
      float spokes=pow(abs(cos(theta*6.0)),28.0);
      reaction=wave*(0.55+0.45*spokes)+echo*0.45;
      reaction+=line(d-min(pulse*0.55,0.95),0.018)*(0.4+0.4*cos(theta*8.0-uAge))*0.38;
      reaction+=spokes*line(d-pulse*0.72,0.12)*0.22;
      core=wave;
    }else if(uFamily<1.5){
      // Molten veins: branching seams and an uneven flaming shock front.
      float flow=noise(vWorld*3.0+vec2(0.0,-uTime*0.25));
      border=line(r-5.9-(flow-0.5)*0.27,0.018)*0.21;
      border+=line(r-6.26-sin(a*9.0+uTime*0.4)*0.09,0.02)*0.09;
      float flame=sin(theta*9.0+d*4.0-uAge*11.0)*0.07+sin(theta*17.0)*0.025;
      float burning=line(d-pulse-flame,0.03);
      reaction=burning*0.9+echo*0.25;
      reaction+=pow(max(0.0,sin(theta*11.0+d*3.0-uAge*8.0)),12.0)*line(d-pulse*0.7,0.15)*0.45;
      core=burning;
    }else if(uFamily<2.5){
      // Ice: a faceted hexagonal seal with fine branching crystal veins.
      float facets=cos(mod(a+0.523599,1.047198)-0.523599);
      border=line(r*facets-5.53,0.018)*0.18+line(r-6.22,0.012)*0.07;
      border+=pow(abs(cos(a*12.0)),34.0)*line(r-5.94,0.13)*0.12;
      float hex=cos(mod(theta+0.523599,1.047198)-0.523599);
      float crystal=line(d*hex-pulse*0.88,0.018);
      float branches=pow(abs(cos(theta*3.0)),34.0);
      reaction=crystal+echo*0.22+branches*line(d-pulse*0.7,0.16)*0.35;
      reaction+=pow(abs(cos(theta*9.0+d*6.0)),30.0)*line(d-pulse*0.8,0.11)*0.22;
      core=crystal;
    }else if(uFamily<3.5){
      // Gravity lens: separated orbital ribbons and suspended star glyphs.
      float spiral=sin(a*3.0+r*3.5-uTime*0.35);
      border=line(r-6.03-spiral*0.13,0.018)*0.16+line(r-6.42,0.013)*0.08;
      border+=pow(max(0.0,cos(a*16.0+uTime*0.2)),32.0)*line(r-5.8,0.04)*0.13;
      float twist=sin(theta*3.0+d*4.0-uAge*4.0);
      reaction=wave*(0.45+0.55*abs(twist))+echo*0.35;
      reaction+=line(twist,0.04)*line(d-pulse*0.76,0.17)*0.5;
      reaction+=line(d-pulse*0.38,0.014)*0.3;
      core=wave;
    }else if(uFamily<4.5){
      // Electrical branches use fixed angular sectors to avoid screen flashes.
      float bolt=sin(a*12.0+sin(r*15.0)*0.5);
      border=line(r-5.94,0.02)*0.1+line(bolt,0.05)*line(r-6.03,0.24)*0.19;
      float jag=sin(d*23.0+sin(d*7.0)*2.0)*0.15;
      float lightning=line(sin(theta*7.0+jag),0.025);
      float fork=line(sin(theta*7.0-jag*1.4+0.17),0.017);
      reaction=wave*0.35+(lightning+fork*0.42)*line(d-pulse*0.67,0.23)*0.8;
      reaction+=echo*0.38;
      core=lightning*line(d-pulse*0.67,0.23);
    }else if(uFamily<5.5){
      // Petals and vine curls radiate from the combatant's square.
      float petals=cos(a*10.0+sin(r*2.0)*0.22);
      border=line(r-5.97-petals*0.12,0.024)*0.16+line(r-6.36,0.017)*0.07;
      float leaf=pow(max(0.0,cos(theta*5.0+d*2.0-uAge*2.0)),7.0);
      float vine=line(sin(theta*5.0+d*3.0-uAge*1.8),0.05);
      reaction=wave*(0.4+leaf*0.6)+echo*0.23;
      reaction+=leaf*line(d-pulse*0.75,0.15)*0.48+vine*line(d-pulse*0.55,0.18)*0.25;
      core=wave*leaf;
    }else if(uFamily<6.5){
      // Circuit rails: rectangular propagation, travelling nodes and inset grid.
      float square=max(abs(vWorld.x),abs(vWorld.y));
      float rail=line(square-4.72,0.016)+line(square-5.0,0.012)*0.55;
      float nodes=pow(max(0.0,cos((vWorld.x+vWorld.y)*4.0-uTime*1.7)),24.0);
      border=rail*(0.12+nodes*0.13);
      border+=line(square-5.22,0.018)*step(0.6,abs(sin((vWorld.x+vWorld.y)*3.0)))*0.11;
      float box=max(abs(p.x),abs(p.y));
      float railWave=line(box-pulse*0.85,0.021);
      float grid=max(line(fract(p.x*2.0+0.5)-0.5,0.025),line(fract(p.y*2.0+0.5)-0.5,0.025));
      reaction=railWave*0.78+line(box-max(0.0,pulse*0.85-0.19),0.011)*0.3;
      reaction+=grid*line(box-pulse*0.64,0.12)*0.24;
      core=railWave;
    }else{
      // Solar eclipse: twin crescent arcs and a wind-carved sand mandala.
      border=line(r-5.89,0.015)*0.1+line(r-6.19,0.025)*(0.08+0.06*cos(a*8.0));
      border+=pow(abs(sin(a*16.0)),24.0)*line(r-6.03,0.065)*0.15;
      float sand=sin(theta*10.0-d*5.0+uAge*3.0);
      reaction=wave*(0.45+0.55*pow(abs(sand),3.0))+echo*0.45;
      reaction+=line(d-pulse*0.62,0.021)*(0.45+0.45*cos(theta*2.0-uAge))*0.45;
      reaction+=pow(max(0.0,sand),16.0)*line(d-pulse*0.8,0.16)*0.28;
      core=wave;
    }
    float impact=max(0.0,reaction)*uStrength*envelope;
    float alpha=clamp(border*breathe+impact*0.46,0.0,0.58);
    if(alpha<0.004) discard;
    float tint=0.24+0.4*(0.5+0.5*sin(a*2.0+r*2.4+uTime*0.2));
    vec3 color=mix(uColor,uSecondary,tint);
    color=mix(color,vec3(0.9,0.96,1.0),min(0.32,core*uStrength*0.25));
    gl_FragColor=vec4(color,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

const particleVertex = `
  attribute float aSeed;
  uniform float uTime,uFamily;
  varying float vAlpha,vAngle,vTint;
  #include <fog_pars_vertex>
  void main(){
    vec3 p=position; float t=uTime*0.4+aSeed;
    float seed=fract(aSeed*0.173),speed=0.7+seed*0.6;
    if(uFamily<0.5){ p.y+=sin(t)*0.2; p.xz+=vec2(sin(t),cos(t*0.7))*0.06; }
    else if(uFamily<1.5){ p.y=mod(position.y+uTime*0.62*speed,3.0); p.xz+=vec2(sin(t*1.6),cos(t))*0.08; }
    else if(uFamily<2.5){ p.y=3.0-mod(position.y+uTime*0.21*speed,3.0); p.xz+=vec2(sin(t),cos(t*0.7))*0.12; }
    else if(uFamily<3.5){
      p.y+=sin(t)*0.4; float spin=uTime*0.035*speed;
      p.xz=mat2(cos(spin),-sin(spin),sin(spin),cos(spin))*p.xz;
    }else if(uFamily<4.5){ p.y+=sin(t*4.0)*0.11; p.xz+=vec2(sin(t*2.0),cos(t*3.0))*0.06; }
    else if(uFamily<5.5){ p.xz+=vec2(sin(t),cos(t*0.8))*0.18; p.y+=cos(t*0.7)*0.28; }
    else if(uFamily<6.5){ p.y=mod(position.y+uTime*0.33*speed,3.0); }
    else { p.y=0.2+mod(position.y+uTime*0.12*speed,1.15); p.xz+=vec2(sin(t),cos(t*0.6))*0.24; }
    // All motes stay outside the playable 8x8, including wind and orbit paths.
    float safeRadius=5.9; p.xz*=max(1.0,safeRadius/max(length(p.xz),0.01));
    vec4 mvPosition=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mvPosition;
    float familySize=uFamily>4.5&&uFamily<5.5?1.22:1.0;
    gl_PointSize=clamp((32.0+seed*19.0)*familySize/max(-mvPosition.z,0.1),1.0,6.0);
    float life=smoothstep(0.0,0.3,p.y)*(1.0-smoothstep(2.5,3.0,p.y));
    vAlpha=(0.19+0.18*sin(t*1.4)*sin(t*1.4))*life;
    vAngle=t*0.3+aSeed; vTint=0.2+seed*0.65;
    #include <fog_vertex>
  }`;

const particleFragment = `
  uniform vec3 uColor,uSecondary;
  uniform float uFamily;
  varying float vAlpha,vAngle,vTint;
  #include <fog_pars_fragment>
  void main(){
    vec2 p=gl_PointCoord-0.5;
    p=mat2(cos(vAngle),-sin(vAngle),sin(vAngle),cos(vAngle))*p;
    float d=length(p),shape=1.0-smoothstep(0.03,0.48,d),core=exp(-d*d*50.0);
    if(uFamily<0.5){ shape*=0.5+0.5*exp(-min(abs(p.x),abs(p.y))*14.0); }
    else if(uFamily<1.5){ shape=1.0-smoothstep(0.1,0.48,length(vec2(p.x*1.4,p.y*0.8))); core=exp(-dot(p,p)*42.0); }
    else if(uFamily<2.5){ float spokes=pow(abs(cos(atan(p.y,p.x)*3.0)),6.0); shape*=0.35+0.65*spokes; }
    else if(uFamily<3.5){ shape=1.0-smoothstep(0.08,0.5,abs(p.x)+abs(p.y)); shape+=core*0.2; }
    else if(uFamily<4.5){ shape=exp(-p.x*p.x*110.0)*(1.0-smoothstep(0.1,0.48,abs(p.y))); }
    else if(uFamily<5.5){ float leaf=length(vec2(p.x*1.7,p.y*0.9)); shape=1.0-smoothstep(0.17,0.48,leaf); }
    else if(uFamily<6.5){ float box=max(abs(p.x),abs(p.y)); shape=(1.0-smoothstep(0.17,0.4,box))*(0.5+0.5*core); }
    else { shape=exp(-d*d*16.0)*(1.0-smoothstep(0.22,0.49,d)); }
    float alpha=shape*vAlpha; if(alpha<0.005)discard;
    vec3 color=mix(uColor,uSecondary,vTint); color=mix(color,vec3(1.0),core*0.25);
    gl_FragColor=vec4(color,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

/** Four batches per field, one shared clock, no lights/loops per ornament. */
export class ArenaEnvironment {
  readonly root = new THREE.Group();
  id: ArenaId = "citadel";
  private particles?: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private field?: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private reactionStart = -100;
  private clock = 0;
  private low = false;
  private reduced = false;

  constructor() { this.root.name = "arena-environment"; this.setArena("citadel"); }
  setArena(id: ArenaId) {
    this.dispose(); this.id = id; this.reactionStart = -100;
    const theme = arenas[id], family = arenaIds.indexOf(id);
    const batches: THREE.BufferGeometry[][] = [[], []];
    const add = (g: THREE.BufferGeometry, lane: number, x: number, y: number, z: number, rotation = 0, tilt = 0, tint = 0) => {
      g.rotateZ(tilt); g.rotateY(rotation); g.translate(x, y, z);
      const geometry = g.index ? g.toNonIndexed() : g;
      if (g.index) g.dispose();
      if (lane) {
        const color = new THREE.Color(theme.glow).lerp(new THREE.Color(secondaryGlow[id]), tint);
        const colors = new Float32Array(geometry.getAttribute("position").count * 3);
        for (let j = 0; j < colors.length; j += 3) colors.set([color.r, color.g, color.b], j);
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      }
      batches[lane].push(geometry);
    };
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4 + Math.PI / 8, x = Math.cos(angle) * 6.5, z = Math.sin(angle) * 6.5;
      const tangent = angle + Math.PI / 2;
      if (id === "citadel") {
        add(new THREE.CylinderGeometry(0.43, 0.62, 0.24, 8), 0, x, -0.15, z, angle);
        add(new THREE.CylinderGeometry(0.3, 0.5, 2.7, 6), 0, x, 0.9, z);
        add(new THREE.BoxGeometry(0.7, 0.17, 0.7), 0, x, 2.46, z, angle);
        add(new THREE.ConeGeometry(0.52, 0.7, 4), 0, x, 2.6, z, angle);
        add(new THREE.TorusGeometry(0.43, 0.028, 4, 32), 1, x, 2.15, z, angle, 0, 0.7);
        add(new THREE.BoxGeometry(0.06, 1.8, 0.41), 1, x, 1.28, z, angle);
        add(new THREE.OctahedronGeometry(0.15), 1, x, 3.02, z, angle, 0, 0.45);
      } else if (id === "ember") {
        add(new THREE.CylinderGeometry(0.42, 0.8, 1.5 + i % 2, 5), 0, x, 0.5, z, angle);
        const ring = new THREE.TorusGeometry(0.4, 0.045, 4, 20); ring.rotateX(Math.PI / 2);
        add(ring, 1, x, 1.19 + i % 2 * 0.5, z, angle, 0, 0.7);
        for (let j = 0; j < 3; j++) {
          const side = (j - 1) * 0.18;
          add(new THREE.ConeGeometry(0.14 + j * 0.025, 0.8 + j * 0.27, 5, 1, true), 1, x + Math.cos(tangent) * side, 1.48 + i % 2 * 0.4, z + Math.sin(tangent) * side, angle, (j - 1) * 0.18, j * 0.32);
          add(new THREE.BoxGeometry(0.035, 1.1, 0.038), 1, x + Math.cos(tangent) * side, 0.55, z + Math.sin(tangent) * side, angle, side, 0.8);
        }
      } else if (id === "frost") {
        add(new THREE.ConeGeometry(0.65, 3 + i % 2, 4), 0, x, 1.1, z, angle);
        add(new THREE.OctahedronGeometry(0.32), 1, x, 2.7, z);
        for (const side of [-0.45, 0.45]) {
          add(new THREE.ConeGeometry(0.25, 1.65, 4), 0, x + Math.cos(tangent) * side, 0.58, z + Math.sin(tangent) * side, angle, side * 0.32);
          add(new THREE.OctahedronGeometry(0.16), 1, x + Math.cos(tangent) * side, 1.38, z + Math.sin(tangent) * side, angle, 0, 0.75);
        }
      } else if (id === "astral") {
        add(new THREE.OctahedronGeometry(0.8), 0, x, 0.4, z);
        for (let j = 0; j < 2; j++) {
          const ring = new THREE.TorusGeometry(0.76 + j * 0.12, 0.022, 4, 36); ring.rotateX(j ? 0.85 : -0.85);
          add(ring, 1, x, 1.8 + i % 2 * 0.5, z, angle, j ? 0.25 : -0.25, j * 0.8);
        }
        add(new THREE.OctahedronGeometry(0.2), 1, x, 1.8 + i % 2 * 0.5, z, angle);
        add(new THREE.OctahedronGeometry(0.15), 1, x, 2.9 + i % 2 * 0.5, z, angle, 0, 0.75);
      } else if (id === "storm") {
        add(new THREE.ConeGeometry(0.55, 3.3, 4), 0, x, 1.1, z, angle);
        add(new THREE.CylinderGeometry(0.08, 0.16, 0.7, 5), 0, x, 2.97, z);
        for (let j = 0; j < 4; j++) {
          const side = j % 2 ? 0.16 : -0.16;
          add(new THREE.BoxGeometry(0.035, 0.42, 0.04), 1, x + Math.cos(tangent) * side, 2.35 + j * 0.22, z + Math.sin(tangent) * side, angle, j % 2 ? 0.55 : -0.55, j * 0.25);
        }
        add(new THREE.OctahedronGeometry(0.18), 1, x, 3.4, z, angle, 0, 0.65);
      } else if (id === "grove") {
        add(new THREE.CylinderGeometry(0.15, 0.32, 2.7, 5), 0, x, 0.9, z);
        add(new THREE.IcosahedronGeometry(0.85, 0), 0, x, 2.3, z);
        for (let j = 0; j < 3; j++) {
          const branch = angle + j * Math.PI * 2 / 3;
          add(new THREE.CylinderGeometry(0.045, 0.09, 0.88, 4), 0, x + Math.cos(branch) * 0.23, 1.86, z + Math.sin(branch) * 0.23, branch, 0.65);
          const leaf = new THREE.IcosahedronGeometry(0.29, 0); leaf.scale(1.0, 0.6, 0.8);
          add(leaf, 1, x + Math.cos(branch) * 0.54, 2.45 + j * 0.12, z + Math.sin(branch) * 0.54, branch, 0, j * 0.3);
        }
      } else if (id === "reactor") {
        add(new THREE.BoxGeometry(0.85, 2.7, 0.85), 0, x, 0.9, z, angle);
        add(new THREE.BoxGeometry(1.05, 0.2, 1.05), 0, x, 2.35, z, angle);
        for (let j = 0; j < 3; j++) add(new THREE.BoxGeometry(0.055, 0.49, 0.95), 1, x, 0.35 + j * 0.64, z, angle, 0, j * 0.35);
        add(new THREE.OctahedronGeometry(0.24), 1, x, 2.85, z, angle, 0, 0.8);
        const ring = new THREE.TorusGeometry(0.41, 0.026, 4, 24); ring.rotateX(Math.PI / 2);
        add(ring, 1, x, 2.85, z, angle);
      } else {
        add(new THREE.ConeGeometry(1, 2.8, 4), 0, x, 0.85, z, angle);
        add(new THREE.BoxGeometry(1.4, 0.2, 1.4), 0, x, -0.17, z, angle);
        add(new THREE.TorusGeometry(0.47, 0.025, 4, 32), 1, x, 2.61, z, angle);
        add(new THREE.TorusGeometry(0.58, 0.017, 4, 32, Math.PI * 1.45), 1, x, 2.61, z, angle, 0.3, 0.65);
        for (let j = 0; j < 3; j++) add(new THREE.BoxGeometry(0.03, 0.28, 0.04), 1, x + Math.cos(tangent) * (j - 1) * 0.24, 1.13 + j * 0.25, z + Math.sin(tangent) * (j - 1) * 0.24, angle, 0, j * 0.3);
      }
    }
    for (let i = 0; i < 2; i++) {
      const geometry = mergeGeometries(batches[i])!; batches[i].forEach((g) => g.dispose());
      const material = i ? new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending })
        : new THREE.MeshStandardMaterial({ color: theme.stone, metalness: id === "reactor" ? 0.8 : 0.3, roughness: 0.62 });
      // Merged foreground props fade in the shader so orbiting never hides a file.
      // The built-in camera uniform follows both OrbitControls and cinematic shots.
      material.transparent = true; material.depthWrite = false;
      material.onBeforeCompile = (shader) => {
        shader.vertexShader = `varying float vArenaVisibility;\n${shader.vertexShader}`.replace("#include <begin_vertex>", `
          #include <begin_vertex>
          vec2 fieldPosition = (modelMatrix * vec4(position,1.0)).xz;
          float front = dot(normalize(fieldPosition), normalize(cameraPosition.xz + vec2(0.0001)));
          vArenaVisibility = 1.0 - smoothstep(0.15,0.7,front) * 0.9;
        `);
        shader.fragmentShader = `varying float vArenaVisibility;\n${shader.fragmentShader}`.replace("#include <opaque_fragment>", `
          diffuseColor.a *= vArenaVisibility;
          #include <opaque_fragment>
        `);
      };
      material.customProgramCacheKey = () => "arena-foreground-fade-v1";
      const object = new THREE.Mesh(geometry, material); object.name = i ? "arena-beacons" : `arena-props-${id}`;
      this.root.add(object);
    }
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uFamily: { value: family }, uColor: { value: new THREE.Color(theme.glow) },
      uSecondary: { value: new THREE.Color(secondaryGlow[id]) }, uOrigin: { value: new THREE.Vector2() },
      uStrength: { value: 0 }, uAge: { value: 0 },
    }]);
    const material = new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      fog: true, vertexShader: fieldVertex, fragmentShader: fieldFragment,
    });
    this.field = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), material);
    this.field.name = `arena-field-${id}`; this.field.rotation.x = -Math.PI / 2; this.field.position.y = 0.013;
    this.root.add(this.field);
    const positions = new Float32Array(96 * 3), seeds = new Float32Array(96);
    for (let i = 0; i < 96; i++) {
      const angle = i * 2.39996, radius = 6.05 + (i * 17 % 31) / 18;
      positions.set([Math.cos(angle) * radius, 0.2 + (i * 13 % 23) / 10, Math.sin(angle) * radius], i * 3); seeds[i] = i * 0.73;
    }
    const particles = new THREE.BufferGeometry(); particles.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particles.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    this.particles = new THREE.Points(particles, new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      fog: true, vertexShader: particleVertex, fragmentShader: particleFragment,
    }));
    this.particles.name = `arena-particles-${id}`; this.particles.frustumCulled = false; this.root.add(this.particles);
    this.setMotion(this.low, this.reduced);
  }
  setMotion(low: boolean, reduced: boolean) {
    this.low = low; this.reduced = reduced;
    if (this.particles) { this.particles.visible = !reduced; this.particles.geometry.setDrawRange(0, low ? 32 : 96); }
  }
  react(point: THREE.Vector3) {
    if (!this.field || this.reduced) return;
    this.reactionStart = this.clock; this.field.material.uniforms.uOrigin.value.set(point.x, point.z);
  }
  resetReaction() { this.reactionStart = -100; if (this.field) this.field.material.uniforms.uStrength.value = 0; }
  update(time: number, low: boolean, reduced: boolean) {
    this.clock = time;
    if (low !== this.low || reduced !== this.reduced) this.setMotion(low, reduced);
    if (!this.field) return;
    const u = this.field.material.uniforms, age = time - this.reactionStart;
    u.uTime.value = reduced ? 0 : time; u.uAge.value = Math.max(0, age);
    u.uStrength.value = reduced ? 0 : Math.max(0, 1 - age / 1.4);
  }
  dispose() {
    for (const object of [...this.root.children]) {
      const mesh = object as THREE.Mesh; mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose(); this.root.remove(object);
    }
    this.field = undefined; this.particles = undefined;
  }
}
