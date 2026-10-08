import * as THREE from "three";
import type { PieceSymbol } from "chess.js";
import type { SkinId } from "./profile";

export type CombatVFXQuality = "auto" | "low" | "high";
export interface CombatVFXConfig {
  piece: PieceSymbol;
  color: number;
  skin: SkinId;
  quality: CombatVFXQuality;
  captured: boolean;
}
export interface CombatVFXFrame {
  time: number;
  progress: number;
  phase: string;
  charge: number;
  travel: number;
  strike: number;
  defeat: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  actor: THREE.Vector3;
  target: THREE.Vector3;
  contact: boolean;
  dead: boolean;
  /** Dramatic moves contact at .52; ordinary moves at .62; captures at .56. */
  contactAt?: number;
}

export const combatVFXBudgets = {
  low: { batches: 4, motes: 32, shards: 0 },
  auto: { batches: 5, motes: 64, shards: 16 },
  high: { batches: 5, motes: 96, shards: 24 },
} as const;
export const combatVFXStyles = {
  p: "piercing-lance", n: "crossing-crescents", b: "spiral-seal",
  r: "reactor-cannon", q: "orbital-vortex", k: "crown-judgement",
} as const satisfies Record<PieceSymbol, string>;

const pieceIndex: Record<PieceSymbol, number> = { p: 0, n: 1, b: 2, r: 3, q: 4, k: 5 };
const skinIndex: Record<SkinId, number> = { classic: 0, ember: 1, frost: 2, astral: 3, royal: 4 };
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smooth = (start: number, end: number, value: number) => {
  const t = clamp((value - start) / (end - start)); return t * t * (3 - 2 * t);
};
const seed = (index: number, salt: number) => {
  const n = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453; return n - Math.floor(n);
};
const shaderCommon = /* glsl */`
  uniform float uTime, uProgress, uPiece, uSkin, uCharge, uDash, uAttack;
  uniform float uStrike, uDefeat, uImpact, uWave, uDeath, uFade;
  uniform vec3 uActor, uTarget, uFrom, uTo, uForward, uSide, uColor, uCore;
  const float PI = 3.14159265359;
  const float TAU = 6.28318530718;
  float band(float value, float centre, float width) {
    float d = (value - centre) / width; return exp(-d * d);
  }
  vec3 energy(float glow, float core) {
    return uColor * glow + uCore * core;
  }
`;

// The seal and reticle share one batch; transparent empty quad space is discarded.
const groundVertex = /* glsl */`
  ${shaderCommon}
  attribute float aKind;
  varying vec2 vUv;
  varying float vKind;
  void main() {
    vUv = uv * 2.0 - 1.0; vKind = aKind;
    float radius = aKind < .5 ? .9 + uCharge * .27 : .68 + uAttack * .12;
    vec3 centre = aKind < .5 ? uActor : uTarget;
    centre.y = .045 + aKind * .012;
    vec3 p = centre + vec3(position.x * radius, 0.0, position.y * radius);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const groundFragment = /* glsl */`
  ${shaderCommon}
  varying vec2 vUv;
  varying float vKind;
  void main() {
    float r = length(vUv), angle = atan(vUv.y, vUv.x);
    float sectors = uPiece < .5 ? 3.0 : uPiece < 3.5 ? 4.0 : uPiece < 4.5 ? 6.0 : 8.0;
    float orbit = angle + uTime * (vKind < .5 ? .6 : -.45);
    float broken = smoothstep(-.4, .2, sin(orbit * sectors));
    float outer = band(r, .84, .028) * (.3 + .7 * broken);
    float inner = band(r, .56, .018) * (.5 + .5 * cos(orbit * sectors * 2.0));
    float ticks = band(r, .72, .09) * pow(max(0.0, cos(orbit * sectors)), 26.0);
    float rays = band(r, .4, .18) * pow(max(0.0, cos(angle * sectors)), 38.0);
    float fill = exp(-r * r * 5.0) * .07;
    float family = uSkin > 3.5 ? band(r, .96, .018) * broken :
      uSkin > 2.5 ? band(r, .94 + sin(angle * 3.0) * .025, .024) :
      uSkin > 1.5 ? band(max(abs(vUv.x), abs(vUv.y)), .61, .017) * .5 :
      uSkin > .5 ? band(r, .92 + sin(angle * 5.0 + uTime * 2.0) * .02, .04) * .5 : 0.0;
    float alive = vKind < .5 ? (.24 + uCharge * .6 + uDash * .2) * (1.0 - uDefeat * .8) :
      (.32 + uAttack * .48) * (1.0 - uDefeat * .5);
    float core = outer * .45 + inner * .25 + ticks * .36;
    float glow = outer + inner * .7 + ticks + rays * .6 + family + fill;
    float alpha = min(.78, glow * alive * uFade);
    if (alpha < .006) discard;
    gl_FragColor = vec4(energy(.64, core * .25), alpha);
    #include <colorspace_fragment>
  }
