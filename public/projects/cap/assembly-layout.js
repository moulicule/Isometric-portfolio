import * as THREE from 'three';

// World-space inspection slots: shells/display above, electronics below.
export const PART_SLOTS = [
  [2.35, -1.45, .1], [-3.6, 1, 0], [-2.8, -1.4, .1],
  [-.65, -1.4, .1], [.85, -3.15, .1], [0, 1, .2],
  [3.6, 1, 0], [2.9, -3.15, .1], [-.65, -3.15, .1]
];
const VIEWS = {
  all: [.22, .15], shell: [.3, .16], display: [-.08, .08],
  brain: [.12, .2], touch: [-.14, .17], power: [.28, .12]
};

export function inspectionView(parts, kind, aspect, fov) {
  const bounds = new THREE.Box3(), selected = new THREE.Box3();
  for (const part of parts) {
    bounds.union(part.bounds);
    if (part.kind === kind) selected.union(part.bounds);
  }
  // Keep the shell overview wide; later chapters frame their active components.
  const closeup = !['all', 'shell'].includes(kind) && !selected.isEmpty();
  const frame = closeup ? selected : bounds;
  const target = frame.getCenter(new THREE.Vector3());
  const [yaw, pitch] = VIEWS[kind] || VIEWS.all;
  const direction = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right);
  const tanY = Math.tan(THREE.MathUtils.degToRad(fov / 2)), tanX = tanY * aspect;
  let distance = 4;
  for (const part of parts.filter(part => !closeup || part.kind === kind)) {
    for (const x of [part.bounds.min.x, part.bounds.max.x]) {
      for (const y of [part.bounds.min.y, part.bounds.max.y]) {
        for (const z of [part.bounds.min.z, part.bounds.max.z]) {
          const offset = new THREE.Vector3(x, y, z).sub(target);
          distance = Math.max(distance, Math.abs(offset.dot(right)) / tanX + offset.dot(direction), Math.abs(offset.dot(up)) / tanY + offset.dot(direction));
        }
      }
    }
  }
  return { target, position: target.clone().addScaledVector(direction, distance * (closeup ? 1.3 : 1.12)) };
}
