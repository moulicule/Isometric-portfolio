import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import * as THREE from 'three';
import * as cycle from '../src/day-night-cycle.js';
import * as motion from '../src/scene-motion.js';
import { PORTFOLIO_DATA } from '../src/data.js';

// Run the real controller without importing the renderer or booting the page.
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '')
  .replace("await import('@splinetool/runtime')", 'await loadSplineRuntime()')
  .replace(/^initPage\(\);|^inject(?:SpeedInsights)?\(\);/gm, '');

function controller({ menus = false } = {}) {
  const elements = new Map(), activations = [], picks = [], sounds = [], warnings = [];
  const documentListeners = {};
  let now = 0;
  const element = id => {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, {
        id,
        clientWidth: 242,
        attributes: {}, listeners: {}, style: {},
        classList: {
          add: value => classes.add(value), remove: value => classes.delete(value),
          contains: value => classes.has(value),
          toggle(value, force = !classes.has(value)) { force ? classes.add(value) : classes.delete(value); }
        },
        setAttribute(name, value) { this.attributes[name] = value; },
        getAttribute(name) { return this.attributes[name]; },
        addEventListener(name, listener) { this.listeners[name] = listener; },
        querySelector: selector => id === 'themeDropdown' && selector === '[aria-checked="true"]'
          ? null : element(`${id} ${selector === '[aria-checked="true"]' ? 'item' : selector}`),
        querySelectorAll: selector => selector === '.dropdown-item, input[type="range"]'
          ? [id === 'themeDropdown' ? element('lightingSlider') : element(`${id} item`)] : [], appendChild() {},
        contains: target => target?.id === id || target?.id?.startsWith(`${id} `)
          || (id === 'themeDropdown' && target?.id === 'lightingSlider'),
        focus() { context.document.activeElement = this; }
      });
    }
    return elements.get(id);
  };
  const context = createContext({
    THREE, PORTFOLIO_DATA, ...cycle, ...motion, activations, picks,
    performance: { now: () => now }, requestAnimationFrame() {},
    sound: { toggleAmbient() {}, playPop: () => sounds.push('pop'),
      playWaterPour: () => sounds.push('water') },
    console: { warn: message => warnings.push(message) },
    window: { matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {} },
    document: {
      hidden: false,
      addEventListener(name, listener) { (documentListeners[name] ||= []).push(listener); },
      createElement: () => element('created'),
      getElementById: element,
      querySelectorAll: selector => selector === '.lighting-stops .ui-icon'
        ? ['dayIcon', 'sunsetIcon', 'nightIcon'].map(element)
        : menus && selector === '.bottom-dock .dropdown'
          ? ['theme', 'camera', 'interactions'].map(id => element(`${id}Dropdown`)) : [],
      querySelector: () => ({ lastElementChild: { textContent: 'Night' } })
    }
  });
  runInContext(source, context);
  runInContext(`
    const originalActivateHotspot = activateHotspot;
    getInteractiveAtPointer = event => { picks.push(event); return {}; };
    activateHotspot = () => activations.push('hotspot');
  `, context);
  return { context, activations, picks, sounds, warnings, element, documentListeners,
    run: code => runInContext(code, context),
    advance: time => { now = time; }
  };
}

const pointer = (pointerId = 1, extra = {}) => ({
  pointerId, isPrimary: pointerId === 1, button: 0, clientX: 100, clientY: 100, ...extra
});

test('the room reaches readiness when its optional controller is unavailable', async () => {
  const { context: c, run, element } = controller();
  let disposed = false, checkedReadiness = false;
  c.loadSplineRuntime = async () => ({ Application: class {
    constructor() { this._scene = new THREE.Group(); this._camera = new THREE.OrthographicCamera(); }
    async load() {}
    dispose() { disposed = true; }
  } });
  c.loadDeskController = async () => null;
  c.applyRoomPalette = () => {};
  c.waitForSceneReady = async () => { checkedReadiness = true; };
  c.ResizeObserver = class { observe() {} };
  c.setTimeout = setTimeout;
  c.clearTimeout = clearTimeout;
  element('app').dataset = {};
  run(`syncResponsiveCameraZoom = configureCameraControls = setupSceneReferences =
    setupObjectInteractions = setupHotspots = setupLightingAndTheme = setupSceneInput = () => {};`);
  await c.init();
  assert.equal(element('app').dataset.sceneState, 'ready');
  assert.equal(checkedReadiness, true);
  assert.equal(disposed, false);
  assert.equal(run('objects.controller'), null);
});

test('all dock menus dismiss on a second Safari tap and outside click, while retaining keyboard focus', () => {
  const { run, element, documentListeners } = controller({ menus: true });
  run('setupModalSectionMotion = () => {}; setupEventListeners();');
  for (const id of ['theme', 'camera', 'interactions']) {
    const dropdown = element(`${id}Dropdown`);
    const toggle = dropdown.querySelector('.dropdown-toggle');
    const menu = dropdown.querySelector('.dropdown-menu');
    const tap = () => toggle.listeners.click({ detail: 1, stopPropagation() {} });
    tap();
    assert.equal(toggle.attributes['aria-expanded'], 'true');
    assert.equal(menu.inert, false);
    dropdown.listeners.focusout({ relatedTarget: null });
    tap();
    assert.equal(toggle.attributes['aria-expanded'], 'false', `${id} must close on the second tap`);
    assert.equal(menu.inert, true);
    tap();
    documentListeners.click.forEach(listener => listener({ target: element('outside') }));
    assert.equal(menu.inert, true, 'outside tap closes the menu');

    toggle.listeners.click({ detail: 0, stopPropagation() {} });
    assert.equal(run('document.activeElement.id'), id === 'theme' ? 'lightingSlider' : `${id}Dropdown item`);
    dropdown.listeners.keydown({ key: 'Tab' });
    assert.equal(menu.inert, true);
    assert.equal(run('document.activeElement.id'), toggle.id);
    tap();
    dropdown.listeners.focusout({ relatedTarget: element('outside') });
    assert.equal(menu.inert, true, 'keyboard focus leaving the dropdown closes it');
  }
});

