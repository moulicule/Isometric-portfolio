import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Box3, BufferAttribute, BufferGeometry, Group, Mesh, BoxGeometry, Vector3 } from 'three';
import { loadDeskController } from '../src/desk-controller.js';

test('the supplied controller loads on the desk surface with its materials', async t => {
  const buffer = readFileSync(new URL('../public/models/controller.glb', import.meta.url));
  t.mock.method(globalThis, 'fetch', async (url, { signal }) => {
    assert.equal(url, '/models/controller.glb');
    assert.equal(signal.aborted, false);
    return new Response(buffer);
  });
  const room = new Group();
  const originalX = -40.258056090413426, z = 35.73154673771854;
  const x = originalX - 8;
  const screen = new Mesh(new BoxGeometry(30, 20, 5));
  screen.name = 'Computer';
  screen.position.set(originalX - 100, 60, z);
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
      geometry.rotateY(Math.PI / 9);
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
  assert.ok(Math.abs(bounds.getSize(new Vector3()).z - 25.014628038751236) < 1e-4);
  assert.ok(Math.abs(bounds.getCenter(new Vector3()).x - x) < 1e-4);
  assert.ok(Math.abs(bounds.getCenter(new Vector3()).z - z) < 1e-4);
});

test('controller download errors and invalid files leave the room usable', async t => {
  const room = new Group();
  t.mock.method(console, 'warn', () => {});
  const app = { createObject() { assert.fail('a failed download must not add scene objects'); } };
  for (const response of [new Response('', { status: 404 }), new Response('invalid GLB')]) {
    t.mock.method(globalThis, 'fetch', async () => response);
    assert.equal(await loadDeskController(app, room), null);
    assert.equal(room.children.length, 0);
  }
});

test('a stalled controller request is aborted before it can hold up startup', async t => {
  t.mock.method(console, 'warn', () => {});
  let signal;
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
    signal = options.signal;
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  assert.equal(await loadDeskController({}, new Group(), { timeoutMs: 5 }), null);
  assert.equal(signal.aborted, true);
});

test('a mesh creation failure removes the partial controller', async t => {
  t.mock.method(console, 'warn', () => {});
  t.mock.method(globalThis, 'fetch', async () => new Response(
    readFileSync(new URL('../public/models/controller.glb', import.meta.url))));
  let removed;
  const app = {
    async createObject(type) {
      if (type === 'Group') return { uuid: 'partial-controller' };
      throw new Error('mesh construction failed');
    },
    removeObject(id) { removed = id; }
  };
  assert.equal(await loadDeskController(app, new Group()), null);
  assert.equal(removed, 'partial-controller');
});
