import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForSceneReady } from '../src/scene-ready.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function runtime() {
  const canvas = new EventTarget();
  const app = {
    canvas,
    renderMode: 'auto',
    _sharedAssetsManager: { images: {}, videos: {}, fonts: {}, materials: {} },
    _renderer: { lastFrameIncomplete: false },
    requestRender() { this.renderRequested = true; }
  };
  return { app, frame: () => canvas.dispatchEvent(new Event('rendered')) };
}

test('assets, complete frames, GPU completion, and presentation must all finish', async () => {
  const { app, frame } = runtime();
  const image = deferred(), gpu = deferred(), paint = deferred();
  const asset = { loadPromise: image.promise, loaded: false };
  app._sharedAssetsManager.images.texture = asset;
  app._renderer.backend = { device: { queue: { onSubmittedWorkDone: () => gpu.promise } } };
  let ready = false;
  const result = waitForSceneReady(app, { waitForPaint: () => paint.promise }).then(() => { ready = true; });
  assert.equal(app.renderMode, 'continuous');
  assert.equal(app.renderRequested, true);
  frame(); frame();
  await tick();
  assert.equal(ready, false, 'scene parsing alone must not reveal the room');
  asset.loaded = true;
  image.resolve();
  await tick();
  frame(); frame();
  await tick();
  assert.equal(ready, false, 'CPU rendering is not GPU completion');
  gpu.resolve();
  await tick();
  assert.equal(ready, false, 'the canvas must also have a presentation frame');
  paint.resolve();
  await result;
  assert.equal(ready, true);
  assert.equal(app.renderMode, 'auto');
});

test('incomplete or stalled WebGPU draws cannot count as ready frames', async () => {
  const { app, frame } = runtime();
  let ready = false;
  const result = waitForSceneReady(app, { waitForPaint: async () => {} }).then(() => { ready = true; });
  await tick();
  for (const flag of ['lastFrameIncomplete', '_warmupInFlight', '_compilationHasWork', '_skippedAsyncDraws']) {
    app._renderer[flag] = flag === '_skippedAsyncDraws' ? 1 : true;
    frame(); frame();
    await tick();
    assert.equal(ready, false, `${flag} must keep the card visible`);
    app._renderer[flag] = flag === '_skippedAsyncDraws' ? 0 : false;
  }
  frame();
  await tick();
  assert.equal(ready, false);
  frame();
  await result;
});

test('resolved video/font promises and pending material resources still block readiness', async () => {
  const { app, frame } = runtime();
  const video = { loadPromise: Promise.resolve(), loaded: false };
  const font = { loadingPromise: Promise.resolve(), isLoaded: false };
  let materialLoaded = false, ready = false;
  app._sharedAssetsManager.videos.video = video;
  app._sharedAssetsManager.fonts.font = font;
  app._sharedAssetsManager.materials.material = { assetsLoaded: () => materialLoaded };
  const result = waitForSceneReady(app, { waitForPaint: async () => {} }).then(() => { ready = true; });
  await tick();
  for (const release of [() => { video.loaded = true; }, () => { font.isLoaded = true; }]) {
    frame(); frame();
    await tick();
    assert.equal(ready, false);
    release();
  }
  frame(); frame();
  await tick();
  assert.equal(ready, false);
  materialLoaded = true;
  frame(); frame();
  await result;
});

test('failed assets reject and restore rendering mode rather than reveal the room', async () => {
  const { app } = runtime();
  const image = deferred();
  app._sharedAssetsManager.images.texture = { loadPromise: image.promise, loaded: false };
  const result = waitForSceneReady(app);
  image.reject(new Error('Texture download failed'));
  await assert.rejects(result, /Texture download failed/);
  assert.equal(app.renderMode, 'auto');
});

test('new pending work during presentation keeps the card visible', async () => {
  const { app, frame } = runtime();
  const firstPaint = deferred();
  let ready = false, paints = 0;
  const result = waitForSceneReady(app, { waitForPaint: () => ++paints === 1 ? firstPaint.promise : Promise.resolve() })
    .then(() => { ready = true; });
  await tick();
  frame(); frame();
  await tick();
  app._renderer.lastFrameIncomplete = true;
  firstPaint.resolve();
  await tick();
  assert.equal(ready, false);
  app._renderer.lastFrameIncomplete = false;
  frame(); frame();
  await result;
});

test('a timeout stays failed even when assets arrive late', async () => {
  const { app, frame } = runtime();
  const image = deferred();
  const asset = { loadPromise: image.promise, loaded: false };
  let presentations = 0;
  app._sharedAssetsManager.images.texture = asset;
  await assert.rejects(waitForSceneReady(app, { timeoutMs: 20, waitForPaint: async () => { presentations++; } }), /did not finish/);
  assert.equal(app.renderMode, 'auto');
  asset.loaded = true;
  image.resolve();
  await tick();
  frame(); frame();
  await tick();
  assert.equal(presentations, 0);
});

test('missing runtime readiness information fails closed', async () => {
  await assert.rejects(waitForSceneReady({}), /readiness information is unavailable/);
});
