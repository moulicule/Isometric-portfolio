import * as THREE from 'three';
import { gsap } from 'gsap';
import { sound } from './audio.js';
import { PORTFOLIO_DATA } from './data.js';
import { waitForSceneReady } from './scene-ready.js';
import { DAY_NIGHT_CYCLE_MS, DAY_NIGHT_PHASES, getDayNightPhase } from './day-night-cycle.js';
import { createChairSwivel, createWallClock } from './scene-motion.js';

// DOM References
const appEl = document.getElementById('app');
const canvas = document.getElementById('canvas3d');
const loadingScreen = document.getElementById('loadingScreen');
const loadingBackdrop = document.getElementById('loadingBackdrop');
const loadingStatus = document.getElementById('loadingStatus');
const loaderSpinner = document.getElementById('loaderSpinner');
const loadingAboutBtn = document.getElementById('loadingAboutBtn');
const retrySceneBtn = document.getElementById('retrySceneBtn');
const hotspotContainer = document.getElementById('hotspotContainer');
const hoverTooltip = document.getElementById('hoverTooltip');
const toastContainer = document.getElementById('toastContainer');
const zenOverlay = document.getElementById('zenOverlay');
const zenClock = document.getElementById('zenClock');

// Modals
const projectsModal = document.getElementById('projectsModal');
const skillsModal = document.getElementById('skillsModal');
const aboutModal = document.getElementById('aboutModal');
let activeModal = null;
let modalReturnFocus = null;
let modalReturnFallback = null;
const modalBackgroundState = new Map();
let zenReturnFocus = null;

