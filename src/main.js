import * as THREE from 'three';
import { gsap } from 'gsap';
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { sound } from './audio.js';
import { PORTFOLIO_DATA } from './data.js';
import { waitForSceneReady } from './scene-ready.js';
import { DAY_NIGHT_CYCLE_MS, DAY_NIGHT_PHASES, getDayNightPhase } from './day-night-cycle.js';
import { loadDeskController } from './desk-controller.js';
import { applyRoomPalette } from './room-palette.js';
import { createChairSwivel, createWallClock, createPlantInteraction } from './scene-motion.js';

// DOM References
const appEl = document.getElementById('app');
const canvas = document.getElementById('canvas3d');
const skyAtmosphere = document.getElementById('skyAtmosphere');
const skyClouds = document.getElementById('skyClouds');
const cloudDitherShadow = document.getElementById('cloudDitherShadow');
const skyStars = document.getElementById('skyStars');
const loadingScreen = document.getElementById('loadingScreen');
const loadingBackdrop = document.getElementById('loadingBackdrop');
const loadingStatus = document.getElementById('loadingStatus');
const loaderSpinner = document.getElementById('loaderSpinner');
const loadingAboutBtn = document.getElementById('loadingAboutBtn');
const retrySceneBtn = document.getElementById('retrySceneBtn');
const hotspotContainer = document.getElementById('hotspotContainer');
const hoverTooltip = document.getElementById('hoverTooltip');
const plantHydration = document.getElementById('plantHydration');
const plantHydrationSurface = document.getElementById('plantHydrationSurface');
const plantHydrationFill = document.getElementById('plantHydrationFill');
const zenOverlay = document.getElementById('zenOverlay');
const zenClock = document.getElementById('zenClock');

// Modals
const projectsModal = document.getElementById('projectsModal');
const funProjectsModal = document.getElementById('funProjectsModal');
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
const lightingSlider = document.getElementById('lightingSlider');
const lightingThumb = document.getElementById('lightingThumb');
const lightingThumbSurface = document.getElementById('lightingThumbSurface');
const lightingSliderMotion = { value: 100 };
let lightingThumbPressed = false;
const lightingIcons = [...document.querySelectorAll('.lighting-stops .ui-icon')];
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
  theme: 'night',
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
let plantMeterUntil = 0;
const plantMeterBounds = [];
const plantMeterPoint = new THREE.Vector3();
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

// Lighting and decorative sky share one blend throughout the cycle.
const THEMES = {
  night: {
    bg: new THREE.Color('#51495E'),
    sunColor: new THREE.Color('#B9B1DE'),
    sunIntensity: 0.30,
    skyColor: new THREE.Color('#8D88AF'),
    skyIntensity: 0.25,
    lampIntensity: 1.6,
    cloudColor: new THREE.Color('#D4C3EF'),
    cloudShadowColor: new THREE.Color('#604970'),
    cloudOpacity: 0.15,
    starOpacity: 1,
    label: 'Cozy Night'
  },
  day: {
    bg: new THREE.Color('#D8E8E7'),
    sunColor: new THREE.Color('#FFF1DC'),
    sunIntensity: 1.05,
    skyColor: new THREE.Color('#D5E1CE'),
    skyIntensity: 0.60,
    lampIntensity: 0.15,
    cloudColor: new THREE.Color('#FFFCF6'),
    cloudShadowColor: new THREE.Color('#90AAA9'),
    cloudOpacity: 1,
    starOpacity: 0,
    label: 'Soft Daylight'
  },
  sunset: {
    bg: new THREE.Color('#DEA6B6'),
    sunColor: new THREE.Color('#FFD9CA'),
    sunIntensity: 0.80,
    skyColor: new THREE.Color('#D4C3EF'),
    skyIntensity: 0.50,
    lampIntensity: 1.3,
    cloudColor: new THREE.Color('#F7E1D2'),
    cloudShadowColor: new THREE.Color('#B2748B'),
    cloudOpacity: 0.70,
    starOpacity: 0.15,
    label: 'Pastel Sunset'
  }
};
const cycleBackgroundColor = THEMES.night.bg.clone();
const runtimeBackgroundColor = cycleBackgroundColor.clone();
const cycleCloudColor = THEMES.night.cloudColor.clone();
const cycleCloudShadowColor = THEMES.night.cloudShadowColor.clone();
let cycleCloudOpacity = THEMES.night.cloudOpacity;
let cycleStarOpacity = THEMES.night.starOpacity;
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
  controller: null,
  bed: null,
  plant: null,
  clock: null,
  clockHour: null,
  clockMin: null,
  books: null,
  window: null,
  stickyNotes: null
};

