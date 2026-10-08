import * as THREE from "three";

/** Fit both combatants, including weapons/auras, inside a HUD-safe rectangle. */
export function frameCombat(bounds: THREE.Box3[], direction: THREE.Vector3, fov: number, aspect: number) {
  const total = new THREE.Box3(); bounds.forEach((box) => total.union(box));
  const focus = total.getCenter(new THREE.Vector3());
  const forward = direction.clone().normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();
  const up = new THREE.Vector3().crossVectors(forward, right).normalize();
  const vertical = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * 0.73;
  const horizontal = vertical * Math.max(0.1, aspect) * 0.96;
  let distance = 5;
  for (const box of bounds) for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const p = new THREE.Vector3(x, y, z).sub(focus), depth = p.dot(forward);
    distance = Math.max(distance, depth + Math.abs(p.dot(right)) / horizontal, depth + Math.abs(p.dot(up)) / vertical);
  }
  return { focus, position: focus.clone().addScaledVector(forward, distance + 0.2), distance };
}
