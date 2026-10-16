import * as THREE from 'three';
import { gsap } from 'gsap';
import { sound } from './audio.js';
import { PORTFOLIO_DATA } from './data.js';
import { waitForSceneReady } from './scene-ready.js';
import { DAY_NIGHT_CYCLE_MS, DAY_NIGHT_PHASES, getDayNightPhase } from './day-night-cycle.js';
import { createChairSwivel, createWallClock, createPlantInteraction, createCoffeeInteraction } from './scene-motion.js';

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
let modalSectionTimeline = null;
let reduceModalMotion = false;
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
const interactionMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');

// Spline & Three.js State
let splineApp = null;
let threeScene = null;
let threeCamera = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let sceneViewport = null;
let pendingHover = null;
let hotspotsDirty = true;
const hotspotPoint = new THREE.Vector3();
const hotspotCameraWorld = new THREE.Matrix4();
const hotspotCameraProjection = new THREE.Matrix4();

// Drag tracking is retained only to avoid treating a drag as an object click.
const activePointers = new Set();
let isDragging = false;
const pointerStart = { x: 0, y: 0 };

// Room State
const state = {
  lampOn: true,
  theme: 'sunset',
  cameraPreset: 'iso',
  pinsVisible: true,
  zenMode: false,
  hoveredInteractive: null
};
let dayNightCycleStart = null;
let lastCycleUpdate = -Infinity;
let chairSwivel = null;
let wallClock = null;
let lastClockSecond = null;
let plantInteraction = null;
let coffeeInteraction = null;
let roomEffects = null;

// Base Camera Settings
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
  if (spot.id === 'plant' || spot.id === 'coffee') {
    const accepted = spot.action(trigger);
    if (accepted && spot.cameraPreset && state.cameraPreset !== spot.cameraPreset) {
      setCameraPreset(spot.cameraPreset, { notify: false, audible: false });
    }
    return accepted;
  }
  sound.playPop();
  if (spot.cameraPreset && state.cameraPreset !== spot.cameraPreset) {
    setCameraPreset(spot.cameraPreset, { notify: false });
  }
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
    await setupObjectInteractions();
    updateClockHands();
    setupHotspots();
    updateInteractionLabels();
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
    updateObjectInteractions(lastTime);
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