// Hotspot definitions mapped to 3D room objects
const HOTSPOTS = [
  { id: 'funProjects', name: 'Gaming Controller', label: 'Creative Playground', icon: '🎮', objKey: 'controller', cameraPreset: 'desk', offsetY: 3, revealOffsetY: 12, action: trigger => openModal('funProjects', trigger) },
  { id: 'projects', name: 'Computer', label: 'Projects', icon: '💻', objKey: 'computer', cameraPreset: 'desk', offsetY: 0, revealOffsetY: 27, action: trigger => openModal('projects', trigger) },
  { id: 'lamp', name: 'Bed Table', label: 'Bedside Lamp', icon: '💡', objKey: 'bedTable', offsetY: 50, revealOffsetY: 65, action: () => toggleLamp() },
  { id: 'chair', name: 'Chair', label: 'Swivel Chair', icon: '🪑', objKey: 'chair', cameraPreset: 'desk', offsetY: 0, revealOffsetY: 45, action: () => spinChair() },
  { id: 'skills', name: 'Books', label: 'Skills', icon: '📚', objKey: 'books', offsetY: 0, revealOffsetY: 27, action: trigger => openModal('skills', trigger) },
  { id: 'plant', name: 'Plant', label: 'Water Plant', icon: '💧', objKey: 'plant', offsetY: 0, revealOffsetY: 50, action: () => waterPlant() },
  { id: 'bed', name: 'Bed', label: 'Zen Mode', icon: '🛏️', objKey: 'bed', cameraPreset: 'bed', offsetY: 0, revealOffsetY: 25, action: () => toggleZenMode() },
  { id: 'window', name: 'Window', label: 'Atmosphere & Sky', icon: '🌤️', objKey: 'window', pin: false, action: () => cycleTheme() },
  { id: 'about', name: 'Sticky Notes', label: 'About Me', icon: '👤', objKey: 'stickyNotes', cameraPreset: 'desk', offsetY: 0, action: trigger => openModal('about', trigger) }
];

function activateHotspot(spot, trigger = null) {
  if (spot.id === 'plant') {
    const accepted = spot.action(trigger);
    if (accepted && spot.cameraPreset && (!currentCamAnim || state.cameraPreset !== spot.cameraPreset)) {
      setCameraPreset(spot.cameraPreset, { audible: false });
    }
    return accepted;
  }
  sound.playPop();
  if (spot.cameraPreset && (!currentCamAnim || state.cameraPreset !== spot.cameraPreset)) {
    setCameraPreset(spot.cameraPreset);
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
    applyRoomPalette(splineApp, threeScene);
    objects.controller = await loadDeskController(splineApp, threeScene);
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
  const bounds = objects.plant && new THREE.Box3().setFromObject(objects.plant);
  if (bounds && !bounds.isEmpty()) {
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          plantMeterBounds.push(objects.plant.worldToLocal(new THREE.Vector3(x, y, z)));
        }
      }
    }
  }

  const element = document.createElement('div');
  element.className = 'room-effects';
  element.setAttribute('aria-hidden', 'true');
  element.hidden = true;
  element.innerHTML = '<span class="water-droplet"></span>'.repeat(8);
  appEl.appendChild(element);
  roomEffects = { element, rim, point: new THREE.Vector3(),
    drops: [...element.querySelectorAll('.water-droplet')] };

  document.addEventListener('visibilitychange', () => updateObjectInteractions(performance.now()));
  interactionMotionMedia.addEventListener('change', () => {
    updateObjectInteractions(performance.now());
    if (interactionMotionMedia.matches) animatePlantMeter(plantHydration.classList.contains('is-visible'));
  });
}

