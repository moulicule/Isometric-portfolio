import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { Box3, BufferAttribute, Matrix4, Mesh, Scene } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';

// Run against the original CAD export, never an already simplified delivery copy.
const [mode, input, output] = process.argv.slice(2);
assert.ok(['controller', 'cap'].includes(mode) && input && output,
  'Usage: node scripts/optimize-model.mjs controller|cap original.glb optimized.glb');
const buffer = readFileSync(input);
const document = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)));
assert.ok(!document.images?.length && !document.animations?.length && !document.skins?.length,
  'This optimizer is for the untextured, static controller and CAP exports.');
const { scene } = await new GLTFLoader().parseAsync(
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
await MeshoptSimplifier.ready;
scene.updateMatrixWorld(true);
const before = new Box3().setFromObject(scene);
const originalParts = mode === 'cap' ? scene.children[0].children.map(part => part.name) : null;

function simplify(geometry) {
  for (const name of Object.keys(geometry.attributes)) {
    if (!['position', 'normal'].includes(name)) geometry.deleteAttribute(name);
  }
  geometry = mergeVertices(geometry, 1e-6);
  const positions = geometry.attributes.position.array;
  const normals = geometry.attributes.normal.array;
  const indices = new Uint32Array(geometry.index.array);
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  // Keep each part's bounds exact: placement and inspection cameras use them.
  const lock = new Uint8Array(positions.length / 3);
  for (let i = 0; i < lock.length; i++) {
    for (const [axis, key] of ['x', 'y', 'z'].entries()) {
      if (positions[i * 3 + axis] === min[key] || positions[i * 3 + axis] === max[key]) lock[i] = 1;
    }
  }
  const ratio = mode === 'controller' ? 0.1 : 0.35;
  const target = Math.max(12, Math.floor(indices.length * ratio / 3) * 3);
  const [reduced] = MeshoptSimplifier.simplifyWithAttributes(
    indices, positions, 3, normals, 3, [0.1, 0.1, 0.1], lock,
    Math.min(indices.length, target), mode === 'controller' ? 0.003 : 0.0015, ['Permissive']);
  const [remap, count] = MeshoptSimplifier.compactMesh(reduced);
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const data = new Float32Array(count * attribute.itemSize);
    for (let i = 0; i < remap.length; i++) {
      if (remap[i] < count) data.set(attribute.array.subarray(i * attribute.itemSize, (i + 1) * attribute.itemSize), remap[i] * attribute.itemSize);
    }
    geometry.setAttribute(name, new BufferAttribute(data, attribute.itemSize));
  }
  geometry.setIndex(new BufferAttribute(count > 65535 ? reduced : new Uint16Array(reduced), 1));
  return geometry;
}

if (mode === 'cap') {
  assert.equal(originalParts.length, 9, 'CAP must retain its nine inspection components.');
  for (const part of scene.children[0].children) {
    const inverse = new Matrix4().copy(part.matrixWorld).invert();
    const groups = new Map();
    part.traverse(node => {
      if (!node.isMesh) return;
      assert.ok(!Array.isArray(node.material));
      const matrix = new Matrix4().multiplyMatrices(inverse, node.matrixWorld);
      const geometry = node.geometry.clone().applyMatrix4(matrix);
      if (matrix.determinant() < 0) {
        const indices = geometry.index.array;
        for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
      }
      const key = node.name === 'LCd' ? 'LCd' : node.material.uuid;
      if (!groups.has(key)) groups.set(key, { material: node.material, geometries: [] });
      groups.get(key).geometries.push(geometry);
    });
    part.clear();
    for (const [key, { material, geometries }] of groups) {
      const geometry = mergeGeometries(geometries);
      const mesh = new Mesh(key === 'LCd' ? geometry : simplify(geometry), material);
      mesh.name = key === 'LCd' ? key : `${part.name} ${part.children.length + 1}`;
      part.add(mesh);
    }
  }
} else {
  scene.traverse(node => { if (node.isMesh) node.geometry = simplify(node.geometry.clone()); });
}

scene.updateMatrixWorld(true);
const after = new Box3().setFromObject(scene);
assert.ok(before.min.distanceTo(after.min) < 1e-6 && before.max.distanceTo(after.max) < 1e-6,
  'Optimization must preserve the model bounds.');
if (originalParts) assert.deepEqual(scene.children[0].children.map(part => part.name), originalParts);

// GLTFExporter uses FileReader for binary output; Node provides Blob instead.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(result => { this.result = result; this.onloadend(); });
  }
};
const exportScene = new Scene();
exportScene.add(...scene.children);
const result = await new GLTFExporter().parseAsync(exportScene, { binary: true, onlyVisible: false });
const restored = (await new GLTFLoader().parseAsync(result, '')).scene;
if (originalParts) assert.deepEqual(restored.children[0].children.map(part => part.name), originalParts,
  'The delivered GLB must preserve the inspection hierarchy.');
let meshes = 0, triangles = 0;
exportScene.traverse(node => {
  if (!node.isMesh) return;
  meshes++;
  triangles += node.geometry.index.count / 3;
  assert.ok(node.geometry.attributes.position.array.every(Number.isFinite));
});
writeFileSync(output, Buffer.from(result));
console.log(JSON.stringify({ mode, meshes, triangles, bytesBefore: buffer.length, bytesAfter: result.byteLength }));
