import * as THREE from "three";
import type { PieceSymbol } from "chess.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { skins, type SkinId } from "./profile";

// The summons are silhouettes with articulated weapons, made from code rather
// than model files. Their torso/armour geometry is merged into two draw calls.
export function createAvatar(type: PieceSymbol, side: "w" | "b", skin: SkinId) {
  const group = new THREE.Group();
  group.name = `avatar-${type}-${skin}`;
  group.userData.avatar = true;
  const palette = side === "w" ? skins[skin].white : skins[skin].black;
  const materials = [
    new THREE.MeshStandardMaterial({ color: palette[0], emissive: palette[1], emissiveIntensity: 0.18,
      metalness: 0.55, roughness: 0.35, transparent: true, opacity: 0.62, depthWrite: false,
      side: THREE.DoubleSide, forceSinglePass: true }),
    new THREE.MeshBasicMaterial({ color: palette[1], transparent: true, opacity: 0.55, depthWrite: false,
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
  for (const direction of [-1, 1]) {
    add(new THREE.OctahedronGeometry(type === "r" ? 0.32 : 0.18), 0, direction * broad, 1.45);
    box(0.13, 0.5, 0.14, direction * broad * 0.84, 1.12, 0, 0, direction * 0.2);
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
  group.userData.baseOpacity = materials.map((m) => m.opacity);
  group.userData.materials = materials;
  return group;
}

export function animateAvatar(group: THREE.Group, type: PieceSymbol, charge: number, strike: number, fade: number, time: number) {
  const weapon = group.userData.weapon as THREE.Group;
  if (type === "p") { weapon.rotation.x = -0.25 - strike * 1.3; weapon.position.z = -0.08 - strike * 0.65; }
  if (type === "n") { weapon.rotation.z = 1.4 - strike * 2.8; group.rotation.z = Math.sin(strike * Math.PI) * -0.18; }
  if (type === "b") { weapon.rotation.z = -0.3 + charge * 0.45; group.position.y += Math.sin(time * 5) * 0.05; }
  if (type === "r") { weapon.rotation.x = Math.PI / 2; weapon.position.z = -0.15 + Math.sin(strike * Math.PI) * 0.2; }
  if (type === "q") { weapon.rotation.z = charge * 1.6 - strike * 2.6; group.rotation.z = Math.sin(time * 4) * 0.04; }
  if (type === "k") { weapon.rotation.z = -0.9 + strike * 2; weapon.position.y = 1.25 + (1 - strike) * charge * 0.4; }
  const materials = group.userData.materials as THREE.MeshBasicMaterial[];
  materials.forEach((m, i) => m.opacity = group.userData.baseOpacity[i] * fade);
}
