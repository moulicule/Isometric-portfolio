import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const appSource = readFileSync(new URL('../public/projects/cap/app.js', import.meta.url), 'utf8');
const sceneSource = readFileSync(new URL('../public/projects/cap/scene.js', import.meta.url), 'utf8');

function viewers({ reject = false } = {}) {
  const elements = new Map();
  const calls = [], observed = new Set(), failures = [];
  let callback, imports = 0, margin;
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      id: selector.slice(1), disabled: true,
      classList: { add: value => failures.push(value) },
      setAttribute() {}, querySelector: () => ({ textContent: '' })
    });
    return elements.get(selector);
  };
  const context = createContext({
    $: element, console: { error() {} },
    loadScene() {
      imports++;
      return Promise.resolve({ makeScene: async (host, options) => {
        calls.push({ host, options });
        if (reject) throw new Error('no GPU');
        return { host };
      } });
    },
    IntersectionObserver: class {
      constructor(fn, options) { callback = fn; margin = options.rootMargin; }
      observe(host) { observed.add(host); }
      unobserve(host) { observed.delete(host); }
    }
  });
  const source = appSource.slice(appSource.indexOf('let sceneModule;'), appSource.indexOf('if(window.gsap&&window.ScrollTrigger)'))
    .replace(/import\('\.\/scene\.js\?v=\d+'\)/, 'loadScene()');
  runInContext('let hero, bench, synchronizations = 0; function setBench() { synchronizations++; }\n' + source, context);
  return { element, calls, failures, observed, context, margin,
    get imports() { return imports; },
    async intersect(selector, isIntersecting = true, copies = 1) {
      const target = element(selector);
      if (observed.has(target)) callback(Array.from({ length: copies }, () => ({ target, isIntersecting })));
      await new Promise(setImmediate);
    }
  };
}

test('CAP defers each viewer until near the viewport and imports the scene only once', async () => {
  const v = viewers();
  assert.equal(v.margin, '200px');
  assert.equal(v.imports, 0);
  assert.equal(v.calls.length, 0);
  await v.intersect('#bench-viewer', false);
  assert.equal(v.imports, 0);
  await v.intersect('#hero-viewer', true, 2);
  assert.equal(v.imports, 1);
  assert.equal(v.calls.length, 1);
  assert.equal(v.calls[0].options.hero, true);
  assert.equal(v.element('#hero-zoom-in').disabled, false);
  assert.equal(v.element('#explode').disabled, true);
  await v.intersect('#hero-viewer');
  assert.equal(v.calls.length, 1, 'an initialized viewer must not be recreated');
  await v.intersect('#bench-viewer');
  assert.equal(v.imports, 1);
  assert.equal(v.calls.length, 2);
  assert.equal(v.calls[1].options.hero, false);
  assert.equal(v.element('#explode').disabled, false);
  assert.equal(runInContext('synchronizations', v.context), 1, 'late initialization must apply the current chapter');
});

test('a failed CAP viewer retains its photo fallback and disabled controls', async () => {
  const v = viewers({ reject: true });
  await v.intersect('#hero-viewer');
  assert.deepEqual(v.failures, ['failed']);
  assert.equal(v.element('#hero-zoom-in').disabled, true);
  assert.equal(v.element('#explode').disabled, true);
  assert.equal(v.calls.length, 1);
});

test('CAP does not fetch its model at import time and shares one pending download between viewers', async () => {
  let loads = 0, contexts = 0, resolveModel;
  const pending = new Promise(resolve => { resolveModel = resolve; });
  const context = createContext({
    URL, matchMedia: () => ({ matches: false }),
    GLTFLoader: class { loadAsync() { loads++; return pending; } },
    THREE: { WebGLRenderer: class { constructor() { contexts++; throw new Error('renderer stub'); } } }
  });
  runInContext(sceneSource.replace(/^import .*;\n/gm, '').replace('export async function', 'async function')
    .replaceAll('import.meta.url', "'https://example.test/scene.js'"), context);
  assert.equal(loads, 0);
  const hero = assert.rejects(context.makeScene({}, { hero: true }), /renderer stub/);
  const bench = assert.rejects(context.makeScene({}), /renderer stub/);
  assert.equal(loads, 1);
  assert.equal(contexts, 0, 'no graphics context is needed while the shared model downloads');
  resolveModel({});
  await Promise.all([hero, bench]);
  assert.equal(contexts, 2);
});

test('CAP redraws only for face updates, control changes, and transitions, and pauses off screen', () => {
  let renders = 0, paints = 0;
  const context = createContext({ document: { hidden: false }, controls: { update() {} }, texture: {},
    renderer: { render() { renders++; } }, paint() { paints++; }, scene: {}, camera: {} });
  const frame = sceneSource.slice(sceneSource.indexOf('  function frame(now)'), sceneSource.indexOf('  renderer.setAnimationLoop(frame)'));
  runInContext('let visible = true, reduced = false, lastPaint = 0, dirty = false; function invalidate() { dirty = true; }\n' + frame, context);
  for (let now = 0; now < 1000; now += 10) context.frame(now);
  assert.equal(renders, 12, 'unchanged 3D frames should follow the existing face cadence');
  assert.equal(renders, paints);
  runInContext('dirty = true;', context); context.frame(995);
  assert.equal(renders, 13, 'a control or tween change renders between face updates');
  runInContext('visible = false; dirty = true;', context); context.frame(1100);
  context.document.hidden = true;
  runInContext('visible = true;', context); context.frame(1200);
  assert.equal(renders, 13);
  context.document.hidden = false;
  runInContext('reduced = true;', context); context.frame(1300); context.frame(1400);
  assert.equal(renders, 14, 'reduced motion renders a dirty frame and then rests');
  assert.equal(paints, 12);
});