// Buttons
const lofiBtn = document.getElementById('lofiBtn');
const muteBtn = document.getElementById('muteBtn');
const toggleLampBtn = document.getElementById('toggleLampBtn');
const spinChairBtn = document.getElementById('spinChairBtn');
const waterPlantBtn = document.getElementById('waterPlantBtn');
const togglePinsBtn = document.getElementById('togglePinsBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const exitZenBtn = document.getElementById('exitZenBtn');
const dockDropdowns = [...document.querySelectorAll('.bottom-dock .dropdown')];
const compactLayoutMedia = window.matchMedia('(max-width: 840px), (max-height: 500px)');

// Nearby alternatives keep compact 44px markers from covering one another.
const COMPACT_PIN_OFFSETS = [-2, -1, 0, 1, 2]
  .flatMap(x => [-2, -1, 0, 1, 2].map(y => ({ x: x * 52, y: y * 52 })))
  .sort((a, b) => a.x * a.x + a.y * a.y - b.x * b.x - b.y * b.y);

// Spline & Three.js State
let splineApp = null;
let threeScene = null;
let threeCamera = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Drag tracking is retained only to avoid treating a drag as an object click.
let isPointerDown = false;
let isDragging = false;
const pointerStart = { x: 0, y: 0 };

// Room State
const state = {
  lampOn: true,
  theme: 'sunset',
  cameraPreset: 'iso',
  plantHydration: 80,
  pinsVisible: !compactLayoutMedia.matches,
  zenMode: false,
  hoveredInteractive: null
};
let dayNightCycleStart = null;
let chairSwivel = null;
let wallClock = null;
let lastClockSecond = null;

// Base Camera Settings
const DEFAULT_CAM_POS = new THREE.Vector3(585.13, 336.63, 729.21);
const DEFAULT_CAM_ROT = new THREE.Euler(
  THREE.MathUtils.degToRad(-29.57),
  THREE.MathUtils.degToRad(34.53),
  THREE.MathUtils.degToRad(17.83)
);
const DEFAULT_CAM_ZOOM = 2.1096;
// The served room occupies an approximately 800px square at the base zoom.
// Leave a little extra space for its constrained orbit when fitting small screens.
const OVERVIEW_FRAME_SIZE = 840;

// Camera Target Presets
const CAMERA_PRESETS = {
  iso: {
    pos: new THREE.Vector3(585.13, 336.63, 729.21),
    rot: new THREE.Euler(
      THREE.MathUtils.degToRad(-29.57),
      THREE.MathUtils.degToRad(34.53),
      THREE.MathUtils.degToRad(17.83)
    ),
    zoom: DEFAULT_CAM_ZOOM
  },
  desk: {
    pos: new THREE.Vector3(260, 190, 480),
    rot: new THREE.Euler(
      THREE.MathUtils.degToRad(-22.0),
      THREE.MathUtils.degToRad(28.0),
      THREE.MathUtils.degToRad(12.0)
    ),
    zoom: 3.2
  },
  bed: {
    pos: new THREE.Vector3(520, 170, 420),
    rot: new THREE.Euler(
      THREE.MathUtils.degToRad(-22.0),
      THREE.MathUtils.degToRad(48.0),
      THREE.MathUtils.degToRad(16.0)
    ),
    zoom: 2.8
  }
};

let currentCamAnim = null;
let zoomBounce = null;
let cameraZoomScale = 1;
const ZOOM_BOUNDS = {
  min: DEFAULT_CAM_ZOOM * 0.7,
  max: Math.max(...Object.values(CAMERA_PRESETS).map(({ zoom }) => zoom)) * 1.1
};

// Lighting Palettes
const THEMES = {
  night: {
    bg: new THREE.Color('#30262c'),
    sunColor: new THREE.Color(0.25, 0.35, 0.7),
    sunIntensity: 0.35,
    skyColor: new THREE.Color(0.15, 0.22, 0.45),
    skyIntensity: 0.25,
    lampIntensity: 1.6,
    label: 'Cozy Night'
  },
  day: {
    bg: new THREE.Color('#8a674e'),
    sunColor: new THREE.Color(1.0, 0.96, 0.88),
    sunIntensity: 1.3,
    skyColor: new THREE.Color(0.55, 0.78, 1.0),
    skyIntensity: 0.65,
    lampIntensity: 0.15,
    label: 'Bright Daylight'
  },
  sunset: {
    bg: new THREE.Color('#70452e'),
    sunColor: new THREE.Color(1.0, 0.5, 0.22),
    sunIntensity: 1.2,
    skyColor: new THREE.Color(0.85, 0.35, 0.65),
    skyIntensity: 0.55,
    lampIntensity: 1.3,
    label: 'Golden Sunset'
  }
};
const cycleBackgroundColor = new THREE.Color();
let appliedBackground = null;
let themeTransition = null;
const THEME_FADE_MS = 1000;

// Cached scene object pointers
const objects = {
  chair: null,
  bedTable: null,
  lampLight1: null,
  lampLight2: null,
  sunLight: null,
  skyLight: null,
  computer: null,
  bed: null,
  plant: null,
  clock: null,
  clockHour: null,
  clockMin: null,
  books: null,
  coffee: null,
  window: null,
  stickyNotes: null
};

// Hotspot definitions mapped to 3D room objects
const HOTSPOTS = [
  { id: 'projects', name: 'Computer', label: 'Projects', icon: '💻', objKey: 'computer', cameraPreset: 'desk', offsetY: 0, revealOffsetY: 27, secondary: true, action: trigger => openModal('projects', trigger) },
  { id: 'lamp', name: 'Bed Table', label: 'Bedside Lamp', icon: '💡', objKey: 'bedTable', offsetY: 50, revealOffsetY: 65, secondary: true, action: () => toggleLamp() },
  { id: 'chair', name: 'Chair', label: 'Swivel Chair', icon: '🪑', objKey: 'chair', cameraPreset: 'desk', offsetY: 0, revealOffsetY: 45, secondary: true, action: () => spinChair() },
  { id: 'skills', name: 'Books', label: 'Skills', icon: '📚', objKey: 'books', cameraPreset: 'desk', offsetY: 0, revealOffsetY: 27, secondary: true, action: trigger => openModal('skills', trigger) },
  { id: 'plant', name: 'Plant', label: 'House Plant', icon: '🌱', objKey: 'plant', offsetY: 0, revealOffsetY: 50, secondary: true, action: () => waterPlant() },
  { id: 'bed', name: 'Bed', label: 'Zen Mode', icon: '🛏️', objKey: 'bed', cameraPreset: 'bed', offsetY: 0, revealOffsetY: 25, secondary: true, action: () => toggleZenMode() },
  { id: 'window', name: 'Window', label: 'Atmosphere & Sky', icon: '🌤️', objKey: 'window', pin: false, action: () => cycleTheme() },
  { id: 'coffee', name: ' Coffee Cup', label: 'Coffee Break', icon: '☕', objKey: 'coffee', cameraPreset: 'desk', offsetY: 0, offsetX: -6, secondary: true, action: () => drinkCoffee() },
  { id: 'about', name: 'Sticky Notes', label: 'About Me', icon: '👤', objKey: 'stickyNotes', cameraPreset: 'desk', offsetY: 0, secondary: true, action: trigger => openModal('about', trigger) }
];

function activateHotspot(spot, trigger = null) {
  sound.playPop();
  if (spot.cameraPreset) setCameraPreset(spot.cameraPreset);
  spot.action(trigger);
}

// The DOM portfolio is usable before renderer download, construction, or loading.
function initPage() {
  renderContent();
  setupEventListeners();
  appEl.classList.add('ui-ready');
  loadingAboutBtn.hidden = false;
  retrySceneBtn.addEventListener('click', () => window.location.reload());
  init();
}

// Update the baseline without re-enabling room input behind an open dialog.
function setBaseInert(element, isInert) {
  if (modalBackgroundState.has(element)) modalBackgroundState.set(element, isInert);
  else element.inert = isInert;
}

// Initialize Spline independently of portfolio content and navigation.
async function init() {
  loaderSpinner.hidden = false;
  loadingStatus.textContent = 'Loading the interactive room. About and contact are available now.';
  const slowLoadTimer = setTimeout(() => {
    loadingStatus.textContent = 'The room is taking longer than usual. You can still browse About or contact me.';
    retrySceneBtn.hidden = false;
  }, 12000);
  try {
    const { Application } = await import('@splinetool/runtime');
    splineApp = new Application(canvas);
    await splineApp.load('/scene.splinecode');

    threeScene = splineApp._scene;
    threeCamera = splineApp._camera;
    if (!threeScene || !threeCamera) throw new Error('The room scene or camera is unavailable.');
    threeCamera.zoom = DEFAULT_CAM_ZOOM;
    syncResponsiveCameraZoom();
    configureCameraControls();
    setupSceneReferences();
    updateClockHands();
    setupHotspots();
    setupLightingAndTheme();
    setupSceneInput();
    new ResizeObserver(syncResponsiveCameraZoom).observe(canvas);
    loadingStatus.textContent = 'Preparing room assets, materials, and lighting…';
    appEl.dataset.sceneState = 'preparing';
    await waitForSceneReady(splineApp);
    appEl.dataset.sceneState = 'ready';
    for (const element of [canvas, hotspotContainer, document.querySelector('.top-nav-right'), document.querySelector('.bottom-dock')]) {
      setBaseInert(element, false);
    }
    loadingStatus.textContent = 'The interactive room is ready.';
    loadingBackdrop.classList.add('hidden');
    loadingScreen.classList.add('hidden');
    setBaseInert(loadingScreen, true);
    // A loading-card opener disappears here; preserve keyboard access.
    if (!activeModal && loadingScreen.contains(document.activeElement)) {
      document.querySelector('#sideNav [data-modal="about"]').focus({ preventScroll: true });
    }

    // Start render/update loop
    dayNightCycleStart = performance.now();
    lastTime = dayNightCycleStart;
    requestAnimationFrame(animateLoop);
  } catch (err) {
    console.error('Failed to initialize Spline scene:', err);
    appEl.dataset.sceneState = 'error';
    loadingStatus.textContent = 'The 3D room could not load. About and contact are still available, or you can try loading the room again.';
    retrySceneBtn.hidden = false;
    threeScene = null;
    threeCamera = null;
    splineApp?.dispose();
    splineApp = null;
  } finally {
    clearTimeout(slowLoadTimer);
    loaderSpinner.hidden = true;
  }
}

// Fit the room's measured base footprint to compact layouts, leaving space
// for the top controls and dock.
function syncResponsiveCameraZoom() {
  if (!threeCamera) return;

  const rect = canvas.getBoundingClientRect();
  let nextScale = 1;
  if (compactLayoutMedia.matches && rect.height > 0) {
    const dockRect = document.querySelector('.bottom-dock').getBoundingClientRect();
    const topRect = document.querySelector('.top-nav-right').getBoundingClientRect();
    const availableWidth = Math.max(1, rect.width - 32);
    const availableHeight = Math.max(1, dockRect.top - topRect.bottom - 32);
    nextScale = Math.min(1, availableWidth / OVERVIEW_FRAME_SIZE, availableHeight / OVERVIEW_FRAME_SIZE);
  }

  const ratio = nextScale / cameraZoomScale;
  cameraZoomScale = nextScale;
  ZOOM_BOUNDS.min = DEFAULT_CAM_ZOOM * cameraZoomScale * 0.7;
  ZOOM_BOUNDS.max = Math.max(...Object.values(CAMERA_PRESETS).map(({ zoom }) => zoom)) * cameraZoomScale * 1.1;

  // Preserve the user's relative zoom and any transition when rotating/resizing.
  threeCamera.zoom *= ratio;
  if (currentCamAnim) {
    currentCamAnim.startZoom *= ratio;
    currentCamAnim.targetZoom *= ratio;
  }
  if (zoomBounce) zoomBounce.startZoom *= ratio;
  threeCamera.updateProjectionMatrix();

  // Only update zoom bounds here; keep the original rotation limits anchored.
  const orbitControls = splineApp?._controls?.orbitControls;
  if (orbitControls) {
    orbitControls.minZoom = ZOOM_BOUNDS.min;
    orbitControls.maxZoom = ZOOM_BOUNDS.max;
  }
}

// Allow a small inspection orbit without allowing the camera to pan away from
// the centered composition.
function configureCameraControls() {
  const orbitControls = splineApp._controls?.orbitControls;
  if (!orbitControls) return;

  const rotationLimit = THREE.MathUtils.degToRad(15);
  const wrapAngle = THREE.MathUtils.euclideanModulo;

  orbitControls.enabled = true;
  orbitControls.enableRotate = true;
  orbitControls.enablePan = false;

  // Preserve the starting framing and the closest preset view without letting
  // the orthographic camera zoom endlessly away from the house.
  orbitControls.zoomLimitsEnabled = true;
  orbitControls.minZoom = ZOOM_BOUNDS.min;
  orbitControls.maxZoom = ZOOM_BOUNDS.max;

  // Spline only applies min/max orbit angles when its limit mode is enabled.
  // Its elastic soft limit gives a small bounce at the ±15° edge. A short
  // response range makes the resistance ramp up quickly and feel stiffer.
  orbitControls.rotationLimitsMode = 3;
  orbitControls.rotationSoftLimit = 2;
  orbitControls.rotationRangeFactor.setScalar(THREE.MathUtils.degToRad(3));
  orbitControls.minTheta = wrapAngle(orbitControls.spherical.theta - rotationLimit + Math.PI, Math.PI * 2) - Math.PI;
  orbitControls.maxTheta = wrapAngle(orbitControls.spherical.theta + rotationLimit + Math.PI, Math.PI * 2) - Math.PI;
  orbitControls.minPhi = orbitControls.spherical.phi - rotationLimit;
  orbitControls.maxPhi = orbitControls.spherical.phi + rotationLimit;
  orbitControls.isThetaFlipped = orbitControls.minTheta > orbitControls.maxTheta;
}

// Find and cache scene objects
function setupSceneReferences() {
  if (!threeScene) return;

  objects.chair = threeScene.getObjectByName('Chair');
  objects.bedTable = threeScene.getObjectByName('Bed Table');
  objects.lampLight1 = threeScene.getObjectByName('Point Light 2');
  objects.lampLight2 = threeScene.getObjectByName('Point Light 3');
  objects.sunLight = threeScene.getObjectByName('Directional Light');
  objects.skyLight = threeScene.getObjectByName('Directional Light 2');
  objects.computer = threeScene.getObjectByName('Computer');
  objects.bed = threeScene.getObjectByName('Bed');
  objects.plant = threeScene.getObjectByName('Plant');
  objects.clock = threeScene.getObjectByName('Clock');
  objects.clockHour = objects.clock?.getObjectByName('Cylinder 19');
  objects.clockMin = objects.clock?.getObjectByName('Cylinder 18');
  objects.books = threeScene.getObjectByName('Books');
  objects.coffee = threeScene.getObjectByName(' Coffee Cup') || threeScene.getObjectByName('Coffee Cup');
  objects.window = threeScene.getObjectByName('Window');
  objects.stickyNotes = threeScene.getObjectByName('Sticky Notes');

  if (objects.chair) {
    const post = objects.chair.getObjectByName('Cylinder 12');
    const seatParts = ['Cube 50', 'Cube 49', 'Cube 48']
      .map(name => objects.chair.getObjectByName(name))
      .filter(Boolean);
    if (post) {
      chairSwivel = createChairSwivel(
        seatParts.map(part => splineApp.findObjectById(part.uuid)),
        post.position.clone()
      );
    }
  }
  if (objects.clock) {
    wallClock = createWallClock(
      splineApp.findObjectById(objects.clock.uuid),
      objects.clockHour && splineApp.findObjectById(objects.clockHour.uuid),
      objects.clockMin && splineApp.findObjectById(objects.clockMin.uuid)
    );
  }
}

// Setup 3D Hotspot DOM Elements
function setupHotspots() {
  hotspotContainer.innerHTML = '';
  HOTSPOTS.forEach(spot => {
    if (spot.pin === false) return;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = spot.secondary ? 'hotspot-pin hotspot-secondary' : 'hotspot-pin';
    el.id = `hotspot-${spot.id}`;
    el.setAttribute('aria-label', spot.label);
    if (!spot.secondary) el.title = spot.label;
    el.hidden = true;
    const content = `
      <div class="hotspot-icon" aria-hidden="true">${spot.icon}</div>
      <div class="hotspot-label">${spot.label}</div>
    `;
    el.innerHTML = spot.secondary
      ? `<span class="hotspot-ring" aria-hidden="true"></span><span class="hotspot-bubble">${content}</span>`
      : content;
    if (spot.secondary) {
      spot.bubble = el.querySelector('.hotspot-bubble');
      spot.ring = el.querySelector('.hotspot-ring');
      const obj = objects[spot.objKey];
      const bounds = obj && spot.revealOffsetY === undefined && new THREE.Box3().setFromObject(obj);
      spot.bounds = [];
      if (bounds && !bounds.isEmpty()) {
        // Cache geometry bounds once; project their corners as the camera moves.
        for (const x of [bounds.min.x, bounds.max.x]) {
          for (const y of [bounds.min.y, bounds.max.y]) {
            for (const z of [bounds.min.z, bounds.max.z]) {
              spot.bounds.push(obj.worldToLocal(new THREE.Vector3(x, y, z)));
            }
          }
        }
      }
      el.addEventListener('pointerenter', () => { spot.pinHovered = true; });
      el.addEventListener('pointerleave', () => { spot.pinHovered = false; });
    }
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      activateHotspot(spot, el);
    });
    hotspotContainer.appendChild(el);
    spot.domElement = el;
  });
  gsap.matchMedia().add({ motion: '(prefers-reduced-motion: no-preference)', reduced: '(prefers-reduced-motion: reduce)' }, context => {
    HOTSPOTS.filter(spot => spot.secondary).forEach(spot => {
      spot.reducedMotion = context.conditions.reduced;
      spot.revealed = null;
      spot.domElement.classList.remove('is-revealed');
      spot.motion = { rise: 0 };
      gsap.set(spot.ring, { scale: 0.8, y: 0, autoAlpha: 1 });
      gsap.set(spot.bubble, { xPercent: -50, yPercent: -50, scale: 0.45, autoAlpha: 0 });
      spot.setBubbleX = gsap.quickSetter(spot.bubble, 'x', 'px');
      spot.setBubbleY = gsap.quickSetter(spot.bubble, 'y', 'px');
      spot.revealTimeline = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' }, onReverseComplete: () => spot.domElement.classList.remove('is-revealed') })
        .to(spot.motion, { rise: 1, duration: 0.36 }, 0)
        .to(spot.ring, { y: -12, scaleX: 1.4, scaleY: 0.5, autoAlpha: 0, duration: 0.16 }, 0)
        .to(spot.bubble, { scale: 1, autoAlpha: 1, duration: 0.26 }, 0.07);
    });
  });
}

