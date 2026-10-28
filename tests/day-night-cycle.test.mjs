import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY_NIGHT_CYCLE_MS, getDayNightPhase } from '../src/day-night-cycle.js';

test('starts at night and completes night → day → sunset in ten minutes', () => {
  assert.equal(DAY_NIGHT_CYCLE_MS, 600000);
  for (const [elapsed, from, to] of [
    [0, 'night', 'day'],
    [200000, 'day', 'sunset'],
    [400000, 'sunset', 'night'],
    [600000, 'night', 'day'],
    [1800000, 'night', 'day']
  ]) {
    assert.deepEqual(getDayNightPhase(elapsed), { from, to, blend: 0 });
  }
});

test('blends continuously at phase boundaries and catches up after a hidden tab', () => {
  assert.equal(getDayNightPhase(100000).blend, 0.5);
  for (const boundary of [200000, 400000, 600000]) {
    const before = getDayNightPhase(boundary - 1);
    const after = getDayNightPhase(boundary);
    assert.equal(before.to, after.from);
    assert.ok(before.blend > 0.999999);
    assert.equal(after.blend, 0);
  }
  assert.deepEqual(getDayNightPhase(1300000), getDayNightPhase(100000));
  assert.deepEqual(getDayNightPhase(-200000), getDayNightPhase(400000));
});