function updateObjectInteractions(now) {
  const options = { visible: !document.hidden, reduced: interactionMotionMedia.matches };
  plantInteraction?.update(now, options);
  updateInteractionLabels();
  updatePlantMeter(now);
  if (document.hidden || interactionMotionMedia.matches) {
    if (roomEffects) roomEffects.element.hidden = true;
  }
}

function updateInteractionLabels() {
  if (!plantInteraction) return;
  const spot = HOTSPOTS.find(item => item.id === 'plant');
  const interaction = plantInteraction;
  const status = `${interaction.hydration}% hydrated · ${interaction.hydration === 100 ? 'All watered' : 'Water plant'}`;
  const busy = String(interaction.busy);
  if (spot.statusText !== status) {
    spot.statusText = status;
    canvas.classList.toggle('is-hydrated', interaction.hydration === 100);
    spot.domElement?.classList.toggle('is-hydrated', interaction.hydration === 100);
    if (spot.domElement) {
      spot.domElement.setAttribute('aria-label', `${spot.label}: ${status}`);
    }
    plantHydration.setAttribute('aria-valuenow', String(interaction.hydration));
    plantHydrationFill.style.clipPath = `inset(${100 - interaction.hydration}% 0 0)`;
    if (waterPlantBtn) waterPlantBtn.setAttribute('aria-label', `Water Plant: ${status}`);
  }
  if (spot.interactionBusy !== busy) {
    spot.interactionBusy = busy;
    spot.domElement?.setAttribute('aria-disabled', busy);
    spot.domElement?.classList.toggle('is-watering', interaction.busy && interaction.watering);
    canvas.classList.toggle('is-watering', interaction.busy && interaction.watering);
    if (waterPlantBtn) waterPlantBtn.setAttribute('aria-disabled', busy);
  }
}

function updatePlantMeter(now, projectPosition = false) {
  const spot = HOTSPOTS.find(item => item.id === 'plant');
  const hovered = !!spot && !isDragging && (state.hoveredInteractive === spot || spot.pinHovered
    || spot?.domElement?.matches(':focus-visible'));
  const visible = !!(plantInteraction && threeCamera && sceneViewport && plantMeterBounds.length
    && !activeModal && !state.zenMode && !document.hidden
    && (hovered || now < plantMeterUntil));
  const wasVisible = plantHydration.classList.contains('is-visible');
  if (visible && (projectPosition || !wasVisible)) positionPlantMeter();
  if (visible !== wasVisible) {
    plantHydration.classList.toggle('is-visible', visible);
    plantHydration.setAttribute('aria-hidden', String(!visible));
    animatePlantMeter(visible);
  }
}

// Animate the surface separately so camera projection retains the outer transform.
function animatePlantMeter(visible) {
  const immediate = interactionMotionMedia.matches || document.hidden || !!activeModal || state.zenMode;
  gsap.to(plantHydration, {
    autoAlpha: visible ? 1 : 0,
    duration: immediate ? 0 : 0.2,
    overwrite: true
  });
  gsap.to(plantHydrationSurface, {
    y: visible ? 0 : 5,
    scale: visible ? 1 : 0.9,
    duration: immediate ? 0 : visible ? 0.36 : 0.2,
    ease: visible ? 'back.out(1.3)' : 'power2.in',
    overwrite: true
  });
}

