// Spline 2.0.60 resolves load() before all media/fonts and WebGPU pipelines finish.
// Keep runtime internals used for readiness together, separate from camera input.
export function waitForSceneReady(app, {
  timeoutMs = 60000,
  waitForPaint = () => new Promise(resolve => requestAnimationFrame(resolve))
} = {}) {
  const shared = app._sharedAssetsManager;
  const renderer = app._renderer;
  if (!shared || !renderer) return Promise.reject(new Error('Scene readiness information is unavailable.'));

  const media = [...Object.values(shared.images), ...Object.values(shared.videos)];
  const fonts = Object.values(shared.fonts);
  const assetPromises = [...media.map(asset => asset.loadPromise), ...fonts.map(font => font.loadingPromise)];
  const originalRenderMode = app.renderMode;

  return new Promise((resolve, reject) => {
    let assetsResolved = false;
    let completeFrames = 0;
    let presenting = false;
    let settled = false;
    let pendingReason = 'waiting for the first rendered frame';
    const resourcesReady = () => {
      // Spline may treat stalled shader work as a final frame to keep its loop
      // alive. Raw pending work still means the room is incomplete.
      const incomplete = renderer.lastFrameIncomplete === true || renderer._warmupInFlight === true
        || renderer._compilationHasWork === true || (renderer._skippedAsyncDraws ?? 0) > 0;
      const mediaPending = media.some(asset => asset.loaded !== true);
      const fontsPending = fonts.some(font => font.isLoaded !== true);
      const materialsPending = Object.values(shared.materials).some(material =>
        typeof material.assetsLoaded === 'function' && !material.assetsLoaded());
      pendingReason = `assets=${assetsResolved}, media=${mediaPending}, fonts=${fontsPending}, materials=${materialsPending}, incomplete=${incomplete}`;
      return assetsResolved && !incomplete && !mediaPending && !fontsPending && !materialsPending;
    };
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      app.canvas.removeEventListener('rendered', onRendered);
      app.renderMode = originalRenderMode;
      if (error) reject(error);
      else resolve();
    };
    const onRendered = async () => {
      if (settled || presenting) return;
      try {
        if (!resourcesReady()) {
          completeFrames = 0;
          return;
        }
        if (++completeFrames < 2) return;
        presenting = true;
        // The WebGPU render event means commands were submitted; wait for the GPU
        // to finish them and give the browser a presentation frame before reveal.
        await renderer.backend?.device?.queue?.onSubmittedWorkDone?.();
        await waitForPaint();
        if (!resourcesReady()) {
          presenting = false;
          completeFrames = 0;
          return;
        }
        finish();
      } catch (error) {
        finish(error);
      }
    };
    const deadline = setTimeout(() => finish(new Error(`The room assets or rendering did not finish loading (${pendingReason}).`)), timeoutMs);
    app.canvas.addEventListener('rendered', onRendered);
    // Auto mode can become idle before our final camera/lighting changes render.
    // Restore it only after readiness, or on failure; no second renderer is used.
    Promise.all(assetPromises).then(() => { assetsResolved = true; }, finish);
    try {
      app.renderMode = 'continuous';
      app.requestRender();
    } catch (error) {
      finish(error);
    }
  });
}
