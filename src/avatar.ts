import * as THREE from "three";
import type { PieceSymbol } from "chess.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { skins, type SkinId } from "./profile.ts";
import { fighterPose, defenderPose, type FighterPose, type MotionContext } from "./motion.ts";
import { CAPTURE_DURATION } from "./combat.ts";

type BoneName = "hips" | "torso" | "head" | "mantle" | "leftArm" | "rightArm" | "leftElbow" | "rightElbow" | "leftLeg" | "rightLeg" | "leftKnee" | "rightKnee";

interface AvatarTemplate {
  bones: { name: BoneName; accent: number; geometry: THREE.BufferGeometry }[];
  weapon: THREE.BufferGeometry;
}
// CPU-only immutable templates: new avatars reuse vertex arrays, while their disposable GPU
// geometry wrappers and fading materials remain independent. The finite class/skin set caps this.
const avatarTemplates = new Map<string, AvatarTemplate>();
function geometryView(source: THREE.BufferGeometry) {
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    if (!(attribute instanceof THREE.BufferAttribute)) continue;
    geometry.setAttribute(name, new THREE.BufferAttribute(attribute.array, attribute.itemSize, attribute.normalized));
  }
  if (source.index) geometry.setIndex(new THREE.BufferAttribute(source.index.array, 1));
  return geometry;
}

export function avatarResourceStats() {
  let geometries = 0, bytes = 0;
  for (const template of avatarTemplates.values()) {
    const entries = [...template.bones.map((part) => part.geometry), template.weapon];
    geometries += entries.length;
    for (const geometry of entries) for (const attribute of Object.values(geometry.attributes)) bytes += attribute.array.byteLength;
  }
  return { profiles: avatarTemplates.size, geometries, bytes, maxProfiles: 6 * Object.keys(skins).length };
}

