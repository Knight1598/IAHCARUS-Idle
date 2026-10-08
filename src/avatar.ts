import * as THREE from "three";
import type { PieceSymbol } from "chess.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { skins, type SkinId } from "./profile";

// Armour stays in two batches; the two arms and weapon articulate independently.
export function createAvatar(type: PieceSymbol, side: "w" | "b", skin: SkinId) {
  const group = new THREE.Group();
  group.name = `avatar-${type}-${skin}`;
  group.userData.avatar = true;
  const palette = side === "w" ? skins[skin].white : skins[skin].black;
  const materials = [
    new THREE.MeshStandardMaterial({ color: palette[0], emissive: palette[1], emissiveIntensity: 0.22,
      metalness: 0.45, roughness: 0.4, transparent: true, opacity: 0.94, depthWrite: true,
      side: THREE.DoubleSide, forceSinglePass: true }),
    new THREE.MeshBasicMaterial({ color: palette[1], transparent: true, opacity: 0.68, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true }),
  ];
  const batches: THREE.BufferGeometry[][] = [[], []];
  const add = (geometry: THREE.BufferGeometry, accent: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
    batches[accent].push(geometry);
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, accent = 0, rz = 0) => add(new THREE.BoxGeometry(w, h, d), accent, x, y, z, 0, 0, rz);
  // Every class has a face/visor and recognisable upper-body proportions.
  const broad = type === "r" ? 0.8 : type === "k" ? 0.58 : 0.4;
  add(new THREE.CylinderGeometry(broad * 0.75, broad * 0.46, 0.72, type === "r" ? 4 : 6), 0, 0, 1.15);
  add(new THREE.IcosahedronGeometry(type === "r" ? 0.27 : 0.22, 0), 0, 0, 1.76);
  box(0.28, 0.055, 0.06, 0, 1.79, -0.2, 1);
  // Face plate, breastplate and belt make the summoned fighter readable against FX.
  box(broad * 1.28, 0.4, 0.12, 0, 1.3, -0.2);
  add(new THREE.OctahedronGeometry(type === "r" ? 0.15 : 0.1), 1, 0, 1.36, -0.3);
  box(broad * 1.16, 0.09, 0.34, 0, 0.83, 0, 1);
  box(0.24, 0.15, 0.07, 0, 1.65, -0.2);
  for (const direction of [-1, 1]) {
    add(new THREE.OctahedronGeometry(type === "r" ? 0.32 : 0.18), 0, direction * broad, 1.45);
  }
  if (type === "p" || type === "k") {
    for (const x of [-0.13, 0.13]) box(0.18, 0.54, 0.2, x, 0.52, 0);
    add(new THREE.ConeGeometry(0.17, 0.35, 4), 1, 0, 1.96);
  }
  if (type === "n") {
    // A spectral cavalry rider: forward horse mask and a swept mane.
    add(new THREE.ConeGeometry(0.27, 0.55, 4), 0, 0, 1.85, -0.25, -Math.PI / 2);
    for (let i = 0; i < 4; i++) add(new THREE.ConeGeometry(0.12, 0.42, 3), 1, 0, 1.8 - i * 0.16, 0.23 + i * 0.1, -0.6);
    box(0.38, 0.35, 0.7, 0, 0.65, 0.15);
  }
  if (type === "b") {
    add(new THREE.ConeGeometry(0.42, 1.35, 6, 1, true), 0, 0, 0.7);
    add(new THREE.ConeGeometry(0.29, 0.65, 6), 0, 0, 1.9);
    add(new THREE.TorusGeometry(0.4, 0.03, 4, 24), 1, 0, 1.95, 0.12);
  }
  if (type === "r") {
    for (const x of [-0.48, 0.48]) {
      box(0.32, 0.7, 0.32, x, 0.55, 0);
      add(new THREE.CylinderGeometry(0.15, 0.21, 0.7, 6), 1, x, 1.5, -0.28, Math.PI / 2);
    }
    box(0.52, 0.12, 0.1, 0, 1.64, -0.22, 1);
  }
  if (type === "q" || type === "k") {
    // Capes and crown points survive even at a small screen size.
    add(new THREE.ConeGeometry(type === "q" ? 0.48 : 0.6, 1.5, 5, 1, true), 0, 0, 0.85, 0.17);
    for (let i = 0; i < (type === "q" ? 5 : 3); i++)
      add(new THREE.ConeGeometry(0.07, i % 2 ? 0.23 : 0.35, 4), 1, (i - (type === "q" ? 2 : 1)) * 0.12, 2.05);
  }
  if (type === "q") {
    for (const direction of [-1, 1]) for (let i = 0; i < 3; i++)
      add(new THREE.ConeGeometry(0.1, 0.8 - i * 0.12, 3), 1, direction * (0.4 + i * 0.18), 1.35, 0.18, 0, 0, direction * -0.9);
  }
  // Cosmetic families change silhouette, including low-level pieces.
  if (skin === "ember") for (const direction of [-1, 1])
    add(new THREE.ConeGeometry(0.13, 0.48, 3), 1, direction * broad, 1.72, 0, 0, 0, direction * -0.35);
  if (skin === "frost") for (const direction of [-1, 1])
    add(new THREE.OctahedronGeometry(0.18), 1, direction * (broad + 0.08), 1.64);
  if (skin === "astral") add(new THREE.TorusGeometry(0.62, 0.035, 4, 32), 1, 0, 1.55, 0.22, 0.15);
  if (skin === "royal") {
    add(new THREE.TorusGeometry(0.63, 0.04, 4, 32), 1, 0, 1.9, 0.25);
    for (const direction of [-1, 1]) box(0.13, 0.7, 0.08, direction * 0.74, 1.5, 0.22, 1, direction * 0.45);
  }
  for (let i = 0; i < batches.length; i++) {
    const prepared = batches[i].map((g) => g.index ? g.toNonIndexed() : g);
    const geometry = mergeGeometries(prepared)!;
    new Set([...prepared, ...batches[i]]).forEach((g) => g.dispose());
    group.add(new THREE.Mesh(geometry, materials[i]));
  }
  const arms: THREE.Group[] = [];
  for (const direction of [-1, 1]) {
    const arm = new THREE.Group(); arm.name = direction < 0 ? "avatar-left-arm" : "avatar-right-arm";
    arm.position.set(direction * broad, 1.4, 0);
    const upper = new THREE.BoxGeometry(type === "r" ? 0.25 : 0.15, 0.36, 0.2); upper.translate(0, -0.15, 0);
    const gauntlet = new THREE.BoxGeometry(type === "r" ? 0.29 : 0.2, 0.27, 0.25); gauntlet.translate(0, -0.42, -0.06);
    const prepared = [upper.toNonIndexed(), gauntlet.toNonIndexed()];
    const body = new THREE.Mesh(mergeGeometries(prepared)!, materials[0]); body.userData.sharedMaterial = true; arm.add(body);
    [...prepared, upper, gauntlet].forEach((g) => g.dispose());
    const band = new THREE.Mesh(new THREE.BoxGeometry(type === "r" ? 0.3 : 0.21, 0.06, 0.26), materials[1]);
    band.position.set(0, -0.39, -0.06); band.userData.sharedMaterial = true; arm.add(band);
    group.add(arm); arms.push(arm);
  }
  const weapon = new THREE.Group();
  weapon.name = "avatar-weapon";
  weapon.position.set(type === "r" ? 0 : 0.43, 1.25, -0.08);
  const shape = type === "p" ? new THREE.CylinderGeometry(0.035, 0.035, 2.2, 6)
    : type === "b" ? new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6)
    : type === "r" ? new THREE.CylinderGeometry(0.2, 0.27, 1.1, 6)
    : new THREE.BoxGeometry(type === "k" ? 0.17 : 0.08, type === "k" ? 1.6 : 1.2, 0.04);
  const shaft = new THREE.Mesh(shape, materials[1]);
  shaft.userData.sharedMaterial = true;
  weapon.add(shaft);
  const tip = new THREE.Mesh(type === "b" ? new THREE.OctahedronGeometry(0.19)
    : type === "r" ? new THREE.TorusGeometry(0.22, 0.045, 4, 16)
    : new THREE.ConeGeometry(type === "p" ? 0.13 : 0.1, 0.32, 4), materials[1]);
  tip.userData.sharedMaterial = true;
  tip.position.y = type === "p" ? 1.1 : type === "b" ? 0.95 : 0.55;
  weapon.add(tip);
  group.add(weapon);
  group.userData.weapon = weapon;
  group.userData.arms = arms;
  group.userData.piece = type;
  group.userData.baseOpacity = materials.map((m) => m.opacity);
  group.userData.materials = materials;
  return group;
}

