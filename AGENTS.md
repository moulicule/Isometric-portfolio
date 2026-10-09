# Project Handoff Guide

## What this project is

This is a static Vite site: an interactive isometric-room portfolio. It has **no backend, database, authentication, API routes, server functions, or environment variables**. Everything runs in the browser.

The architecture is intentionally small:

```text
index.html + src/style.css       DOM shell and visual UI
src/main.js                      application controller and scene integration
public/scene.splinecode          3D room loaded at runtime
src/data.js                      static portfolio/modal content
src/audio.js                     local procedural Web Audio engine
canvas-confetti                  client-only confetti effects
dist/                            generated production output; never hand-edit
```

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

`npm run build` is the only available verification command. It rebuilds `dist/`, including hashed assets. The current build can emit Vite's large-chunk advisory; that is a warning, not a failure.

## Libraries and ownership boundaries

| Concern | Implementation | Notes |
| --- | --- | --- |
| Bundling/dev server | Vite | No framework, TypeScript, or test runner. |
| 3D scene loading/rendering/input | `@splinetool/runtime` | Owns WebGL/WebGPU rendering, the Spline scene graph, and native camera controls. |
| Scene inspection/raycasting/math | `three` | Imported separately in `src/main.js`; used for `Raycaster`, `Vector3`, camera interpolations, and colors. |
| Celebration particles | `canvas-confetti` | Used for projects, plant watering, and contact submission. |
| Sound | Native Web Audio API | Implemented in `src/audio.js`; no media files or audio service. |
| Application UI | Browser DOM + CSS | All modals, tooltips, pins, dock controls, and overlays are custom DOM. |

The project does not use any external backend. The social/project URLs in `src/data.js` are ordinary links, and the contact form only shows a local success effect—it does not send email.

## Files to edit

- `index.html` — fixed DOM shell and all button/modal IDs.
- `src/main.js` — lifecycle, camera behavior, scene object lookups, interactions, rendering loop, modals, and event listeners.
- `src/style.css` — all responsive and visual styling.
- `src/data.js` — developer profile, projects, skills, and books rendered into modals.
- `src/audio.js` — the procedural `SoundEngine` singleton.
- `public/scene.splinecode` — the runtime scene asset actually fetched by the app at `/scene.splinecode`.
- `scene.splinecode` and `scene (1).splinecode` — source/copy assets. Do not assume editing either changes the served scene; copy the finalized asset into `public/scene.splinecode` if the scene is updated.

## Startup and lifecycle (`src/main.js`)

1. `init()` creates the Spline `Application` around `#canvas3d` and awaits `splineApp.load('/scene.splinecode')`.
2. It reads the Spline runtime's scene and active camera into `threeScene` and `threeCamera`.
3. `configureCameraControls()` adjusts the runtime camera controls.
4. `setupSceneReferences()`, `setupHotspots()`, `setupLightingAndTheme()`, `renderContent()`, and `setupEventListeners()` prepare the rest of the page.
5. `animateLoop()` then continuously updates clock hands, chair animation, camera transitions/boundary feedback, and DOM hotspot positions.

If the Spline asset fails to load, only the loader error state is shown. There is no fallback renderer.

## Spline scene contract

`setupSceneReferences()` depends on these exact Spline object names. Renaming any of them in Spline silently breaks its corresponding feature.

| Spline object name | Used for |
| --- | --- |
| `Chair` | Chair rotation animation and chair hotspot |
| `Bed Table` | Lamp hotspot |
| `Point Light 2`, `Point Light 3` | Bedside lamp intensity |
| `Directional Light`, `Directional Light 2` | Theme sun/sky lighting |
| `Computer`, `Bed`, `Plant`, `Books`, `Window`, `Sticky Notes` | Hotspot targets |
| ` Coffee Cup` (leading space) or `Coffee Cup` | Coffee hotspot |
| `Clock`, `Cylinder 19`, `Cylinder 18` | Live clock and its hour/minute hands |

`HOTSPOTS` is the one source of truth for custom DOM pins. Each entry maps a scene name/object cache key to an action. Pins use projected 3D positions in `updateHotspots()`. Scene clicking is not handled by Spline events here: the app raycasts the Spline scene with Three's `Raycaster` and walks parents in `findInteractiveParent()`.

## Camera behavior: preserve this carefully

The camera is an orthographic Spline camera. Its preset transforms are in `CAMERA_PRESETS`; `setCameraPreset()` interpolates position, quaternion, and zoom itself rather than invoking a Spline preset.

The current requested interaction rules are:

- Rotation is enabled.
- Panning is disabled.
- Horizontal and vertical rotation are limited to ±15° around the initial camera view.
- The limits use Spline's elastic mode for a small boundary bounce.
- Zooming out is bounded at 70% of the default zoom (`ZOOM_BOUNDS.min`).
- Zooming out while already at that minimum triggers a short custom zoom bounce; the upper bound still permits the desk and bed preset zooms.

`configureCameraControls()` accesses `splineApp._controls?.orbitControls`. `_controls` is a runtime implementation detail, but it is the current practical integration point. Do **not** replace this wholesale with Three `OrbitControls`: that would create competing input systems and break Spline's camera ownership.