test('lighting slider scrubs the full atmosphere, interrupts fades, and resumes the cycle', () => {
  const { context: c, run, element, advance } = controller();
  run('setupModalSectionMotion = () => {}; setupEventListeners(); dayNightCycleStart = 0;');
  c.setTheme('day');
  advance(250);
  for (const [value, from, to, blend] of [
    [0, 'day', 'sunset', 0], [25, 'day', 'sunset', 0.5],
    [50, 'sunset', 'night', 0], [75, 'sunset', 'night', 0.5], [100, 'night', 'day', 0]
  ]) {
    element('lightingSlider').value = String(value);
    element('lightingSlider').listeners.input();
    assert.equal(run('themeTransition'), null);
    assert.equal(Number(element('lightingSlider').value), value);
    const expected = run(`THEMES.${from}.bg.clone().lerp(THEMES.${to}.bg, ${blend}).getStyle()`);
    assert.equal(element('app').style.background, expected);
    assert.equal(run('cycleCloudColor.getStyle()'), run(`THEMES.${from}.cloudColor.clone().lerp(THEMES.${to}.cloudColor, ${blend}).getStyle()`));
    assert.equal(run('cycleStarOpacity'), run(`THREE.MathUtils.lerp(THEMES.${from}.starOpacity, THEMES.${to}.starOpacity, ${blend})`));
  }
  c.setTimeOfDay(25);
  c.updateDayNightCycle(100250);
  assert.equal(Number(element('lightingSlider').value), 50);
  assert.equal(element('lightingSlider').attributes['aria-valuetext'], 'Sunset');
  c.setTheme('night');
  assert.equal(Number(element('lightingSlider').value), 100);
  c.toggleZenMode(true);
  c.setTimeOfDay(0);
  assert.equal(Number(element('lightingSlider').value), 100, 'Zen keeps night');
});

test('automatic dawn keeps Night selected without sweeping through Sunset', () => {
  const { context: c, run, element } = controller();
  run('dayNightCycleStart = 0');
  c.updateDayNightCycle(100000);
  assert.equal(Number(element('lightingSlider').value), 100);
  assert.equal(element('lightingSlider').attributes['aria-valuetext'], 'Night');
  assert.equal(element('sunsetIcon').classList.contains('is-lit'), false);
  assert.equal(element('app').style.background, run('THEMES.night.bg.clone().lerp(THEMES.day.bg, 0.5).getStyle()'));
  for (const [now, value] of [[200000, 0], [300000, 25], [400000, 50], [500000, 75], [600000, 100], [700000, 100], [800000, 0]]) {
    c.updateDayNightCycle(now);
    assert.equal(Number(element('lightingSlider').value), value, `slider at ${now}ms`);
  }
});

test('lighting slider keeps native keyboard handling and stays open during input', () => {
  const { run, element } = controller({ menus: true });
  run('setupModalSectionMotion = () => {}; setupEventListeners();');
  const dropdown = element('themeDropdown');
  dropdown.querySelector('.dropdown-toggle').listeners.click({ detail: 0, stopPropagation() {} });
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab']) {
    dropdown.listeners.keydown({ key, target: element('lightingSlider'), preventDefault() { assert.fail('native slider key was intercepted'); } });
  }
  element('lightingSlider').value = '50';
  element('lightingSlider').listeners.input();
  assert.equal(dropdown.querySelector('.dropdown-menu').inert, false);
});

test('an open lighting slider stays fixed through automatic phase changes but still accepts input', () => {
  const { context: c, run, element, advance } = controller({ menus: true });
  run('setupModalSectionMotion = () => {}; setupEventListeners();');
  c.setTimeOfDay(25);
  const dropdown = element('themeDropdown');
  dropdown.querySelector('.dropdown-toggle').listeners.click({ detail: 1, stopPropagation() {} });
  const valueText = element('lightingSlider').attributes['aria-valuetext'];
  for (const now of [100, 100000, 300000]) {
    c.updateDayNightCycle(now);
    assert.equal(Number(element('lightingSlider').value), 25);
    assert.equal(element('lightingSlider').attributes['aria-valuetext'], valueText);
  }
  assert.equal(run('state.theme'), 'night', 'the atmosphere continues cycling');
  advance(300000);
  element('lightingSlider').value = '75';
  element('lightingSlider').listeners.input();
  assert.equal(element('lightingSlider').attributes['aria-valuetext'], 'Sunset to Night, 50%');
  c.updateDayNightCycle(350000);
  assert.equal(Number(element('lightingSlider').value), 75);
  dropdown.querySelector('.dropdown-toggle').listeners.click({ detail: 1, stopPropagation() {} });
  c.updateDayNightCycle(350100);
  assert.ok(Number(element('lightingSlider').value) > 75, 'closed sliders sync with the cycle again');
});

