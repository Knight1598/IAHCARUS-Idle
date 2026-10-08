import * as THREE from "three";
import type { PieceSymbol } from "chess.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { skins, type SkinId } from "./profile";
import { fighterPose, defenderPose, type FighterPose, type MotionContext } from "./motion";

type BoneName = "hips" | "torso" | "head" | "mantle" | "leftArm" | "rightArm" | "leftElbow" | "rightElbow" | "leftLeg" | "rightLeg" | "leftKnee" | "rightKnee";

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
  }
  if (type === "q" || type === "k") {
    // An open back cape leaves both moving feet visible from the combat camera.
    box("mantle", type === "q" ? 0.65 : 0.86, 1.25, 0.05, 0, 0.17, 0.26);
    for (const direction of [-1, 1]) box("mantle", 0.1, 1.25, 0.06, direction * (type === "q" ? 0.3 : 0.4), 0.17, 0.27, 1, direction * 0.1);
    for (let i = 0; i < (type === "q" ? 5 : 3); i++) add("head", new THREE.ConeGeometry(0.07, i % 2 ? 0.23 : 0.35, 4), 1, (i - (type === "q" ? 2 : 1)) * 0.12, 0.37);
  }
  if (type === "q") for (const direction of [-1, 1]) for (let i = 0; i < 3; i++)
    add("torso", new THREE.ConeGeometry(0.1, 0.8 - i * 0.12, 3), 1, direction * (0.4 + i * 0.18), 0.22, 0.18, 0, 0, direction * -0.9);
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
  }
  const weapon = new THREE.Group(); weapon.name = "avatar-weapon";
  weapon.position.set(type === "r" ? 0 : 0.43, 0.12, -0.08); weapon.userData.restPosition = weapon.position.clone(); torso.add(weapon);
  const shape = type === "p" ? new THREE.CylinderGeometry(0.035, 0.035, 2.2, 6)
    : type === "b" ? new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6)
    : type === "r" ? new THREE.CylinderGeometry(0.2, 0.27, 1.1, 6)
    : new THREE.BoxGeometry(type === "k" ? 0.17 : 0.08, type === "k" ? 1.6 : 1.2, 0.04);
  const tip = type === "b" ? new THREE.OctahedronGeometry(0.19)
    : type === "r" ? new THREE.TorusGeometry(0.22, 0.045, 4, 16) : new THREE.ConeGeometry(type === "p" ? 0.13 : 0.1, 0.32, 4);
  tip.translate(0, type === "p" ? 1.1 : type === "b" ? 0.95 : 0.55, 0);
  const prepared = [shape, tip].map((g) => g.index ? g.toNonIndexed() : g);
  const weaponMesh = new THREE.Mesh(mergeGeometries(prepared)!, materials[1]); weaponMesh.userData.sharedMaterial = true; weapon.add(weaponMesh);
  new Set([...prepared, shape, tip]).forEach((g) => g.dispose());
  // One material owner is needed for the scene's shared-material disposal convention.
  const torsoMeshes = bones.torso.children.filter((node): node is THREE.Mesh => node instanceof THREE.Mesh);
  for (const mesh of torsoMeshes) mesh.userData.sharedMaterial = false;
  group.userData.weapon = weapon; group.userData.arms = [bones.leftArm, bones.rightArm]; group.userData.bones = bones;
  group.userData.piece = type; group.userData.baseOpacity = materials.map((m) => m.opacity); group.userData.materials = materials;
  return group;
}

function applyPose(group: THREE.Group, pose: FighterPose, fade: number) {
  const bones = group.userData.bones as Record<BoneName, THREE.Group>;
  for (const name of Object.keys(bones) as BoneName[]) {
    bones[name].position.copy(bones[name].userData.restPosition);
    bones[name].rotation.set(...pose[name]);
  }
  const weapon = group.userData.weapon as THREE.Group;
  weapon.position.copy(weapon.userData.restPosition);
  weapon.position.x += pose.weaponOffset[0]; weapon.position.y += pose.weaponOffset[1]; weapon.position.z += pose.weaponOffset[2];
  weapon.rotation.set(...pose.weapon);
  // Local offsets belong to the skeleton: repeated sampling cannot drift the scene-owned root.
  bones.hips.position.x += pose.offset[0]; bones.hips.position.y += pose.offset[1]; bones.hips.position.z += pose.offset[2];
  group.rotation.x = pose.body[0]; group.rotation.z = pose.body[2];
  const materials = group.userData.materials as THREE.Material[];
  materials.forEach((m, i) => m.opacity = group.userData.baseOpacity[i] * Math.max(0, Math.min(1, fade)));
  group.visible = fade > 0.005;
}

export function animateAvatar(group: THREE.Group, type: PieceSymbol, charge: number, strike: number, fade: number, time: number, context: MotionContext = {}) {
  applyPose(group, fighterPose(type, charge, strike, time, context), fade);
}

export function animateDefender(group: THREE.Group, type: PieceSymbol, hit: number, fade: number, time: number) {
  applyPose(group, defenderPose(type, hit, time), fade);
}

const auraVertex = `
  uniform float uTime; uniform float uCharge; uniform float uLayer; uniform float uStyle;
  varying vec3 vLocal; varying vec2 vUv;
  void main() {
    vec3 p = position; vUv = uv;
    float height = clamp(p.y / 2.25, 0.0, 1.0);
    if (uLayer > 0.5) {
      float flow = uTime * (1.8 + uCharge) + atan(p.z, p.x) * (3.0 + uStyle * 0.5);
      p.xz *= 1.0 + sin(flow - p.y * 5.0) * (0.025 + uCharge * 0.045) * height;
      p.y += sin(flow * 1.3 + p.y * 3.0) * height * 0.035;
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
    } else {
      float tip = pow(max(0.0, sin(vUv.x * 6.28318 - uTime * 2.8)), 4.0);
      alpha = (0.12 + tip * 0.5) * energy; core = tip * 0.7;
    }
    alpha *= uFade; if (alpha < 0.004) discard;
    gl_FragColor = vec4(mix(uColor * (0.7 + height * 0.45), uBright, core), alpha);
    #include <colorspace_fragment>
  }
`;

/** Three batches: travelling floor runes, flowing energy envelope and class-shaped ribbons. */
export function createAvatarAura(type: PieceSymbol, side: "w" | "b", skin: SkinId) {
  const root = new THREE.Group(); root.name = `avatar-aura-${type}-${skin}`;
  const style = ["p", "n", "b", "r", "q", "k"].indexOf(type); const skinIndex = ["classic", "ember", "frost", "astral", "royal"].indexOf(skin);
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
