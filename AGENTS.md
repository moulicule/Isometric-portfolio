# Project Handoff Guide

## What this project is

This is a static Vite site: an interactive isometric-room portfolio. It has **no backend, database, authentication, API routes, server functions, or environment variables**. Everything runs in the browser.

The architecture is intentionally small:

```text
index.html + src/style.css       DOM shell and visual UI
src/main.js                      application controller and scene integration
src/day-night-cycle.js           ten-minute lighting phase calculation
src/scene-ready.js               asset/render readiness gate for the loading card
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

`npm run build` rebuilds `dist/`, including hashed assets. The current build can emit Vite's large-chunk advisory; that is a warning, not a failure. The readiness adapter also has dependency-free regression checks: `node --test tests/scene-ready.test.mjs`.

## Libraries and ownership boundaries

| Concern | Implementation | Notes |
| --- | --- | --- |
| Bundling/dev server | Vite | No framework, TypeScript, or test runner. |
| 3D scene loading/rendering/input | `@splinetool/runtime` | Owns WebGL/WebGPU rendering, the Spline scene graph, and native camera controls. |
| Scene inspection/raycasting/math | `three` | Imported separately in `src/main.js`; used for `Raycaster`, `Vector3`, camera interpolations, and colors. |
| Celebration particles | `canvas-confetti` | Used for projects and plant watering. |
| Hotspot reveal animations | `gsap` | Reversible timelines for circle-to-pin reveals; honors reduced motion. |
| Sound | Native Web Audio API | Implemented in `src/audio.js`; no media files or audio service. |
| Application UI | Browser DOM + CSS | All modals, tooltips, pins, dock controls, and overlays are custom DOM. |

The project does not use any external backend. The social/project URLs in `src/data.js` are ordinary links. Contact uses a direct `mailto:` link to `PORTFOLIO_DATA.developer.email`, opening the visitor's email app.

## Files to edit

- `index.html` — fixed DOM shell and all button/modal IDs.
- `src/main.js` — lifecycle, camera behavior, scene object lookups, interactions, rendering loop, modals, and event listeners.
- `src/day-night-cycle.js` — ten-minute sunset → night → day → sunset timing and smooth blend calculation. Checks: `node --test tests/day-night-cycle.test.mjs`.
- `src/scene-ready.js` — awaits scene media/fonts, material resources, completed renderer frames, GPU submission, and browser presentation before dismissing the card.
- `src/style.css` — all responsive and visual styling.
- `src/data.js` — developer profile, projects, and skills rendered into modals.
- `src/audio.js` — the procedural `SoundEngine` singleton.
- `public/scene.splinecode` — the runtime scene asset actually fetched by the app at `/scene.splinecode`.
- `scene.splinecode` and `scene (1).splinecode` — source/copy assets. Do not assume editing either changes the served scene; copy the finalized asset into `public/scene.splinecode` if the scene is updated.

## Startup and lifecycle (`src/main.js`)

1. `initPage()` renders portfolio content and binds DOM navigation/dialog controls immediately, then starts `init()`.
2. `init()` dynamically imports the Spline runtime, creates its `Application`, and awaits `splineApp.load('/scene.splinecode')`. Renderer construction/import/load failures are caught without blocking About or contact.
3. It reads the runtime scene/camera, applies the default and responsive zoom, configures camera controls, and caches scene references/hotspots/lighting.
4. `setupSceneInput()` binds canvas input **after Spline**. This preserves the wheel handler order: app capture → Spline wheel handling → app boundary feedback.
5. The app enters `data-scene-state="preparing"`: the canvas can render behind the still-visible card, while room input remains inert. `waitForSceneReady()` awaits image/video/font resources and checks material resources and pending WebGPU work on Spline's `rendered` events. It requires two consecutive complete frames, GPU queue completion when applicable, and a browser presentation frame. Only then does the app enter `ready`, enable room controls, hide the card, and start `animateLoop()`.

The static HTML loading card includes the confirmed name, direct email, and LinkedIn link, so those remain usable without the application module or JavaScript. Keep these initial HTML values in sync with `PORTFOLIO_DATA.developer`; `renderContent()` updates name/email when JavaScript runs. No replacement renderer is used on failure. The card instead explains the error and offers Reload room; after 12 seconds a stalled load also offers reload. Navigation and modals stay usable in both cases.

Canvas, hotspots, utility controls, and the dock start inert and the scene controls stay hidden until ready. `setBaseInert()` updates the saved background state if a modal is open when loading completes, so the newly ready room does not become interactive behind that dialog. Closing a loading-card dialog after readiness returns focus to the About navigation button because the card's opener has disappeared.

`Application.load()` alone is insufficient for visual readiness in Spline 2.0.60: media/fonts and WebGPU shaders may still be pending. The readiness adapter temporarily uses Spline's continuous render mode and restores its original mode afterward. Do not hide the preparing canvas with opacity/visibility/display: that can defer rendering and prevent completion. Instead, `#loadingBackdrop` stays opaque above the canvas until readiness, then fades out in the same frame and with the same transition as `#loadingScreen`. Navigation and dialogs stay above the backdrop. The adapter uses runtime internals (`_sharedAssetsManager`, `_renderer`, pending pipeline flags); revalidate them when upgrading Spline. Stalled/failed readiness keeps the contact card and backdrop available and routes to the existing error/reload state after 60 seconds; the deadline never hides them.

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