test('lighting icons light up only while under the thumb, including after resizing', () => {
  const { context: c, element } = controller();
  const icons = ['dayIcon', 'sunsetIcon', 'nightIcon'].map(element);
  for (const [value, litIndex] of [[0, 0], [5, 0], [7.3, 0], [7.4, -1], [8, -1], [10, -1], [45, 1], [50, 1], [60, -1], [95, 2], [100, 2]]) {
    c.updateLightingSlider(value);
    assert.deepEqual(icons.map(icon => icon.classList.contains('is-lit')), icons.map((_, index) => index === litIndex));
  }
  element('lightingSlider').clientWidth = 180;
  c.updateLightingSlider(9);
  assert.equal(icons[0].classList.contains('is-lit'), true, 'coverage follows the rendered thumb size');
});

test('plant pin and Water Plant menu share progress and busy guards', () => {
  const { context: c, run, advance, element, sounds } = controller();
  run(`
    plantInteraction = createPlantInteraction([], new THREE.Vector3());
    HOTSPOTS.find(spot => spot.id === 'plant').domElement = document.getElementById('hotspot-plant');
    setupModalSectionMotion = () => {};
    setupEventListeners();
    updateObjectInteractions(0);
    originalActivateHotspot(HOTSPOTS.find(spot => spot.id === 'plant'));
  `);
  assert.deepEqual(sounds, ['water']);
  assert.equal(element('hotspot-plant').attributes['aria-label'], 'House Plant: 75% hydrated · Water plant');
  assert.equal(element('hotspot-plant').attributes['aria-disabled'], 'true');
  element('waterPlantBtn').listeners.click();
  assert.equal(run('plantInteraction.hydration'), 75, 'busy plant rejects repeat watering');
  assert.deepEqual(sounds, ['water']);
  advance(1200);
  c.updateObjectInteractions(1200);
  assert.equal(element('hotspot-plant').attributes['aria-disabled'], 'false');
  element('waterPlantBtn').listeners.click();
  assert.equal(run('plantInteraction.hydration'), 100);
  assert.match(element('waterPlantBtn').attributes['aria-label'], /100% hydrated/);
});