/** Articulated fighters use shared armour materials and one merged mesh per material per bone. */
export function createAvatar(type: PieceSymbol, side: "w" | "b", skin: SkinId) {
  const group = new THREE.Group(); group.name = `avatar-${type}-${skin}`; group.userData.avatar = true;
  const palette = side === "w" ? skins[skin].white : skins[skin].black;
  const materials = [
    new THREE.MeshStandardMaterial({ color: palette[0], emissive: palette[1], emissiveIntensity: 0.19,
      metalness: 0.55, roughness: 0.3, transparent: true, opacity: 0.96, depthWrite: true,
      side: THREE.DoubleSide, forceSinglePass: true }),
    new THREE.MeshBasicMaterial({ color: palette[1], transparent: true, opacity: 0.7, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true }),
  ];
  const bones = {} as Record<BoneName, THREE.Group>;
  const batches = {} as Record<BoneName, [THREE.BufferGeometry[], THREE.BufferGeometry[]]>;
  const bone = (name: BoneName, parent: THREE.Group, x: number, y: number, z = 0) => {
    const node = new THREE.Group(); node.name = `avatar-${name}`; node.position.set(x, y, z);
    node.userData.restPosition = node.position.clone(); parent.add(node); bones[name] = node; batches[name] = [[], []]; return node;
  };
  const hips = bone("hips", group, 0, 0.8); const torso = bone("torso", hips, 0, 0.33);
  bone("head", torso, 0, 0.55); bone("mantle", hips, 0, 0);
  const broad = type === "r" ? 0.8 : type === "k" ? 0.58 : 0.4;
  for (const direction of [-1, 1]) {
    const sideName = direction < 0 ? "left" : "right";
    const arm = bone(`${sideName}Arm`, torso, direction * broad, 0.28);
    bone(`${sideName}Elbow`, arm, 0, -0.3);
    const leg = bone(`${sideName}Leg`, hips, direction * (type === "r" ? 0.4 : 0.18), -0.02);
    bone(`${sideName}Knee`, leg, 0, -0.32);
  }
  const finish = (weaponGeometry: THREE.BufferGeometry) => {
    const weapon = new THREE.Group(); weapon.name = "avatar-weapon";
    // The gauntlet drives the weapon position. Pose orientation is expressed in torso space,
    // so applyPose resolves it against the articulated arm instead of leaving a floating blade.
    weapon.position.set(0, -0.245, -0.045); weapon.userData.restPosition = weapon.position.clone();
    bones.rightElbow.add(weapon);
    const mesh = new THREE.Mesh(weaponGeometry, materials[1]); mesh.userData.sharedMaterial = true; weapon.add(mesh);
    const torsoMeshes = bones.torso.children.filter((node): node is THREE.Mesh => node instanceof THREE.Mesh);
    for (const mesh of torsoMeshes) mesh.userData.sharedMaterial = false;
    group.userData.weapon = weapon; group.userData.arms = [bones.leftArm, bones.rightArm]; group.userData.bones = bones;
    group.userData.piece = type; group.userData.skin = skin; group.userData.baseOpacity = materials.map((m) => m.opacity); group.userData.materials = materials;
    return group;
  };
  const key = `${type}:${skin}`;
  const cached = avatarTemplates.get(key);
  if (cached) {
    for (const part of cached.bones) {
      const mesh = new THREE.Mesh(geometryView(part.geometry), materials[part.accent]); mesh.userData.sharedMaterial = true;
      bones[part.name].add(mesh);
    }
    return finish(geometryView(cached.weapon));
  }
  const template: AvatarTemplate = { bones: [], weapon: new THREE.BufferGeometry() };
  const add = (part: BoneName, g: THREE.BufferGeometry, accent = 0, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
    batches[part][accent].push(g);
  };
  const box = (part: BoneName, w: number, h: number, d: number, x: number, y: number, z: number, accent = 0, rz = 0) =>
    add(part, new THREE.BoxGeometry(w, h, d), accent, x, y, z, 0, 0, rz);
  add("torso", new THREE.CylinderGeometry(broad * 0.75, broad * 0.46, 0.7, type === "r" ? 4 : 6));
  box("torso", broad * 1.3, 0.4, 0.12, 0, 0.14, -0.21);
  add("torso", new THREE.OctahedronGeometry(type === "r" ? 0.15 : 0.1), 1, 0, 0.23, -0.3);
  // Shoulder guards move with the torso; elbows and knees move independently beneath them.
  for (const direction of [-1, 1]) add("torso", new THREE.OctahedronGeometry(type === "r" ? 0.3 : 0.18), 0, direction * broad, 0.3);
  box("hips", broad * 1.18, 0.1, 0.35, 0, 0.02, 0, 1);
  add("hips", new THREE.CylinderGeometry(broad * 0.46, broad * 0.52, 0.18, 6), 0, 0, -0.08);
  add("head", new THREE.IcosahedronGeometry(type === "r" ? 0.27 : 0.22, 0), 0, 0, 0.09);
  box("head", type === "r" ? 0.4 : 0.29, 0.06, 0.06, 0, 0.12, -0.21, 1);
  box("head", 0.24, 0.15, 0.07, 0, -0.03, -0.2);
  for (const sideName of ["left", "right"] as const) {
    box(`${sideName}Arm`, type === "r" ? 0.25 : 0.15, 0.31, 0.2, 0, -0.13, 0);
    box(`${sideName}Elbow`, type === "r" ? 0.29 : 0.19, 0.27, 0.24, 0, -0.13, -0.02);
    // Gauntlet bands share the body mesh so articulation has a fixed draw budget.
    add(`${sideName}Elbow`, new THREE.CylinderGeometry(type === "r" ? 0.15 : 0.1, type === "r" ? 0.15 : 0.1, 0.07, 4), 0, 0, -0.03, -0.02);
    box(`${sideName}Leg`, type === "r" ? 0.28 : 0.18, 0.34, type === "r" ? 0.28 : 0.2, 0, -0.14, 0);
    box(`${sideName}Knee`, type === "r" ? 0.3 : 0.19, 0.27, type === "r" ? 0.3 : 0.22, 0, -0.14, 0);
    box(`${sideName}Knee`, type === "r" ? 0.33 : 0.22, 0.09, type === "r" ? 0.4 : 0.31, 0, -0.29, -0.06);
  }
  if (type === "p" || type === "k") add("head", new THREE.ConeGeometry(0.17, 0.35, 4), 1, 0, 0.3);
  if (type === "n") {
    add("head", new THREE.ConeGeometry(0.27, 0.55, 4), 0, 0, 0.14, -0.25, -Math.PI / 2);
    for (let i = 0; i < 4; i++) add("head", new THREE.ConeGeometry(0.12, 0.42, 3), 1, 0, 0.12 - i * 0.13, 0.2 + i * 0.08, -0.6);
    // A split cavalry tabard responds to the spinning lunge instead of remaining rigid.
    for (const sign of [-1, 1]) box("mantle", 0.19, 0.5, 0.05, sign * 0.18, -0.25, 0.19, 0, sign * 0.12);
  }
  if (type === "b") {
    add("mantle", new THREE.ConeGeometry(0.42, 1.25, 6, 1, true), 0, 0, -0.1);
    add("head", new THREE.ConeGeometry(0.29, 0.65, 6), 0, 0, 0.23);
    add("head", new THREE.TorusGeometry(0.4, 0.026, 4, 24), 1, 0, 0.27, 0.13);
  }
  if (type === "r") {
    for (const x of [-0.48, 0.48]) add("torso", new THREE.CylinderGeometry(0.15, 0.21, 0.7, 6), 1, x, 0.38, -0.28, Math.PI / 2);
    box("head", 0.52, 0.12, 0.1, 0, -0.04, -0.22, 1);
    // A real arm-mounted shield visibly follows guard and recoil poses.
    box("leftElbow", 0.5, 0.58, 0.1, 0, -0.1, -0.18);
    box("leftElbow", 0.34, 0.07, 0.12, 0, -0.1, -0.2);
  }
  if (type === "k") add("leftElbow", new THREE.CylinderGeometry(0.25, 0.3, 0.08, 6), 0, 0, -0.1, -0.15, Math.PI / 2);
  if (type === "q" || type === "k") {
    // An open back cape leaves both moving feet visible from the combat camera.
    box("mantle", type === "q" ? 0.65 : 0.86, 1.25, 0.05, 0, 0.17, 0.26);
    for (const direction of [-1, 1]) box("mantle", 0.1, 1.25, 0.06, direction * (type === "q" ? 0.3 : 0.4), 0.17, 0.27, 1, direction * 0.1);
    for (let i = 0; i < (type === "q" ? 5 : 3); i++) add("head", new THREE.ConeGeometry(0.07, i % 2 ? 0.23 : 0.35, 4), 1, (i - (type === "q" ? 2 : 1)) * 0.12, 0.37);
  }
  if (type === "q") for (const direction of [-1, 1]) for (let i = 0; i < 3; i++)
    add("torso", new THREE.ConeGeometry(0.1, 0.8 - i * 0.12, 3), 1, direction * (0.4 + i * 0.18), 0.22, 0.18, 0, 0, direction * -0.9);
  if(skin==='nova')for(let i=0;i<8;i++)add('torso',new THREE.ConeGeometry(.07,.5,3),1,Math.cos(i*Math.PI/4)*.65,.65+Math.sin(i*Math.PI/4)*.5,.3,0,0,i*Math.PI/4);
  if(skin==='phantom'){add('torso',new THREE.TorusGeometry(.72,.035,4,32,Math.PI*1.5),1,0,.5,.32,.2,.3);for(const sign of [-1,1])box('mantle',.16,1.6,.04,sign*.4,-.1,.36,1,sign*.25);}
  if(skin==='dragon')for(const sign of [-1,1]){add('head',new THREE.ConeGeometry(.1,.55,4),1,sign*.26,.38,.1,0,0,sign*-.45);for(let i=0;i<3;i++)box('torso',.11,.8-i*.12,.05,sign*(.7+i*.16),.3,.35,1,sign*-.9);}
  if (skin === "storm") for (const sign of [-1, 1]) {
    box("torso", .08, .75, .08, sign * (broad + .08), .5, 0, 1, sign * .45);
    box("head", .05, .36, .05, sign * .25, .38, 0, 1, sign * .4);
  }
  if (skin === "void") for (let i = 0; i < 2; i++) add("torso", new THREE.TorusGeometry(.62 + i * .14, .025, 4, 24), 1, 0, .42, .3, i * .7);
  if (skin === "prism") for (let i = 0; i < 3; i++) {
    add("head", new THREE.TorusGeometry(.45 + i * .13, .025, 4, 6), 1, 0, .22 + i * .08, .24, i * .4);
    for (const sign of [-1, 1]) add("torso", new THREE.OctahedronGeometry(.12), 1, sign * (.58 + i * .13), .5 - i * .1);
  }
  if (skin === "ember") for (const direction of [-1, 1])
    add("torso", new THREE.ConeGeometry(0.13, 0.48, 3), 1, direction * broad, 0.59, 0, 0, 0, direction * -0.35);
  if (skin === "frost") for (const direction of [-1, 1]) add("torso", new THREE.OctahedronGeometry(0.18), 1, direction * (broad + 0.08), 0.51);
  if (skin === "astral") add("torso", new THREE.TorusGeometry(0.62, 0.035, 4, 32), 1, 0, 0.42, 0.22, 0.15);
  if (skin === "royal") {
    add("head", new THREE.TorusGeometry(0.63, 0.035, 4, 32), 1, 0, 0.22, 0.25);
    for (const direction of [-1, 1]) box("torso", 0.13, 0.7, 0.08, direction * 0.74, 0.37, 0.22, 1, direction * 0.45);
  }
  for (const name of Object.keys(batches) as BoneName[]) for (let material = 0; material < 2; material++) {
    const source = batches[name][material]; if (!source.length) continue;
    const prepared = source.map((g) => g.index ? g.toNonIndexed() : g);
    const geometry = mergeGeometries(prepared)!;
    new Set([...prepared, ...source]).forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(geometry, materials[material]); mesh.userData.sharedMaterial = true; bones[name].add(mesh);
    template.bones.push({ name, accent: material, geometry: geometryView(geometry) });
  }
  const shape = type === "p" ? new THREE.CylinderGeometry(0.035, 0.035, 2.2, 6)
    : type === "b" ? new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6)
    : type === "r" ? new THREE.CylinderGeometry(0.2, 0.27, 1.1, 6)
    : new THREE.BoxGeometry(type === "k" ? 0.17 : 0.08, type === "k" ? 1.6 : 1.2, 0.04);
  if (type === "n" || type === "q" || type === "k") shape.translate(0, 0.32, 0);
  const tip = type === "b" ? new THREE.OctahedronGeometry(0.19)
    : type === "r" ? new THREE.TorusGeometry(0.22, 0.045, 4, 16) : new THREE.ConeGeometry(type === "p" ? 0.13 : 0.1, 0.32, 4);
  tip.translate(0, type === "p" ? 1.1 : type === "b" ? 0.95 : type === "k" ? 1.1 : type === "r" ? 0.55 : 0.87, 0);
  const weaponParts: THREE.BufferGeometry[] = [shape, tip];
  if (type === "n") {
    const edge = new THREE.TorusGeometry(0.54, 0.028, 4, 16, Math.PI * 0.72); edge.translate(-0.2, 0.18, 0); weaponParts.push(edge);
  }
  if(['nova','phantom','dragon'].includes(skin)){const crest=new THREE.TorusGeometry(.28,.025,4,skin==='nova'?12:skin==='dragon'?3:32,skin==='phantom'?Math.PI*1.5:Math.PI*2);crest.translate(0,.55,0);weaponParts.push(crest);}
  if (skin === "storm") {
    for (const sign of [-1, 1]) { const fin = new THREE.BoxGeometry(.05, .4, .035); fin.rotateZ(sign * .55); fin.translate(sign * .12, .37, 0); weaponParts.push(fin); }
  } else if (skin === "void") {
    const eclipse = new THREE.TorusGeometry(.27, .03, 4, 24); eclipse.translate(0, .5, 0); weaponParts.push(eclipse);
  } else if (skin === "prism") {
    for (let i = 0; i < 3; i++) { const shard = new THREE.OctahedronGeometry(.1); shard.translate((i - 1) * .14, .6 + i * .14, 0); weaponParts.push(shard); }
  } else if (skin === "frost") {
    for (const sign of [-1, 1]) { const crystal = new THREE.OctahedronGeometry(0.085); crystal.translate(sign * 0.11, 0.37, 0); weaponParts.push(crystal); }
  } else if (skin === "astral") {
    const orbit = new THREE.TorusGeometry(type === "r" ? 0.31 : 0.16, 0.018, 4, 16); orbit.rotateX(Math.PI / 2); orbit.translate(0, 0.32, 0); weaponParts.push(orbit);
  } else if (skin === "royal") {
    const guard = new THREE.BoxGeometry(0.36, 0.055, 0.07); guard.translate(0, -0.22, 0); weaponParts.push(guard);
  } else if (skin === "ember") {
    const vent = new THREE.ConeGeometry(0.055, 0.23, 3); vent.translate(0.1, 0.22, 0); weaponParts.push(vent);
  }
  const prepared = weaponParts.map((g) => g.index ? g.toNonIndexed() : g);
  const weaponGeometry = mergeGeometries(prepared)!;
  new Set([...prepared, ...weaponParts]).forEach((g) => g.dispose());
  template.weapon.dispose(); template.weapon = geometryView(weaponGeometry);
  avatarTemplates.set(key, template);
  return finish(weaponGeometry);
}