export function animateAvatar(group: THREE.Group, type: PieceSymbol, charge: number, strike: number, fade: number, time: number) {
  const weapon = group.userData.weapon as THREE.Group;
  const [left, right] = group.userData.arms as THREE.Group[];
  weapon.position.set(type === "r" ? 0 : 0.43, 1.25, -0.08); weapon.rotation.set(0, 0, 0);
  group.rotation.x = group.rotation.z = 0;
  left.rotation.set(-0.2, 0, -0.15); right.rotation.set(-0.2, 0, 0.15);
  const swing = Math.sin(strike * Math.PI);
  if (type === "p") {
    left.rotation.x = -0.85; right.rotation.x = -0.4 - strike * 1.15;
    weapon.rotation.x = -0.4 - strike * 1.16; weapon.position.z = 0.15 * charge - strike * 0.8;
    group.rotation.x = -charge * 0.08 + swing * 0.22;
  }
  if (type === "n") {
    left.rotation.z = -0.5; right.rotation.z = 0.8 * charge - strike * 1.6; right.rotation.x = -1.1;
    weapon.rotation.z = 1.6 * charge - strike * 3; weapon.rotation.x = -0.6;
    group.rotation.x = -charge * 0.22 + swing * 0.3; group.rotation.z = swing * -0.2;
  }
  if (type === "b") {
    left.rotation.z = -0.7 - charge * 0.4; right.rotation.z = 0.7 + charge * 0.4;
    left.rotation.x = right.rotation.x = -strike * 1.5;
    weapon.rotation.z = -0.3 + charge * 0.45; weapon.position.y += charge * 0.25;
    group.position.y += Math.sin(time * 5) * 0.06 + charge * 0.15;
  }
  if (type === "r") {
    left.rotation.x = right.rotation.x = -Math.PI / 2;
    left.rotation.z = -0.15; right.rotation.z = 0.15;
    weapon.rotation.x = Math.PI / 2; weapon.position.z = -0.35 + swing * 0.3;
    group.position.y -= charge * 0.12; group.rotation.x = -swing * 0.12;
  }
  if (type === "q") {
    left.rotation.z = -1.15; right.rotation.z = 1.15 - strike * 0.8;
    right.rotation.x = -strike * 1.1; left.rotation.y = -charge * 0.5;
    weapon.rotation.z = charge * 1.6 - strike * 2.6; group.rotation.z = Math.sin(time * 4) * 0.04;
    group.position.y += charge * 0.2;
  }
  if (type === "k") {
    left.rotation.x = right.rotation.x = -charge * 2.3 + strike * 1.4;
    left.rotation.z = -0.2; right.rotation.z = 0.2;
    weapon.rotation.x = -charge * 1.1; weapon.rotation.z = -0.9 - charge * 0.8 + strike * 2.6;
    weapon.position.y = 1.25 + (1 - strike) * charge * 0.65; group.rotation.x = swing * 0.2;
  }
  const materials = group.userData.materials as THREE.MeshBasicMaterial[];
  materials.forEach((m, i) => m.opacity = group.userData.baseOpacity[i] * fade);
  group.visible = fade > 0.005;
}