test('visibility and reduced-motion changes settle plant interaction', () => {
  const { context: c, run, advance } = controller();
  run(`
    plantInteraction = createPlantInteraction([], new THREE.Vector3());
    waterPlant();
    document.hidden = true;
  `);
  c.updateObjectInteractions(1000);
  assert.equal(run('plantInteraction.busy'), false);
  run('document.hidden = false');
  c.updateObjectInteractions(600000);
  assert.equal(run('plantInteraction.hydration'), 75);
  c.updateObjectInteractions(606000);
  assert.equal(run('plantInteraction.hydration'), 74);
  run('interactionMotionMedia.matches = true');
  advance(606000);
  c.waterPlant();
  assert.equal(run('plantInteraction.hydration'), 99);
  assert.equal(run('plantInteraction.busy'), false);
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
  c.setTheme('day');
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

test('overview fits phone, landscape, and desktop bounds and preserves zoom during resize', () => {
  const { context: c, element, run } = controller();
  let width, height;
  element('canvas3d').getBoundingClientRect = () => ({ left: 0, top: 0, right: width, width, height });
  element('sideNav').getBoundingClientRect = () => ({ left: 12 });
  c.document.querySelector = selector => ({ getBoundingClientRect: () => selector === '.bottom-dock'
    ? { top: height - 70 } : { top: 12, bottom: 206, right: width - 12 } });
  run(`threeCamera = new THREE.OrthographicCamera(); threeCamera.zoom = DEFAULT_CAM_ZOOM;
    splineApp = { _controls: { orbitControls: { minTheta: -0.25, maxTheta: 0.25 } } };`);
  for ([width, height] of [[320,568],[390,844],[568,320],[667,375],[844,390],[1024,600],[1440,1000]]) {
    c.syncResponsiveCameraZoom();
    const footprint = run('cameraZoomScale * OVERVIEW_FRAME_SIZE');
    assert.ok(footprint <= width - 32 + 1e-8);
    assert.ok(height / 2 - footprint / 2 >= 16 - 1e-8);
    assert.ok(height / 2 + footprint / 2 <= height - 86 + 1e-8);
    assert.ok(Math.abs(run('threeCamera.zoom / cameraZoomScale') - run('DEFAULT_CAM_ZOOM')) < 1e-8);
  }
  width = 844; height = 390; c.syncResponsiveCameraZoom();
  assert.ok(run('cameraZoomScale * OVERVIEW_FRAME_SIZE') > 200, 'landscape must not collapse to an 80px room');
  run(`threeCamera.zoom *= 1.2;
    currentCamAnim = { startZoom: threeCamera.zoom, targetZoom: CAMERA_PRESETS.desk.zoom * cameraZoomScale };
    zoomBounce = { startZoom: ZOOM_BOUNDS.min * 0.965 };`);
  width = 390; height = 844; c.syncResponsiveCameraZoom();
  assert.ok(Math.abs(run('threeCamera.zoom / cameraZoomScale') - run('DEFAULT_CAM_ZOOM * 1.2')) < 1e-8);
  assert.ok(Math.abs(run('currentCamAnim.targetZoom / cameraZoomScale') - 3.2) < 1e-8);
  assert.ok(Math.abs(run('zoomBounce.startZoom / ZOOM_BOUNDS.min') - 0.965) < 1e-8);
  assert.equal(run('splineApp._controls.orbitControls.minTheta'), -0.25);
  assert.equal(run('splineApp._controls.orbitControls.maxTheta'), 0.25);
  const zoom = run('threeCamera.zoom');
  height = 0; c.syncResponsiveCameraZoom();
  assert.equal(run('threeCamera.zoom'), zoom, 'a hidden canvas must not destroy zoom');
});

test('automatic lighting updates at 10Hz while manual fades keep every animation frame', () => {
  const { context: c, run, advance } = controller();
  run('let lightUpdates = 0; applyThemeLighting = () => lightUpdates++; dayNightCycleStart = 0;');
  for (let now = 0; now < 1000; now += 10) c.updateDayNightCycle(now);
  assert.equal(run('lightUpdates'), 10);
  advance(1000); c.setTheme('day');
  run('lightUpdates = 0;');
  for (let now = 1000; now <= 2000; now += 10) c.updateDayNightCycle(now);
  assert.equal(run('lightUpdates'), 101);
  assert.equal(run('themeTransition'), null);
  assert.equal(run('state.theme'), 'day');
  c.updateDayNightCycle(602000);
  assert.equal(run('state.theme'), 'day', 'the cycle catches up after a long gap');
});

test('hover events coalesce while release picks immediately and queued hover cannot survive leaving or dragging', () => {
  const { context: c, run, picks, element } = controller();
  run('getInteractiveAtPointer = event => { picks.push(event); return null; }; setupSceneInput();');
  for (let x = 0; x < 100; x++) c.handlePointerMove(pointer(1, { clientX: x }));
  assert.equal(picks.length, 0);
  c.flushPointerHover();
  assert.equal(picks.length, 1);
  assert.equal(picks[0].clientX, 99);
  c.flushPointerHover();
  assert.equal(picks.length, 1);
  c.handlePointerMove(pointer());
  element('canvas3d').listeners.pointerleave();
  c.flushPointerHover();
  assert.equal(picks.length, 1);
  c.handlePointerMove(pointer());
  c.handlePointerDown(pointer());
  c.handlePointerUp(pointer(1, { clientX: 102 }));
  assert.equal(picks.length, 2);
  assert.equal(picks[1].clientX, 102);
  c.flushPointerHover();
  assert.equal(picks.length, 2);
  c.handlePointerMove(pointer());
  run('activeModal = {};'); c.flushPointerHover();
  assert.equal(picks.length, 2);
});

test('stationary hotspots do no layout reads or position writes, but follow camera, object, and label changes', () => {
  const { context: c, run, element } = controller();
  let writes = 0, projections = 0;
  const pin = element('pin');
  pin.matches = () => false;
  pin.style = new Proxy({ setProperty() { writes++; } }, { set(target, key, value) { writes++; target[key] = value; return true; } });
  c.pin = pin;
  c.bubble = { get offsetWidth() { throw new Error('unexpected label measurement'); }, get offsetHeight() { throw new Error('unexpected label measurement'); } };
  c.countBubbleWrite = () => writes++;
  run(`threeCamera = new THREE.OrthographicCamera(-5,5,5,-5,0.1,100); threeCamera.position.z = 10;
    sceneViewport = { width: 500, height: 500 };
    objects.computer = new THREE.Object3D();
    HOTSPOTS.splice(0, HOTSPOTS.length, { id: 'test', objKey: 'computer', domElement: pin, bubble,
      worldMatrix: new THREE.Matrix4(), layoutDirty: true, bounds: [], offsetY: 0, revealOffsetY: 0,
      bubbleSize: { width: 100, height: 44 }, motion: { rise: 0 },
      revealTimeline: { play() {}, reverse() {} }, setBubbleX: countBubbleWrite, setBubbleY: countBubbleWrite });`);
  const object = run('objects.computer');
  const project = object.getWorldPosition.bind(object);
  object.getWorldPosition = point => { projections++; return project(point); };
  c.updateHotspots();
  const initialPosition = pin.style.transform;
  writes = projections = 0;
  for (let frame = 0; frame < 60; frame++) c.updateHotspots();
  assert.equal(writes, 0);
  assert.equal(projections, 0);
  run('HOTSPOTS[0].motion.rise = 0.5;'); c.updateHotspots(false);
  assert.equal(writes, 2, 'label reveal still updates between projections');
  run('threeCamera.position.x = 1;'); c.updateHotspots();
  assert.notEqual(pin.style.transform, initialPosition);
  const cameraPosition = pin.style.transform;
  object.position.x = 2; c.updateHotspots();
  assert.notEqual(pin.style.transform, cameraPosition);
  const beforeLabel = projections;
  run('HOTSPOTS[0].bubbleSize.width = 200; HOTSPOTS[0].layoutDirty = true;'); c.updateHotspots();
  assert.ok(projections > beforeLabel);
  run('activeModal = {};');
  writes = projections = 0;
  for (let frame = 0; frame < 60; frame++) c.updateHotspots();
  assert.equal(writes, 0);
  assert.equal(projections, 0);
  run('activeModal = null;'); c.updateHotspots();
  assert.ok(projections > 0, 'closing the dialog refreshes positions');
});

test('hotspot pointers follow their object when labels shift at viewport edges', () => {
  const { context: c, run, element } = controller();
  const pin = element('pin');
  const properties = {};
  pin.matches = () => false;
  pin.style.setProperty = (name, value) => { properties[name] = value; };
  c.pin = pin;
  run(`threeCamera = new THREE.OrthographicCamera(-5,5,5,-5,0.1,100); threeCamera.position.z = 10;
    sceneViewport = { width: 500, height: 500 };
    objects.computer = new THREE.Object3D();
    HOTSPOTS.splice(0, HOTSPOTS.length, { objKey: 'computer', domElement: pin,
      worldMatrix: new THREE.Matrix4(), layoutDirty: true, bounds: [], offsetY: 0, revealOffsetY: 0,
      bubbleSize: { width: 100, height: 44 }, motion: { rise: 1 },
      revealTimeline: { play() {}, reverse() {} }, setBubbleX() {}, setBubbleY() {} });`);
  for (const [screenX, expectedPointer] of [[250, 50], [30, 22], [470, 78], [5, 12], [495, 88]]) {
    run(`objects.computer.position.x = ${(screenX - 250) / 50};`);
    c.updateHotspots();
    assert.ok(Math.abs(parseFloat(properties['--pin-pointer-x']) - expectedPointer) < 1e-8);
    const spot = run('HOTSPOTS[0]');
    if (screenX >= 20 && screenX <= 480) {
      const tipX = spot.screenX + spot.bubbleX - spot.bubbleSize.width / 2 + expectedPointer;
      assert.ok(Math.abs(tipX - screenX) < 1e-8, 'pointer stays aligned with the object');
    }
  }
  run('objects.computer.position.x = 4.4; HOTSPOTS[0].bubbleSize.width = 200; HOTSPOTS[0].layoutDirty = true;');
  c.updateHotspots();
  assert.ok(Math.abs(parseFloat(properties['--pin-pointer-x']) - 178) < 1e-8, 'label resizing updates pointer');
  run('sceneViewport.width = 1000; hotspotsDirty = true;');
  c.updateHotspots();
  assert.ok(Math.abs(parseFloat(properties['--pin-pointer-x']) - 148) < 1e-8, 'viewport resizing updates pointer');
});

test('camera animations request every frame, including their final frame, independently of lighting', () => {
  const { context: c, run } = controller();
  run(`let renders = 0; splineApp = { requestRender() { renders++; } };
    threeCamera = new THREE.OrthographicCamera();
    currentCamAnim = { startPos: new THREE.Vector3(), targetPos: new THREE.Vector3(10,0,0),
      startQuat: new THREE.Quaternion(), targetQuat: new THREE.Quaternion(), startZoom: 1, targetZoom: 2,
      duration: 0.02, elapsed: 0 };
    lastTime = 0; updateDayNightCycle = updateClockHands = updateObjectInteractions = updateHotspots = updateRoomEffects = () => {};`);
  c.animateLoop(10); c.animateLoop(20); c.animateLoop(30);
  assert.equal(run('renders'), 2);
  assert.equal(run('threeCamera.zoom'), 2);
  assert.equal(run('currentCamAnim'), null);
});

test('chair camera transitions keep pins on the rendered room until Spline finalizes the next frame', () => {
  const { context: c, run, element } = controller();
  c.ResizeObserver = class { observe() {} };
  c.gsap = { matchMedia: () => ({ add() {} }) };
  run(`HOTSPOTS.length = 0; setupHotspots();
    threeCamera = new THREE.OrthographicCamera(-5,5,5,-5,0.1,100); threeCamera.position.z = 10;
    sceneViewport = { width: 500, height: 500 };
    splineApp = { requestRender() {} };
    lastTime = 0; updateDayNightCycle = updateClockHands = updateObjectInteractions = () => {};
    objects.chair = new THREE.Object3D(); objects.computer = new THREE.Object3D();
    objects.computer.position.set(1, 1, 0);
    HOTSPOTS.push(...['chair', 'computer'].map(objKey => ({ objKey, offsetY: 0, bounds: [],
      domElement: document.getElementById(objKey + '-pin'), worldMatrix: new THREE.Matrix4(),
      bubbleSize: { width: 100, height: 44 }, motion: { rise: 0 },
      revealTimeline: { play() {}, reverse() {} }, setBubbleX() {}, setBubbleY() {} })));
    for (const spot of HOTSPOTS) {
      spot.domElement.matches = () => false;
      spot.domElement.style.setProperty = () => {};
    }
    chairSwivel = { start() { return true; }, update() {} };
    sound.playWhoosh = () => {};
    originalActivateHotspot({ id: 'chair', cameraPreset: 'desk', action: spinChair });
    currentCamAnim.targetPos.set(0, -2, 10); currentCamAnim.targetQuat.identity(); currentCamAnim.targetZoom = 1;
    updateHotspots();`);
  const pins = [element('chair-pin'), element('computer-pin')];
  const initial = pins.map(pin => pin.style.transform);

  c.animateLoop(300);
  assert.deepEqual(pins.map(pin => pin.style.transform), initial,
    'an unrendered camera pose must not move any pin');

  // Spline applies its orbit controls before rendering, replacing the pending pose.
  run('threeCamera.position.y = -0.5; threeCamera.updateMatrixWorld(true);');
  element('canvas3d').listeners.rendered();
  assert.deepEqual(pins.map(pin => pin.style.transform), [
    'translate(250px, 225px) translate(-50%, -50%)',
    'translate(300px, 175px) translate(-50%, -50%)'
  ]);
  const rendered = pins.map(pin => pin.style.transform);
  c.animateLoop(1200);
  assert.deepEqual(pins.map(pin => pin.style.transform), rendered,
    'the final camera animation frame must also wait for the render');
  run('threeCamera.position.y = -1; threeCamera.updateMatrixWorld(true);');
  element('canvas3d').listeners.rendered();
  assert.equal(pins[0].style.transform, 'translate(250px, 200px) translate(-50%, -50%)');
});

test('repeated chair activations spin without restarting the active Desk camera', () => {
  const { run, picks } = controller();
  run(`let spins = 0;
    chairSwivel = { start() { spins++; return true; } };
    sound.playWhoosh = () => {};
    setCameraPreset = preset => { picks.push(preset); state.cameraPreset = preset; currentCamAnim = {}; };
    const chair = HOTSPOTS.find(spot => spot.id === 'chair');
    originalActivateHotspot(chair);
    originalActivateHotspot(chair);
    originalActivateHotspot(chair);`);
  assert.equal(run('spins'), 3, 'every activation still spins the chair');
  assert.deepEqual(picks, ['desk'], 'only the first activation should move the camera');
  run(`state.cameraPreset = 'bed'; originalActivateHotspot(chair);`);
  assert.deepEqual(picks, ['desk', 'desk'], 'returning from another view still focuses the desk');
});

test('desk object taps refocus after a completed transition and manual camera movement', () => {
  for (const id of ['projects', 'chair', 'about', 'funProjects']) {
    const { run } = controller();
    run(`
      threeCamera = new THREE.OrthographicCamera();
      const spot = { ...HOTSPOTS.find(spot => spot.id === '${id}'), action: () => true };
      originalActivateHotspot(spot);
      const firstTransition = currentCamAnim;
      originalActivateHotspot(spot);
    `);
    assert.equal(run('currentCamAnim === firstTransition'), true, `${id}: active transition is retained`);
    run(`
      threeCamera.position.copy(currentCamAnim.targetPos);
      threeCamera.quaternion.copy(currentCamAnim.targetQuat);
      threeCamera.zoom = currentCamAnim.targetZoom;
      currentCamAnim = null;
      threeCamera.position.x += 20;
      threeCamera.zoom *= 0.8;
      const movedPosition = threeCamera.position.clone();
      const movedZoom = threeCamera.zoom;
      originalActivateHotspot(spot);
    `);
    assert.equal(run('state.cameraPreset'), 'desk');
    assert.equal(run('currentCamAnim.startPos.equals(movedPosition)'), true, `${id}: refocus starts from the moved camera`);
    assert.equal(run('currentCamAnim.startZoom === movedZoom'), true);
    assert.equal(run('currentCamAnim.targetPos.equals(CAMERA_PRESETS.desk.pos)'), true);
    assert.equal(run('currentCamAnim.targetZoom === CAMERA_PRESETS.desk.zoom * cameraZoomScale'), true);
  }
});

test('overlapping touch targets choose the nearest circle but preserve revealed-label activation', () => {
  const { context: c, run, element } = controller();
  c.firstPin = element('first-pin');
  c.lastPin = element('last-pin');
  run(`sceneViewport = { left: 10, top: 20 };
    HOTSPOTS.splice(0, HOTSPOTS.length,
      { id: 'projects', screenX: 100, screenY: 100, domElement: firstPin },
      { id: 'about', screenX: 116, screenY: 101, domElement: lastPin });`);
  const topmost = run('HOTSPOTS[1]');
  const center = { clientX: 110, clientY: 120, target: { closest: () => null } };
  assert.equal(c.getPinHotspot(center, topmost).id, 'projects');
  assert.equal(c.getPinHotspot({ ...center, clientX: 126 }, topmost).id, 'about');
  assert.equal(c.getPinHotspot({ ...center, target: { closest: () => ({}) } }, topmost).id, 'about');
  c.firstPin.hidden = true;
  assert.equal(c.getPinHotspot(center, topmost).id, 'about');
});

test('controller parts resolve to the Creative Playground pin and open its dialog', () => {
  const { run } = controller();
  run(`
    threeScene = new THREE.Group();
    objects.controller = new THREE.Group();
    objects.controller.name = 'Gaming Controller';
    const controllerPart = new THREE.Mesh(new THREE.BoxGeometry());
    objects.controller.add(controllerPart);
    threeScene.add(objects.controller);
    const trigger = { id: 'hotspot-funProjects' };
    let openedDialog;
    openModal = (name, opener) => { openedDialog = { name, opener }; };
    setCameraPreset = () => {};
    const controllerSpot = findInteractiveParent(controllerPart);
    originalActivateHotspot(controllerSpot, trigger);
  `);
  assert.equal(run('controllerSpot.label'), 'Creative Playground');
  assert.notEqual(run('controllerSpot.pin'), false);
  assert.equal(run('openedDialog.name'), 'funProjects');
  assert.equal(run('openedDialog.opener === trigger'), true);
});

test('creative projects render in Creative Playground with their links', () => {
  const { context: c, element } = controller();
  c.renderContent();
  const funProjects = element('funProjectsGrid').innerHTML;
  assert.match(funProjects, /Timescape/);
  assert.match(funProjects, /Film, Motion & Video Editing/);
  assert.match(funProjects, /Video portfolio/);
  assert.match(funProjects, /Watch Sunbird in the Garden/);
  assert.match(funProjects, /href="https:\/\/github.com\/moulicule\/timescape-Moulik"/);
  assert.doesNotMatch(funProjects, /exhibition-notes\.pdf/);
  assert.doesNotMatch(element('projectsGrid').innerHTML, /Timescape|Film, Motion & Video Editing/);
});

test('both project grids show full descriptions, tags, and links without disclosures or duplicate previews', () => {
  const { context: c, element } = controller();
  c.renderContent();
  for (const [grid, projects] of [['projectsGrid', PORTFOLIO_DATA.projects], ['funProjectsGrid', PORTFOLIO_DATA.funProjects]]) {
    const articles = [...element(grid).innerHTML.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)];
    assert.equal(articles.length, projects.length);
    projects.forEach((project, index) => {
      const article = articles[index][1];
      assert.doesNotMatch(article, /<details\b|<summary\b|\shidden(?:\s|=|>)|project-summary/);
      assert.ok(article.includes(`<p class="project-desc">${project.description}</p>`), 'full description is visible');
      assert.equal(article.split(project.description).length - 1, 1, 'description appears once');
      assert.ok(!article.includes(project.summary), 'short preview is not repeated');
      assert.ok(article.includes(`data-src="${project.image}"`));
      assert.doesNotMatch(article, /\ssrc="/, 'closed dialogs must not start image downloads');
      assert.ok(existsSync(new URL(`../public${project.image}`, import.meta.url)), 'the delivery thumbnail exists');
      assert.ok(article.includes(project.badge));
      for (const tag of project.tags) assert.ok(article.includes(`<span class="project-tag">${tag}</span>`));
      for (const link of project.links) {
        assert.ok(article.includes(`href="${link.url}"`), 'original link is preserved');
        assert.ok(article.includes(`<span>${link.label}</span>`));
      }
    });
  }
});

test('opening a dialog loads only its own deferred images, once', () => {
  const { context: c, run, element } = controller();
  c.HTMLElement = class {};
  const images = new Map();
  for (const id of ['projectsModal', 'funProjectsModal', 'aboutModal']) {
    const image = { dataset: { src: `/${id}.webp` }, loads: 0,
      set src(value) { this.loadedSource = value; this.loads++; },
      removeAttribute() { delete this.dataset.src; } };
    images.set(id, image);
    const modal = element(id);
    const originalQuery = modal.querySelector;
    modal.querySelector = selector => selector === '.modal-nav' ? null : originalQuery(selector);
    modal.querySelectorAll = selector => selector === 'img[data-src]' && image.dataset.src ? [image] : [];
  }
  element('app').children = [];
  run('closeAllModals = () => { activeModal = null; };');
  c.openModal('projects');
  assert.equal(images.get('projectsModal').loads, 1);
  assert.equal(images.get('funProjectsModal').loads, 0);
  assert.equal(images.get('aboutModal').loads, 0);
  c.openModal('about');
  assert.equal(images.get('aboutModal').loads, 1);
  c.openModal('projects');
  assert.equal(images.get('projectsModal').loads, 1, 'reopening reuses the loaded image');
});

test('modal keyboard loop includes disclosure summaries and skips collapsed or disabled descendants', () => {
  const { context, run } = controller();
  const focusable = (id, extra = {}) => ({
    id, tabIndex: 0, disabled: false, getClientRects: () => [{}], closest: () => null,
    focus() { context.document.activeElement = this; }, ...extra
  });
  const first = focusable('first');
  const summary = focusable('summary');
  let open = false;
  const details = { querySelector: () => summary };
  const closedAncestor = selector => selector === 'details:not([open])' && !open ? details : null;
  summary.closest = closedAncestor;
  const hiddenLink = focusable('details-link', { closest: closedAncestor });
  const disabled = focusable('disabled', { disabled: true });
  const offscreen = focusable('hidden', { getClientRects: () => [] });
  context.testDialog = { querySelectorAll(selector) {
    assert.ok(selector.includes('summary'));
    return [first, summary, hiddenLink, disabled, offscreen];
  }};
  run('activeModal = { querySelector: () => testDialog };');
  let prevented = 0;
  context.key = { shiftKey: false, preventDefault() { prevented++; } };
  context.document.activeElement = first;
  run('trapModalFocus(key)');
  assert.equal(prevented, 0, 'Tab from first proceeds naturally toward summary');
  context.document.activeElement = summary;
  run('trapModalFocus(key)');
  assert.equal(context.document.activeElement, first, 'closed summary is the last reachable control');
  open = true;
  context.document.activeElement = summary;
  run('trapModalFocus(key)');
  assert.equal(context.document.activeElement, summary, 'open content participates in natural tab order');
  context.document.activeElement = hiddenLink;
  run('trapModalFocus(key)');
  assert.equal(context.document.activeElement, first);
  context.key.shiftKey = true;
  run('trapModalFocus(key)');
  assert.equal(context.document.activeElement, hiddenLink, 'Shift+Tab wraps to expanded content');
});

test('sky blends preserve Spline RGB and alpha without repeated parsing or warnings', async t => {
  // The installed browser runtime's Color4 import needs a window during module setup.
  globalThis.window = {};
  let SplineColor;
  try {
    ({ i: SplineColor } = await import('../node_modules/@splinetool/runtime/build/runtime-chunk-KMKMRLPZ.js'));
  } finally {
    delete globalThis.window;
  }
  const warn = t.mock.method(console, 'warn', () => {});
  const { context: c, run, element } = controller();
  c.runtimeBackground = new SplineColor();
  run(`
    const skyBackgrounds = [];
    threeScene = { activePage: { bgColor: runtimeBackground } };
    splineApp = {
      setBackgroundColor(color) { skyBackgrounds.push(color); runtimeBackground.setStyle(color); },
      requestRender() {}
    };
    setupLightingAndTheme();
    objects.sunLight = { color: new THREE.Color(), intensity: 0 };
    objects.skyLight = { color: new THREE.Color(), intensity: 0 };
    objects.lampLight1 = { intensity: 0 };
    objects.lampLight2 = { intensity: 0 };
    applyThemeLighting(THEMES.sunset, THEMES.night, 0.5);
  `);
  assert.equal(element('skyClouds').style.opacity, 0.425);
  assert.equal(element('skyStars').style.opacity, 0.575);
  assert.equal(element('skyClouds').style.color,
    run('THEMES.sunset.cloudColor.clone().lerp(THEMES.night.cloudColor, 0.5).getStyle()'));
  assert.equal(element('app').style.background,
    run('THEMES.sunset.bg.clone().lerp(THEMES.night.bg, 0.5).getStyle()'));
  assert.equal(run('skyBackgrounds.length'), 1);
  assert.equal(run('skyBackgrounds[0]'), 'transparent');
  assert.equal(c.runtimeBackground.a, 0);
  assert.equal(c.runtimeBackground.getStyle(), element('app').style.background);
  assert.equal(c.runtimeBackground.r, run('runtimeBackgroundColor.r'));
  assert.ok(Math.abs(run('objects.lampLight1.intensity') - 1.45) < 1e-12);
  run('state.lampOn = false; applyThemeLighting(THEMES.night);');
  assert.equal(run('objects.lampLight1.intensity'), 0);
  assert.equal(element('skyStars').style.opacity, 1, 'lamp toggle does not dim the sky');
  for (const blend of [0, 0.2, 0.8, 1, 0.3]) {
    run(`applyThemeLighting(THEMES.day, THEMES.sunset, ${blend});`);
    assert.equal(c.runtimeBackground.a, 0);
    assert.equal(c.runtimeBackground.getStyle(), element('app').style.background);
  }
  assert.equal(run('skyBackgrounds.length'), 1, 'blending never reparses a background string');
  assert.equal(warn.mock.callCount(), 0);
});

test('interrupting a theme fade captures the visible sky and continues without a jump', () => {
  const { context: c, run, advance, element } = controller();
  run('applyThemeLighting(THEMES.sunset); dayNightCycleStart = 0;');
  c.setTheme('night');
  advance(400); c.updateDayNightCycle(400);
  const visible = {
    bg: element('app').style.background,
    color: element('skyClouds').style.color,
    shadow: element('cloudDitherShadow').getAttribute('fill'),
    clouds: element('skyClouds').style.opacity,
    stars: element('skyStars').style.opacity
  };
  c.setTheme('day');
  c.updateDayNightCycle(400);
  assert.equal(element('app').style.background, visible.bg);
  assert.equal(element('skyClouds').style.color, visible.color);
  assert.equal(element('cloudDitherShadow').getAttribute('fill'), visible.shadow);
  assert.equal(element('skyClouds').style.opacity, visible.clouds);
  assert.equal(element('skyStars').style.opacity, visible.stars);
  advance(900); c.updateDayNightCycle(900);
  assert.equal(element('skyClouds').style.opacity, (visible.clouds + 1) / 2);
  assert.equal(element('skyStars').style.opacity, visible.stars / 2);
  advance(1400); c.updateDayNightCycle(1400);
  assert.equal(element('skyClouds').style.opacity, 1);
  assert.equal(element('skyStars').style.opacity, 0);
  assert.equal(run('themeTransition'), null);
});

test('decorative motion follows page visibility, including an initially hidden page', () => {
  const { context: c, run, element, documentListeners } = controller();
  c.document.hidden = true;
  run('setupModalSectionMotion = () => {}; setupEventListeners();');
  const sky = element('skyAtmosphere');
  assert.ok(sky.classList.contains('is-paused'));
  c.document.hidden = false;
  documentListeners.visibilitychange.forEach(listener => listener());
  assert.equal(sky.classList.contains('is-paused'), false);
  c.document.hidden = true;
  documentListeners.visibilitychange.forEach(listener => listener());
  assert.ok(sky.classList.contains('is-paused'));
});

test('cloud dither shadows blend with each lighting phase', () => {
  const { run, element } = controller();
  const fills = new Set();
  for (const [from, to] of [['night', 'day'], ['day', 'sunset'], ['sunset', 'night']]) {
    for (const blend of [0, 0.5, 1]) {
      run(`applyThemeLighting(THEMES.${from}, THEMES.${to}, ${blend});`);
      const fill = element('cloudDitherShadow').getAttribute('fill');
      assert.equal(fill, run(`THEMES.${from}.cloudShadowColor.clone().lerp(THEMES.${to}.cloudShadowColor, ${blend}).getStyle()`));
      fills.add(fill);
    }
  }
  assert.equal(fills.size, 6, 'three distinct shadow colors and their intermediate blends');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const pattern = html.match(/<pattern id="cloudDitherShadow"[\s\S]*?<\/pattern>/)[0];
  assert.equal((pattern.match(/fill=/g) || []).length, 1, 'dots inherit the animated pattern fill');
});