const armOrientation = new THREE.Quaternion();
const desiredWeaponOrientation = new THREE.Quaternion();
const jointEuler = new THREE.Euler();
const jointQuaternion = new THREE.Quaternion();
const aimTarget = new THREE.Vector3();
const aimOrigin = new THREE.Vector3();
const aimDirection = new THREE.Vector3();
const parentOrientation = new THREE.Quaternion();
const aimOrientation = new THREE.Quaternion();
const downAxis = new THREE.Vector3(0, -1, 0);
const upAxis = new THREE.Vector3(0, 1, 0);
const straightJoint = new THREE.Quaternion();
const smoothAim = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

/** A contact-directed two-joint reach keeps melee blades on the visible opponent at the hit. */
function aimAtContact(group: THREE.Group, context: MotionContext, time: number, defender = false) {
  if (!context.combat) return;
  const seconds = context.seconds ?? (context.progress === undefined ? time : context.progress * CAPTURE_DURATION / 1000);
  const reach = (at: number) => smoothAim((seconds - at + .18) / .18) * (1 - smoothAim((seconds - at - .08) / .15));
  const fallback = defender ? reach(1.86) : Math.max(reach(1.08), reach(2.48), reach(2.83), reach(3.85));
  const weight = Math.max(0, Math.min(1, context.aimWeight ?? fallback)) * (1 - (context.recovery ?? 0));
  if (weight < 0.001) return;
  group.updateMatrixWorld(true);
  if (context.contactTarget) aimTarget.set(...context.contactTarget);
  else { aimTarget.set(0, 1.2, -1.1); group.localToWorld(aimTarget); }
  const bones = group.userData.bones as Record<BoneName, THREE.Group>;
  const arm = bones.rightArm, elbow = bones.rightElbow;
  arm.getWorldPosition(aimOrigin); aimDirection.copy(aimTarget).sub(aimOrigin).normalize();
  if (!aimDirection.lengthSq()) return;
  aimOrientation.setFromUnitVectors(downAxis, aimDirection);
  bones.torso.getWorldQuaternion(parentOrientation).invert();
  aimOrientation.premultiply(parentOrientation);
  arm.quaternion.slerp(aimOrientation, weight);
  elbow.quaternion.slerp(straightJoint, weight * 0.9);
  group.updateMatrixWorld(true);
  const weapon = group.userData.weapon as THREE.Group;
  weapon.getWorldPosition(aimOrigin); aimDirection.copy(aimTarget).sub(aimOrigin).normalize();
  if (!aimDirection.lengthSq()) return;
  aimOrientation.setFromUnitVectors(upAxis, aimDirection);
  elbow.getWorldQuaternion(parentOrientation).invert();
  aimOrientation.premultiply(parentOrientation);
  weapon.quaternion.slerp(aimOrientation, weight);
}