// Fit around the canvas center at every size; utility columns occupy side space.
function syncResponsiveCameraZoom() {
  if (!threeCamera) return;

  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  sceneViewport = rect;
  hotspotsDirty = true;
  const dockRect = document.querySelector('.bottom-dock').getBoundingClientRect();
  const topRect = document.querySelector('.top-nav-right').getBoundingClientRect();
  const navRect = document.getElementById('sideNav').getBoundingClientRect();
  const sideInset = Math.max(16, navRect.left - rect.left, rect.right - topRect.right);
  const topInset = Math.max(16, topRect.top - rect.top);
  const availableWidth = Math.max(1, rect.width - sideInset * 2);
  const availableHeight = Math.max(1, 2 * Math.min(rect.height / 2 - topInset,
    dockRect.top - rect.top - 16 - rect.height / 2));
  const nextScale = Math.min(1, availableWidth / OVERVIEW_FRAME_SIZE, availableHeight / OVERVIEW_FRAME_SIZE);

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
  orbitControls.touches[0] = THREE.TOUCH.ROTATE;

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

async function setupObjectInteractions() {
  const foliage = ['Cylinder 5', 'Cylinder 6', 'Cylinder 7', 'Cylinder 8', 'Cylinder 9']
    .map(name => objects.plant?.getObjectByName(name)).filter(Boolean);
  const rim = objects.plant?.getObjectByName('Cylinder 2');
  const pivot = rim?.position.clone() || new THREE.Vector3();
  if (rim) pivot.y += (rim.data?.geometry?.height ?? 23) * rim.scale.y / 2;
  plantInteraction = createPlantInteraction(foliage.map(part => splineApp.findObjectById(part.uuid)), pivot);

  const body = objects.coffee?.getObjectByName('Cylinder 11');
  let liquid = null, top = 1, bottom = 0;
  if (body?.geometry) {
    try {
      body.geometry.computeBoundingBox();
      const bounds = body.geometry.boundingBox;
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      top = bounds.max.y - size.y * 0.16;
      bottom = bounds.min.y + size.y * 0.15;
      liquid = await splineApp.createObject('Cylinder', {
        name: 'Portfolio Coffee Liquid', parent: body.uuid,
        position: [center.x, top, center.z],
        width: size.x * 0.75, depth: size.z * 0.75, height: size.y * 0.018,
        radialSegments: 32, cornerRadius: 0, hollow: 0,
        material: { color: '#482719', roughness: 0.3 }, castShadow: false
      });
    } catch (error) {
      console.warn('Coffee liquid unavailable; mug interaction remains usable.', error);
    }
  }
  const tiltDirection = new THREE.Vector3(0, 0, 1);
  const seat = objects.chair?.getObjectByName('Cube 50') || objects.chair;
  if (seat && objects.coffee?.parent) {
    const target = seat.getWorldPosition(new THREE.Vector3());
    const origin = (body || objects.coffee).getWorldPosition(new THREE.Vector3());
    const parent = objects.coffee.parent;
    tiltDirection.copy(parent.worldToLocal(target)).sub(parent.worldToLocal(origin));
    tiltDirection.y = 0;
  }
  coffeeInteraction = createCoffeeInteraction(
    objects.coffee && splineApp.findObjectById(objects.coffee.uuid), liquid, { top, bottom, tiltDirection }
  );

  const element = document.createElement('div');
  element.className = 'room-effects';
  element.setAttribute('aria-hidden', 'true');
  element.hidden = true;
  element.innerHTML = `${'<span class="water-droplet"></span>'.repeat(8)}${'<svg class="coffee-steam" viewBox="0 0 16 36"><path d="M8 34C-3 24 19 21 8 11C2 5 9 2 10 1"/></svg>'.repeat(3)}`;
  appEl.appendChild(element);
  roomEffects = { element, rim, body, point: new THREE.Vector3(),
    drops: [...element.querySelectorAll('.water-droplet')],
    steam: [...element.querySelectorAll('.coffee-steam')] };

  document.addEventListener('visibilitychange', () => updateObjectInteractions(performance.now()));
  interactionMotionMedia.addEventListener('change', () => updateObjectInteractions(performance.now()));
}

function updateObjectInteractions(now) {
  const options = { visible: !document.hidden, reduced: interactionMotionMedia.matches };
  plantInteraction?.update(now, options);
  coffeeInteraction?.update(now, options);
  updateInteractionLabels();
  if (document.hidden || interactionMotionMedia.matches) {
    if (roomEffects) roomEffects.element.hidden = true;
  }
}

function updateInteractionLabels() {
  if (!plantInteraction || !coffeeInteraction) return;
  for (const id of ['plant', 'coffee']) {
    const spot = HOTSPOTS.find(item => item.id === id);
    const interaction = id === 'plant' ? plantInteraction : coffeeInteraction;
    const status = id === 'plant'
      ? `${interaction.hydration}% hydrated · ${interaction.hydration === 100 ? 'All watered' : 'Water plant'}`
      : interaction.sips === 0 ? 'Empty · Refill coffee' : `${interaction.sips} of 4 sips left · Take a sip`;
    const busy = String(interaction.busy);
    if (spot.statusText !== status) {
      spot.statusText = status;
      if (spot.domElement) {
        spot.domElement.querySelector('.hotspot-progress').textContent = status;
        spot.domElement.setAttribute('aria-label', `${spot.label}: ${status}`);
      }
      if (id === 'plant' && waterPlantBtn) waterPlantBtn.setAttribute('aria-label', `Water Plant: ${status}`);
      if (state.hoveredInteractive === spot) hoverTooltip.textContent = `${spot.icon} ${spot.label} — ${status}`;
    }
    if (spot.interactionBusy !== busy) {
      spot.interactionBusy = busy;
      spot.domElement?.setAttribute('aria-disabled', busy);
      if (id === 'plant' && waterPlantBtn) waterPlantBtn.setAttribute('aria-disabled', busy);
    }
  }
}

function updateRoomEffects() {
  if (!roomEffects || !threeCamera) return;
  const { element, rim, body, point, drops, steam } = roomEffects;
  element.hidden = !!activeModal || state.zenMode || document.hidden || interactionMotionMedia.matches
    || (!plantInteraction.busy && !coffeeInteraction.busy);
  if (element.hidden) return;
  const rect = sceneViewport;
  if (!rect) return;
  const scale = threeCamera.zoom / DEFAULT_CAM_ZOOM;
  function place(node, opacity) {
    point.project(threeCamera);
    node.style.opacity = point.z < -1 || point.z > 1 ? '0' : String(opacity);
    node.style.transform = `translate(${(point.x * 0.5 + 0.5) * rect.width}px, ${(-point.y * 0.5 + 0.5) * rect.height}px) translate(-50%, -100%) scale(${scale})`;
  }
  drops.forEach((drop, i) => {
    const p = (plantInteraction.progress - i * 0.045) / 0.55;
    if (!rim || !plantInteraction.busy || !plantInteraction.watering || p <= 0 || p >= 1) {
      drop.style.opacity = '0';
      return;
    }
    point.set(0, rim.geometry?.boundingBox?.max.y ?? 11.5, 0);
    rim.localToWorld(point);
    point.x += Math.sin(i * 2.4) * 10;
    point.z += Math.cos(i * 2.4) * 7;
    point.y += 42 * (1 - p * p);
    place(drop, Math.sin(Math.PI * p) * 0.95);
  });
  steam.forEach((wisp, i) => {
    const p = (coffeeInteraction.progress - i * 0.12) / 0.7;
    if (!body || !coffeeInteraction.busy || p <= 0 || p >= 1) {
      wisp.style.opacity = '0';
      return;
    }
    point.set(0, body.geometry?.boundingBox?.max.y ?? 11.5, 0);
    body.localToWorld(point);
    point.y += p * 20;
    point.x += (i - 1) * 3 + Math.sin(p * Math.PI * 2) * 2;
    place(wisp, Math.sin(Math.PI * p) * 0.65);
  });
}

// Setup 3D Hotspot DOM Elements
function setupHotspots() {
  hotspotContainer.innerHTML = '';
  // Spline finalizes the camera through its controls immediately before rendering.
  canvas.addEventListener('rendered', () => {
    updateHotspots();
    updateRoomEffects();
  });
  const bubbleSpots = new Map();
  const bubbleObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const spot = bubbleSpots.get(entry.target);
      const box = entry.borderBoxSize?.[0];
      const width = box?.inlineSize ?? entry.target.offsetWidth;
      const height = box?.blockSize ?? entry.target.offsetHeight;
      // Keep the last useful measurement while an off-screen pin is hidden.
      if (width > 0 && height > 0) {
        spot.bubbleSize = { width, height };
        spot.layoutDirty = true;
      }
    }
  });
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
      <div class="hotspot-label">${spot.label}${['plant', 'coffee'].includes(spot.id) ? '<span class="hotspot-progress"></span>' : ''}</div>
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
      const hoverPin = event => {
        const target = getPinHotspot(event, spot);
        for (const pin of HOTSPOTS) pin.pinHovered = pin === target;
      };
      el.addEventListener('pointerenter', hoverPin);
      el.addEventListener('pointermove', hoverPin);
      el.addEventListener('pointerleave', () => {
        for (const pin of HOTSPOTS) pin.pinHovered = false;
      });
    }
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = e.detail === 0 ? spot : getPinHotspot(e, spot);
      activateHotspot(target, target.domElement);
    });
    hotspotContainer.appendChild(el);
    spot.domElement = el;
    spot.worldMatrix = new THREE.Matrix4();
    spot.layoutDirty = true;
    if (spot.secondary) {
      spot.bubbleSize = { width: 0, height: 0 };
      bubbleSpots.set(spot.bubble, spot);
      bubbleObserver.observe(spot.bubble);
    }
  });
  gsap.matchMedia().add({ motion: '(prefers-reduced-motion: no-preference)', reduced: '(prefers-reduced-motion: reduce)' }, context => {
    HOTSPOTS.filter(spot => spot.secondary).forEach(spot => {
      spot.reducedMotion = context.conditions.reduced;
      spot.revealed = null;
      spot.layoutDirty = true;
      spot.bubbleRise = null;
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

// Small layouts can overlap 44px targets; honor the circle closest to the tap.
function getPinHotspot(event, fallback) {
  if (event.target?.closest('.hotspot-bubble')) return fallback;
  if (!sceneViewport) return fallback;
  const x = event.clientX - sceneViewport.left;
  const y = event.clientY - sceneViewport.top;
  let nearest = fallback, distance = Infinity;
  for (const spot of HOTSPOTS) {
    if (!spot.domElement || spot.domElement.hidden) continue;
    const dx = x - spot.screenX, dy = y - spot.screenY;
    if (Math.abs(dx) > 22 || Math.abs(dy) > 22) continue;
    const squared = dx * dx + dy * dy;
    if (squared < distance) { nearest = spot; distance = squared; }
  }
  return nearest;
}

// Update Hotspot Screen Positions
function updateHotspots(projectPositions = true) {
  if (!threeCamera || !sceneViewport) return;
  if (!state.pinsVisible || activeModal) {
    hotspotsDirty = true;
    for (const spot of HOTSPOTS) {
      if (!spot.secondary || !spot.domElement) continue;
      spot.pinHovered = false;
      setHotspotRevealed(spot, false);
    }
    return;
  }
  if (!projectPositions) {
    for (const spot of HOTSPOTS) {
      if (spot.domElement) updateHotspotBubble(spot);
    }
    return;
  }
  const rect = sceneViewport;
  const v = hotspotPoint;
  threeCamera.updateWorldMatrix(true, false);
  const cameraChanged = !hotspotCameraWorld.equals(threeCamera.matrixWorld)
    || !hotspotCameraProjection.equals(threeCamera.projectionMatrix);
  hotspotCameraWorld.copy(threeCamera.matrixWorld);
  hotspotCameraProjection.copy(threeCamera.projectionMatrix);

  HOTSPOTS.forEach(spot => {
    const obj = objects[spot.objKey];
    if (!spot.domElement) return;
    if (!obj) {
      spot.domElement.hidden = true;
      return;
    }

    obj.updateWorldMatrix(true, false);
    const project = hotspotsDirty || cameraChanged || spot.layoutDirty || !spot.worldMatrix.equals(obj.matrixWorld);
    if (!project) {
      updateHotspotBubble(spot);
      return;
    }
    spot.worldMatrix.copy(obj.matrixWorld);
    spot.layoutDirty = false;
    obj.getWorldPosition(v);
    v.y += spot.offsetY ?? 40;
    v.project(threeCamera);

    // Check if within frustum bounds
    const isVisible = v.z >= -1 && v.z < 1 && v.x >= -1.2 && v.x <= 1.2 && v.y >= -1.2 && v.y <= 1.2;
    spot.domElement.hidden = !isVisible;
    if (!isVisible) return;

    const x = (v.x * 0.5 + 0.5) * rect.width + (spot.offsetX ?? 0) * threeCamera.zoom / DEFAULT_CAM_ZOOM;
    const y = (-v.y * 0.5 + 0.5) * rect.height;
    spot.screenX = x;
    spot.screenY = y;
    if (spot.secondary) {
      const { width, height } = spot.bubbleSize;
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
      spot.bubbleX = THREE.MathUtils.clamp(x, width / 2 + 8, rect.width - width / 2 - 8) - x;
      spot.bubbleY = bubbleY - y;
      spot.bubbleRise = null;
    }

    spot.domElement.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    updateHotspotBubble(spot);
  });
  hotspotsDirty = false;
}

function updateHotspotBubble(spot) {
  if (!spot.secondary) return;
  setHotspotRevealed(spot, !spot.domElement.hidden && !isDragging
    && (state.hoveredInteractive === spot || spot.pinHovered || spot.domElement.matches(':focus-visible')));
  if (spot.domElement.hidden) return;
  if (spot.bubbleRise === spot.motion.rise) return;
  spot.setBubbleX(spot.bubbleX * spot.motion.rise);
  spot.setBubbleY(spot.bubbleY * spot.motion.rise);
  spot.bubbleRise = spot.motion.rise;
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
  updateObjectInteractions(now);

  // 3. Camera transition animation
  const cameraAnimating = currentCamAnim || zoomBounce;
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

  // Raw camera edits must still render between the slower atmosphere updates.
  if (cameraAnimating) splineApp?.requestRender();
  flushPointerHover();
  // Label reveals keep animating even when Spline has no new frame to render.
  updateHotspots(false);
}

// Camera Preset Transition
function setCameraPreset(presetName, { notify = true, audible = true } = {}) {
  const preset = CAMERA_PRESETS[presetName];
  if (!preset || !threeCamera) return;

  state.cameraPreset = presetName;
  if (audible) sound.playPop(1.1);

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

  if (notify) showToast(`Perspective switched to ${presetName.toUpperCase()}`, '📐');
}

// Lighting & Atmosphere Transition
function setTheme(themeName, { notify = true, restartCycle = true } = {}) {
  const theme = THEMES[themeName];
  if (!theme || (state.zenMode && themeName !== 'night')) return;

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
    if (progress === 1) {
      themeTransition = null;
      lastCycleUpdate = now;
    }
    return;
  }
  if (dayNightCycleStart === null || state.zenMode) return;
  if (now - lastCycleUpdate < 100) return;
  lastCycleUpdate = now;
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
    splineApp?.requestRender();
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
  if (!plantInteraction || document.hidden) return;
  const action = plantInteraction.water(performance.now(), { reduced: interactionMotionMedia.matches });
  if (!action) return;
  if (action === 'water') sound.playWaterPour();
  else sound.playPop(0.8);
  updateInteractionLabels();
  showToast(action === 'water' ? `Plant watered · ${plantInteraction.hydration}% hydrated` : 'Already watered · Happy as can be', action === 'water' ? '💧' : '🌱');
  return action;
}

// Coffee Interaction
function drinkCoffee() {
  if (!coffeeInteraction || document.hidden) return;
  const action = coffeeInteraction.drink(performance.now(), { reduced: interactionMotionMedia.matches });
  if (!action) return;
  if (action === 'refill') sound.playCoffeePour();
  else sound.playCoffeeSip();
  updateInteractionLabels();
  showToast(action === 'refill' ? 'Freshly refilled · Four sips to enjoy'
    : coffeeInteraction.sips ? `A little coffee break · ${coffeeInteraction.sips} ${coffeeInteraction.sips === 1 ? 'sip' : 'sips'} left`
      : 'Last sip · Tap the mug to refill', '☕');
  return action;
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
  if (activePointers.size) {
    const distance = Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y);
    if (distance > 6) {
      isDragging = true;
      hoverTooltip.classList.remove('visible');
    }
    return;
  }

  pendingHover = e;
}

function flushPointerHover() {
  const e = pendingHover;
  pendingHover = null;
  if (!e || activePointers.size || activeModal || document.hidden) return;
  const targetSpot = getInteractiveAtPointer(e);

  if (targetSpot) {
    state.hoveredInteractive = targetSpot;
    canvas.classList.add('pointer-cursor');
    hoverTooltip.textContent = `${targetSpot.icon} ${targetSpot.label} — ${targetSpot.statusText || 'Click to interact'}`;
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
  pendingHover = null;
  activePointers.add(e.pointerId);
  // A pinch stays a gesture until every participating pointer has lifted.
  if (activePointers.size > 1 || !e.isPrimary) {
    isDragging = true;
    hoverTooltip.classList.remove('visible');
    return;
  }
  isDragging = false;
  pointerStart.x = e.clientX;
  pointerStart.y = e.clientY;
}

function handlePointerUp(e) {
  const wasDown = activePointers.delete(e.pointerId);
  if (wasDown && e.isPrimary && e.button === 0 && !isDragging && !activePointers.size) {
    // Touch taps have no preceding hover, so pick at the release position.
    const targetSpot = getInteractiveAtPointer(e);
    if (targetSpot) {
      activateHotspot(targetSpot);
    }
  }
  if (!activePointers.size) isDragging = false;
}

function handlePointerCancel(e) {
  if (!activePointers.delete(e.pointerId)) return;
  isDragging = activePointers.size > 0;
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
  if (toastContainer.childElementCount >= 4) {
    gsap.killTweensOf(toastContainer.firstElementChild);
    toastContainer.firstElementChild.remove();
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  toastContainer.appendChild(toast);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  gsap.timeline({ onComplete: () => toast.remove() })
    .fromTo(toast,
      { autoAlpha: 0, y: reducedMotion ? 0 : 8, scale: reducedMotion ? 1 : 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: reducedMotion ? 0 : 0.4, ease: 'back.out(1.2)' })
    .to(toast,
      { autoAlpha: 0, y: reducedMotion ? 0 : -6, scale: reducedMotion ? 1 : 0.97, duration: reducedMotion ? 0 : 0.22, ease: 'power2.in' },
      3.5);
}

// Modal Handlers
function setupModalSectionMotion() {
  document.querySelectorAll('.modal-nav').forEach(nav => {
    const buttons = [...nav.querySelectorAll('button')];
    nav.style.setProperty('--active-section', buttons.indexOf(nav.querySelector('[aria-current]')));
    nav.classList.add('is-animated');
  });
  gsap.matchMedia().add({ reduced: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)' }, context => {
    reduceModalMotion = context.conditions.reduced;
    if (reduceModalMotion) modalSectionTimeline?.progress(1);
  });
}

function openModal(modalName, trigger = null) {
  const targetModal = { projects: projectsModal, skills: skillsModal, about: aboutModal }[modalName];
  if (!targetModal || targetModal === activeModal) return;
  const switchingSections = Boolean(activeModal && trigger?.closest('.modal-nav'));
  const previousNav = activeModal?.querySelector('.modal-nav');
  // Read the visible highlight before cancelling an interrupted switch.
  const previousSection = previousNav ? Number(gsap.getProperty(previousNav, '--active-section')) : 0;
  const previousIndex = previousNav ? [...previousNav.querySelectorAll('button')].indexOf(previousNav.querySelector('[aria-current]')) : 0;
  const focused = trigger || document.activeElement;
  const returnTarget = focused instanceof HTMLElement && focused !== document.body && !activeModal?.contains(focused)
    ? focused
    : modalReturnFocus || document.querySelector(`[data-modal="${modalName}"]`);
  closeAllModals({ restoreFocus: false, immediate: switchingSections });
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
  targetModal.classList.toggle('section-switch', switchingSections);
  targetModal.classList.add('open');
  targetModal.querySelector('.modal-body').scrollTop = 0;
  if (switchingSections) {
    const nav = targetModal.querySelector('.modal-nav');
    const index = [...nav.querySelectorAll('button')].indexOf(nav.querySelector('[aria-current]'));
    const content = targetModal.querySelectorAll('.modal-body');
    const direction = Math.sign(index - previousIndex);
    const finish = () => {
      gsap.set(content, { clearProps: 'transform,opacity' });
      targetModal.classList.remove('section-switch');
      modalSectionTimeline = null;
    };
    gsap.set(nav, { '--active-section': previousSection });
    modalSectionTimeline = gsap.timeline({ onComplete: finish })
      .to(nav, { '--active-section': index, duration: 0.42, ease: 'power3.inOut' }, 0)
      .fromTo(content, { x: direction * 22, opacity: 0 }, {
        x: 0, opacity: 1, duration: 0.34, stagger: 0.045, ease: 'power3.out'
      }, 0.04);
    if (reduceModalMotion) modalSectionTimeline.progress(1);
  }
  // Wait for the visibility change before focusing the previously hidden dialog.
  requestAnimationFrame(() => {
    if (activeModal !== targetModal) return;
    const focusTarget = targetModal.querySelector(switchingSections ? '.modal-nav [aria-current]' : '[role="dialog"]');
    focusTarget.focus({ preventScroll: true });
  });
  hoverTooltip.classList.remove('visible');
}

function closeAllModals({ restoreFocus = true, immediate = false } = {}) {
  if (!activeModal) return;
  modalSectionTimeline?.kill();
  modalSectionTimeline = null;
  gsap.set(activeModal.querySelectorAll('.modal-body'), { clearProps: 'transform,opacity' });
  const nav = activeModal.querySelector('.modal-nav');
  nav.style.setProperty('--active-section', [...nav.querySelectorAll('button')].indexOf(nav.querySelector('[aria-current]')));
  activeModal.classList.toggle('section-switch', immediate);
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
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px; white-space: pre-line;">${p.category}</div>
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
              <span>${link.label}</span>
              <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="/ui-icons.svg#arrow-up-right"/></svg>
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
          <h3 class="skill-category-title">${cat.category}</h3>
          <div class="skills-row">
            ${cat.items.map(s => `
              <div class="skill-card">
                ${s.name}
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
          <div class="profile-location"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="/ui-icons.svg#map-pin"/></svg><span>${dev.location}</span></div>
        </div>

        <div class="profile-photo-frame">
          <img class="profile-photo" src="${dev.photo}" alt="${dev.photoAlt}" width="1600" height="1200" decoding="async">
        </div>

        <p class="profile-bio">${dev.bio}</p>

        <section class="contact-section" aria-labelledby="contactHeading">
          <h3 class="skill-category-title" id="contactHeading">Let's connect</h3>
          <p class="contact-description">For projects, collaborations, or a hello.</p>
          <div class="profile-socials">
            <a href="mailto:${dev.email}" class="social-pill contact-email-link">
              <svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
              <span>Email</span>
              <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="/ui-icons.svg#arrow-up-right"/></svg>
            </a>
            ${dev.socials.map(s => `
              <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="social-pill">
                ${s.icon === 'linkedin' ? `<svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor"><path d="M20.45 2H3.55C2.69 2 2 2.68 2 3.52v16.96C2 21.32 2.69 22 3.55 22h16.9c.86 0 1.55-.68 1.55-1.52V3.52C22 2.68 21.31 2 20.45 2ZM7.93 18.75H4.98V9.2h2.95v9.55ZM6.45 7.89a1.71 1.71 0 1 1 0-3.42 1.71 1.71 0 0 1 0 3.42Zm12.3 10.86H15.8v-4.64c0-1.11-.02-2.54-1.55-2.54-1.55 0-1.79 1.21-1.79 2.46v4.72H9.51V9.2h2.83v1.31h.04c.39-.74 1.35-1.52 2.79-1.52 2.98 0 3.58 1.96 3.58 4.51v5.25Z"/></svg>` : ''}
                <span>${s.label}</span>
                <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="/ui-icons.svg#arrow-up-right"/></svg>
              </a>
            `).join('')}
          </div>
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
    pendingHover = null;
    state.hoveredInteractive = null;
    canvas.classList.remove('pointer-cursor');
    hoverTooltip.classList.remove('visible');
  });
  canvas.addEventListener('pointermove', keepOrbitDragActive);
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', handlePointerCancel);
  canvas.addEventListener('lostpointercapture', handlePointerCancel);
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

// DOM controls are available independently of the renderer.
function setupEventListeners() {
  setupModalSectionMotion();
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
    muteBtn.querySelector('use').setAttribute('href', `/ui-icons.svg#${isMuted ? 'volume-x' : 'volume-2'}`);
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
      if (isOpen && e.detail === 0) (dropdown.querySelector('[aria-checked="true"]') || items[0]).focus();
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
      // Safari taps can blur to no target before click; outside clicks handle that case.
      if (e.relatedTarget && !dropdown.contains(e.relatedTarget)) setDockDropdownOpen(dropdown, false);
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
    fullscreenBtn.querySelector('use').setAttribute('href', `/ui-icons.svg#${document.fullscreenElement ? 'minimize' : 'maximize'}`);
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
