import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Object3D } from 'three';
import { applyRoomPalette, ROOM_PALETTE as p } from '../src/room-palette.js';
// Decode the actual served asset with Spline 2.0.60; revalidate on runtime upgrades.
import { o as serializer } from '../node_modules/@splinetool/runtime/build/runtime-chunk-K3UQCG3P.js';

function fixture() {
  const data = serializer.deserialize(readFileSync(new URL('../public/scene.splinecode', import.meta.url)));
  const shared = new Map(), handles = new Map();
  const material = source => ({
    layers: Array.from(source.layers, ({ data: layer }) => ({ ...structuredClone(layer),
      ...(layer.colors && { colors: layer.colors.map(color => `rgb(${color.slice(0, 3).map(c => Math.round(c * 255)).join(',')})`) })
    }))
  });
  function build(record) {
    const { data: source } = record;
    const object = new Object3D();
    object.name = source.name || source.type;
    object.type = source.type;
    object.uuid = record.id;
    object.position.fromArray(source.position);
    object.rotation.fromArray(source.rotation);
    object.scale.fromArray(source.scale);
    object.visible = source.visible;
    object.userData.geometry = structuredClone(source.geometry);
    if (source.type === 'Mesh') {
      const id = source.material;
      let mat;
      if (typeof id === 'string') {
        if (!shared.has(id)) shared.set(id, material(data.shared.materials[id]));
        mat = shared.get(id);
      } else mat = material(id);
      const handle = { material: mat };
      Object.defineProperty(handle, 'color', {
        get() { return mat.layers.find(l => l.type === 'color').color; }
      });
      handles.set(object.uuid, handle);
    }
    for (const child of record.children || []) object.add(build(child));
    return object;
  }
  const room = new Object3D();
  for (const record of data.scene.objects) room.add(build(record));
  return { room, handles, app: { findObjectById: id => handles.get(id) } };
}

const part = (room, scope, name) => room.getObjectByName(scope).getObjectByName(name);
const pose = room => {
  const result = [];
  room.traverse(o => result.push([o.uuid, o.name, o.parent?.uuid, o.visible,
    o.position.toArray(), o.rotation.toArray(), o.scale.toArray(), o.userData.geometry]));
  return result;
};

const wallNames = ['Wall', 'Cube 5', 'Cube 4', 'Cube 3', 'Cube 7', 'Cube'];

test('the served interior wall panels stay plum without changing geometry, transforms, or interaction names', () => {
  const { room, app, handles } = fixture();
  const before = pose(room);
  applyRoomPalette(app, room);
  assert.deepEqual(pose(room), before);
  const sharedWallMaterial = handles.get(part(room, 'Walls', 'Wall').uuid).material;
  for (const name of wallNames) {
    const handle = handles.get(part(room, 'Walls', name).uuid);
    assert.equal(handle.material, sharedWallMaterial, 'shared wall material stays shared');
    assert.equal(handle.color, p.wall);
    assert.equal(handle.material.layers.find(l => l.type === 'depth').colors[0], p.wallShade);
  }
});

test('only the plum walls and matched bed frame change; bedding, table, and all other materials keep their authored values', () => {
  const { room, app, handles } = fixture();
  const wallIds = new Set(wallNames.map(name => part(room, 'Walls', name).uuid));
  const before = new Map([...handles].map(([id, handle]) => [id, structuredClone(handle.material)]));
  const originalTableColor = handles.get(part(room, 'Table', 'Cube 8').uuid).color;
  const tableColor = '#' + ['r', 'g', 'b'].map(k => Math.round(originalTableColor[k] * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
  assert.equal(p.bedWood, tableColor, 'bed palette uses the table’s authored wood color');
  const bedFrameIds = new Set();
  part(room, 'Bed', 'Empty Object 2').traverse(o => {
    if (o.type === 'Mesh') bedFrameIds.add(o.uuid);
  });
  assert.equal(bedFrameIds.size, 6, 'every wooden frame part is covered');
  applyRoomPalette(app, room);
  for (const [id, handle] of handles) {
    const expected = before.get(id);
    if (wallIds.has(id)) {
      for (const layer of expected.layers) {
        if (layer.type === 'color') layer.color = p.wall;
        if (layer.type === 'depth') layer.colors[0] = p.wallShade;
      }
    }
    if (bedFrameIds.has(id)) {
      for (const layer of expected.layers) {
        if (layer.type === 'color') layer.color = tableColor;
        if (layer.type === 'depth') layer.colors[0] = '#FFFFFF';
      }
      assert.equal(handle.color, tableColor, 'bed wood matches the table');
    }
    assert.deepEqual(handle.material, expected, `only wall and bed wood color adjustments may change (${id})`);
  }
});

test('missing wall objects or handles do not prevent the room from loading', () => {
  assert.doesNotThrow(() => applyRoomPalette({ findObjectById() {} }, new Object3D()));
  const { room } = fixture();
  assert.doesNotThrow(() => applyRoomPalette({ findObjectById() {} }, room));
});
