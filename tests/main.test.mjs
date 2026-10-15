import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import * as THREE from 'three';
import * as cycle from '../src/day-night-cycle.js';

// Run the real controller without importing the renderer or booting the page.
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '')
  .replace(/\ninitPage\(\);\s*$/, '');

function controller() {
  const elements = new Map(), activations = [], picks = [];
  let now = 0;
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      attributes: {}, listeners: {}, style: {},
      classList: { add() {}, remove() {}, toggle() {} },
      setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener(name, listener) { this.listeners[name] = listener; },
      contains() { return false; }
    });
    return elements.get(id);
  };
  const context = createContext({
    THREE, ...cycle, activations, picks,
    performance: { now: () => now }, requestAnimationFrame() {},
    sound: { toggleAmbient() {}, playPop() {} },
    window: { matchMedia: () => ({ matches: false }) },
    document: {
      getElementById: element,
      querySelectorAll: () => [],
      querySelector: () => ({ lastElementChild: { textContent: 'Night' } })
    }
  });
  runInContext(source, context);
  runInContext(`
    getInteractiveAtPointer = event => { picks.push(event); return {}; };
    activateHotspot = () => activations.push('hotspot');
    showToast = () => {};
  `, context);
  return { context, activations, picks, element,
    run: code => runInContext(code, context),
    advance: time => { now = time; }
  };
}

const pointer = (pointerId = 1, extra = {}) => ({
  pointerId, isPrimary: pointerId === 1, button: 0, clientX: 100, clientY: 100, ...extra
});

test('a primary tap picks at release, while a drag, right click, or orphan release does not activate', () => {
  const { context: c, activations, picks } = controller();
  c.handlePointerDown(pointer());
  c.handlePointerUp(pointer(1, { clientX: 102 }));
  assert.equal(activations.length, 1);
  assert.equal(picks[0].clientX, 102);
  c.handlePointerDown(pointer());
  c.handlePointerMove(pointer(1, { clientX: 110 }));
  c.handlePointerUp(pointer(1, { clientX: 110 }));
  c.handlePointerDown(pointer(1, { button: 2 }));
  c.handlePointerUp(pointer(1, { button: 2 }));
  c.handlePointerUp(pointer());
  assert.equal(activations.length, 1);
});

test('a two-finger gesture cannot activate in either release order, even without movement', () => {
  for (const order of [[1, 2], [2, 1]]) {
    const { context: c, activations } = controller();
    c.handlePointerDown(pointer());
    c.handlePointerDown(pointer(2, { clientX: 200 }));
    for (const id of order) c.handlePointerUp(pointer(id));
    assert.equal(activations.length, 0);
    c.handlePointerDown(pointer());
    c.handlePointerUp(pointer());
    assert.equal(activations.length, 1, 'the next tap must work');
  }
});

test('cancelled pointers and lost capture end tracking without turning a pinch into a tap', () => {
  for (const event of ['pointercancel', 'lostpointercapture']) {
    const { context: c, activations, element, run } = controller();
    run('setupSceneInput()');
    c.handlePointerDown(pointer());
    c.handlePointerDown(pointer(2));
    element('canvas3d').listeners[event](pointer(2));
    c.handlePointerUp(pointer());
    assert.equal(activations.length, 0);
    c.handlePointerDown(pointer());
    element('canvas3d').listeners[event](pointer());
    c.handlePointerUp(pointer());
    assert.equal(activations.length, 0);
    c.handlePointerDown(pointer());
    c.handlePointerUp(pointer());
    assert.equal(activations.length, 1);
  }
});

test('Zen holds night against manual changes, then resumes the cycle on exit', () => {
  const { context: c, run, advance, element } = controller();
  run('dayNightCycleStart = 0');
  c.setTheme('day', { notify: false });
  c.toggleZenMode(true);
  advance(1000);
  c.updateDayNightCycle(1000);
  const cycleStart = run('dayNightCycleStart');
  for (const change of [() => c.setTheme('day'), () => c.setTheme('sunset'), () => c.cycleTheme()]) {
    change();
    assert.equal(run('state.theme'), 'night');
    assert.equal(element('app').attributes['data-theme'], 'night');
    assert.equal(run('themeTransition'), null);
    assert.equal(run('dayNightCycleStart'), cycleStart);
  }
  advance(2000);
  c.toggleZenMode(false);
  c.updateDayNightCycle(3000);
  c.updateDayNightCycle(203000);
  assert.equal(run('state.theme'), 'day');
  c.setTheme('sunset');
  assert.equal(run('state.theme'), 'sunset', 'manual lighting works after Zen');
});