function setHotspotRevealed(spot, revealed) {
  if (spot.revealed === revealed) return;
  spot.revealed = revealed;
  if (revealed) spot.domElement.classList.add('is-revealed');
  if (spot.reducedMotion) {
    spot.revealTimeline.progress(revealed ? 1 : 0).pause();
    spot.domElement.classList.toggle('is-revealed', revealed);
  } else if (revealed) {
    spot.revealTimeline.play();
  } else {
    spot.revealTimeline.reverse();
  }
}

// Update Hotspot Screen Positions
function updateHotspots() {
  if (!state.pinsVisible || !threeCamera) {
    hotspotContainer.style.display = 'none';
    HOTSPOTS.filter(spot => spot.secondary).forEach(spot => {
      spot.pinHovered = false;
      setHotspotRevealed(spot, false);
    });
    return;
  }
  hotspotContainer.style.display = 'block';

  const rect = canvas.getBoundingClientRect();
  const v = new THREE.Vector3();
  const compactPins = compactLayoutMedia.matches;
  const placedPins = [];
  // Read sizes together before updating positions or starting any tweens.
  const bubbleSizes = new Map(HOTSPOTS.filter(spot => spot.secondary).map(spot => [spot, { width: spot.bubble.offsetWidth, height: spot.bubble.offsetHeight }]));
  const obstacles = compactPins
    ? [...document.querySelectorAll('.side-nav, .top-nav-right, .bottom-dock')].map(el => el.getBoundingClientRect())
    : [];

  HOTSPOTS.forEach(spot => {
    const obj = objects[spot.objKey];
    if (!spot.domElement) return;
    if (!obj) {
      spot.domElement.hidden = true;
      return;
    }

    obj.getWorldPosition(v);
    v.y += spot.offsetY ?? 40;
    v.project(threeCamera);

    // Check if within frustum bounds
    const isVisible = v.z < 1 && v.x >= -1.2 && v.x <= 1.2 && v.y >= -1.2 && v.y <= 1.2;
    spot.domElement.hidden = !isVisible;
    if (!isVisible) {
      spot.domElement.style.opacity = '0';
      return;
    }

    let x = (v.x * 0.5 + 0.5) * rect.width + (spot.offsetX ?? 0) * threeCamera.zoom / DEFAULT_CAM_ZOOM;
    let y = (-v.y * 0.5 + 0.5) * rect.height;

    if (compactPins && !spot.secondary) {
      const position = COMPACT_PIN_OFFSETS
        .map(offset => ({
          x: THREE.MathUtils.clamp(x + offset.x, 28, rect.width - 28),
          y: THREE.MathUtils.clamp(y + offset.y, 28, rect.height - 28)
        }))
        .find(point => (
          placedPins.every(other => Math.abs(point.x - other.x) >= 52 || Math.abs(point.y - other.y) >= 52)
          && obstacles.every(obstacle => (
            point.x + 26 < obstacle.left - rect.left || point.x - 26 > obstacle.right - rect.left
            || point.y + 26 < obstacle.top - rect.top || point.y - 26 > obstacle.bottom - rect.top
          ))
        ));
      if (!position) {
        spot.domElement.hidden = true;
        return;
      }
      ({ x, y } = position);
      placedPins.push(position);
    }
    if (spot.secondary) {
      const { width, height } = bubbleSizes.get(spot);
      let objectTop = y;
      // Use tuned reveal heights for large objects instead of their full bounds.
      if (spot.revealOffsetY !== undefined) {
        obj.getWorldPosition(v);
        v.y += spot.revealOffsetY;
        v.project(threeCamera);
        objectTop = Math.min(objectTop, (-v.y * 0.5 + 0.5) * rect.height);
      }
      for (const corner of spot.bounds) {
        v.copy(corner);
        obj.localToWorld(v);
        v.project(threeCamera);
        objectTop = Math.min(objectTop, (-v.y * 0.5 + 0.5) * rect.height);
      }
      const lift = Math.max(44, y - objectTop + height / 2 + 14);
      const bubbleY = Math.max(8 + height / 2, y - lift);
      spot.domElement.style.setProperty('--pin-lift', `${y - bubbleY}px`);
      setHotspotRevealed(spot, isVisible && !activeModal && !isDragging && (state.hoveredInteractive === spot || spot.pinHovered || spot.domElement.matches(':focus-visible')));
      spot.setBubbleX((THREE.MathUtils.clamp(x, width / 2 + 8, rect.width - width / 2 - 8) - x) * spot.motion.rise);
      spot.setBubbleY((bubbleY - y) * spot.motion.rise);
    }

    spot.domElement.style.opacity = '1';
    spot.domElement.style.left = `${x}px`;
    spot.domElement.style.top = `${y}px`;
  });
}

