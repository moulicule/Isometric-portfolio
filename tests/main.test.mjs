import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import * as THREE from 'three';
import * as cycle from '../src/day-night-cycle.js';
import * as motion from '../src/scene-motion.js';

// Run the real controller without importing the renderer or booting the page.
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '')
  .replace(/\ninitPage\(\);\s*$/, '');

function controller() {
  const elements = new Map(), activations = [], picks = [], sounds = [], toasts = [], warnings = [];
  let now = 0;
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      attributes: {}, listeners: {}, style: {},
      classList: { add() {}, remove() {}, toggle() {} },
      setAttribute(name, value) { this.attributes[name] = value; },
      getAttribute(name) { return this.attributes[name]; },
      addEventListener(name, listener) { this.listeners[name] = listener; },
      querySelector: selector => element(`${id} ${selector}`),
      querySelectorAll: () => [], appendChild() {},
      contains() { return false; }
    });
    return elements.get(id);
  };
  const context = createContext({
    THREE, ...cycle, ...motion, activations, picks, toasts,
    performance: { now: () => now }, requestAnimationFrame() {},
    sound: { toggleAmbient() {}, playPop: () => sounds.push('pop'),
      playWaterPour: () => sounds.push('water'), playCoffeeSip: () => sounds.push('sip'), playCoffeePour: () => sounds.push('pour') },
    console: { warn: message => warnings.push(message) },
    window: { matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {} },
    document: {
      hidden: false, addEventListener() {},
      createElement: () => element('created'),
      getElementById: element,
      querySelectorAll: () => [],
      querySelector: () => ({ lastElementChild: { textContent: 'Night' } })
    }
  });
  runInContext(source, context);
  runInContext(`
    const originalActivateHotspot = activateHotspot;
    getInteractiveAtPointer = event => { picks.push(event); return {}; };
    activateHotspot = () => activations.push('hotspot');
    showToast = message => toasts.push(message);
  `, context);
  return { context, activations, picks, sounds, toasts, warnings, element,
    run: code => runInContext(code, context),
    advance: time => { now = time; }
  };
}

const pointer = (pointerId = 1, extra = {}) => ({
  pointerId, isPrimary: pointerId === 1, button: 0, clientX: 100, clientY: 100, ...extra
});

test('object pins and Water Plant menu share progress, busy guards, and contextual names', () => {
  const { context: c, run, advance, element, sounds, toasts, picks } = controller();
  run(`
    plantInteraction = createPlantInteraction([], new THREE.Vector3());
    coffeeInteraction = createCoffeeInteraction(null, null);
    for (const id of ['plant', 'coffee']) HOTSPOTS.find(spot => spot.id === id).domElement = document.getElementById('hotspot-' + id);
    setupModalSectionMotion = () => {};
    setupEventListeners();
    updateObjectInteractions(0);
    setCameraPreset = (preset, options) => { picks.push({ preset, options }); state.cameraPreset = preset; };
    originalActivateHotspot(HOTSPOTS.find(spot => spot.id === 'plant'));
    originalActivateHotspot(HOTSPOTS.find(spot => spot.id === 'coffee'));
  `);
  assert.deepEqual(sounds, ['water', 'sip'], 'object-specific sounds replace the generic activation pop');
  assert.equal(picks.length, 1);
  assert.equal(picks[0].preset, 'desk');
  assert.equal(picks[0].options.audible, false);
  assert.equal(element('hotspot-plant').attributes['aria-label'], 'House Plant: 75% hydrated · Water plant');
  assert.equal(element('hotspot-coffee').attributes['aria-disabled'], 'true');
  element('waterPlantBtn').listeners.click();
  run("originalActivateHotspot(HOTSPOTS.find(spot => spot.id === 'coffee'))");
  assert.equal(toasts.length, 2, 'busy inputs do not add notifications or progress');
  assert.equal(picks.length, 1, 'busy input does not restart the camera transition');
  advance(1200);
  c.updateObjectInteractions(1200);
  assert.equal(element('hotspot-coffee').attributes['aria-disabled'], 'false');
  element('waterPlantBtn').listeners.click();
  assert.equal(run('plantInteraction.hydration'), 100);
  assert.match(element('waterPlantBtn').attributes['aria-label'], /100% hydrated/);
  for (let i = 1; i <= 3; i++) {
    advance(1200 + i * 1200);
    c.drinkCoffee();
  }
  assert.match(element('hotspot-coffee').attributes['aria-label'], /Empty · Refill coffee/);
  advance(6000);
  c.drinkCoffee();
  assert.equal(run('coffeeInteraction.sips'), 4);
  assert.equal(sounds.at(-1), 'pour');
});

test('visibility and reduced-motion changes settle the real interaction integration', () => {
  const { context: c, run, advance } = controller();
  run(`
    plantInteraction = createPlantInteraction([], new THREE.Vector3());
    coffeeInteraction = createCoffeeInteraction(null, null);
    state.cameraPreset = 'desk';
    waterPlant(); drinkCoffee();
    document.hidden = true;
  `);
  c.updateObjectInteractions(1000);
  assert.equal(run('coffeeInteraction.busy || plantInteraction.busy'), false);
  run('document.hidden = false');
  c.updateObjectInteractions(600000);
  assert.equal(run('plantInteraction.hydration'), 75);
  c.updateObjectInteractions(606000);
  assert.equal(run('plantInteraction.hydration'), 74);
  run('interactionMotionMedia.matches = true');
  advance(606000);
  c.drinkCoffee();
  assert.equal(run('coffeeInteraction.sips'), 2);
  assert.equal(run('coffeeInteraction.busy'), false);
});

test('optional liquid creation failure preserves working coffee and room interaction setup', async () => {
  const { context: c, run, warnings, sounds } = controller();
  await run(`
    objects.coffee = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 12, 10));
    body.name = 'Cylinder 11';
    objects.coffee.add(body);
    splineApp = {
      findObjectById: id => objects.coffee.getObjectByProperty('uuid', id),
      createObject: async () => { throw new Error('Optional geometry unavailable'); }
    };
    setupObjectInteractions();
  `);
  assert.equal(warnings.length, 1);
  c.drinkCoffee();
  assert.equal(run('coffeeInteraction.sips'), 3);
  assert.deepEqual(sounds, ['sip']);
  assert.equal(run('roomEffects.element.attributes["aria-hidden"]'), 'true');
});

test('coffee setup aims at the chair seat in the mug parent coordinates', async () => {
  const { run } = controller();
  await run(`
    const room = new THREE.Group();
    room.position.set(80, -20, 50);
    room.rotation.y = 0.7;
    room.scale.set(0.8, 1.2, 1.3);
    objects.coffee = new THREE.Group();
    objects.coffee.position.set(-10, 8, -5);
    objects.chair = new THREE.Group();
    objects.chair.position.set(20, 3, 30);
    const seat = new THREE.Object3D();
    seat.name = 'Cube 50';
    seat.position.set(4, 7, -3);
    objects.chair.add(seat);
    room.add(objects.coffee, objects.chair);
    splineApp = { findObjectById: id => room.getObjectByProperty('uuid', id) };
    const coffeeFactory = createCoffeeInteraction;
    let chairDirection;
    createCoffeeInteraction = (mug, liquid, options) => {
      chairDirection = options.tiltDirection;
      return coffeeFactory(mug, liquid, options);
    };
    setupObjectInteractions();
  `);
  assert.ok(Math.abs(run('chairDirection.x') - 34) < 1e-9);
  assert.ok(Math.abs(run('chairDirection.z') - 32) < 1e-9);
  assert.equal(run('chairDirection.y'), 0);
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