`;

const ribbonVertex = /* glsl */`
  ${shaderCommon}
  attribute float aPath, aT, aEdge;
  varying vec2 vRibbon;
  varying float vStrength;
  void main() {
    float t = aT, path = aPath;
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 actor = uActor + up * 1.25;
    vec3 target = uTarget + up * 1.05;
    vec3 p = actor, widthAxis = up;
    float width = .04, strength = uAttack;
    float swing = uStrike * 1.5 - .75;
    if (uPiece < .5) {
      if (path < 1.5) {
        float spiral = t * TAU + path * PI + uTime * 1.4;
        p = mix(actor, target + uForward * .55, t);
        p += (uSide * cos(spiral) + up * sin(spiral)) * sin(t * PI) * .16;
        widthAxis = normalize(uSide * cos(spiral) + up * sin(spiral)); width = .065;
      } else {
        p = mix(uFrom + up * .35, actor - up * .45, t);
        p += uSide * (path - 2.5) * .17 + up * sin(t * PI) * .12;
        widthAxis = uSide; strength = uDash * .7; width = .045;
      }
    } else if (uPiece < 1.5) {
      if (path < 2.5) {
        float angle = (-1.2 + t * 2.5) * PI + swing + path * .38;
        float diagonal = path < 1.0 ? -.68 : .68;
        vec3 axis = normalize(uSide * cos(diagonal) + up * sin(diagonal));
        float radius = 1.2 + path * .12;
        vec3 radial = axis * cos(angle) + uForward * sin(angle) * .36;
        p = target + radial * radius; widthAxis = normalize(radial); width = .15 * sin(t * PI);
      } else {
        p = mix(uFrom + up * .5, actor, t) + up * sin(t * PI) * .7;
        p += uSide * (path - 3.5) * .24; widthAxis = uSide; width = .08; strength = uDash;
      }
    } else if (uPiece < 2.5) {
      if (path < 3.5) {
        float angle = t * TAU * 1.8 + path * TAU / 4.0 - uTime * 1.2;
        float radius = .14 + sin(t * PI) * .18;
        vec3 radial = uSide * cos(angle) + up * sin(angle);
        p = mix(actor, target, t) + radial * radius;
        widthAxis = radial; width = path < .5 ? .09 : .033;
      } else {
        float angle = t * TAU + uTime * .55;
        vec3 radial = uSide * cos(angle) + up * sin(angle);
        p = target + radial * (.82 + (path - 4.0) * .17);
        widthAxis = radial; width = .025; strength = max(uAttack * .7, uCharge * .2);
      }
    } else if (uPiece < 3.5) {
      if (path < 2.5) {
        float radius = path < .5 ? 0.0 : .13;
        float angle = path * PI + t * TAU * .35;
        p = mix(actor - up * .15, target - up * .1, t) + uSide * cos(angle) * radius + up * sin(angle) * radius;
        widthAxis = path < .5 ? up : normalize(uSide + up * (path - 1.5));
        width = path < .5 ? .17 : .05;
      } else {
        float angle = t * TAU;
        float radius = .26 + (path - 3.0) * .13 + uStrike * .26;
        vec3 radial = uSide * cos(angle) + up * sin(angle);
        p = actor + uForward * (.2 + (path - 3.0) * .15) + radial * radius;
        widthAxis = radial; width = .04; strength = max(uAttack, uCharge * .35);
      }
    } else if (uPiece < 4.5) {
      float angle = t * TAU * .76 + path * TAU / 6.0 + uTime * .6;
      float radius = 1.05 - uStrike * .25 + sin(t * PI) * .3;
      vec3 radial = uSide * cos(angle) + uForward * sin(angle);
      p = target + radial * radius + up * (sin(angle + path) * .35 + (path - 2.5) * .12);
      widthAxis = normalize(radial + up * .28); width = .07 + .04 * sin(t * PI);
      strength = max(uAttack, uCharge * .15);
    } else {
      if (path < 2.5) {
        float angle = (-.75 + t * 1.5) * PI + swing * .7;
        vec3 radial = up * cos(angle) + uForward * sin(angle) * .62;
        p = target + radial * (1.4 + path * .1) + uSide * (path - 1.0) * .13;
        widthAxis = normalize(radial); width = .15 * sin(t * PI);
      } else {
        float angle = t * TAU + uTime * .35;
        vec3 radial = uSide * cos(angle) + uForward * sin(angle);
        p = target + up * (1.3 + (path - 3.0) * .2) + radial * .75;
        widthAxis = radial; width = .03; strength = uAttack * .6;
      }
    }
    if (path >= 2.0) {
      float chargeShape = (1.0 - smoothstep(.0, .2, uDash)) * (1.0 - smoothstep(.0, .3, uAttack));
      float angle = t * TAU * .9 + path * .8 + uTime * .65;
      vec3 radial = uSide * cos(angle) + uForward * sin(angle);
      vec3 helix = uActor + radial * (.48 + path * .045) + up * (.15 + t * 1.5);
      p = mix(p, helix, chargeShape);
      widthAxis = normalize(mix(widthAxis, radial, chargeShape));
      width = mix(width, .025, chargeShape);
      strength = max(strength, uCharge * .34 * chargeShape);
    }
    // A small family-specific ripple follows the curved core, never hides it.
    float detail = uSkin < .5 ? 0.0 : sin(t * (uSkin > 1.5 && uSkin < 2.5 ? 36.0 : 20.0) + uTime * 2.0) * .018;
    p += widthAxis * (aEdge * max(.004, width) + detail);
    vRibbon = vec2(t, aEdge); vStrength = strength * uFade;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const ribbonFragment = /* glsl */`
  ${shaderCommon}
  varying vec2 vRibbon;
  varying float vStrength;
  void main() {
    float across = abs(vRibbon.y);
    float feather = pow(max(0.0, 1.0 - across * across), 1.5);
    float tapered = smoothstep(0.0, .055, vRibbon.x) * (1.0 - smoothstep(.87, 1.0, vRibbon.x));
    float core = exp(-across * across * 24.0);
    float streak = .8 + .2 * sin(vRibbon.x * 42.0 - uTime * 2.0);
    float alpha = feather * tapered * vStrength * .74;
    if (alpha < .004) discard;
    gl_FragColor = vec4(energy(.7 * streak, core * .28), alpha);
    #include <colorspace_fragment>
  }
`;

const waveVertex = /* glsl */`
  ${shaderCommon}
  attribute float aKind;
  varying vec2 vUv;
  varying float vKind;
  void main() {
    vUv = uv * 2.0 - 1.0; vKind = aKind;
    float radius = .4 + uWave * 1.7 + aKind * .1;
    vec3 p = uTarget;
    if (aKind < .5) {
      p.y = .07; p += vec3(position.x * radius, 0.0, position.y * radius);
    } else {
      vec3 vertical = aKind < 1.5 ? vec3(0.0, 1.0, 0.0) : normalize(vec3(0.0, .8, 0.0) + uForward * .45);
      p += vec3(0.0, .9, 0.0) + uSide * position.x * radius + vertical * position.y * radius;
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const waveFragment = /* glsl */`
  ${shaderCommon}
  varying vec2 vUv;
  varying float vKind;
  void main() {
    float radius = length(vUv), angle = atan(vUv.y, vUv.x);
    float broken = .4 + .6 * pow(max(0.0, cos(angle * (3.0 + uPiece))), 3.0);
    float ring = band(radius, .76, .029 + uWave * .018);
    float secondary = band(radius, .59, .013) * .42;
    float halo = band(radius, .73, .12) * .15;
    float spokes = pow(max(0.0, cos(angle * (4.0 + uPiece))), 32.0) * band(radius, .44, .24) * .18;
    float alpha = (ring * broken + secondary + halo + spokes) * uImpact * uFade * (vKind < .5 ? .63 : .42);
    if (alpha < .004) discard;
    gl_FragColor = vec4(energy(.65, ring * .16), alpha);
    #include <colorspace_fragment>
  }
`;

const moteVertex = /* glsl */`
  ${shaderCommon}
  attribute vec4 aSeed;
  varying float vAlpha, vCore;
  void main() {
    float angle = aSeed.x * TAU + uTime * (.5 + aSeed.y);
    float radius = (.34 + aSeed.z * .7) * (1.0 - uCharge * .64);
    vec3 p = uActor + vec3(cos(angle) * radius, .4 + aSeed.y * 1.3, sin(angle) * radius);
    float alpha = (.15 + uCharge * .65) * (1.0 - uAttack * .7);
    float speed = .7 + aSeed.z * 1.5;
    if (uProgress > .36 && uProgress < .56) {
      float tail = aSeed.y * .7;
      p = mix(uFrom, uActor, 1.0 - tail) + vec3(0.0, .15 + aSeed.z * .65, 0.0);
      p += uSide * (aSeed.x - .5) * .5; alpha = max(alpha, uDash * .6);
    }
    if (uImpact > 0.0) {
      vec3 direction = normalize(vec3(cos(angle), .22 + aSeed.y * .8, sin(angle)));
      float distance = min(2.25, (.08 + uWave * 1.65) * speed);
      p = uTarget + vec3(0.0, .9, 0.0) + direction * distance;
      p.y -= uWave * uWave * .55;
      alpha = uImpact * (.48 + aSeed.w * .35);
    }
    if (uDeath > 0.0 && aSeed.w > .65) {
      p = uTarget + vec3((aSeed.x - .5) * .8, .3 + aSeed.y * 1.65 + uDeath * .7, (aSeed.z - .5) * .8);
      p += uSide * sin(uTime + aSeed.x * TAU) * .2;
      alpha = max(alpha, sin(uDeath * PI) * .8);
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = clamp((2.3 + aSeed.w * 3.0) * 60.0 / max(1.0, -mv.z), 1.6, 18.0);
    vAlpha = alpha * uFade; vCore = aSeed.w;
    gl_Position = projectionMatrix * mv;
  }
`;
const moteFragment = /* glsl */`
  ${shaderCommon}
  varying float vAlpha, vCore;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r = dot(p, p);
    float glow = exp(-r * 4.5), core = exp(-r * 28.0);
    float star = exp(-abs(p.x * p.y) * 50.0) * exp(-r * 8.0) * vCore * .2;
    float alpha = (glow * .6 + core * .4 + star) * vAlpha;
    if (alpha < .006) discard;
    gl_FragColor = vec4(energy(.7, core * .35 + star), alpha);
    #include <colorspace_fragment>
  }
`;

const shardVertex = /* glsl */`
  ${shaderCommon}
  attribute vec4 aSeed;
  varying float vAlpha, vLight;
  void main() {
    float angle = aSeed.x * TAU;
    vec3 axis = normalize(vec3(cos(angle), .25 + aSeed.y, sin(angle)));
    float distance = min(2.15, uWave * (1.2 + aSeed.z));
    vec3 p = position * vec3(.022, .065 + aSeed.w * .13, .024);
    float spin = uTime * (2.0 + aSeed.z * 4.0) + angle;
    p.xz = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * p.xz;
    p.xy = mat2(cos(spin * .6), -sin(spin * .6), sin(spin * .6), cos(spin * .6)) * p.xy;
    p += uTarget + vec3(0.0, .9, 0.0) + axis * distance;
    p.y -= uWave * uWave * .75;
    vAlpha = uImpact * uFade * (.42 + aSeed.w * .22);
    vLight = .35 + abs(normal.y) * .5 + abs(normal.z) * .15;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const shardFragment = /* glsl */`
  ${shaderCommon}
  varying float vAlpha, vLight;
  void main() {
    if (vAlpha < .004) discard;
    gl_FragColor = vec4(energy(vLight * .55, vLight * .16), vAlpha);
    #include <colorspace_fragment>
  }
`;

function quads(count: number) {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [], uvs: number[] = [], kinds: number[] = [], indices: number[] = [];
  for (let i = 0; i < count; i++) {
    positions.push(-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1); kinds.push(i, i, i, i);
    const offset = i * 4; indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("aKind", new THREE.Float32BufferAttribute(kinds, 1));
  geometry.setIndex(indices); return geometry;
}
function ribbons(paths: number, samples: number) {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [], pathIds: number[] = [], fractions: number[] = [], edges: number[] = [], indices: number[] = [];
  for (let path = 0; path < paths; path++) {
    for (let step = 0; step <= samples; step++) for (const edge of [-1, 1]) {
      positions.push(0, 0, 0); pathIds.push(path); fractions.push(step / samples); edges.push(edge);
    }
    const base = path * (samples + 1) * 2;
    for (let step = 0; step < samples; step++) {
      const i = base + step * 2; indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    }
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aPath", new THREE.Float32BufferAttribute(pathIds, 1));
  geometry.setAttribute("aT", new THREE.Float32BufferAttribute(fractions, 1));
  geometry.setAttribute("aEdge", new THREE.Float32BufferAttribute(edges, 1));
  geometry.setIndex(indices); return geometry;
}
function seeds(count: number, instanced = false) {
  const data = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) for (let j = 0; j < 4; j++) data[i * 4 + j] = seed(i + 1, j + 1);
  return instanced ? new THREE.InstancedBufferAttribute(data, 4) : new THREE.BufferAttribute(data, 4);
}

/** One move owns all resources; the scene disposes this group on finish or cancel. */
export class CombatVFX {
  readonly group = new THREE.Group();
  readonly root = this.group;
  readonly chargeGroup = new THREE.Group();
  readonly lockGroup = new THREE.Group();
  readonly budget: (typeof combatVFXBudgets)[CombatVFXQuality];
  readonly config: CombatVFXConfig;
  private readonly uniforms: Record<string, THREE.IUniform>;
  private readonly direction = new THREE.Vector3();
  private readonly side = new THREE.Vector3();

  constructor(config: CombatVFXConfig) {
    this.config = config;
    this.budget = combatVFXBudgets[config.quality];
    this.group.name = `combat-vfx-${config.piece}-${config.skin}`;
    this.group.userData.combatVFX = true;
    this.group.userData.style = combatVFXStyles[config.piece];
    this.group.userData.budget = this.budget;
    this.chargeGroup.name = `charge-${config.piece}`;
    this.lockGroup.name = config.captured ? "enemy-lock" : "destination-lock";
    const color = new THREE.Color(config.color);
    const core = color.clone().lerp(new THREE.Color(0xe8f4ff), .48);
    this.uniforms = {
      uTime: { value: 0 }, uProgress: { value: 0 }, uPiece: { value: pieceIndex[config.piece] }, uSkin: { value: skinIndex[config.skin] },
      uCharge: { value: 0 }, uDash: { value: 0 }, uAttack: { value: 0 }, uStrike: { value: 0 },
      uDefeat: { value: 0 }, uImpact: { value: 0 }, uWave: { value: 0 }, uDeath: { value: 0 }, uFade: { value: 1 },
      uActor: { value: new THREE.Vector3() }, uTarget: { value: new THREE.Vector3() },
      uFrom: { value: new THREE.Vector3() }, uTo: { value: new THREE.Vector3() },
      uForward: { value: new THREE.Vector3(0, 0, -1) }, uSide: { value: new THREE.Vector3(1, 0, 0) },
      uColor: { value: color }, uCore: { value: core },
    };
    const material = (vertexShader: string, fragmentShader: string) => new THREE.ShaderMaterial({
      uniforms: { ...this.uniforms }, vertexShader, fragmentShader, transparent: true, depthWrite: false,
      depthTest: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true,
      toneMapped: false,
    });
    const add = (object: THREE.Object3D, name: string) => {
      object.name = name; object.frustumCulled = false; object.renderOrder = 6; this.group.add(object);
    };
    const seal = new THREE.Mesh(quads(2), material(groundVertex, groundFragment));
    seal.add(this.chargeGroup, this.lockGroup);
    add(seal, "vfx-seal-and-reticle");
    const paths = config.piece === "p" ? 4 : config.piece === "n" ? 5 : 6;
    add(new THREE.Mesh(ribbons(paths, config.quality === "low" ? 20 : 40), material(ribbonVertex, ribbonFragment)), `vfx-${combatVFXStyles[config.piece]}`);
    add(new THREE.Mesh(quads(config.quality === "low" ? 2 : 3), material(waveVertex, waveFragment)), "vfx-pressure-waves");
    const moteGeometry = new THREE.BufferGeometry();
    moteGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.budget.motes * 3), 3));
    moteGeometry.setAttribute("aSeed", seeds(this.budget.motes));
    add(new THREE.Points(moteGeometry, material(moteVertex, moteFragment)), "vfx-energy-motes");
    if (this.budget.shards) {
      const geometry = new THREE.IcosahedronGeometry(1, 0);
      geometry.setAttribute("aSeed", seeds(this.budget.shards, true));
      const shards = new THREE.InstancedMesh(geometry, material(shardVertex, shardFragment), this.budget.shards);
      const identity = new THREE.Matrix4();
      for (let i = 0; i < this.budget.shards; i++) shards.setMatrixAt(i, identity);
      add(shards, "vfx-prismatic-shards");
    }
  }

  update(frame: CombatVFXFrame) {
    const progress = clamp(frame.progress), captured = this.config.captured;
    const impactStart = frame.contactAt === undefined ? captured ? .56 : .62 : clamp(frame.contactAt);
    const holdEnd = Math.min(.94, impactStart + (impactStart < .6 ? .08 : .1));
    const frozenDuration = Math.max(0, Math.min(progress, holdEnd) - impactStart);
    this.uniforms.uTime.value = (progress - frozenDuration) * 5;
    this.uniforms.uProgress.value = progress;
    this.uniforms.uCharge.value = clamp(frame.charge) * (1 - smooth(impactStart - .03, holdEnd + .08, progress));
    this.uniforms.uDash.value = smooth(captured ? .18 : .22, captured ? .28 : .34, progress) * (1 - smooth(captured ? .43 : .52, holdEnd, progress));
    this.uniforms.uAttack.value = smooth(captured ? .4 : .38, impactStart - .01, progress) * (1 - smooth(holdEnd + .04, .91, progress));
    this.uniforms.uStrike.value = clamp(frame.strike);
    this.uniforms.uDefeat.value = captured ? clamp(frame.defeat) : 0;
    this.uniforms.uWave.value = clamp((progress - holdEnd) / (1 - holdEnd));
    this.uniforms.uImpact.value = frame.contact ? 1 - smooth(holdEnd + .05, .97, progress) : 0;
    this.uniforms.uDeath.value = captured && (frame.dead || frame.defeat > 0) ? clamp((progress - .64) / .29) : 0;
    this.uniforms.uFade.value = 1 - smooth(.86, 1, progress);
    (this.uniforms.uActor.value as THREE.Vector3).copy(frame.actor);
    (this.uniforms.uTarget.value as THREE.Vector3).copy(frame.target);
    (this.uniforms.uFrom.value as THREE.Vector3).copy(frame.from);
    (this.uniforms.uTo.value as THREE.Vector3).copy(frame.to);
    if (captured) this.direction.copy(frame.target).sub(frame.actor);
    else this.direction.copy(frame.to).sub(frame.from);
    this.direction.y = 0;
    if (this.direction.lengthSq() < .000001) { this.direction.copy(frame.to).sub(frame.from); this.direction.y = 0; }
    if (this.direction.lengthSq() < .000001) this.direction.set(0, 0, -1);
    this.direction.normalize(); this.side.set(-this.direction.z, 0, this.direction.x);
    (this.uniforms.uForward.value as THREE.Vector3).copy(this.direction);
    (this.uniforms.uSide.value as THREE.Vector3).copy(this.side);
    this.chargeGroup.position.copy(frame.actor); this.chargeGroup.position.y = .045;
    this.lockGroup.position.copy(frame.target); this.lockGroup.position.y = .057;
    this.group.userData.phase = frame.phase;
    this.group.userData.progress = progress;
    this.group.visible = progress < 1;
  }
}