`HOTSPOTS` is the one source of truth for custom DOM pins. All visible hotspots, including About Me, Projects, and Skills, use concentric-circle markers that reveal labels above their objects on object/marker hover or keyboard focus. GSAP animates ring/label transforms and opacity on reversible timelines; projected geometry bounds set the default label clearance while the circle anchor stays fixed. Projects, Skills, Chair, Plant, Bed, and Lamp use calibrated `revealOffsetY` heights so labels stay close to the interaction area; the lamp clears its shade above the bedside-table pivot. Coffee uses `offsetX` to center both its circle and label over the cup body rather than its handle, scaled with camera zoom. Reduced-motion users get the same raised labels immediately. `secondary` selects this presentation; `pin: false` keeps the Window interaction without a DOM marker. Each entry maps a scene name/object cache key to an action. Pins use projected 3D positions in `updateHotspots()`. Scene clicking is not handled by Spline events here: the app raycasts the Spline scene with Three's `Raycaster` and walks parents in `findInteractiveParent()`.

## Camera behavior: preserve this carefully

The camera is an orthographic Spline camera. Its preset transforms are in `CAMERA_PRESETS`; `setCameraPreset()` interpolates position, quaternion, and zoom itself rather than invoking a Spline preset. Compact layouts apply `cameraZoomScale` to each preset zoom. `syncResponsiveCameraZoom()` fits the served room's base footprint (`OVERVIEW_FRAME_SIZE`, currently 840px including orbit margin) to the available space above the dock. A canvas `ResizeObserver` rescales current zoom and active animations without resetting the original rotation limits.

The current requested interaction rules are:

- Rotation is enabled.
- Panning is disabled.
- Horizontal and vertical rotation are limited to ±15° around the initial camera view.
- The limits use Spline's elastic mode for a small boundary bounce.
- Zooming out is bounded at 70% of the default zoom for the current viewport (`ZOOM_BOUNDS.min`).
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

When changing preset zoom values, update `CAMERA_PRESETS`; `ZOOM_BOUNDS.max` is derived from the largest preset and the current responsive scale. If changing the default view or scene asset, update `DEFAULT_CAM_*`, recalibrate `OVERVIEW_FRAME_SIZE`, and re-evaluate the 70% minimum.

## Application features (`src/main.js`)

| Area | Functions | Behavior |
| --- | --- | --- |
| Lighting/theme | `setTheme`, `cycleTheme`, `setupLightingAndTheme`, `updateDayNightCycle` | Boots at Sunset; after readiness, blends Sunset → Night → Day → Sunset over ten minutes. Manual theme selection fades the current background and lighting into the selected phase over 1 second, then resumes the cycle; repeated clicks retarget from the visible colours. Zen fades to Night, holds it, and resumes from Night on exit. |
| Lamp | `toggleLamp`, `updateLampLighting` | Sets the two named Spline point-light intensities. |
| Chair | `spinChair` + `animateLoop` | Turns cached chair over one full revolution. |
| Plant | `waterPlant` | Increases local hydration state, computes plant screen location, and fires green confetti. |
| Coffee | `drinkCoffee` | Local sound/toast only. |
| Zen mode | `toggleZenMode` | Activates DOM overlay, ambient audio, and night theme; focuses Wake Up and restores focus on exit. Repeated exit requests do nothing. |
| Modals | `openModal`, `closeAllModals`, `trapModalFocus`, `renderContent` | Renders trusted static data, opens named dialogs, makes background content inert, contains keyboard focus, and restores the opener on close. |
| Notifications | `showToast` | Creates DOM toast in a polite live region and removes it after its exit animation. |
| Contact | `renderContent` | Renders a direct email link from `PORTFOLIO_DATA.developer.email`; no form or simulated submission. |