// Real-Time Clock Hands Sync
function updateClockHands() {
  const now = new Date();
  const second = Math.floor(now.getTime() / 1000);
  if (second === lastClockSecond) return;
  lastClockSecond = second;
  wallClock?.update(now);

  // Update Zen Clock
  if (zenClock) {
    zenClock.textContent = now.toLocaleTimeString();
  }
}

// Main Animation Loop
let lastTime = performance.now();
function animateLoop(now) {
  requestAnimationFrame(animateLoop);
  const delta = (now - lastTime) / 1000;
  lastTime = now;

  updateDayNightCycle(now);

  // 1. Clock hands update
  updateClockHands();

  // 2. Chair spinning animation
  chairSwivel?.update(now);

  // 3. Camera transition animation
  if (currentCamAnim && threeCamera) {
    currentCamAnim.elapsed += delta;
    const progress = Math.min(1, currentCamAnim.elapsed / currentCamAnim.duration);
    const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic

    threeCamera.position.lerpVectors(currentCamAnim.startPos, currentCamAnim.targetPos, ease);

    // Slerp rotation
    threeCamera.quaternion.slerpQuaternions(currentCamAnim.startQuat, currentCamAnim.targetQuat, ease);

    // Zoom interpolation
    if (threeCamera.zoom !== undefined && currentCamAnim.startZoom !== undefined) {
      threeCamera.zoom = THREE.MathUtils.lerp(currentCamAnim.startZoom, currentCamAnim.targetZoom, ease);
      threeCamera.updateProjectionMatrix();
    }

    if (progress >= 1) {
      currentCamAnim = null;
    }
  }

  // Let the camera briefly flex past its minimum zoom before returning, so
  // attempts to zoom out further have clear boundary feedback.
  if (zoomBounce && threeCamera) {
    zoomBounce.elapsed += delta;
    const progress = Math.min(1, zoomBounce.elapsed / zoomBounce.duration);
    const ease = 1 - Math.pow(1 - progress, 4);
    threeCamera.zoom = THREE.MathUtils.lerp(zoomBounce.startZoom, ZOOM_BOUNDS.min, ease);
    threeCamera.updateProjectionMatrix();

    if (progress >= 1) zoomBounce = null;
  }

  // 4. Update 3D Hotspot Screen Coordinates
  updateHotspots();
}