function positionPlantMeter() {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  const rect = sceneViewport;
  for (const corner of plantMeterBounds) {
    plantMeterPoint.copy(corner);
    objects.plant.localToWorld(plantMeterPoint);
    plantMeterPoint.project(threeCamera);
    const x = (plantMeterPoint.x * 0.5 + 0.5) * rect.width;
    const y = (-plantMeterPoint.y * 0.5 + 0.5) * rect.height;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  // Inset the conservative projected box toward the foliage; keep a 2px gap.
  const inset = (right - left) * 0.1;
  left += inset; right -= inset;
  // Match the 22 × 76px pill and leave the bottom dock clear.
  const x = THREE.MathUtils.clamp(left >= 32 ? left - 24 : right + 2, 8, rect.width - 30);
  const y = THREE.MathUtils.clamp((top + bottom) / 2 - 38, 12, Math.max(12, rect.height - 176));
  plantHydration.style.transform = `translate(${x}px, ${y}px)`;
}

function updateRoomEffects() {
  if (!roomEffects || !threeCamera) return;
  const { element, rim, point, drops } = roomEffects;
  element.hidden = !!activeModal || state.zenMode || document.hidden || interactionMotionMedia.matches
    || !plantInteraction.busy;
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

}

// Setup 3D Hotspot DOM Elements
function setupHotspots() {
  hotspotContainer.innerHTML = '';
  // Spline finalizes the camera through its controls immediately before rendering.
  canvas.addEventListener('rendered', () => {
    updateHotspots();
    updatePlantMeter(performance.now(), true);
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
    el.className = 'hotspot-pin';
    el.id = `hotspot-${spot.id}`;
    el.setAttribute('aria-label', spot.label);
    el.hidden = true;
    const content = `
      <div class="hotspot-icon" aria-hidden="true">${spot.icon}</div>
      <div class="hotspot-label">${spot.label}</div>
    `;
    el.innerHTML = `<span class="hotspot-ring" aria-hidden="true"></span><span class="hotspot-bubble">${content}</span>`;
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
      if (event.pointerType === 'touch') return;
      const target = getPinHotspot(event, spot);
      for (const pin of HOTSPOTS) pin.pinHovered = pin === target;
    };
    el.addEventListener('pointerenter', hoverPin);
    el.addEventListener('pointermove', hoverPin);
    el.addEventListener('pointerleave', () => {
      for (const pin of HOTSPOTS) pin.pinHovered = false;
    });
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = e.detail === 0 ? spot : getPinHotspot(e, spot);
      activateHotspot(target, target.domElement);
    });
    hotspotContainer.appendChild(el);
    spot.domElement = el;
    spot.worldMatrix = new THREE.Matrix4();
    spot.layoutDirty = true;
    spot.bubbleSize = { width: 0, height: 0 };
    bubbleSpots.set(spot.bubble, spot);
    bubbleObserver.observe(spot.bubble);
  });
  gsap.matchMedia().add({ motion: '(prefers-reduced-motion: no-preference)', reduced: '(prefers-reduced-motion: reduce)' }, context => {
    HOTSPOTS.filter(spot => spot.domElement).forEach(spot => {
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
      if (!spot.domElement) continue;
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
    const pointerX = THREE.MathUtils.clamp(width / 2 - spot.bubbleX, 12, Math.max(12, width - 12));
    spot.domElement.style.setProperty('--pin-pointer-x', `${pointerX}px`);
    spot.bubbleY = bubbleY - y;
    spot.bubbleRise = null;

    spot.domElement.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    updateHotspotBubble(spot);
  });
  hotspotsDirty = false;
}

function updateHotspotBubble(spot) {
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
function setCameraPreset(presetName, { audible = true } = {}) {
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
}

// Lighting & Atmosphere Transition
function captureThemeLighting() {
  const current = THEMES[state.theme];
  return {
    bg: cycleBackgroundColor.clone(),
    cloudColor: cycleCloudColor.clone(),
    cloudShadowColor: cycleCloudShadowColor.clone(),
    cloudOpacity: cycleCloudOpacity,
    starOpacity: cycleStarOpacity,
    sunColor: objects.sunLight?.color.clone() ?? current.sunColor.clone(),
    sunIntensity: objects.sunLight?.intensity ?? current.sunIntensity,
    skyColor: objects.skyLight?.color.clone() ?? current.skyColor.clone(),
    skyIntensity: objects.skyLight?.intensity ?? current.skyIntensity,
    lampIntensity: objects.lampLight1?.intensity ?? (state.lampOn ? current.lampIntensity : 0)
  };
}

function setTheme(themeName, { restartCycle = true } = {}) {
  const theme = THEMES[themeName];
  if (!theme || (state.zenMode && themeName !== 'night')) return;

  const now = performance.now();
  if (restartCycle && dayNightCycleStart !== null) {
    // Capture what is visible so repeated selections can retarget mid-fade.
    themeTransition = {
      start: now,
      from: captureThemeLighting(),
      to: theme
    };
    dayNightCycleStart = now + THEME_FADE_MS
      - DAY_NIGHT_PHASES.indexOf(themeName) * (DAY_NIGHT_CYCLE_MS / DAY_NIGHT_PHASES.length);
  }
  state.theme = themeName;
  appEl.setAttribute('data-theme', themeName);

  updateLightingSlider({ day: 0, sunset: 50, night: 100 }[themeName], { automatic: !restartCycle });

  // Bedside Lamp behavior based on theme
  if (themeName === 'night') {
    state.lampOn = true;
  }
  if (!themeTransition) applyThemeLighting(theme);
  updateLampLighting({ applyIntensity: !themeTransition });
}

function updateLightingSlider(value, { automatic = false } = {}) {
  if (automatic && document.getElementById('themeDropdown').classList.contains('open')) return;
  lightingSlider.value = String(Math.round(value * 10) / 10);
  const label = value < 0.25 ? 'Day' : Math.abs(value - 50) < 0.25 ? 'Sunset' : value > 99.75 ? 'Night'
    : value < 50 ? `Day to Sunset, ${Math.round(value * 2)}%`
    : `Sunset to Night, ${Math.round((value - 50) * 2)}%`;
  lightingSlider.setAttribute('aria-valuetext', label);
  document.getElementById('themeToggleBtn').setAttribute('aria-label', `Lighting: ${label}`);
  // The native range owns input; only its decorative thumb eases toward the value.
  const immediate = interactionMotionMedia.matches || document.hidden
    || !document.getElementById('themeDropdown').classList.contains('open');
  gsap.to(lightingSliderMotion, {
    value,
    duration: immediate ? 0 : 0.16,
    ease: 'power3.out',
    overwrite: true,
    onUpdate: renderLightingSlider
  });
}

function renderLightingSlider() {
  gsap.set(lightingThumb, { x: 0, xPercent: lightingSliderMotion.value });
  // Match the 4px clearance around the 30px thumb in the 38px track.
  const thumbTravel = lightingSlider.clientWidth - 2 * 4 - 30;
  lightingIcons.forEach((icon, index) => {
    icon.classList.toggle('is-lit', Math.abs(lightingSliderMotion.value / 100 - index / 2) * thumbTravel <= 15);
  });
}

function animateLightingThumb(pressed) {
  const immediate = interactionMotionMedia.matches || document.hidden
    || !document.getElementById('themeDropdown').classList.contains('open');
  if (pressed === lightingThumbPressed && !immediate) return;
  lightingThumbPressed = pressed && !immediate;
  gsap.to(lightingThumbSurface, {
    scaleX: lightingThumbPressed ? 1.06 : 1,
    scaleY: lightingThumbPressed ? 0.94 : 1,
    duration: immediate ? 0 : pressed ? 0.12 : 0.32,
    ease: pressed ? 'power2.out' : 'back.out(1.5)',
    overwrite: true
  });
}

function setTimeOfDay(value, { fade = false } = {}) {
  if (state.zenMode) return;
  const now = performance.now();
  const elapsed = (1 + value / 50) * (DAY_NIGHT_CYCLE_MS / DAY_NIGHT_PHASES.length);
  const from = fade && !interactionMotionMedia.matches ? captureThemeLighting() : null;
  themeTransition = null;
  dayNightCycleStart = now - elapsed;
  lastCycleUpdate = -Infinity;
  if (from) {
    const phase = getDayNightPhase(elapsed);
    const a = THEMES[phase.from], b = THEMES[phase.to];
    const to = Object.fromEntries(Object.keys(from).map(key => [key, a[key].isColor
      ? a[key].clone().lerp(b[key], phase.blend)
      : THREE.MathUtils.lerp(a[key], b[key], phase.blend)]));
    const duration = 400;
    themeTransition = { start: now, from, to, duration, ease: gsap.parseEase('power2.out') };
    dayNightCycleStart += duration;
    if (state.theme !== phase.from) setTheme(phase.from, { restartCycle: false });
  }
  updateLightingSlider(value);
  updateDayNightCycle(now);
}

function applyThemeLighting(from, to = from, blend = 0) {
  const background = cycleBackgroundColor.copy(from.bg).lerp(to.bg, blend).getStyle();
  if (background !== appliedBackground) {
    // Spline 2.0.60's Color4 keeps alpha zero; explicit sRGB also respects its color management.
    const rgb = runtimeBackgroundColor.copy(cycleBackgroundColor).convertLinearToSRGB();
    threeScene?.activePage.bgColor.setRGB(rgb.r, rgb.g, rgb.b, 'srgb');
    appEl.style.background = background;
    appliedBackground = background;
  }
  skyClouds.style.color = cycleCloudColor.copy(from.cloudColor).lerp(to.cloudColor, blend).getStyle();
  cloudDitherShadow.setAttribute('fill', cycleCloudShadowColor.copy(from.cloudShadowColor).lerp(to.cloudShadowColor, blend).getStyle());
  cycleCloudOpacity = THREE.MathUtils.lerp(from.cloudOpacity, to.cloudOpacity, blend);
  cycleStarOpacity = THREE.MathUtils.lerp(from.starOpacity, to.starOpacity, blend);
  skyClouds.style.opacity = cycleCloudOpacity;
  skyStars.style.opacity = cycleStarOpacity;
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
    const progress = Math.min(1, Math.max(0, (now - themeTransition.start) / (themeTransition.duration ?? THEME_FADE_MS)));
    applyThemeLighting(themeTransition.from, themeTransition.to, themeTransition.ease ? themeTransition.ease(progress) : progress * progress * (3 - 2 * progress));
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
  if (state.theme !== from) setTheme(from, { restartCycle: false });
  applyThemeLighting(THEMES[from], THEMES[to], blend);
  const position = ((now - dayNightCycleStart) % DAY_NIGHT_CYCLE_MS + DAY_NIGHT_CYCLE_MS)
    % DAY_NIGHT_CYCLE_MS / (DAY_NIGHT_CYCLE_MS / DAY_NIGHT_PHASES.length);
  // Dawn has no stop on the Day → Sunset → Night slider; retain Night until Day begins.
  updateLightingSlider(position < 1 ? 100 : (position - 1) * 50, { automatic: true });
}

function cycleTheme() {
  const themes = ['night', 'day', 'sunset'];
  const nextIdx = (themes.indexOf(state.theme) + 1) % themes.length;
  setTheme(themes[nextIdx]);
}

function setupLightingAndTheme() {
  splineApp.setBackgroundColor('transparent');
  setTheme('night');
}

// Bedside Lamp Toggle
function toggleLamp() {
  state.lampOn = !state.lampOn;
  sound.playSwitch(state.lampOn);
  updateLampLighting();
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
}

// House Plant Interaction
function waterPlant() {
  if (!plantInteraction || document.hidden) return;
  const action = plantInteraction.water(performance.now(), { reduced: interactionMotionMedia.matches });
  if (!action) return;
  plantMeterUntil = performance.now() + 4000;
  if (action === 'water') sound.playWaterPour();
  else sound.playPop(0.8);
  updateInteractionLabels();
  updatePlantMeter(performance.now());
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
  } else {
    setTheme('night');
    const shouldRestoreFocus = zenOverlay.contains(document.activeElement);
    zenOverlay.classList.remove('active');
    if (shouldRestoreFocus) {
      const target = zenReturnFocus instanceof HTMLElement && zenReturnFocus.getClientRects().length && zenReturnFocus !== document.body
        ? zenReturnFocus : document.getElementById('cameraToggleBtn');
      target.focus({ preventScroll: true });
    }
    zenReturnFocus = null;
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
      state.hoveredInteractive = null;
      canvas.classList.remove('watering-cursor');
      canvas.classList.remove('pointer-cursor');
      hoverTooltip.classList.remove('visible');
    }
    return;
  }

  if (e.pointerType === 'touch') return;
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
    canvas.classList.toggle('watering-cursor', targetSpot.id === 'plant');
    hoverTooltip.textContent = `${targetSpot.icon} ${targetSpot.label} — ${targetSpot.statusText || 'Click to interact'}`;
    hoverTooltip.style.left = `${e.clientX}px`;
    hoverTooltip.style.top = `${e.clientY}px`;
    const revealedPin = state.pinsVisible && targetSpot.domElement && !targetSpot.domElement.hidden;
    hoverTooltip.classList.toggle('visible', !revealedPin && targetSpot.id !== 'plant');
  } else {
    state.hoveredInteractive = null;
    canvas.classList.remove('pointer-cursor');
    canvas.classList.remove('watering-cursor');
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
  const targetModal = { projects: projectsModal, funProjects: funProjectsModal, skills: skillsModal, about: aboutModal }[modalName];
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
  modalReturnFallback = document.querySelector(`#sideNav [data-modal="${modalName === 'funProjects' ? 'projects' : modalName}"]`);
  // Disable the room and inactive dialogs without making the active dialog inert.
  for (const child of appEl.children) {
    if (child === targetModal) continue;
    modalBackgroundState.set(child, child.inert);
    child.inert = true;
  }
  targetModal.inert = false;
  targetModal.querySelectorAll('img[data-src]').forEach(image => {
    image.src = image.dataset.src;
    image.removeAttribute('data-src');
  });
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
  const focusable = [...dialog.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]')]
    .filter(el => {
      const closedDetails = el.closest('details:not([open])');
      const insideClosedDetails = closedDetails && el !== closedDetails.querySelector('summary');
      return !el.disabled && el.tabIndex >= 0 && !el.closest('[inert]')
        && !insideClosedDetails && el.getClientRects().length;
    });
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
  if (dropdown.id === 'themeDropdown') {
    if (isOpen) renderLightingSlider();
    else {
      updateLightingSlider(Number(lightingSlider.value));
      animateLightingThumb(false);
    }
  }
  if (restoreFocus) toggle.focus();
}

