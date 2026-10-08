import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { arenas, arenaIds, type ArenaId } from "./arenas";

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
    const add = (g: THREE.BufferGeometry, lane: number, x: number, y: number, z: number, rotation = 0) => {
      g.rotateY(rotation); g.translate(x, y, z); batches[lane].push(g.index ? g.toNonIndexed() : g);
      if (g.index) g.dispose();
    };
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4 + Math.PI / 8, x = Math.cos(angle) * 6.5, z = Math.sin(angle) * 6.5;
      if (id === "citadel") {
        add(new THREE.CylinderGeometry(0.3, 0.5, 2.7, 6), 0, x, 0.9, z);
        add(new THREE.ConeGeometry(0.52, 0.7, 4), 0, x, 2.6, z, angle);
        add(new THREE.TorusGeometry(0.4, 0.04, 4, 24), 1, x, 2.2, z, angle);
      } else if (id === "ember") {
        add(new THREE.CylinderGeometry(0.42, 0.8, 1.5 + i % 2, 5), 0, x, 0.5, z, angle);
        add(new THREE.ConeGeometry(0.25, 1.4, 5, 1, true), 1, x, 1.5, z);
      } else if (id === "frost") {
        add(new THREE.ConeGeometry(0.65, 3 + i % 2, 4), 0, x, 1.1, z, angle);
        add(new THREE.OctahedronGeometry(0.45), 1, x, 2.7, z);
      } else if (id === "astral") {
        add(new THREE.OctahedronGeometry(0.8), 0, x, 0.4, z);
        const ring = new THREE.TorusGeometry(0.85, 0.045, 4, 40); ring.rotateX(i % 2 ? 0.6 : -0.6);
        add(ring, 1, x, 1.8 + i % 2 * 0.5, z, angle);
      } else if (id === "storm") {
        add(new THREE.ConeGeometry(0.55, 3.3, 4), 0, x, 1.1, z, angle);
        for (let j = 0; j < 3; j++) add(new THREE.BoxGeometry(0.05, 0.8, 0.05), 1, x + (j % 2 ? 0.15 : -0.15), 2.4 + j * 0.5, z, angle);
      } else if (id === "grove") {
        add(new THREE.CylinderGeometry(0.15, 0.32, 2.7, 5), 0, x, 0.9, z);
        add(new THREE.IcosahedronGeometry(0.85, 0), 0, x, 2.3, z);
        add(new THREE.IcosahedronGeometry(0.38, 0), 1, x + 0.4, 2.6, z);
      } else if (id === "reactor") {
        add(new THREE.BoxGeometry(0.85, 2.7, 0.85), 0, x, 0.9, z, angle);
        add(new THREE.BoxGeometry(0.1, 2.4, 0.95), 1, x, 1.1, z, angle);
        add(new THREE.OctahedronGeometry(0.35), 1, x, 2.7, z);
      } else {
        add(new THREE.ConeGeometry(1, 2.8, 4), 0, x, 0.85, z, angle);
        add(new THREE.TorusGeometry(0.48, 0.045, 4, 32), 1, x, 2.6, z, angle);
      }
    }
    for (let i = 0; i < 2; i++) {
      const geometry = mergeGeometries(batches[i])!; batches[i].forEach((g) => g.dispose());
      const material = i ? new THREE.MeshBasicMaterial({ color: theme.glow, transparent: true, opacity: 0.65 })
        : new THREE.MeshStandardMaterial({ color: theme.stone, metalness: id === "reactor" ? 0.8 : 0.3, roughness: 0.7 });
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
    const uniforms = { uTime: { value: 0 }, uFamily: { value: family }, uColor: { value: new THREE.Color(theme.glow) },
      uOrigin: { value: new THREE.Vector2() }, uStrength: { value: 0 }, uAge: { value: 0 } };
    const material = new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vWorld; void main(){ vec4 p=modelMatrix*vec4(position,1.0); vWorld=p.xz; gl_Position=projectionMatrix*viewMatrix*p; }`,
      fragmentShader: `varying vec2 vWorld; uniform float uTime,uFamily,uStrength,uAge; uniform vec2 uOrigin; uniform vec3 uColor;
        void main(){ float r=length(vWorld); float a=atan(vWorld.y,vWorld.x);
          float border=(1.0-smoothstep(0.02,0.07,abs(r-5.8))) * (0.14+0.04*sin(uTime+a*8.0));
          border+= (1.0-smoothstep(0.02,0.05,abs(r-6.0))) * 0.08;
          vec2 p=vWorld-uOrigin; float d=length(p), theta=atan(p.y,p.x);
          float wave=1.0-smoothstep(0.025,0.14,abs(d-(0.35+uAge*2.6)));
          float pattern=0.65+0.35*cos(theta*8.0);
          if(uFamily>0.5&&uFamily<1.5) pattern=pow(max(0.0,sin(theta*9.0+d*5.0-uAge*10.0)),2.0);
          if(uFamily>1.5&&uFamily<2.5) pattern=pow(abs(cos(theta*3.0)),8.0);
          if(uFamily>2.5&&uFamily<3.5) pattern=0.3+0.7*pow(abs(sin(theta*3.0+d*4.0-uAge*8.0)),3.0);
          if(uFamily>3.5&&uFamily<4.5) pattern=pow(abs(cos(theta*7.0+sin(d*12.0)*0.3)),14.0);
          if(uFamily>4.5&&uFamily<5.5) pattern=pow(max(0.0,cos(theta*5.0+d*2.0-uAge*5.0)),3.0);
          if(uFamily>5.5&&uFamily<6.5){ d=max(abs(p.x),abs(p.y)); wave=1.0-smoothstep(0.03,0.11,abs(d-(0.35+uAge*2.6))); pattern=0.6+0.4*cos((p.x+p.y)*12.0); }
          if(uFamily>6.5) pattern=0.3+0.7*pow(abs(sin(theta*10.0-d*5.0+uAge*6.0)),2.0);
          float alpha=border + wave*pattern*uStrength*0.65;
          if(alpha<0.005) discard; gl_FragColor=vec4(uColor,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.field = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), material);
    this.field.name = `arena-field-${id}`; this.field.rotation.x = -Math.PI / 2; this.field.position.y = 0.013;
    this.root.add(this.field);
    const positions = new Float32Array(96 * 3), seeds = new Float32Array(96);
    for (let i = 0; i < 96; i++) {
      const angle = i * 2.39996, radius = 5 + (i * 17 % 31) / 12;
      positions.set([Math.cos(angle) * radius, 0.2 + (i * 13 % 23) / 10, Math.sin(angle) * radius], i * 3); seeds[i] = i * 0.73;
    }
    const particles = new THREE.BufferGeometry(); particles.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particles.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    this.particles = new THREE.Points(particles, new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aSeed; uniform float uTime,uFamily; varying float vAlpha;
        void main(){ vec3 p=position; float t=uTime*0.4+aSeed;
          if(uFamily<0.5) p.y+=sin(t)*0.15;
          else if(uFamily<1.5) p.y=mod(position.y+uTime*0.9,3.0);
          else if(uFamily<2.5){ p.y=3.0-mod(position.y+uTime*0.25,3.0); p.x+=sin(t)*0.3; }
          else if(uFamily<3.5){ p.y+=sin(t)*0.45; p.xz=mat2(cos(uTime*0.05),-sin(uTime*0.05),sin(uTime*0.05),cos(uTime*0.05))*p.xz; }
          else if(uFamily<4.5) p.y+=sin(t*7.0)*0.2;
          else if(uFamily<5.5){ p.x+=sin(t)*0.35; p.y+=cos(t*0.7)*0.4; }
          else if(uFamily<6.5) p.y=mod(position.y+uTime*0.5,3.0);
          else { p.y=0.3+mod(position.y+uTime*0.2,1.3); p.x+=sin(t)*0.8; }
          vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv;
          gl_PointSize=clamp(38.0/-mv.z,1.0,5.0); vAlpha=0.3+0.3*sin(t*2.0);
        }`,
      fragmentShader: `uniform vec3 uColor; varying float vAlpha; void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5)discard; gl_FragColor=vec4(uColor,(1.0-d*2.0)*vAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
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
