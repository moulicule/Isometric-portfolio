import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Box3, BufferAttribute, BufferGeometry, Group, Mesh, BoxGeometry, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadDeskController } from '../src/desk-controller.js';

test('the supplied controller loads on the desk surface with its materials', async t => {
  const buffer = readFileSync(new URL('../public/models/controller.glb', import.meta.url));
  const model = await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    assert.equal(url, '/models/controller.glb');
    return model;
  });
  const room = new Group();
  const x = -40.258056090413426, z = 35.73154673771854;
  const screen = new Mesh(new BoxGeometry(30, 20, 5));
  screen.name = 'Computer';
  screen.position.set(x - 100, 60, z);
  room.add(screen);
  const bounds = new Box3();
  let parts = 0;
  const controller = await loadDeskController({
    async createObject(type, options) {
      if (type === 'Group') {
        const group = new Group();
        group.name = options.name;
        group.position.fromArray(options.position);
        room.add(group);
        return { uuid: group.uuid };
      }
      assert.equal(type, 'CustomMesh');
      const parent = room.getObjectByProperty('uuid', options.parent);
      assert.equal(parent?.name, 'Gaming Controller');
      assert.match(options.name, /^Gaming Controller /);
      assert.match(options.material.color, /^#[0-9a-f]{6}$/);
      assert.ok(options.vertices.every(Number.isFinite));
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(options.vertices, 3));
      parent.add(new Mesh(geometry.clone()));
      geometry.translate(parent.position.x, parent.position.y, parent.position.z);
      // Undo the decorative clockwise offset to check the desk placement.
      geometry.translate(-x, 0, -z);
      geometry.rotateY(Math.PI / 18);
      geometry.translate(x, 0, z);
      geometry.computeBoundingBox();
      bounds.union(geometry.boundingBox);
      parts++;
    }
  }, room);
  assert.equal(controller.name, 'Gaming Controller');
  assert.equal(controller.children.length, parts, 'every visible part shares the controller click target');
  assert.ok(parts >= 7, 'all controller parts are imported');
  assert.ok(bounds.getSize(new Vector3()).x < bounds.getSize(new Vector3()).z, 'controller turns toward the screen on its left');
  assert.ok(Math.abs(bounds.min.y + 9.899157690651808) < 1e-4, 'bottom rests on the desk surface');
  assert.ok(Math.abs(bounds.getSize(new Vector3()).z - 22.740570944319305) < 1e-4);
  assert.ok(Math.abs(bounds.getCenter(new Vector3()).x - x) < 1e-4);
  assert.ok(Math.abs(bounds.getCenter(new Vector3()).z - z) < 1e-4);
});
