import test from 'node:test';
import assert from 'node:assert/strict';
import { Object3D, Quaternion, Vector3 } from 'three';
import { createChairSwivel, createWallClock } from '../src/scene-motion.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const localTime = (hours, minutes = 0, seconds = 0) => new Date(2026, 9, 13, hours, minutes, seconds);

function clockFixture(tilt = 0) {
  const clock = new Object3D();
  clock.position.set(100, 90, -20);
  const hour = new Object3D();
  hour.rotation.set(0, tilt, -Math.PI / 2);
  hour.position.copy(clock.position).add(new Vector3(6, 0, 2).applyAxisAngle(new Vector3(0, 1, 0), tilt));
  const minute = new Object3D();
  minute.rotation.set(0, tilt, 0);
  minute.position.copy(clock.position).add(new Vector3(0, 8, 1).applyAxisAngle(new Vector3(0, 1, 0), tilt));
  return { clock, hour, minute, motion: createWallClock(clock, hour, minute) };
}

test('chair seat and back swivel around the post while the base stays fixed', () => {
  const pivot = new Vector3(18, -42, 76);
  const parts = [new Object3D(), new Object3D(), new Object3D()];
  parts[0].position.copy(pivot).add(new Vector3(0, 12, 0));
  parts[0].rotation.set(-Math.PI / 2, 0, Math.PI * 89 / 180);
  parts[1].position.copy(pivot).add(new Vector3(0, 24, -19));
  parts[1].rotation.y = Math.PI * 89 / 180;
  parts[2].position.copy(pivot).add(new Vector3(0, 44, -18));
  parts[2].rotation.y = Math.PI * 89 / 180;
  const base = new Object3D();
  base.position.copy(pivot).add(new Vector3(0, -10, 0));
  const baseTransform = base.toJSON();
  const initial = parts.map(part => ({ position: part.position.clone(), rotation: part.rotation.clone(), quaternion: part.quaternion.clone() }));
  const motion = createChairSwivel(parts, pivot);
  assert.equal(motion.start(1000), true);
  motion.update(1300);
  const turn = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI * 2 * (1 - 0.75 ** 3));
  parts.forEach((part, index) => {
    const expectedPosition = initial[index].position.clone().sub(pivot).applyQuaternion(turn).add(pivot);
    near(part.position.distanceTo(expectedPosition), 0);
    const expectedRotation = turn.clone().multiply(initial[index].quaternion);
    near(Math.abs(part.quaternion.dot(expectedRotation)), 1);
  });
  assert.deepEqual(base.toJSON(), baseTransform);
  motion.update(2200);
  parts.forEach((part, index) => {
    assert.deepEqual(part.position, initial[index].position);
    assert.deepEqual(part.rotation.toArray(), initial[index].rotation.toArray());
  });
  assert.equal(motion.start(2300), true);
});

test('every rapid chair tap adds a turn without snapping or waiting for a cooldown', () => {
  const seat = new Object3D();
  seat.position.set(0, 10, -5);
  const initialPosition = seat.position.clone();
  const initialRotation = seat.rotation.toArray();
  const motion = createChairSwivel([seat], new Vector3());
  assert.equal(motion.start(0), true);
  motion.update(300);
  const visiblePosition = seat.position.clone();
  const visibleQuaternion = seat.quaternion.clone();
  assert.equal(motion.start(300), true);
  near(seat.position.distanceTo(visiblePosition), 0);
  near(Math.abs(seat.quaternion.dot(visibleQuaternion)), 1);
  assert.equal(motion.start(300), true);
  motion.update(600);
  const firstAngle = Math.PI * 2 * (1 - 0.75 ** 3);
  const expectedAngle = firstAngle + (Math.PI * 6 - firstAngle) * (1 - 0.75 ** 3);
  const expectedPosition = initialPosition.clone().applyAxisAngle(new Vector3(0, 1, 0), expectedAngle);
  near(seat.position.distanceTo(expectedPosition), 0);
  motion.update(1500);
  assert.deepEqual(seat.position, initialPosition);
  assert.deepEqual(seat.rotation.toArray(), initialRotation);
  assert.equal(motion.start(1501), true);
});

test('a delayed chair frame completes the turn without accumulating rotation', () => {
  const chair = new Object3D();
  chair.rotation.y = -0.5;
  const motion = createChairSwivel([chair], new Vector3());
  motion.start(10000);
  motion.update(9000);
  near(chair.rotation.y, -0.5);
  motion.update(100000);
  near(chair.rotation.y, -0.5);
  assert.equal(motion.start(100001), true);
});

test('a chair with no seat parts does not claim to start an animation', () => {
  assert.equal(createChairSwivel([], new Vector3()).start(0), false);
});

test('at noon both hands point up and orbit the hub rather than their mesh centers', () => {
  const { clock, hour, minute, motion } = clockFixture();
  motion.update(localTime(12));
  near(hour.rotation.z, 0);
  near(minute.rotation.z, 0);
  near(hour.position.x, clock.position.x);
  near(hour.position.y, clock.position.y + 6);
  near(minute.position.y, clock.position.y + 8);
  motion.update(localTime(6));
  near(hour.position.x, clock.position.x);
  near(hour.position.y, clock.position.y - 6);
});

test('clock angles include elapsed minutes and seconds in local 12-hour time', () => {
  const { hour, minute, motion } = clockFixture();
  motion.update(localTime(15, 15, 30));
  near(hour.rotation.z, -(3 + 15.5 / 60) / 12 * Math.PI * 2);
  near(minute.rotation.z, -15.5 / 60 * Math.PI * 2);
  motion.update(localTime(0));
  near(hour.rotation.z, 0);
  near(minute.rotation.z, 0);
});

test('hands keep their face tilt, hub distance, and depth on successive updates', () => {
  const tilt = -Math.PI / 180;
  const { clock, hour, minute, motion } = clockFixture(tilt);
  const normal = new Vector3(0, 0, 1).applyAxisAngle(new Vector3(0, 1, 0), tilt);
  for (const hours of [0, 3, 6, 9, 12, 23]) {
    motion.update(localTime(hours, 30, 45));
    for (const [hand, radius, depth] of [[hour, 6, 2], [minute, 8, 1]]) {
      const offset = hand.position.clone().sub(clock.position);
      near(offset.dot(normal), depth);
      near(offset.addScaledVector(normal, -depth).length(), radius);
      near(hand.rotation.x, 0);
      near(hand.rotation.y, tilt);
    }
  }
});

test('a missing hand does not prevent the other hand from updating', () => {
  const { clock, minute } = clockFixture();
  const motion = createWallClock(clock, undefined, minute);
  motion.update(localTime(9, 45));
  near(minute.rotation.z, -Math.PI * 1.5);
  near(minute.position.x, clock.position.x - 8);
});
