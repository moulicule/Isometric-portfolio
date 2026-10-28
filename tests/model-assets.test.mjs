import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { o as serializer } from '../node_modules/@splinetool/runtime/build/runtime-chunk-K3UQCG3P.js';

test('delivery models stay within their geometry and download budgets', async () => {
  for (const [path, maxBytes, maxTriangles, maxMeshes] of [
    ['../public/models/controller.glb', 350000, 20000, 7],
    ['../public/projects/cap/assets/cap.glb', 3000000, 100000, 50]
  ]) {
    const buffer = readFileSync(new URL(path, import.meta.url));
    assert.ok(buffer.length < maxBytes, `${path}: download budget exceeded`);
    const { scene } = await new GLTFLoader().parseAsync(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
    let meshes = 0, triangles = 0;
    scene.traverse(node => {
      if (!node.isMesh) return;
      meshes++;
      triangles += node.geometry.index.count / 3;
      assert.ok(node.geometry.attributes.position.array.every(Number.isFinite));
    });
    assert.ok(triangles <= maxTriangles, `${path}: triangle budget exceeded`);
    assert.ok(meshes <= maxMeshes, `${path}: mesh budget exceeded`);
    if (path.includes('/cap/')) {
      assert.equal(scene.children[0].children.length, 9);
      assert.ok(scene.getObjectByName('LCd'), 'the procedural face still needs the physical screen surface');
    }
  }
});

test('the served room has no legacy key-4 events or their orphan states', () => {
  const data = serializer.deserialize(readFileSync(new URL('../public/scene.splinecode', import.meta.url)));
  const obsoleteStates = new Set([
    'C20AABA3-8AEC-4E34-85AF-FB55E48FD793',
    'AFC6C253-01FB-43C2-8E0B-1436C9145590',
    'B8F5285C-78E5-40AC-9EAA-53FF96731D98'
  ]);
  function check(record) {
    for (const { data: event } of record.data.events || []) {
      assert.ok(event.type !== 'KeyUp' || event.key !== '4', record.data.name);
    }
    for (const state of record.data.states || []) assert.ok(!obsoleteStates.has(state.id));
    for (const child of record.children || []) check(child);
  }
  data.scene.objects.forEach(check);
});