The critical control settings are:

```js
orbitControls.enableRotate = true;
orbitControls.enablePan = false;
orbitControls.zoomLimitsEnabled = true;
orbitControls.rotationLimitsMode = 3; // constrain both axes
orbitControls.rotationSoftLimit = 2;  // elastic feedback
```

The properties `minTheta`, `maxTheta`, `minPhi`, and `maxPhi` are Spline runtime-specific angles; merely setting them does nothing unless `rotationLimitsMode` is nonzero. The initial configuration also sets `rotationRangeFactor` to 3° to make the rotational boundary firm.

`startZoomLimitBounce()` and the `wheel` capture/bubble listeners provide feedback that the Spline control does not natively provide for orthographic zoom limits. Do not remove the capture listener: it records the pre-Spline zoom value, which is how the code knows that the user was already at the boundary.

Spline's elastic rotation mode temporarily clears its internal `isPointerDown` flag once an edge is reached. `keepOrbitDragActive()` restores that flag while the user is still holding a pointer button, so a user can immediately drag back in the opposite direction without releasing and clicking again. Keep this listener paired with the elastic rotation configuration.

When changing preset zoom values, update `CAMERA_PRESETS`; `ZOOM_BOUNDS.max` is derived from the largest preset. If changing the default view, update `DEFAULT_CAM_*` and re-evaluate the 70% minimum.

## Application features (`src/main.js`)

| Area | Functions | Behavior |
| --- | --- | --- |
| Lighting/theme | `setTheme`, `cycleTheme`, `setupLightingAndTheme` | Applies palette colors/intensities to Spline lights and synchronizes rain audio. |
| Lamp | `toggleLamp`, `updateLampLighting` | Sets the two named Spline point-light intensities. |
| Chair | `spinChair` + `animateLoop` | Turns cached chair over one full revolution. |
| Plant | `waterPlant` | Increases local hydration state, computes plant screen location, and fires green confetti. |
| Coffee | `drinkCoffee` | Local sound/toast only. |
| Zen mode | `toggleZenMode` | Activates DOM overlay, ambient audio, and night theme. |
| Modals | `openModal`, `closeAllModals`, `renderContent` | Renders unescaped static data from `PORTFOLIO_DATA`; opens project/skills/about modals. |
| Notifications | `showToast` | Creates DOM toast and removes it after its exit animation. |
| Contact | `window.submitContact` | Called by the inline HTML form handler; cosmetic only, no submission. |

## Input and UI behavior

- `pointermove` raycasts only when not dragging.
- A movement distance over 6 pixels sets `isDragging`, preventing a drag from firing the click action on release.
- Only primary-button `pointerup` activates a hotspot; right click does not activate scene interactions, and the browser context menu is suppressed on the canvas.
- The canvas uses `touch-action: manipulation` and a grab cursor.
- `setupEventListeners()` binds navigation, sound, theme, camera, quick actions, fullscreen, modal closing, and keyboard shortcuts.
- Keyboard shortcuts: `L` lamp, `C` chair spin, `1`–`4` themes, `Escape` closes modals/exits Zen mode.

## Audio (`src/audio.js`)

`sound` is an exported singleton of `SoundEngine`. Its first user gesture initializes/resumes `AudioContext`, keeping it compatible with browser autoplay restrictions.

- `playSwitch`, `playPop`, `playWhoosh`, `playWaterChime` synthesize short effects.
- `toggleAmbient` creates a recurring lofi chord loop using oscillators.
- `toggleRain` creates a looped filtered noise buffer.
- `toggleMute` changes gain levels; it does not destroy or recreate active sources.

Keep all audio local unless the task explicitly asks for externally hosted media.

## Styling and layout (`src/style.css`)

The CSS owns the full-screen canvas layering, glass panels, dock, hotspots, tooltip, loader, rain effect, modals, Zen overlay, and responsive breakpoints. UI elements sit above the canvas and selectively use `pointer-events` so canvas interaction remains reachable. Before changing z-index or pointer-event rules, verify hotspot clicks and dock buttons still work.

## Safe change workflow

1. Change source files only; never manually modify `dist/`.
2. If editing the 3D model, preserve the scene object-name contract above and copy the intended `.splinecode` into `public/`.
3. Run `npm run build`.
4. Check `git diff --check`.
5. Manually check at least: scene load, all three camera presets, constrained orbit/pan/zoom, one hotspot, lamp, theme/rain, modal opening, and mobile/touch behavior.

## Common pitfalls

- Do not add a backend to implement an existing local interaction; there is none to integrate with.
- Do not treat `dist/` as source. Its filenames are content hashes and will change on each build.
- Do not remove `@splinetool/runtime` because the scene is not plain Three.js content.
- Do not expect `threeScene` or `threeCamera` before `await splineApp.load(...)` resolves.
- Do not rename Spline nodes without updating both `objects` and `HOTSPOTS`.
- Do not use Spline controls and a separate camera controller simultaneously.
- `src/data.js` content is inserted via template strings. Keep it trusted/static or add escaping before accepting remote/user-authored content.