## Input and UI behavior

- `pointermove` raycasts only when not dragging.
- A movement distance over 6 pixels sets `isDragging`, preventing a drag from firing the click action on release.
- Only primary-button `pointerup` activates a hotspot; right click does not activate scene interactions, and the browser context menu is suppressed on the canvas.
- The canvas uses `touch-action: manipulation` and a grab cursor.
- `setupEventListeners()` binds navigation, sound, theme, camera, quick actions, fullscreen, modal closing, and keyboard shortcuts.
- Keyboard shortcuts: `L` lamp, `C` chair spin, `1`–`3` themes. Shortcuts ignore editable fields, composition, repeats, modifier chords, open dialogs, and any open dock menu.
- Escape closes the active dialog, then the open dock menu, then Zen mode (one active layer per keypress). It has no effect when none are active.
- Dialog backdrops start inert. `openModal()` saves the background's inert state and focuses the dialog after it becomes visible. Tab/Shift+Tab wrap through the close button, scrollable content region, and links. Closing restores the opener; a matching navigation button is the fallback if a resized/hidden hotspot cannot receive focus.
- Lighting, Camera View, and Interactions share dropdown behavior: Up/Down, Home/End, Enter/Space activation, Escape, and Tab back into the page. Only one menu opens at a time; closed menus are inert. Theme and camera options use `menuitemradio` and `aria-checked`; accessible names track the selection. Lighting keeps a light-bulb icon; Camera View keeps a camera icon. Lamp uses `aria-checked`; audio, Pins, and fullscreen controls synchronize `aria-pressed` with their visual states.

## Audio (`src/audio.js`)

`sound` is an exported singleton of `SoundEngine`. Its first user gesture initializes/resumes `AudioContext`, keeping it compatible with browser autoplay restrictions.

- `playSwitch`, `playPop`, `playWhoosh`, `playWaterChime` synthesize short effects.
- `toggleAmbient` creates a recurring lofi chord loop using oscillators.
- `toggleMute` changes gain levels; it does not destroy or recreate active sources.

Keep all audio local unless the task explicitly asks for externally hosted media.

## Styling and layout (`src/style.css`)

The CSS owns the full-screen canvas layering, glass panels, dock, hotspots, tooltip, loader, modals, Zen overlay, and responsive breakpoints. UI elements sit above the canvas and selectively use `pointer-events` so canvas interaction remains reachable. Before changing z-index or pointer-event rules, verify hotspot clicks and dock buttons still work.

Compact layouts (width up to 840px or height up to 500px) use 44px icon controls and named `.dock-label` spans, and initially hide markers. The three dock menus fit on one row on phones; dropdown menus stay within the viewport. The Pins button sits in the top-right controls between Fullscreen and Lofi and reveals keyboard-accessible circle markers. Toasts sit below the four utility controls. Circles stay anchored to their objects, with expanded labels kept inside the viewport. The app uses dynamic viewport height and safe-area spacing.

Dialog close targets are 44px, content is selectable, and scroll regions are focusable. Small phones use tighter dialog padding; skill grids shrink to available width. Dialog/menu visibility becomes immediate on opening; descendant hover transitions exclude inherited visibility so focus is available immediately.

## Safe change workflow

1. Change source files only; never manually modify `dist/`.
2. If editing the 3D model, preserve the scene object-name contract above and copy the intended `.splinecode` into `public/`.
3. Run `npm run build`.
4. Check `git diff --check`.
5. Manually check at least: scene load, all three camera presets, constrained orbit/pan/zoom, one hotspot, lamp, themes, modal opening, and mobile/touch behavior.

## Common pitfalls

- Do not add a backend to implement an existing local interaction; there is none to integrate with.
- Do not treat `dist/` as source. Its filenames are content hashes and will change on each build.
- Do not remove `@splinetool/runtime` because the scene is not plain Three.js content.
- Do not expect `threeScene` or `threeCamera` before `await splineApp.load(...)` resolves.
- Do not rename Spline nodes without updating both `objects` and `HOTSPOTS`.
- Do not use Spline controls and a separate camera controller simultaneously.
- `src/data.js` content is inserted via template strings. Keep it trusted/static or add escaping before accepting remote/user-authored content.