function applyPose(group: THREE.Group, pose: FighterPose, fade: number) {
  const bones = group.userData.bones as Record<BoneName, THREE.Group>;
  for (const name of Object.keys(bones) as BoneName[]) {
    bones[name].position.copy(bones[name].userData.restPosition);
    bones[name].rotation.set(...pose[name]);
    // A negative procedural lift means raising an arm toward the -Z facing direction.
    // Convert that semantic angle at the rig boundary; the old rig swung its hands backward.
    if (name.endsWith("Arm") || name.endsWith("Elbow")) bones[name].rotation.x *= -1;
  }
  const weapon = group.userData.weapon as THREE.Group;
  weapon.position.copy(weapon.userData.restPosition);
  weapon.position.x += pose.weaponOffset[0]; weapon.position.y += pose.weaponOffset[1]; weapon.position.z += pose.weaponOffset[2];
  // Preserve the intended class-specific weapon angle while deriving its pivot from the hand.
  armOrientation.setFromEuler(bones.rightArm.rotation);
  jointQuaternion.setFromEuler(bones.rightElbow.rotation); armOrientation.multiply(jointQuaternion).invert();
  desiredWeaponOrientation.setFromEuler(jointEuler.set(...pose.weapon));
  weapon.quaternion.copy(armOrientation.multiply(desiredWeaponOrientation));
  // Local offsets belong to the skeleton: repeated sampling cannot drift the scene-owned root.
  bones.hips.position.x += pose.offset[0]; bones.hips.position.y += pose.offset[1]; bones.hips.position.z += pose.offset[2];
  group.rotation.x = pose.body[0]; group.rotation.z = pose.body[2];
  const materials = group.userData.materials as THREE.Material[];
  materials.forEach((m, i) => m.opacity = group.userData.baseOpacity[i] * Math.max(0, Math.min(1, fade)));
  group.visible = fade > 0.005;
}

