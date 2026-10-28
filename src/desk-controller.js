import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Use Spline-owned meshes so the controller shares the room's renderer and lights.
export async function loadDeskController(app, room, { timeoutMs = 8000 } = {}) {
  const abort = new AbortController();
  const deadline = setTimeout(() => abort.abort(), timeoutMs);
  let controller;
  try {
    room.updateMatrixWorld(true);
    // Calibrated against the desk surface in public/scene.splinecode.
    const center = new Vector3(-40.258056090413426, -2.916331241292987, 35.73154673771854);
    const surfaceY = -9.899157690651808;
    const width = 22.740570944319305;
    const screen = room.getObjectByName('Computer');
    const direction = screen ? new Box3().setFromObject(screen).getCenter(new Vector3()).sub(center) : new Vector3(0, 0, -1);
    // The shoulder buttons face -Z; offset 20° clockwise from the monitor.
    const angle = Math.atan2(-direction.x, -direction.z) - Math.PI / 9;
    center.addScaledVector(direction.clone().setY(0).normalize(), 8);
    const response = await fetch('/models/controller.glb', { signal: abort.signal });
    if (!response.ok) throw new Error(`Controller download failed (${response.status}).`);
    const { scene } = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '');
    abort.signal.throwIfAborted();
    scene.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(scene);
    const size = bounds.getSize(new Vector3());
    const origin = bounds.getCenter(new Vector3());
    const scale = width / size.x;
    const parts = [];
    scene.traverse(node => { if (node.isMesh) parts.push(node); });
    controller = await app.createObject('Group', {
      name: 'Gaming Controller', position: [center.x, surfaceY, center.z]
    });
    for (const part of parts) {
      const geometry = part.geometry.clone().applyMatrix4(part.matrixWorld);
      geometry.translate(-origin.x, -bounds.min.y, -origin.z);
      geometry.scale(scale, scale, scale);
      geometry.rotateY(angle);
      const material = part.material;
      await app.createObject('CustomMesh', {
        name: `Gaming Controller ${part.name}`,
        parent: controller.uuid,
        vertices: geometry.attributes.position.array,
        indices: geometry.index?.array,
        normals: geometry.attributes.normal?.array,
        material: { color: `#${material.color.getHexString()}`, roughness: material.roughness, metalness: material.metalness },
        castShadow: true, receiveShadow: true
      });
      geometry.dispose();
      part.geometry.dispose();
      material.dispose();
    }
    return room.getObjectByProperty('uuid', controller.uuid);
  } catch (error) {
    if (controller) app.removeObject(controller.uuid);
    console.warn('Gaming controller unavailable; continuing without it.', error);
    return null;
  } finally {
    clearTimeout(deadline);
  }
}
