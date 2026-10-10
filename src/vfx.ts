import * as THREE from "three";
import type { PieceSymbol } from "chess.js";
import { skins, type SkinId } from "./profile.ts";
import { combatProfile, type DefenseReaction } from "./combat-profiles.ts";
import { CAPTURE_CLASH, CAPTURE_CONTACT, CAPTURE_DEATH } from "./combat.ts";

export type CombatVFXQuality = "auto" | "low" | "high";
export interface CombatVFXConfig {
  piece: PieceSymbol;
  color: number;
  skin: SkinId;
  quality: CombatVFXQuality;
  captured: boolean;
  defenderPiece?: PieceSymbol;
  defenderSkin?: SkinId;
  defenderColor?: number;
  reaction?: DefenseReaction;
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
  /** Each phase is supplied by the shared choreography, never a second timer. */
  opening?: number;
  counter?: number;
  clash?: number;
  finisher?: number;
  recovery?: number;
  /** Dramatic quiet moves contact at .52; ordinary moves at .62. */
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
const skinIndex: Record<SkinId, number> = { classic: 0, ember: 1, frost: 2, astral: 3, royal: 4, storm: 5, void: 6, prism: 7, nova:8, phantom:9, dragon:10 };
const reactionIndex: Record<DefenseReaction, number> = { parry: 0, shield: 1, barrier: 2, dodge: 3, brace: 4 };
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
  uniform float uOpening, uCounter, uClash, uFinisher, uRecovery;
  uniform float uDefenderPiece, uDefenderSkin, uReaction, uOffensePaths;
  uniform float uLobes, uRings, uShardRatio, uTrailWidth, uBurstScale, uOrbitSpeed;
  uniform float uClashWave, uContact;
  uniform vec3 uActor, uTarget, uFrom, uTo, uForward, uSide, uColor, uCore;
  uniform vec3 uClashPoint, uDefenderColor;
  const float PI = 3.14159265359;
  const float TAU = 6.28318530718;
  float band(float value, float centre, float width) {
    float d = (value - centre) / width; return exp(-d * d);
  }
  vec3 energy(float glow, float core) {
    vec3 tint = uColor;
    if (uSkin > 6.5 && uSkin < 7.5) tint = mix(tint, vec3(.65) + .35 * cos(vec3(0.0,2.1,4.2) + uTime * 1.4 + uProgress * 6.0), .45);
    return tint * glow + uCore * core;
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
    if (aKind > 1.5) radius = .3 + uClash * .35;
    vec3 centre = aKind < .5 ? uActor : aKind < 1.5 ? uTarget : uClashPoint;
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
    float sectors = uLobes;
    float orbit = angle + uTime * (vKind < .5 ? .6 : -.45) * uOrbitSpeed;
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
    if(uSkin > 9.5) {
      outer = 0.0; inner = 0.0;
      family = band(vUv.y-vUv.x*.4,0.0,.025)*band(abs(vUv.x),.4,.3)
        + band(vUv.y-vUv.x*.4,.22,.025)*band(abs(vUv.x),.4,.3)
        + band(vUv.y-vUv.x*.4,-.22,.025)*band(abs(vUv.x),.4,.3);
    } else if(uSkin > 8.5) {
      outer *= smoothstep(.15,.5,abs(vUv.x)); inner = 0.0;
      family = band(length(vUv*vec2(1.8,.8)),.7,.025);
      rays = 0.0; ticks = 0.0;
    } else if(uSkin > 7.5) {
      family = band(r,.94,.015)*pow(max(0.0,cos(angle*12.0-uTime*.5)),8.0);
      inner = band(r,.4,.015); rays *= 1.5;
    }
    // A ward follows the defender's class, rather than repainting the attack seal.
    if (vKind > .5 && vKind < 1.5) {
      float wardSectors = uDefenderPiece < 1.5 ? 3.0 : uDefenderPiece < 3.5 ? 4.0 : 6.0;
      float ward = band(r, .68, .025) * pow(max(0.0, cos(angle * wardSectors - uTime)), 6.0);
      family += ward * uCounter + band(r, .92, .018) * uClash;
    }
    // The third quad traces the shared point where weapons / wards actually meet.
    if (vKind > 1.5) {
      float cross = band(vUv.x, 0.0, .055) * band(abs(vUv.y), .45, .32) +
        band(vUv.y, 0.0, .055) * band(abs(vUv.x), .45, .32);
      float alpha = min(.6, (cross + band(r, .76, .045)) * uClash * uFade);
      if (alpha < .006) discard;
      gl_FragColor = vec4(energy(.55, .25), alpha);
      #include <colorspace_fragment>
      return;
    }
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
  varying float vDefense;
  void main() {
    float t = aT, path = aPath;
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 actor = uActor + up * 1.25;
    vec3 target = uTarget + up * 1.05;
    vec3 p = actor, widthAxis = up;
    float width = .04, strength = uAttack;
    float swing = uStrike * 1.5 - .75;
    float finalWeight = .72 + uFinisher * .46;
    if (uPiece < .5) {
      if (path < 1.5) {
        float spiral = t * TAU + path * PI + uTime * 1.4 * uOrbitSpeed;
        p = mix(actor, target + uForward * .55, t);
        p += (uSide * cos(spiral) + up * sin(spiral)) * sin(t * PI) * .16;
        widthAxis = normalize(uSide * cos(spiral) + up * sin(spiral)); width = .065;
        // A rapid three-thrust opening resolves into one long plasma finisher.
        strength *= .58 + .42 * max(uFinisher, pow(max(0.0, sin(uOpening * PI * 3.0)), 2.0));
      } else {
        p = mix(uFrom + up * .35, actor - up * .45, t);
        p += uSide * (path - 2.5) * .17 + up * sin(t * PI) * .12;
        widthAxis = uSide; strength = uDash * .7; width = .045;
      }
    } else if (uPiece < 1.5) {
      if (path < 2.5) {
        float angle = (-1.2 + t * 2.5) * PI + swing + path * .38;
        angle += (uFinisher > .01 ? -.18 : .18) * PI;
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
        float angle = t * TAU * 1.8 + path * TAU / 4.0 - uTime * 1.2 * uOrbitSpeed;
        float radius = .14 + sin(t * PI) * .18;
        vec3 radial = uSide * cos(angle) + up * sin(angle);
        p = mix(actor, target, t) + radial * radius;
        widthAxis = radial; width = path < .5 ? .09 + uFinisher * .06 : .033;
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
        width = path < .5 ? .12 + uFinisher * .12 : .05;
      } else {
        float angle = t * TAU;
        float radius = .26 + (path - 3.0) * .13 + uStrike * .26;
        vec3 radial = uSide * cos(angle) + up * sin(angle);
        p = actor + uForward * (.2 + (path - 3.0) * .15) + radial * radius;
        widthAxis = radial; width = .04; strength = max(uAttack, uCharge * .35);
      }
    } else if (uPiece < 4.5) {
      float angle = t * TAU * .76 + path * TAU / 6.0 + uTime * .6 * uOrbitSpeed;
      float radius = 1.05 - uStrike * .25 + sin(t * PI) * .3;
      vec3 radial = uSide * cos(angle) + uForward * sin(angle);
      p = target + radial * radius + up * (sin(angle + path) * .35 + (path - 2.5) * .12);
      widthAxis = normalize(radial + up * .28); width = .07 + .04 * sin(t * PI);
      // Orbital blades converge for the final strike, with discrete lightning joints.
      p = mix(p, mix(actor + up * .35, target, t), uFinisher * .48);
      p += up * sin(floor(t * 12.0) * 7.7 + path) * .06 * uFinisher;
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
    if (path >= 2.0 && path < uOffensePaths) {
      float chargeShape = (1.0 - smoothstep(.0, .2, uDash)) * (1.0 - smoothstep(.0, .3, uAttack));
      float angle = t * TAU * .9 + path * .8 + uTime * .65;
      vec3 radial = uSide * cos(angle) + uForward * sin(angle);
      vec3 helix = uActor + radial * (.48 + path * .045) + up * (.15 + t * 1.5);
      p = mix(p, helix, chargeShape);
      widthAxis = normalize(mix(widthAxis, radial, chargeShape));
      width = mix(width, .025, chargeShape);
      strength = max(strength, uCharge * .34 * chargeShape);
    }
    width *= clamp(uTrailWidth / .14, .48, 2.2) * finalWeight;
    // Skin styles alter the trajectory and release, not merely its colour.
    if (uSkin > 9.5) {
      // Three broad claw tracks rake down toward the target instead of flame noise.
      p += uSide * (mod(path,3.0)-1.0) * .24 + up * sin(t*PI) * .38;
      width *= 1.4; strength *= .6 + .4 * t;
    } else if (uSkin > 8.5) {
      // Separated veil segments: clear gaps, a lateral approach and a thin draw cut.
      p += uSide * sin(t*PI) * (mod(path,2.0)<.5 ? -.4 : .4);
      strength *= smoothstep(.25,.4,fract(t*4.0)); width *= .55;
    } else if (uSkin > 7.5) {
      // Solar paths converge into a straight lance, without lightning zigzags.
      p = mix(p, mix(uActor+up*1.2,uTarget+up*1.2,t), uAttack);
      width *= .7 + uAttack*.9;
    } else if (uSkin > 6.5) {
      p += widthAxis * sin(floor(t * 8.0) * 2.1 + path) * .13;
      width *= .7 + .3 * abs(sin(t * PI * 6.0));
    } else if (uSkin > 5.5) {
      p = mix(p, uActor + up * .9, sin(t * PI) * .16);
      strength *= .4 + .6 * abs(sin(t * PI * 2.0 - uTime));
    } else if (uSkin > 4.5) {
      p += widthAxis * sin(floor(t * 22.0) * 2.8 + uTime * 4.0) * .09;
      width *= .6 + .4 * step(.3, fract(t * 12.0 - uTime));
    } else if (uSkin > .5 && uSkin < 1.5) {
      p += up * sin(t * PI) * (.08 + .1 * sin(t * 23.0 - uTime * 4.0));
      width *= .84 + .16 * sin(t * 37.0 - uTime * 5.0);
    } else if (uSkin > 1.5 && uSkin < 2.5) {
      p += widthAxis * sin(floor(t * 14.0) * 2.4 + path) * .065;
      strength *= .45 + .55 * step(.22, fract(t * 9.0 + path * .17));
    } else if (uSkin > 2.5 && uSkin < 3.5) {
      p += uSide * sin(t * PI) * sin(t * TAU * 1.5 + path) * .17;
      p += up * sin(t * PI) * cos(t * TAU + path) * .08;
      strength *= .46 + .54 * smoothstep(.08, .27, abs(sin(t * PI * 3.0 - uTime * .45)));
    } else if (uSkin > 3.5) {
      p += up * sin(t * PI) * .1 * (path < 2.5 ? 1.0 : -1.0);
      width *= 1.08; strength *= .88 + .12 * cos(t * TAU * uRings);
    }
    if (path >= uOffensePaths) {
      float defensePath = path - uOffensePaths;
      float response = max(uCounter * .8, uClash);
      if (uReaction < .5) {
        // A paired parry arc crosses the incoming attack at a shared contact.
        float a = (t * 1.2 - .6) * PI - uCounter * .3 + defensePath * .18;
        vec3 radial = up * sin(a) + uSide * cos(a);
        p = uClashPoint + radial * (.43 + defensePath * .08) - uForward * sin(a) * .15;
        widthAxis = normalize(radial); width = .05; strength = response;
      } else if (uReaction < 2.5 || uReaction > 3.5) {
        // Shield / magical barrier / braced plate. The guard lives between both fighters.
        float a = t * TAU + defensePath * .2 + uTime * .28;
        vec3 radial = uSide * cos(a) + up * sin(a);
        float polygon = uReaction > 1.5 && uReaction < 2.5 ? .92 + .08 * cos(a * 6.0) : 1.0;
        p = uClashPoint + radial * (.48 + defensePath * .13) * polygon;
        widthAxis = radial; width = uReaction > 3.5 ? .085 : .035;
        strength = response;
      } else {
        // A retreat trail follows the defender's side step, leaving the result intact.
        p = mix(target, target + uSide * .55 - uForward * .22, t);
        p += up * sin(t * PI) * .24 + uSide * defensePath * .08;
        widthAxis = up; width = .045; strength = uCounter * .66;
      }
      if (uDefenderSkin > 1.5 && uDefenderSkin < 2.5) {
        p += widthAxis * sin(floor(t * 12.0) * 2.5) * .025;
      } else if (uDefenderSkin > 2.5 && uDefenderSkin < 3.5) {
        strength *= .5 + .5 * abs(sin(t * PI * 3.0 + uTime));
      }
    }
    float detail = uSkin < .5 ? 0.0 : sin(t * 20.0 + uTime * 2.0) * .012;
    p += widthAxis * (aEdge * max(.004, width) + detail);
    vRibbon = vec2(t, aEdge); vStrength = strength * uFade;
    vDefense = path >= uOffensePaths ? 1.0 : 0.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const ribbonFragment = /* glsl */`
  ${shaderCommon}
  varying vec2 vRibbon;
  varying float vStrength;
  varying float vDefense;
  void main() {
    float across = abs(vRibbon.y);
    float feather = pow(max(0.0, 1.0 - across * across), 1.5);
    float tapered = smoothstep(0.0, .055, vRibbon.x) * (1.0 - smoothstep(.87, 1.0, vRibbon.x));
    float core = exp(-across * across * 24.0);
    float streak = .8 + .2 * sin(vRibbon.x * 42.0 - uTime * 2.0);
    float alpha = feather * tapered * vStrength * .74;
    if (alpha < .004) discard;
    vec3 tint = mix(uColor, uDefenderColor, vDefense);
    gl_FragColor = vec4(tint * .7 * streak + uCore * core * .28, alpha);
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
    float wave = uContact > .5 ? uWave : uClashWave;
    float radius = uContact > .5 ? (.4 + wave * 1.7) * uBurstScale + aKind * .1 : .25 + wave * .65;
    vec3 p = uContact > .5 ? uTarget : uClashPoint;
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
    float shapeRadius = radius;
    if (uSkin > 9.5) shapeRadius = max(abs(vUv.x)*.8,abs(vUv.y-vUv.x*.45));
    else if (uSkin > 8.5) shapeRadius = length(vUv*vec2(1.7,.65));
    else if (uSkin > 7.5) shapeRadius = radius;
    else if (uSkin > 1.5 && uSkin < 2.5) shapeRadius *= .9 + .1 * cos(angle * 6.0);
    else if (uSkin > 2.5 && uSkin < 3.5) shapeRadius += sin(angle * 3.0 + uTime) * .065;
    else if (uSkin > .5 && uSkin < 1.5) shapeRadius += sin(angle * 7.0 - uTime * 2.0) * .024;
    float broken = .4 + .6 * pow(max(0.0, cos(angle * uLobes)), 3.0);
    float ring = band(shapeRadius, .76, .029 + uWave * .018);
    float secondary = band(shapeRadius, .59, .013) * (.22 + min(uRings, 4.0) * .08);
    float halo = band(radius, .73, .12) * .15;
    float spokes = pow(max(0.0, cos(angle * uLobes)), 32.0) * band(radius, .44, .24) * .18;
    float signature = 0.0;
    if (uPiece < .5) {
      signature = band(vUv.y, 0.0, .035) * band(vUv.x, 0.0, .68) +
        band(abs(vUv.x) + abs(vUv.y) * 1.8, .69, .025) * .35;
    } else if (uPiece < 1.5) {
      signature = band(vUv.y - vUv.x, 0.0, .045) * band(radius, .52, .27) +
        band(vUv.y + vUv.x, 0.0, .035) * band(radius, .52, .27);
    } else if (uPiece < 2.5) {
      signature = band(radius * (.92 + .08 * cos(angle * 6.0)), .41, .017) +
        band(radius, .9, .018) * pow(max(0.0, cos(angle * 6.0)), 8.0);
    } else if (uPiece < 3.5) {
      signature = band(radius, .83, .065) * .65 + band(radius, .39, .025) * .4;
    } else if (uPiece < 4.5) {
      float rayAngle = angle + sin(radius * 19.0) * .05;
      signature = pow(max(0.0, cos(rayAngle * 6.0)), 38.0) * band(radius, .5, .3) * .8;
    } else {
      float crown = .55 + .15 * pow(max(0.0, cos(angle * 5.0)), 5.0);
      signature = band(radius, crown, .023) + band(abs(vUv.x), .28, .022) * band(vUv.y, 0.0, .5) * .35;
    }
    float intensity = uContact > .5 ? uImpact : uClash * .65;
    float alpha = (ring * broken + secondary + halo + spokes + signature * .5) * intensity * uFade * (vKind < .5 ? .56 : .36);
    alpha = min(.7, alpha);
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
    float angle = aSeed.x * TAU + uTime * (.5 + aSeed.y) * uOrbitSpeed;
    float radius = (.34 + aSeed.z * .7) * (1.0 - uCharge * .64);
    vec3 p = uActor + vec3(cos(angle) * radius, .4 + aSeed.y * 1.3, sin(angle) * radius);
    float alpha = (.15 + uCharge * .65) * (1.0 - uAttack * .7);
    float speed = .7 + aSeed.z * 1.5;
    if (uDash > .01 && uContact < .5) {
      float tail = aSeed.y * .7;
      p = mix(uFrom, uActor, 1.0 - tail) + vec3(0.0, .15 + aSeed.z * .65, 0.0);
      p += uSide * (aSeed.x - .5) * .5; alpha = max(alpha, uDash * .6);
    }
    if (uImpact > 0.0 || uClash > 0.0) {
      vec3 direction = normalize(vec3(cos(angle), .22 + aSeed.y * .8, sin(angle)));
      if (uPiece < .5) direction = normalize(uForward * (.8 + aSeed.y) + uSide * cos(angle) * .4 + vec3(0.0, sin(angle) * .3, 0.0));
      else if (uPiece < 1.5) direction = normalize(uSide * cos(angle) + vec3(0.0, sin(angle), 0.0) + uForward * .22);
      else if (uPiece > 3.5) direction = normalize(direction + vec3(0.0, .36, 0.0));
      float wave = uContact > .5 ? uWave : uClashWave;
      float distance = min(2.25, (.08 + wave * (uContact > .5 ? 1.65 : .7)) * speed * uBurstScale);
      vec3 origin = uContact > .5 ? uTarget + vec3(0.0, .9, 0.0) : uClashPoint;
      p = origin + direction * distance;
      if (uSkin > 9.5) {
        p = origin + uSide*(floor(aSeed.x*3.0)-1.0)*.3 + uForward*distance + vec3(0.0,-wave*.5,0.0);
      } else if (uSkin > 8.5) {
        p = mix(origin + uSide*(aSeed.x-.5)*1.6, origin, wave);
        p.y += sin(aSeed.x*TAU)*wave*.4;
      } else if (uSkin > 7.5) {
        p = origin + normalize(vec3(cos(angle),.08,sin(angle)))*distance;
        p.y += aSeed.y*.25;
      } else if (uSkin > 6.5) {
        float facet = floor(aSeed.x * 6.0) * TAU / 6.0;
        p = origin + vec3(cos(facet), aSeed.y * .7, sin(facet)) * distance;
      } else if (uSkin > 5.5) {
        p = origin + direction * distance * (1.0 - wave * .8);
      } else if (uSkin > 4.5) {
        p += uSide * sin(floor(wave * 14.0) * 2.4 + aSeed.x * TAU) * .15;
      } else if (uSkin > .5 && uSkin < 1.5) {
        p.y += wave * (.25 + aSeed.y * .7);
      } else if (uSkin > 1.5 && uSkin < 2.5) {
        p.y -= wave * wave * .8;
      } else if (uSkin > 2.5 && uSkin < 3.5) {
        p = origin + direction * distance * (1.0 - wave * .55);
        p += uSide * sin(angle + wave * TAU) * wave * .3;
      } else if (uSkin > 3.5) {
        p.y += wave * .35; p.xz = mix(p.xz, origin.xz, wave * .15);
      } else p.y -= wave * wave * .55;
      alpha = max(uImpact, uClash * .5) * (.48 + aSeed.w * .35);
    }
    if (uDeath > 0.0 && aSeed.w > .65) {
      p = uTarget + vec3((aSeed.x - .5) * .8, .3 + aSeed.y * 1.65 + uDeath * .7, (aSeed.z - .5) * .8);
      p += uSide * sin(uTime + aSeed.x * TAU) * .2;
      if (uSkin > 9.5) {
        p.y -= uDeath*uDeath*1.4; p += uForward*uDeath*.8;
      } else if (uSkin > 8.5) {
        p = mix(p,uTarget + vec3(0.0,1.1,0.0),uDeath); p.x += sin(aSeed.x*TAU)*uDeath*.2;
      } else if (uSkin > 7.5) {
        p.y += uDeath*1.5; p.xz += vec2(cos(angle),sin(angle))*uDeath*.3;
      } else if (uSkin > 6.5) {
        float facet = floor(aSeed.x * 6.0) * TAU / 6.0;
        p = uTarget + vec3(cos(facet), .4 + aSeed.y, sin(facet)) * (.3 + uDeath * .7);
      } else if (uSkin > 5.5) {
        p = mix(p, uTarget + vec3(0.0, .9, 0.0), uDeath);
      } else if (uSkin > 4.5) {
        p.y += uDeath * .4;
        p += uSide * sin(floor(uDeath * 12.0) * 2.1 + aSeed.x * TAU) * .12;
      } else if (uSkin > .5 && uSkin < 1.5) {
        p.y += uDeath * (.7 + aSeed.z * .6);
      } else if (uSkin > 1.5 && uSkin < 2.5) {
        p += uSide * (aSeed.x - .5) * uDeath * .8;
        p.y -= uDeath * uDeath * .75;
      } else if (uSkin > 2.5 && uSkin < 3.5) {
        p = mix(p, uTarget + vec3(0.0, 1.1, 0.0), uDeath * .75);
        p += uForward * sin(uDeath * PI) * .25;
      } else if (uSkin > 3.5) {
        float spoke = floor(aSeed.x * uLobes) * TAU / uLobes;
        p = uTarget + vec3(cos(spoke) * .45, .4 + aSeed.y * 1.6 + uDeath * .6, sin(spoke) * .45);
      }
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
    if (uSkin > 9.5) {
      glow = exp(-abs(p.x-p.y*.4)*12.0)*exp(-r*3.0); core = exp(-r*30.0);
    } else if (uSkin > 8.5) {
      glow = exp(-abs(p.x+p.y)*15.0)*exp(-r*5.0); core = 0.0;
    } else if (uSkin > 7.5) {
      glow = exp(-r*6.0); core = band(sqrt(r),.45,.055);
    } else if (uSkin > 6.5) {
      float hex = max(abs(p.x), abs(p.x * .5 + p.y * .866));
      glow = exp(-hex * hex * 9.0); core = band(hex, .3, .05);
    } else if (uSkin > 5.5) {
      glow = band(sqrt(r), .5, .1); core = exp(-r * 28.0) * .12;
    } else if (uSkin > 4.5) {
      glow = exp(-abs(p.x + sin(p.y * 8.0) * .12) * 12.0) * exp(-r * 4.0);
      core = exp(-r * 25.0);
    } else if (uSkin > .5 && uSkin < 1.5) {
      float flame = p.x * p.x * 14.0 + pow(p.y + .22, 2.0) * 4.0;
      glow = exp(-flame); core = exp(-flame * 4.0);
    } else if (uSkin > 1.5 && uSkin < 2.5) {
      float diamond = abs(p.x) + abs(p.y);
      glow = exp(-diamond * diamond * 6.0); core = band(diamond, .2, .1);
      star += band(p.x - p.y, 0.0, .045) * exp(-r * 9.0) * .12;
    } else if (uSkin > 2.5 && uSkin < 3.5) {
      glow = band(sqrt(r), .43, .17) * .65; core = exp(-r * 24.0) * .35;
    } else if (uSkin > 3.5) {
      star += (band(p.x, 0.0, .035) + band(p.y, 0.0, .035)) * exp(-r * 5.0) * .25;
    }
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
    float distance = min(2.15, uWave * (1.2 + aSeed.z) * uBurstScale);
    vec3 p = position * vec3(.022, .065 + aSeed.w * .13, .024);
    if (uSkin > .5 && uSkin < 1.5) p *= vec3(.6, 1.6, .6);
    else if (uSkin > 1.5 && uSkin < 2.5) p *= vec3(1.5, 1.28, 1.5);
    else if (uSkin > 2.5 && uSkin < 3.5) p *= vec3(1.3, .6, .7);
    else if (uSkin > 3.5) p *= vec3(1.35, .9, .45);
    float spin = uTime * (2.0 + aSeed.z * 4.0) + angle;
    p.xz = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * p.xz;
    p.xy = mat2(cos(spin * .6), -sin(spin * .6), sin(spin * .6), cos(spin * .6)) * p.xy;
    p += uTarget + vec3(0.0, .9, 0.0) + axis * distance;
    p.y -= uWave * uWave * .75;
    if (uSkin > .5 && uSkin < 1.5) p.y += uWave * .55;
    else if (uSkin > 2.5 && uSkin < 3.5) {
      p.xz = mix(p.xz, uTarget.xz, uDeath * .65);
      p.y += uDeath * .5;
    } else if (uSkin > 3.5) p.y += uDeath * .75;
    vAlpha = max(uImpact, sin(uDeath * PI) * .72) * uFade * (.42 + aSeed.w * .22) * step(aSeed.w, uShardRatio);
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

// Seventeen finite layouts cover all classes and qualities. These templates never
// reach a renderer: each move owns GPU wrappers that can be disposed normally,
// while immutable CPU arrays survive for the next capture without regeneration.
const geometryTemplates = new Map<string, THREE.BufferGeometry>();
function geometryResource(key: string, build: () => THREE.BufferGeometry) {
  let template = geometryTemplates.get(key);
  if (!template) { template = build(); geometryTemplates.set(key, template); }
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(template.attributes)) {
    if (!(attribute instanceof THREE.BufferAttribute)) continue;
    geometry.setAttribute(name, attribute instanceof THREE.InstancedBufferAttribute ?
      new THREE.InstancedBufferAttribute(attribute.array, attribute.itemSize, attribute.normalized, attribute.meshPerAttribute) :
      new THREE.BufferAttribute(attribute.array, attribute.itemSize, attribute.normalized));
  }
  if (template.index) geometry.setIndex(new THREE.BufferAttribute(template.index.array, 1));
  geometry.userData.template = key;
  return geometry;
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
    const profile = combatProfile(config.piece, config.skin);
    const defenderSkin = config.defenderSkin ?? config.skin;
    const defenderPiece = config.defenderPiece ?? "p";
    this.group.userData.profile = profile.id;
    this.group.userData.flourish = profile.vfx.flourish;
    this.group.userData.defense = config.reaction ?? "shield";
    this.chargeGroup.name = `charge-${config.piece}`;
    this.lockGroup.name = config.captured ? "enemy-lock" : "destination-lock";
    const color = new THREE.Color(config.color);
    const core = color.clone().lerp(new THREE.Color(0xe8f4ff), .48);
    const paths = config.piece === "p" ? 4 : config.piece === "n" ? 5 : 6;
    this.uniforms = {
      uTime: { value: 0 }, uProgress: { value: 0 }, uPiece: { value: pieceIndex[config.piece] }, uSkin: { value: skinIndex[config.skin] },
      uCharge: { value: 0 }, uDash: { value: 0 }, uAttack: { value: 0 }, uStrike: { value: 0 },
      uDefeat: { value: 0 }, uImpact: { value: 0 }, uWave: { value: 0 }, uDeath: { value: 0 }, uFade: { value: 1 },
      uOpening: { value: 0 }, uCounter: { value: 0 }, uClash: { value: 0 }, uFinisher: { value: 0 }, uRecovery: { value: 0 },
      uDefenderPiece: { value: pieceIndex[defenderPiece] }, uDefenderSkin: { value: skinIndex[defenderSkin] },
      uReaction: { value: reactionIndex[config.reaction ?? "shield"] }, uOffensePaths: { value: paths },
      uLobes: { value: profile.vfx.lobes }, uRings: { value: profile.vfx.rings },
      uShardRatio: { value: this.budget.shards ? Math.min(1, profile.vfx.shards / this.budget.shards) : 0 },
      uTrailWidth: { value: profile.vfx.trailWidth }, uBurstScale: { value: profile.vfx.burstScale },
      uOrbitSpeed: { value: profile.vfx.orbitSpeed }, uClashWave: { value: 0 }, uContact: { value: 0 },
      uClashPoint: { value: new THREE.Vector3() },
      uDefenderColor: { value: new THREE.Color(config.defenderColor ?? skins[defenderSkin].white[1]) },
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
    const quadCount = config.captured ? 3 : 2;
    const seal = new THREE.Mesh(geometryResource(`quads-${quadCount}`, () => quads(quadCount)), material(groundVertex, groundFragment));
    seal.add(this.chargeGroup, this.lockGroup);
    add(seal, "vfx-seal-and-reticle");
    const ribbonPaths = paths + (config.captured ? 2 : 0), samples = config.quality === "low" ? 20 : 40;
    add(new THREE.Mesh(geometryResource(`ribbons-${ribbonPaths}-${samples}`, () => ribbons(ribbonPaths, samples)), material(ribbonVertex, ribbonFragment)), `vfx-${combatVFXStyles[config.piece]}`);
    const waveCount = config.quality === "low" ? 2 : 3;
    add(new THREE.Mesh(geometryResource(`quads-${waveCount}`, () => quads(waveCount)), material(waveVertex, waveFragment)), "vfx-pressure-waves");
    const moteGeometry = geometryResource(`motes-${this.budget.motes}`, () => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.budget.motes * 3), 3));
      geometry.setAttribute("aSeed", seeds(this.budget.motes));
      return geometry;
    });
    add(new THREE.Points(moteGeometry, material(moteVertex, moteFragment)), "vfx-energy-motes");
    if (this.budget.shards) {
      const geometry = geometryResource(`shards-${this.budget.shards}`, () => {
        const resource = new THREE.IcosahedronGeometry(1, 0);
        resource.setAttribute("aSeed", seeds(this.budget.shards, true));
        return resource;
      });
      const shards = new THREE.InstancedMesh(geometry, material(shardVertex, shardFragment), this.budget.shards);
      const identity = new THREE.Matrix4();
      for (let i = 0; i < this.budget.shards; i++) shards.setMatrixAt(i, identity);
      add(shards, "vfx-prismatic-shards");
    }
  }

  update(frame: CombatVFXFrame) {
    const progress = clamp(frame.progress), captured = this.config.captured;
    const cinematicCapture = captured && frame.opening !== undefined;
    const impactStart = frame.contactAt === undefined ? captured ? CAPTURE_CONTACT : .62 : clamp(frame.contactAt);
    const holdEnd = Math.min(.94, impactStart + (cinematicCapture ? .06 : impactStart < .6 ? .08 : .1));
    const frozenDuration = Math.max(0, Math.min(progress, holdEnd) - impactStart);
    this.uniforms.uTime.value = (progress - frozenDuration) * 5;
    this.uniforms.uProgress.value = progress;
    const opening = clamp(frame.opening ?? 0), counter = clamp(frame.counter ?? 0);
    const finisher = clamp(frame.finisher ?? 0), recovery = clamp(frame.recovery ?? 0);
    this.uniforms.uOpening.value = opening;
    this.uniforms.uCounter.value = Math.sin(counter * Math.PI);
    this.uniforms.uClash.value = captured ? clamp(frame.clash ?? 0) : 0;
    this.uniforms.uFinisher.value = finisher;
    this.uniforms.uRecovery.value = recovery;
    this.uniforms.uClashWave.value = clamp((progress - CAPTURE_CLASH) / .085);
    this.uniforms.uContact.value = frame.contact ? 1 : 0;
    const charge = cinematicCapture ? Math.max(clamp(frame.charge), Math.sin(finisher * Math.PI) * .42 * (frame.contact ? 0 : 1)) : clamp(frame.charge);
    this.uniforms.uCharge.value = charge * (1 - smooth(impactStart - .03, holdEnd + .08, progress));
    this.uniforms.uDash.value = smooth(cinematicCapture ? .24 / 2.6 : captured ? .18 : .22, cinematicCapture ? .65 / 2.6 : captured ? .28 : .34, progress) *
      (1 - smooth(cinematicCapture ? 1 / 2.6 : captured ? .43 : .52, cinematicCapture ? 1.2 / 2.6 : holdEnd, progress));
    this.uniforms.uAttack.value = cinematicCapture ?
      Math.max(Math.sin(opening * Math.PI) * .8, smooth(0, .55, finisher)) * (1 - smooth(holdEnd + .04, .93, progress)) :
      smooth(captured ? .4 : .38, impactStart - .01, progress) * (1 - smooth(holdEnd + .04, .91, progress));
    this.uniforms.uStrike.value = clamp(frame.strike);
    this.uniforms.uDefeat.value = captured ? clamp(frame.defeat) : 0;
    this.uniforms.uWave.value = clamp((progress - holdEnd) / (1 - holdEnd));
    this.uniforms.uImpact.value = frame.contact ? 1 - smooth(holdEnd + .05, .97, progress) : 0;
    this.uniforms.uDeath.value = captured && (frame.dead || frame.defeat > 0) ?
      cinematicCapture ? clamp(frame.defeat) : clamp((progress - CAPTURE_DEATH) / ((2.38 / 2.6) - CAPTURE_DEATH)) : 0;
    this.uniforms.uFade.value = 1 - smooth(.86, 1, progress);
    (this.uniforms.uActor.value as THREE.Vector3).copy(frame.actor);
    (this.uniforms.uTarget.value as THREE.Vector3).copy(frame.target);
    (this.uniforms.uFrom.value as THREE.Vector3).copy(frame.from);
    (this.uniforms.uTo.value as THREE.Vector3).copy(frame.to);
    (this.uniforms.uClashPoint.value as THREE.Vector3).copy(frame.actor).add(frame.target).multiplyScalar(.5);
    (this.uniforms.uClashPoint.value as THREE.Vector3).y = Math.max(frame.actor.y, frame.target.y) + 1.05;
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