export function animateAvatar(group: THREE.Group, type: PieceSymbol, charge: number, strike: number, fade: number, time: number, context: MotionContext = {}) {
  applyPose(group, fighterPose(type, charge, strike, time, { skin: group.userData.skin, ...context }), fade);
  aimAtContact(group, context, time);
}

export function animateDefender(group: THREE.Group, type: PieceSymbol, hit: number, fade: number, time: number, context: MotionContext = {}) {
  applyPose(group, defenderPose(type, hit, time, { skin: group.userData.skin, ...context }), fade);
  aimAtContact(group, context, time, true);
}

const auraVertex = `
  uniform float uTime; uniform float uCharge; uniform float uLayer; uniform float uStyle; uniform float uSkin;
  varying vec3 vLocal; varying vec2 vUv;
  void main() {
    vec3 p = position; vUv = uv;
    float height = clamp(p.y / 2.25, 0.0, 1.0);
    if (uLayer > 0.5) {
      float flow = uTime * (1.8 + uCharge) + atan(p.z, p.x) * (3.0 + uStyle * 0.5);
      p.xz *= 1.0 + sin(flow - p.y * 5.0) * (0.025 + uCharge * 0.045) * height;
      p.y += sin(flow * 1.3 + p.y * 3.0) * height * 0.035;
      if (uSkin > 0.5 && uSkin < 1.5) {
        // Hot filaments flare outward near their tips; the armoured centre stays readable.
        p.xz *= 1.0 + height * height * (0.04 + uCharge * 0.08);
      } else if (uSkin > 1.5 && uSkin < 2.5) {
        float facet = cos(atan(p.z, p.x) * 6.0);
        p.xz *= 1.0 + facet * height * 0.055;
      } else if (uSkin > 2.5 && uSkin < 3.5) {
        float twist = sin(p.y * 2.5 - uTime * 1.2) * (0.045 + uCharge * 0.035);
        p.xz = mat2(cos(twist), -sin(twist), sin(twist), cos(twist)) * p.xz;
      }
    }
    vLocal = p; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const auraFragment = `
  uniform float uTime; uniform float uCharge; uniform float uFade; uniform float uLayer; uniform float uStyle; uniform float uSkin;
  uniform vec3 uColor; uniform vec3 uBright;
  varying vec3 vLocal; varying vec2 vUv;
  float band(float x, float width) { return 1.0 - smoothstep(width, width + 0.075, abs(x)); }
  void main() {
    float angle = atan(vLocal.z, vLocal.x); float height = clamp(vLocal.y / 2.3, 0.0, 1.0);
    float flow = angle * (3.0 + uStyle) - vLocal.y * (5.0 + uSkin) + uTime * (2.0 + uCharge * 1.5);
    if (uSkin > 2.5 && uSkin < 3.5) flow = angle * (4.0 + uStyle) + vLocal.y * 6.0 - uTime * 1.8;
    float edge = pow(abs(sin(flow)), 14.0);
    float energy = 0.45 + uCharge * 0.55;
    float alpha = 0.0; float core = 0.0;
    if (uLayer < 0.5) {
      float chase = pow(max(0.0, cos(angle * (uStyle + 3.0) - uTime * 2.3)), 8.0);
      alpha = (0.22 + chase * 0.5) * energy; core = chase * 0.55;
    } else if (uLayer < 1.5) {
      // Filaments rise through a translucent envelope; its centre stays clear around the armour.
      float envelope = (1.0 - smoothstep(0.62, 1.0, height)) * smoothstep(0.0, 0.07, height);
      float flame = band(sin(flow), 0.09) * (0.28 + 0.35 * sin(vLocal.y * 12.0 - uTime * 4.0) * sin(vLocal.y * 12.0 - uTime * 4.0));
      alpha = (0.012 + flame * 0.2 + edge * 0.025) * envelope * energy;
      core = edge * 0.5;
      if (uSkin > 1.5 && uSkin < 2.5) {
        float lattice = band(sin(angle * 6.0 + vLocal.y * 5.0), 0.08);
        alpha = (0.008 + lattice * 0.09 + edge * 0.025) * envelope * energy;
        core = lattice * 0.6;
      } else if (uSkin > 3.5) {
        float crest = band(sin(vLocal.y * 9.0 + uTime * 0.8), 0.09) * band(sin(angle * 8.0), 0.24);
        alpha += crest * envelope * energy * 0.09;
        core = max(core, crest * 0.55);
      }
    } else {
      float tip = pow(max(0.0, sin(vUv.x * 6.28318 - uTime * 2.8)), 4.0);
      alpha = (0.12 + tip * 0.5) * energy; core = tip * 0.7;
    }
    if (uSkin > 9.5) {
      float rake = band(sin(angle*3.0+vLocal.y*2.0-uTime*1.2),.1);
      alpha *= .15 + rake; core = rake;
    } else if (uSkin > 8.5) {
      float veil = band(sin(angle*2.0+uTime*.7),.12);
      alpha *= veil*.8; core = veil*.5;
    } else if (uSkin > 7.5) {
      float orbit = band(sin(vLocal.y*8.0-uTime*1.5),.08);
      alpha *= .12+orbit; core = orbit;
    } else if (uSkin > 6.5) { core = max(core, pow(abs(sin(angle * 3.0 + uTime)), 12.0)); alpha *= .8 + .2 * cos(angle * 6.0 - uTime); }
    else if (uSkin > 5.5) { alpha *= .45 + .55 * pow(abs(sin(vLocal.y * 4.0 - uTime * 1.5)), 3.0); }
    else if (uSkin > 4.5) { alpha *= .35 + .65 * step(.55, sin(angle * 9.0 + vLocal.y * 11.0 - uTime * 7.0)); }
    alpha *= uFade; if (alpha < 0.004) discard;
    vec3 tint = mix(uColor * (0.7 + height * 0.45), uBright, core);
    if (uSkin > 6.5 && uSkin < 7.5) tint = mix(tint, vec3(.65) + .35 * cos(vec3(0.0,2.1,4.2) + angle * 2.0 + uTime), .45);
    gl_FragColor = vec4(tint, alpha);
    #include <colorspace_fragment>
  }