// Camera Preset Transition
function setCameraPreset(presetName) {
  const preset = CAMERA_PRESETS[presetName];
  if (!preset || !threeCamera) return;

  state.cameraPreset = presetName;
  sound.playPop(1.1);

  // Update the selected menu option and its trigger.
  document.querySelectorAll('#cameraGroup [data-cam]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cam === presetName);
    btn.setAttribute('aria-checked', String(btn.dataset.cam === presetName));
  });
  const cameraOption = document.querySelector(`#cameraMenu [data-cam="${presetName}"]`);
  const cameraToggle = document.getElementById('cameraToggleBtn');
  cameraToggle.setAttribute('aria-label', `Camera view: ${cameraOption.lastElementChild.textContent}`);

  const startQuat = threeCamera.quaternion.clone();
  const targetQuat = new THREE.Quaternion().setFromEuler(preset.rot);

  currentCamAnim = {
    startPos: threeCamera.position.clone(),
    targetPos: preset.pos.clone(),
    startQuat: startQuat,
    targetQuat: targetQuat,
    startZoom: threeCamera.zoom,
    targetZoom: preset.zoom * cameraZoomScale,
    duration: 1.2,
    elapsed: 0
  };

  showToast(`Perspective switched to ${presetName.toUpperCase()}`, '📐');
}

// Lighting & Atmosphere Transition
function setTheme(themeName, { notify = true, restartCycle = true } = {}) {
  const theme = THEMES[themeName];
  if (!theme) return;

  const now = performance.now();
  if (restartCycle && dayNightCycleStart !== null) {
    const current = THEMES[state.theme];
    // Capture what is actually visible so repeated clicks can retarget mid-fade.
    themeTransition = {
      start: now,
      from: {
        bg: cycleBackgroundColor.clone(),
        sunColor: objects.sunLight?.color.clone() ?? current.sunColor.clone(),
        sunIntensity: objects.sunLight?.intensity ?? current.sunIntensity,
        skyColor: objects.skyLight?.color.clone() ?? current.skyColor.clone(),
        skyIntensity: objects.skyLight?.intensity ?? current.skyIntensity,
        lampIntensity: objects.lampLight1?.intensity ?? (state.lampOn ? current.lampIntensity : 0)
      },
      to: theme
    };
    dayNightCycleStart = now + THEME_FADE_MS
      - DAY_NIGHT_PHASES.indexOf(themeName) * (DAY_NIGHT_CYCLE_MS / DAY_NIGHT_PHASES.length);
  }
  state.theme = themeName;
  appEl.setAttribute('data-theme', themeName);

  // Keep menu selection in sync with manual changes and the day/night cycle.
  document.querySelectorAll('#themeGroup [data-theme]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === themeName);
    btn.setAttribute('aria-checked', String(btn.dataset.theme === themeName));
  });
  const themeOption = document.querySelector(`#themeMenu [data-theme="${themeName}"]`);
  const themeToggle = document.getElementById('themeToggleBtn');
  themeToggle.setAttribute('aria-label', `Lighting: ${themeOption.lastElementChild.textContent}`);

  // Bedside Lamp behavior based on theme
  if (themeName === 'night') {
    state.lampOn = true;
  }
  if (!themeTransition) applyThemeLighting(theme);
  updateLampLighting({ applyIntensity: !themeTransition });

  if (notify) showToast(`Atmosphere set to ${theme.label}`, '🌤️');
}

function applyThemeLighting(from, to = from, blend = 0) {
  const background = cycleBackgroundColor.copy(from.bg).lerp(to.bg, blend).getStyle();
  if (background !== appliedBackground) {
    // Spline's opaque canvas covers the CSS atmosphere behind it.
    splineApp?.setBackgroundColor(background);
    appEl.style.background = background;
    appliedBackground = background;
  }
  if (objects.sunLight) {
    objects.sunLight.color.copy(from.sunColor).lerp(to.sunColor, blend);
    objects.sunLight.intensity = THREE.MathUtils.lerp(from.sunIntensity, to.sunIntensity, blend);
  }
  if (objects.skyLight) {
    objects.skyLight.color.copy(from.skyColor).lerp(to.skyColor, blend);
    objects.skyLight.intensity = THREE.MathUtils.lerp(from.skyIntensity, to.skyIntensity, blend);
  }
  const lampIntensity = state.lampOn ? THREE.MathUtils.lerp(from.lampIntensity, to.lampIntensity, blend) : 0;
  if (objects.lampLight1) objects.lampLight1.intensity = lampIntensity;
  if (objects.lampLight2) objects.lampLight2.intensity = lampIntensity;
  splineApp?.requestRender();
}

function updateDayNightCycle(now) {
  if (themeTransition) {
    const progress = Math.min(1, Math.max(0, (now - themeTransition.start) / THEME_FADE_MS));
    applyThemeLighting(themeTransition.from, themeTransition.to, progress * progress * (3 - 2 * progress));
    if (progress === 1) themeTransition = null;
    return;
  }
  if (dayNightCycleStart === null || state.zenMode) return;
  const { from, to, blend } = getDayNightPhase(now - dayNightCycleStart);
  if (state.theme !== from) setTheme(from, { notify: false, restartCycle: false });
  applyThemeLighting(THEMES[from], THEMES[to], blend);
}

function cycleTheme() {
  const themes = ['night', 'day', 'sunset'];
  const nextIdx = (themes.indexOf(state.theme) + 1) % themes.length;
  setTheme(themes[nextIdx]);
}

function setupLightingAndTheme() {
  setTheme('sunset', { notify: false });
}