/** Defensive guard is separate from the attack poses. */
export function animateDefender(group: THREE.Group, type: PieceSymbol, hit: number, fade: number, time: number) {
  animateAvatar(group, type, 0, 0, fade, time);
  const [left, right] = group.userData.arms as THREE.Group[];
  left.rotation.x = -1.3 + hit * 0.4; right.rotation.x = -1.05 + hit * 0.4;
  left.rotation.z = -0.25; right.rotation.z = 0.25;
  const weapon = group.userData.weapon as THREE.Group;
  weapon.rotation.set(type === "r" ? Math.PI / 2 : -0.5, 0, type === "b" ? 0.2 : -0.9);
  group.rotation.x = -hit * 0.28; group.rotation.z = hit * (type === "r" ? 0.25 : 0.5);
}

/** Aura silhouettes match the six fighting styles, batched into two meshes. */
export function createAvatarAura(type: PieceSymbol, side: "w" | "b", skin: SkinId) {
  const root = new THREE.Group(); root.name = `avatar-aura-${type}-${skin}`;
  const color = (side === "w" ? skins[skin].white : skins[skin].black)[1];
  const geometry: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, rz = 0) => {
    g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); geometry.push(g.index ? g.toNonIndexed() : g);
    if (g.index) g.dispose();
  };
  for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(0.62 + i * 0.13, 0.018, 4, type === "p" ? 3 : type === "r" ? 4 : type === "q" ? 6 : 40), 0, 0.035 + i * 0.035, 0, -Math.PI / 2);
  if (type === "p") for (const x of [-0.5, 0.5]) add(new THREE.ConeGeometry(0.055, 0.75, 3), x, 0.5, 0.2);
  if (type === "n") for (const s of [-1, 1]) add(new THREE.TorusGeometry(0.75, 0.035, 4, 24, Math.PI * 0.7), s * 0.55, 1.25, 0.3, 0.2, s * 0.7);
  if (type === "b") for (let i = 0; i < 2; i++) add(new THREE.TorusGeometry(0.6 + i * 0.2, 0.022, 4, 6), 0, 1.5, 0.35, 0, i * Math.PI / 6);
  if (type === "r") for (const x of [-0.8, 0.8]) add(new THREE.BoxGeometry(0.07, 1.3, 0.07), x, 0.7, 0.25);
  if (type === "q") for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3;
    add(new THREE.OctahedronGeometry(0.09), Math.cos(angle) * 0.95, 1.4 + Math.sin(angle) * 0.8, 0.38);
  }
  if (type === "k") for (const s of [-1, 1]) for (let i = 0; i < 3; i++) add(new THREE.ConeGeometry(0.07, 0.8 - i * 0.12, 3), s * (0.55 + i * 0.14), 1.3 - i * 0.12, 0.32, 0, s * -0.65);
  if (skins[skin].tier >= 3) add(new THREE.TorusGeometry(1, 0.016, 4, 40), 0, 1.4, 0.4);
  const merged = mergeGeometries(geometry)!; geometry.forEach((g) => g.dispose());
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.42, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true });
  root.add(new THREE.Mesh(merged, material));
  const veil = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.8, 1.5, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.055, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, forceSinglePass: true }));
  veil.position.y = 0.8; root.add(veil);
  return root;
}

export function animateAvatarAura(root: THREE.Group, avatar: THREE.Group, charge: number, fade: number, time: number) {
  root.position.copy(avatar.position); root.rotation.set(0, avatar.rotation.y, 0);
  root.scale.copy(avatar.scale).multiplyScalar(1 + Math.sin(time * 5) * 0.025 + charge * 0.1);
  (root.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = (0.32 + charge * 0.18) * fade;
  (root.children[1] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = (0.035 + charge * 0.025) * fade;
  root.visible = avatar.visible;
}