`;

/** Three batches: travelling floor runes, flowing energy envelope and class-shaped ribbons. */
export function createAvatarAura(type: PieceSymbol, side: "w" | "b", skin: SkinId) {
  const root = new THREE.Group(); root.name = `avatar-aura-${type}-${skin}`;
  const style = ["p", "n", "b", "r", "q", "k"].indexOf(type); const skinIndex = Object.keys(skins).indexOf(skin);
  const color = new THREE.Color((side === "w" ? skins[skin].white : skins[skin].black)[1]);
  const makeMaterial = (layer: number) => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCharge: { value: 0 }, uFade: { value: 0 }, uLayer: { value: layer }, uStyle: { value: style }, uSkin: { value: skinIndex },
      uColor: { value: color.clone() }, uBright: { value: color.clone().lerp(new THREE.Color(0xd8ecff), 0.48) } },
    vertexShader: auraVertex, fragmentShader: auraFragment, transparent: true, depthWrite: false, toneMapped: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true,
  });
  const batches: THREE.BufferGeometry[][] = [[], [], []];
  const add = (layer: number, g: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, rz = 0) => {
    g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); batches[layer].push(g.index ? g.toNonIndexed() : g); if (g.index) g.dispose();
  };
  const corners = type === "p" ? 3 : type === "r" ? 4 : type === "q" ? 6 : type === "b" ? 6 : 48;
  for (let i = 0; i < 3; i++) add(0, new THREE.TorusGeometry(0.58 + i * 0.15, 0.014 + i * 0.002, 4, corners), 0, 0.035 + i * 0.032, 0, -Math.PI / 2, i * 0.18);
  // Small orbiting glyph blades add rhythm to the floor without a solid glowing disc.
  for (let i = 0; i < (type === "r" ? 4 : 6); i++) {
    const angle = i * Math.PI * 2 / (type === "r" ? 4 : 6);
    add(0, new THREE.OctahedronGeometry(0.052), Math.cos(angle) * 0.95, 0.1, Math.sin(angle) * 0.95);
  }
  add(1, new THREE.CylinderGeometry(type === "r" ? 0.85 : 0.66, type === "r" ? 0.94 : 0.84, 2.2, 32, 8, true), 0, 1.1);
  if (type === "p") for (const sign of [-1, 1]) {
    add(2, new THREE.TorusGeometry(0.58, 0.019, 4, 24, Math.PI * 0.72), sign * 0.32, 0.8, 0.25, 0.18, sign * 0.65);
    add(2, new THREE.ConeGeometry(0.05, 0.6, 3), sign * 0.56, 0.4, 0.3);
  }
  if (type === "n") for (const sign of [-1, 1]) for (let i = 0; i < 2; i++)
    add(2, new THREE.TorusGeometry(0.7 + i * 0.15, 0.02, 4, 32, Math.PI * 0.85), sign * 0.55, 1.22 - i * 0.12, 0.3 + i * 0.1, 0.2, sign * 0.75);
  if (type === "b") for (let i = 0; i < 3; i++) add(2, new THREE.TorusGeometry(0.55 + i * 0.18, 0.016, 4, 6), 0, 1.5, 0.38, 0, i * Math.PI / 6);
  if (type === "r") for (const sign of [-1, 1]) {
    add(2, new THREE.BoxGeometry(0.025, 1.25, 0.025), sign * 0.9, 0.74, 0.3);
    for (let i = 0; i < 3; i++) add(2, new THREE.TorusGeometry(0.17 + i * 0.05, 0.016, 4, 4), sign * 0.9, 0.5 + i * 0.3, 0.3);
  }
  if (type === "q") for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3;
    add(2, new THREE.OctahedronGeometry(0.085), Math.cos(angle) * 0.96, 1.4 + Math.sin(angle) * 0.8, 0.4);
    add(2, new THREE.TorusGeometry(1, 0.014, 4, 12, Math.PI / 6), 0, 1.4, 0.4, 0, angle);
  }
  if (type === "k") for (const sign of [-1, 1]) for (let i = 0; i < 3; i++) {
    add(2, new THREE.ConeGeometry(0.045, 0.8 - i * 0.12, 3), sign * (0.58 + i * 0.14), 1.35 - i * 0.12, 0.36, 0, sign * -0.65);
    add(2, new THREE.TorusGeometry(0.65 + i * 0.1, 0.013, 4, 24, Math.PI * 0.35), sign * 0.17, 1.1, 0.4, 0, sign * 0.45);
  }
  if(skin==='nova')for(let i=0;i<3;i++)add(2,new THREE.TorusGeometry(.7+i*.12,.02,4,12),0,1.2+i*.12,.3,i*.4);
  if(skin==='phantom')for(let i=0;i<2;i++)add(2,new THREE.TorusGeometry(.8+i*.2,.02,4,24,Math.PI*1.5),0,1.2,.35,i*.8);
  if(skin==='dragon')for(const sign of [-1,1])for(let i=0;i<3;i++)add(2,new THREE.ConeGeometry(.09,.9-i*.12,3),sign*(.7+i*.15),1,.35,0,sign*-.8);
  if (skin === "storm") for (let i = 0; i < 6; i++) add(2, new THREE.BoxGeometry(.025, .7, .025), Math.cos(i * Math.PI / 3) * .75, .5, Math.sin(i * Math.PI / 3) * .75, 0, i % 2 ? .5 : -.5);
  if (skin === "void") for (let i = 0; i < 2; i++) add(2, new THREE.TorusGeometry(.8 + i * .16, .018, 4, 32), 0, 1.15, .35, i * .85);
  if (skin === "prism") for (let i = 0; i < 3; i++) add(2, new THREE.TorusGeometry(.75 + i * .15, .016, 4, 6), 0, 1.35, .4, i * .4);
  if (skins[skin].tier >= 3) add(2, new THREE.TorusGeometry(1.08, 0.012, 4, 48), 0, 1.4, 0.45);
  const materials = batches.map((geometry, layer) => {
    const merged = mergeGeometries(geometry)!; geometry.forEach((g) => g.dispose());
    const material = makeMaterial(layer); root.add(new THREE.Mesh(merged, material)); return material;
  });
  root.userData.materials = materials;
  return root;
}

export function animateAvatarAura(root: THREE.Group, avatar: THREE.Group, charge: number, fade: number, time: number) {
  root.position.copy(avatar.position); root.rotation.set(0, avatar.rotation.y, 0);
  root.scale.copy(avatar.scale).multiplyScalar(1 + Math.sin(time * 4) * 0.012 + charge * 0.08);
  const materials = root.userData.materials as THREE.ShaderMaterial[];
  for (const material of materials) {
    material.uniforms.uTime.value = time; material.uniforms.uCharge.value = Math.max(0, Math.min(1, charge));
    material.uniforms.uFade.value = Math.max(0, Math.min(1, fade));
  }
  root.visible = avatar.visible;
}