// Bedside Lamp Toggle
function toggleLamp() {
  state.lampOn = !state.lampOn;
  sound.playSwitch(state.lampOn);
  updateLampLighting();

  showToast(`Bedside lamp turned ${state.lampOn ? 'ON' : 'OFF'}`, state.lampOn ? '💡' : '🌑');
}

function updateLampLighting({ applyIntensity = true } = {}) {
  const intensity = state.lampOn ? (THEMES[state.theme]?.lampIntensity || 1.6) : 0.0;
  if (applyIntensity) {
    if (objects.lampLight1) objects.lampLight1.intensity = intensity;
    if (objects.lampLight2) objects.lampLight2.intensity = intensity;
  }
  toggleLampBtn.classList.toggle('active', state.lampOn);
  toggleLampBtn.setAttribute('aria-checked', String(state.lampOn));
}

// Chair Swivel
function spinChair() {
  if (!chairSwivel?.start(performance.now())) return;
  sound.playWhoosh();
  showToast('Swiveled the office chair!', '🪑');
}

// House Plant Interaction
function waterPlant() {
  state.plantHydration = Math.min(100, state.plantHydration + 15);
  sound.playWaterChime();

  showToast(`🌱 Plant watered! Hydration: ${state.plantHydration}%`, '💧');
}

// Coffee Interaction
function drinkCoffee() {
  sound.playPop(1.4);
  showToast('☕ Fresh hot coffee sipped! Focus level 100%', '⚡');
}

// Zen / Relax Mode Toggle
function toggleZenMode(enable = null) {
  const nextMode = enable !== null ? enable : !state.zenMode;
  if (nextMode === state.zenMode) return;
  state.zenMode = nextMode;
  if (state.zenMode) {
    zenReturnFocus = document.activeElement;
    sound.toggleAmbient(true);
    lofiBtn.classList.add('active');
    lofiBtn.setAttribute('aria-pressed', 'true');
    zenOverlay.classList.add('active');
    requestAnimationFrame(() => {
      if (state.zenMode && !activeModal) exitZenBtn.focus({ preventScroll: true });
    });
    setTheme('night');
    showToast('Entered Cozy Zen Mode', '🌙');
  } else {
    setTheme('night', { notify: false });
    const shouldRestoreFocus = zenOverlay.contains(document.activeElement);
    zenOverlay.classList.remove('active');
    if (shouldRestoreFocus) {
      const target = zenReturnFocus instanceof HTMLElement && zenReturnFocus.getClientRects().length && zenReturnFocus !== document.body
        ? zenReturnFocus : document.getElementById('cameraToggleBtn');
      target.focus({ preventScroll: true });
    }
    zenReturnFocus = null;
    showToast('Exited Zen Mode', '☀️');
  }
}

// Raycasting / Click Interaction on 3D Objects
function findInteractiveParent(obj) {
  let curr = obj;
  while (curr && curr !== threeScene) {
    const rawName = curr.name || curr.data?.name || '';
    const name = rawName.trim();
    for (let spot of HOTSPOTS) {
      if (name === spot.name.trim() || rawName === spot.name || curr === objects[spot.objKey]) {
        return spot;
      }
    }
    curr = curr.parent;
  }
  return null;
}

function getInteractiveAtPointer(e) {
  if (!threeScene || !threeCamera) return null;
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, threeCamera);
  const hits = raycaster.intersectObjects(threeScene.children, true);
  return hits.length ? findInteractiveParent(hits[0].object) : null;
}

function handlePointerMove(e) {
  if (isPointerDown) {
    const distance = Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y);
    if (distance > 6) {
      isDragging = true;
      hoverTooltip.classList.remove('visible');
    }
    return;
  }

  const targetSpot = getInteractiveAtPointer(e);

  if (targetSpot) {
    state.hoveredInteractive = targetSpot;
    canvas.classList.add('pointer-cursor');
    hoverTooltip.textContent = `${targetSpot.icon} ${targetSpot.label} — Click to interact`;
    hoverTooltip.style.left = `${e.clientX}px`;
    hoverTooltip.style.top = `${e.clientY}px`;
    const revealedPin = targetSpot.secondary && state.pinsVisible && targetSpot.domElement && !targetSpot.domElement.hidden;
    hoverTooltip.classList.toggle('visible', !revealedPin);
  } else {
    state.hoveredInteractive = null;
    canvas.classList.remove('pointer-cursor');
    hoverTooltip.classList.remove('visible');
  }
}

function handlePointerDown(e) {
  isPointerDown = true;
  isDragging = false;
  pointerStart.x = e.clientX;
  pointerStart.y = e.clientY;
}

function handlePointerUp(e) {
  isPointerDown = false;
  if (e.button === 0 && !isDragging) {
    // Touch taps have no preceding hover, so pick at the release position.
    const targetSpot = getInteractiveAtPointer(e);
    if (targetSpot) {
      activateHotspot(targetSpot);
    }
  }
  isDragging = false;
}

// Spline's elastic rotation limit clears this internal flag at the outer edge,
// which otherwise makes a held drag stop responding until the next click.
function keepOrbitDragActive(e) {
  const orbitControls = splineApp?._controls?.orbitControls;
  if (e.buttons !== 0 && orbitControls && orbitControls.state !== -1) {
    orbitControls.isPointerDown = true;
  }
}

function startZoomLimitBounce() {
  if (!threeCamera || currentCamAnim) return;

  zoomBounce = {
    startZoom: ZOOM_BOUNDS.min * 0.965,
    duration: 0.16,
    elapsed: 0
  };
  threeCamera.zoom = zoomBounce.startZoom;
  threeCamera.updateProjectionMatrix();
}

// Toast System
function showToast(message, icon = '✨') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Modal Handlers
function openModal(modalName, trigger = null) {
  const targetModal = { projects: projectsModal, skills: skillsModal, about: aboutModal }[modalName];
  if (!targetModal) return;
  const focused = trigger || document.activeElement;
  const returnTarget = focused instanceof HTMLElement && focused !== document.body && !activeModal?.contains(focused)
    ? focused
    : modalReturnFocus || document.querySelector(`[data-modal="${modalName}"]`);
  closeAllModals({ restoreFocus: false });
  dockDropdowns.forEach(dropdown => setDockDropdownOpen(dropdown, false));
  sound.playPop(1.2);
  activeModal = targetModal;
  modalReturnFocus = returnTarget;
  modalReturnFallback = document.querySelector(`[data-modal="${modalName}"]`);
  // Disable the room and inactive dialogs without making the active dialog inert.
  for (const child of appEl.children) {
    if (child === targetModal || child === toastContainer) continue;
    modalBackgroundState.set(child, child.inert);
    child.inert = true;
  }
  targetModal.inert = false;
  targetModal.classList.add('open');
  targetModal.querySelector('.modal-body').scrollTop = 0;
  // Wait for the visibility change before focusing the previously hidden dialog.
  requestAnimationFrame(() => {
    if (activeModal === targetModal) targetModal.querySelector('[role="dialog"]').focus({ preventScroll: true });
  });
  hoverTooltip.classList.remove('visible');
}