// Render Project Showcase & Skills Content
function renderContent() {
  // 1. Projects
  for (const [gridId, projects] of [['projectsGrid', PORTFOLIO_DATA.projects], ['funProjectsGrid', PORTFOLIO_DATA.funProjects]]) {
    const projectsGrid = document.getElementById(gridId);
    if (projectsGrid) {
      projectsGrid.innerHTML = projects.map(p => `
        <article class="project-card" aria-labelledby="project-${p.id}">
          <img class="project-image" data-src="${p.image}" alt="${p.imageAlt}" loading="lazy">
          <div class="project-card-header">
            <div>
              <h3 class="project-name" id="project-${p.id}">${p.title}</h3>
              <p class="project-category">${p.category}</p>
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
        </article>
      `).join('');
    }
  }

  // 2. Skills
  const skillsContainer = document.getElementById('skillsContainer');
  if (skillsContainer) {
    const skillCards = PORTFOLIO_DATA.skills.map((cat, index) => `
        <section class="skill-group${index % 2 ? ' skill-group-support' : ''}" style="order: ${index}">
          <h3 class="skill-category-title"><span class="skill-group-icon"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="/ui-icons.svg#${cat.icon}"/></svg></span>${cat.category}</h3>
          <ul class="skills-row">
            ${cat.items.map(s => `
              <li class="skill-card">${s.name}</li>
            `).join('')}
          </ul>
        </section>
      `);
    skillsContainer.innerHTML = [0, 1].map(column => `
      <div class="skills-column">
        ${skillCards.filter((_, index) => index % 2 === column).join('')}
      </div>
    `).join('');
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
          <p class="section-eyebrow">A little about me</p>
          <h2 class="profile-name">${dev.name}</h2>
          <p class="profile-title">${dev.title}</p>
          <div class="profile-location"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="/ui-icons.svg#map-pin"/></svg><span>${dev.location}</span></div>
        </div>

        <div class="profile-photo-frame">
          <img class="profile-photo" data-src="${dev.photo}" alt="${dev.photoAlt}" width="1600" height="1200" decoding="async">
        </div>

        <p class="profile-bio">${dev.bio}</p>

        <section class="contact-section" aria-labelledby="contactHeading">
          <h3 class="skill-category-title" id="contactHeading">Let's connect</h3>
          <p class="contact-description">For projects, collaborations, or a hello.</p>
          <div class="profile-socials">
            <a href="${dev.resume}" target="_blank" rel="noopener noreferrer" class="social-pill" aria-label="Resume (PDF, opens in a new tab)">
              <svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></svg>
              <span>Resume</span>
              <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="/ui-icons.svg#arrow-up-right"/></svg>
            </a>
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
    canvas.classList.remove('watering-cursor');
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
  const syncSkyMotion = () => skyAtmosphere.classList.toggle('is-paused', document.hidden);
  document.addEventListener('visibilitychange', syncSkyMotion);
  syncSkyMotion();
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
  });

  muteBtn.addEventListener('click', () => {
    const isMuted = sound.toggleMute();
    muteBtn.querySelector('use').setAttribute('href', `/ui-icons.svg#${isMuted ? 'volume-x' : 'volume-2'}`);
    muteBtn.classList.toggle('active', isMuted);
    muteBtn.setAttribute('aria-pressed', String(isMuted));
  });

  lightingSlider.addEventListener('input', () => setTimeOfDay(Number(lightingSlider.value), { fade: true }));
  lightingSlider.addEventListener('pointerdown', event => {
    if (event.button === 0) animateLightingThumb(true);
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) {
    lightingSlider.addEventListener(event, () => animateLightingThumb(false));
  }
  window.addEventListener('pointerup', () => animateLightingThumb(false));
  const settleLightingSlider = () => {
    if (!interactionMotionMedia.matches && !document.hidden) return;
    updateLightingSlider(Number(lightingSlider.value));
    animateLightingThumb(false);
  };
  interactionMotionMedia.addEventListener('change', settleLightingSlider);
  document.addEventListener('visibilitychange', settleLightingSlider);

  // Camera menu options
  document.querySelectorAll('#cameraGroup [data-cam]').forEach(btn => {
    btn.addEventListener('click', () => setCameraPreset(btn.dataset.cam));
  });

  // Dock panels share disclosure and dismissal behavior.
  dockDropdowns.forEach(dropdown => {
    const toggle = dropdown.querySelector('.dropdown-toggle');
    const items = [...dropdown.querySelectorAll('.dropdown-item, input[type="range"]')];
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !dropdown.classList.contains('open');
      setDockDropdownOpen(dropdown, isOpen);
      if (isOpen && e.detail === 0) (dropdown.querySelector('[aria-checked="true"]') || items[0]).focus();
      sound.playPop();
    });

    // Close dropdown on action selection
    items.filter(item => item !== lightingSlider).forEach(item => {
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
      // Range inputs own their arrow, Home, End, and Tab behavior.
      if (e.target === lightingSlider) return;
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

// Initialize Vercel Analytics
inject();

// Initialize Vercel Speed Insights
injectSpeedInsights();