function closeAllModals({ restoreFocus = true } = {}) {
  if (!activeModal) return;
  activeModal.classList.remove('open');
  activeModal.inert = true;
  activeModal = null;
  for (const [element, wasInert] of modalBackgroundState) element.inert = wasInert;
  modalBackgroundState.clear();
  const canFocus = el => el?.isConnected && !el.closest('[inert]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const returnTarget = canFocus(modalReturnFocus) ? modalReturnFocus : modalReturnFallback;
  modalReturnFocus = null;
  modalReturnFallback = null;
  if (restoreFocus && canFocus(returnTarget)) {
    returnTarget.focus({ preventScroll: true });
  }
}

function trapModalFocus(event) {
  const dialog = activeModal.querySelector('[role="dialog"]');
  const focusable = [...dialog.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
    .filter(el => !el.disabled && el.tabIndex >= 0 && !el.closest('[inert]') && el.getClientRects().length);
  const first = focusable[0] || dialog;
  const last = focusable.at(-1) || dialog;
  const focused = document.activeElement;
  if (!focusable.includes(focused) || (event.shiftKey ? focused === first : focused === last)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
}

function setDockDropdownOpen(dropdown, isOpen, restoreFocus = false) {
  if (isOpen) {
    dockDropdowns.filter(other => other !== dropdown).forEach(other => setDockDropdownOpen(other, false));
  }
  const toggle = dropdown.querySelector('.dropdown-toggle');
  dropdown.classList.toggle('open', isOpen);
  toggle.setAttribute('aria-expanded', String(isOpen));
  toggle.classList.toggle('active', isOpen);
  dropdown.querySelector('.dropdown-menu').inert = !isOpen;
  if (restoreFocus) toggle.focus();
}

// Render Project Showcase & Skills Content
function renderContent() {
  // 1. Projects
  const projectsGrid = document.getElementById('projectsGrid');
  if (projectsGrid) {
    projectsGrid.innerHTML = PORTFOLIO_DATA.projects.map(p => `
      <div class="project-card">
        <img class="project-image" src="${p.image}" alt="${p.imageAlt}" loading="lazy">
        <div class="project-card-header">
          <div>
            <div class="project-name">${p.title}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">${p.category}</div>
          </div>
          <span class="project-badge">${p.badge}</span>
        </div>
        <p class="project-desc">${p.description}</p>
        <div class="project-tags">
          ${p.tags.map(t => `<span class="project-tag">${t}</span>`).join('')}
        </div>
        <div class="project-links">
          ${p.links.map((link, index) => `
            <a href="${link.url}" target="_blank" rel="noopener" class="${index === 0 ? 'btn-primary' : 'btn-secondary'}" aria-label="${link.label} (opens in a new tab)">
              <span>${link.label} &nearr;</span>
            </a>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  // 2. Skills
  const skillsContainer = document.getElementById('skillsContainer');
  if (skillsContainer) {
    skillsContainer.innerHTML = `
      ${PORTFOLIO_DATA.skills.map(cat => `
        <div>
          <div class="skill-category-title">${cat.category}</div>
          <div class="skills-row">
            ${cat.items.map(s => `
              <div class="skill-card">
                <div class="skill-header">
                  <span>${s.name}</span>
                  <span style="color: var(--accent-amber);">${s.level}%</span>
                </div>
                <div class="skill-bar-bg">
                  <div class="skill-bar-fill" style="width: ${s.level}%;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    `;
  }

  // 3. About & Contact
  const aboutContainer = document.getElementById('aboutContainer');
  const dev = PORTFOLIO_DATA.developer;
  document.getElementById('fallbackName').textContent = dev.name;
  document.getElementById('fallbackEmailLink').href = `mailto:${dev.email}`;
  document.getElementById('fallbackEmailAddress').textContent = dev.email;
  if (aboutContainer) {
    aboutContainer.innerHTML = `
      <div class="profile-card">
        <div>
          <h2 style="font-size: 1.4rem; font-weight: 700;">${dev.name}</h2>
          <div style="font-size: 0.9rem; color: var(--accent-amber); margin-top: 4px;">${dev.title}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">📍 ${dev.location} &bull; 🟢 ${dev.status}</div>
        </div>

        <p class="profile-bio">${dev.bio}</p>

        <div class="profile-socials">
          ${dev.socials.map(s => `
            <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="social-pill">
              <span>${s.label}</span>
              <span aria-hidden="true">&nearr;</span>
            </a>
          `).join('')}
        </div>

        <section class="contact-section" aria-labelledby="contactHeading">
          <h3 class="skill-category-title" id="contactHeading">Let's connect</h3>
          <p class="contact-description">For projects, collaborations, or a hello.</p>
          <a href="mailto:${dev.email}" class="btn-primary contact-email-link">
            Email me <span aria-hidden="true">&nearr;</span>
          </a>
          <p class="contact-address">${dev.email}</p>
        </section>
      </div>
    `;
  }
}

// Bind after Spline so its wheel handler stays between our capture/bubble handlers.
function setupSceneInput() {
  // Canvas pointer raycasting and click handling. Orbit is constrained; panning is disabled.
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerleave', () => {
    state.hoveredInteractive = null;
    canvas.classList.remove('pointer-cursor');
    hoverTooltip.classList.remove('visible');
  });
  canvas.addEventListener('pointermove', keepOrbitDragActive);
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Capture the zoom before Spline handles the wheel event, then trigger the
  // elastic response only when a zoom-out input is already at the minimum.
  let zoomBeforeWheel = null;
  canvas.addEventListener('wheel', () => {
    zoomBeforeWheel = threeCamera?.zoom ?? null;
  }, { capture: true, passive: true });
  canvas.addEventListener('wheel', (e) => {
    const atMinimumZoom = zoomBeforeWheel !== null && zoomBeforeWheel <= ZOOM_BOUNDS.min + 0.001;
    if (e.deltaY > 0 && atMinimumZoom) startZoomLimitBounce();
  }, { passive: true });
}

function setupNavigationReveals() {
  gsap.matchMedia().add({ motion: '(prefers-reduced-motion: no-preference)', reduced: '(prefers-reduced-motion: reduce)' }, context => {
    const cleanups = Array.from(document.querySelectorAll('#sideNav .nav-btn'), btn => {
      const label = btn.querySelector('.nav-label');
      let hovered = btn.matches(':hover') && window.matchMedia('(any-hover: hover)').matches;
      gsap.set(label, { x: -6, autoAlpha: 0 });
      const timeline = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } })
        .to(btn, { '--nav-expansion': `${label.offsetWidth + 16}px`, duration: 0.3 }, 0)
        .to(label, { x: 0, autoAlpha: 1, duration: 0.2 }, 0.06);
      const update = () => {
        const expanded = hovered || document.activeElement === btn;
        if (context.conditions.reduced) timeline.progress(expanded ? 1 : 0).pause();
        else if (expanded) timeline.play();
        else timeline.reverse();
      };
      const enter = event => { hovered = event.pointerType !== 'touch'; update(); };
      const leave = () => { hovered = false; update(); };
      btn.addEventListener('pointerenter', enter);
      btn.addEventListener('pointerleave', leave);
      btn.addEventListener('focus', update);
      btn.addEventListener('blur', update);
      update();
      return () => {
        btn.removeEventListener('pointerenter', enter);
        btn.removeEventListener('pointerleave', leave);
        btn.removeEventListener('focus', update);
        btn.removeEventListener('blur', update);
      };
    });
    return () => cleanups.forEach(cleanup => cleanup());
  });
}

// DOM controls are available independently of the renderer.
function setupEventListeners() {
  setupNavigationReveals();
  // Top Nav Modal Buttons
  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      openModal(btn.dataset.modal, btn);
    });
  });

  // Modal Close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeAllModals();
    });
  });

  // Audio Buttons
  lofiBtn.addEventListener('click', () => {
    const isPlaying = sound.toggleAmbient();
    lofiBtn.classList.toggle('active', isPlaying);
    lofiBtn.setAttribute('aria-pressed', String(isPlaying));
    showToast(`Cozy Lofi Chords: ${isPlaying ? 'ON' : 'OFF'}`, '🎵');
  });

  muteBtn.addEventListener('click', () => {
    const isMuted = sound.toggleMute();
    muteBtn.textContent = isMuted ? '🔇' : '🔊';
    muteBtn.classList.toggle('active', isMuted);
    muteBtn.setAttribute('aria-pressed', String(isMuted));
    showToast(`Sound Effects: ${isMuted ? 'MUTED' : 'ENABLED'}`, isMuted ? '🔇' : '🔊');
  });

  // Theme menu options
  document.querySelectorAll('#themeGroup [data-theme]').forEach(btn => {
    btn.addEventListener('click', () => setTheme(btn.dataset.theme));
  });

  // Camera menu options
  document.querySelectorAll('#cameraGroup [data-cam]').forEach(btn => {
    btn.addEventListener('click', () => setCameraPreset(btn.dataset.cam));
  });

  // All dock menus share the Interactions behavior.
  dockDropdowns.forEach(dropdown => {
    const toggle = dropdown.querySelector('.dropdown-toggle');
    const items = [...dropdown.querySelectorAll('.dropdown-item')];
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !dropdown.classList.contains('open');
      setDockDropdownOpen(dropdown, isOpen);
      if (isOpen) (dropdown.querySelector('[aria-checked="true"]') || items[0]).focus();
      sound.playPop();
    });

    // Close dropdown on action selection
    items.forEach(item => {
      item.addEventListener('click', () => {
        setDockDropdownOpen(dropdown, false, true);
      });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        setDockDropdownOpen(dropdown, false);
      }
    });
    dropdown.addEventListener('focusout', (e) => {
      if (!dropdown.contains(e.relatedTarget)) setDockDropdownOpen(dropdown, false);
    });
    dropdown.addEventListener('keydown', (e) => {
      const index = items.indexOf(document.activeElement);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        setDockDropdownOpen(dropdown, true);
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1
          : index < 0 ? (e.key === 'ArrowUp' ? items.length - 1 : 0)
          : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next].focus();
      } else if (e.key === 'Tab' && index >= 0) {
        // Move from the menu back into the ordinary page tab sequence.
        setDockDropdownOpen(dropdown, false, true);
      }
    });
  });

  // Quick Action Buttons inside dropdown
  if (toggleLampBtn) toggleLampBtn.addEventListener('click', toggleLamp);
  if (spinChairBtn) spinChairBtn.addEventListener('click', spinChair);
  if (waterPlantBtn) waterPlantBtn.addEventListener('click', waterPlant);

  togglePinsBtn.classList.toggle('active', state.pinsVisible);
  togglePinsBtn.setAttribute('aria-pressed', String(state.pinsVisible));
  togglePinsBtn.addEventListener('click', () => {
    state.pinsVisible = !state.pinsVisible;
    togglePinsBtn.classList.toggle('active', state.pinsVisible);
    togglePinsBtn.setAttribute('aria-pressed', String(state.pinsVisible));
    hotspotContainer.style.display = state.pinsVisible ? 'block' : 'none';
    sound.playPop();
    showToast(`Hotspot Pins: ${state.pinsVisible ? 'VISIBLE' : 'HIDDEN'}`, '📍');
  });

  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  document.addEventListener('fullscreenchange', () => {
    fullscreenBtn.classList.toggle('active', !!document.fullscreenElement);
    fullscreenBtn.setAttribute('aria-pressed', String(!!document.fullscreenElement));
  });

  exitZenBtn.addEventListener('click', () => toggleZenMode(false));
  zenOverlay.addEventListener('click', (e) => {
    if (e.target === zenOverlay) toggleZenMode(false);
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.isComposing) return;
    const openDropdown = dockDropdowns.find(dropdown => dropdown.classList.contains('open'));
    if (e.key === 'Escape') {
      if (activeModal) closeAllModals();
      else if (openDropdown) setDockDropdownOpen(openDropdown, false, true);
      else if (state.zenMode) toggleZenMode(false);
      return;
    }
    if (activeModal) {
      if (e.key === 'Tab') trapModalFocus(e);
      return;
    }
    if (appEl.dataset.sceneState !== 'ready') return;
    const isEditing = e.target instanceof HTMLElement && (e.target.isContentEditable || e.target.closest('input, textarea, select'));
    if (isEditing || e.repeat || e.ctrlKey || e.metaKey || e.altKey || openDropdown) return;
    if (e.key === 'l' || e.key === 'L') {
      toggleLamp();
    } else if (e.key === 'c' || e.key === 'C') {
      spinChair();
    } else if (e.key === '1') {
      setTheme('day');
    } else if (e.key === '2') {
      setTheme('sunset');
    } else if (e.key === '3') {
      setTheme('night');
    }
  });
}

// Start application
initPage();
