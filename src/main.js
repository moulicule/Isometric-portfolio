import { Application } from '@splinetool/runtime';
import * as THREE from 'three';
import confetti from 'canvas-confetti';
import { sound } from './audio.js';
import { PORTFOLIO_DATA } from './data.js';

// DOM References
const appEl = document.getElementById('app');
const canvas = document.getElementById('canvas3d');
const loadingScreen = document.getElementById('loadingScreen');
const loadingStatus = document.getElementById('loadingStatus');
const hotspotContainer = document.getElementById('hotspotContainer');
const hoverTooltip = document.getElementById('hoverTooltip');
const toastContainer = document.getElementById('toastContainer');
const zenOverlay = document.getElementById('zenOverlay');
const zenClock = document.getElementById('zenClock');

// Modals
const projectsModal = document.getElementById('projectsModal');
const skillsModal = document.getElementById('skillsModal');
const aboutModal = document.getElementById('aboutModal');

// Buttons
const lofiBtn = document.getElementById('lofiBtn');
const rainAudioBtn = document.getElementById('rainAudioBtn');
const muteBtn = document.getElementById('muteBtn');
const toggleLampBtn = document.getElementById('toggleLampBtn');
const spinChairBtn = document.getElementById('spinChairBtn');
const waterPlantBtn = document.getElementById('waterPlantBtn');
const togglePinsBtn = document.getElementById('togglePinsBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const resetCamBtn = document.getElementById('resetCamBtn');
const exitZenBtn = document.getElementById('exitZenBtn');

// Spline & Three.js State
const splineApp = new Application(canvas);
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
  theme: 'night',
  cameraPreset: 'iso',
  chairAngle: 0,
  chairSpinning: false,
  plantHydration: 80,
  pinsVisible: true,
  zenMode: false,
  hoveredInteractive: null
};

// Base Camera Settings
const DEFAULT_CAM_POS = new THREE.Vector3(585.13, 336.63, 729.21);
const DEFAULT_CAM_ROT = new THREE.Euler(
  THREE.MathUtils.degToRad(-29.57),
  THREE.MathUtils.degToRad(34.53),
  THREE.MathUtils.degToRad(17.83)
);
const DEFAULT_CAM_ZOOM = 2.1096;

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
const ZOOM_BOUNDS = {
  min: DEFAULT_CAM_ZOOM * 0.7,
  max: Math.max(...Object.values(CAMERA_PRESETS).map(({ zoom }) => zoom)) * 1.1
};

// Lighting Palettes
const THEMES = {
  night: {
    bg: '#0d0b0f',
    sunColor: new THREE.Color(0.25, 0.35, 0.7),
    sunIntensity: 0.35,
    skyColor: new THREE.Color(0.15, 0.22, 0.45),
    skyIntensity: 0.25,
    lampIntensity: 1.6,
    label: 'Cozy Night'
  },
  day: {
    bg: '#182030',
    sunColor: new THREE.Color(1.0, 0.96, 0.88),
    sunIntensity: 1.3,
    skyColor: new THREE.Color(0.55, 0.78, 1.0),
    skyIntensity: 0.65,
    lampIntensity: 0.15,
    label: 'Bright Daylight'
  },
  sunset: {
    bg: '#1a0d16',
    sunColor: new THREE.Color(1.0, 0.5, 0.22),
    sunIntensity: 1.2,
    skyColor: new THREE.Color(0.85, 0.35, 0.65),
    skyIntensity: 0.55,
    lampIntensity: 1.3,
    label: 'Golden Sunset'
  },
  rain: {
    bg: '#0a0f16',
    sunColor: new THREE.Color(0.35, 0.48, 0.65),
    sunIntensity: 0.35,
    skyColor: new THREE.Color(0.22, 0.32, 0.48),
    skyIntensity: 0.3,
    lampIntensity: 1.7,
    label: 'Rainy Lofi'
  }
};

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
  { id: 'projects', name: 'Computer', label: 'Projects & Work', icon: '💻', objKey: 'computer', offsetY: 65, action: () => openModal('projects') },
  { id: 'lamp', name: 'Bed Table', label: 'Bedside Lamp', icon: '💡', objKey: 'bedTable', offsetY: 60, action: () => toggleLamp() },
  { id: 'chair', name: 'Chair', label: 'Swivel Chair', icon: '🪑', objKey: 'chair', offsetY: 50, action: () => spinChair() },
  { id: 'skills', name: 'Books', label: 'Skills & Stack', icon: '📚', objKey: 'books', offsetY: 40, action: () => openModal('skills') },
  { id: 'plant', name: 'Plant', label: 'House Plant', icon: '🌱', objKey: 'plant', offsetY: 75, action: () => waterPlant() },
  { id: 'bed', name: 'Bed', label: 'Zen Mode', icon: '🛏️', objKey: 'bed', offsetY: 50, action: () => toggleZenMode() },
  { id: 'window', name: 'Window', label: 'Atmosphere & Sky', icon: '🌤️', objKey: 'window', offsetY: 60, action: () => cycleTheme() },
  { id: 'coffee', name: ' Coffee Cup', label: 'Coffee Break', icon: '☕', objKey: 'coffee', offsetY: 30, action: () => drinkCoffee() },
  { id: 'about', name: 'Sticky Notes', label: 'About & Bio', icon: '👤', objKey: 'stickyNotes', offsetY: 40, action: () => openModal('about') }
];

// Initialize Spline Application
async function init() {
  try {
    loadingStatus.textContent = 'Loading 3D isometric room model...';
    await splineApp.load('/scene.splinecode');

    threeScene = splineApp._scene;
    threeCamera = splineApp._camera;
    if (threeCamera) {
      threeCamera.zoom = DEFAULT_CAM_ZOOM;
      threeCamera.updateProjectionMatrix();
    }
    configureCameraControls();

    loadingStatus.textContent = 'Connecting scene lighting & physics...';
    setupSceneReferences();
    setupHotspots();
    setupLightingAndTheme();
    renderContent();
    setupEventListeners();

    // Hide loader smoothly
    setTimeout(() => {
      loadingScreen.classList.add('hidden');
      showToast('🏠 Interactive Isometric Atelier ready! Click objects to explore.', '✨');
    }, 450);

    // Start render/update loop
    requestAnimationFrame(animateLoop);
  } catch (err) {
    console.error('Failed to initialize Spline scene:', err);
    loadingStatus.innerHTML = '<span style="color: #ef4444;">Failed to load 3D scene. Please refresh.</span>';
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
  objects.clockHour = threeScene.getObjectByName('Cylinder 19');
  objects.clockMin = threeScene.getObjectByName('Cylinder 18');
  objects.books = threeScene.getObjectByName('Books');
  objects.coffee = threeScene.getObjectByName(' Coffee Cup') || threeScene.getObjectByName('Coffee Cup');
  objects.window = threeScene.getObjectByName('Window');
  objects.stickyNotes = threeScene.getObjectByName('Sticky Notes');
}

// Setup 3D Hotspot DOM Elements
function setupHotspots() {
  hotspotContainer.innerHTML = '';
  HOTSPOTS.forEach(spot => {
    const el = document.createElement('div');
    el.className = 'hotspot-pin';
    el.id = `hotspot-${spot.id}`;
    el.innerHTML = `
      <div class="hotspot-icon">${spot.icon}</div>
      <div class="hotspot-label">${spot.label}</div>
    `;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      sound.playPop();
      spot.action();
    });
    hotspotContainer.appendChild(el);
    spot.domElement = el;
  });
}

// Update Hotspot Screen Positions
function updateHotspots() {
  if (!state.pinsVisible || !threeCamera) {
    hotspotContainer.style.display = 'none';
    return;
  }
  hotspotContainer.style.display = 'block';

  const rect = canvas.getBoundingClientRect();
  const v = new THREE.Vector3();

  HOTSPOTS.forEach(spot => {
    const obj = objects[spot.objKey];
    if (!obj || !spot.domElement) return;

    obj.getWorldPosition(v);
    v.y += spot.offsetY || 40;
    v.project(threeCamera);

    // Check if within frustum bounds
    const isVisible = v.z < 1 && v.x >= -1.2 && v.x <= 1.2 && v.y >= -1.2 && v.y <= 1.2;
    if (!isVisible) {
      spot.domElement.style.opacity = '0';
      return;
    }

    const x = (v.x * 0.5 + 0.5) * rect.width;
    const y = (-v.y * 0.5 + 0.5) * rect.height;

    spot.domElement.style.opacity = '1';
    spot.domElement.style.left = `${x}px`;
    spot.domElement.style.top = `${y}px`;
  });
}

// Real-Time Clock Hands Sync
function updateClockHands() {
  const now = new Date();
  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  if (objects.clockHour) {
    const hourAngle = THREE.MathUtils.degToRad(-((hours + minutes / 60) * 30));
    objects.clockHour.rotation.z = hourAngle;
  }
  if (objects.clockMin) {
    const minAngle = THREE.MathUtils.degToRad(-((minutes + seconds / 60) * 6));
    objects.clockMin.rotation.z = minAngle;
  }

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

  // 1. Clock hands update
  updateClockHands();

  // 2. Chair spinning animation
  if (state.chairSpinning && objects.chair) {
    state.chairAngle += delta * 7.5;
    objects.chair.rotation.y = state.chairAngle;
    if (state.chairAngle >= Math.PI * 2) {
      state.chairSpinning = false;
      state.chairAngle = 0;
      objects.chair.rotation.y = 0;
    }
  }

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

  // Update dock buttons
  document.querySelectorAll('#cameraGroup .dock-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cam === presetName);
  });

  const startQuat = threeCamera.quaternion.clone();
  const targetQuat = new THREE.Quaternion().setFromEuler(preset.rot);

  currentCamAnim = {
    startPos: threeCamera.position.clone(),
    targetPos: preset.pos.clone(),
    startQuat: startQuat,
    targetQuat: targetQuat,
    startZoom: threeCamera.zoom || DEFAULT_CAM_ZOOM,
    targetZoom: preset.zoom || DEFAULT_CAM_ZOOM,
    duration: 1.2,
    elapsed: 0
  };

  showToast(`Perspective switched to ${presetName.toUpperCase()}`, '📐');
}

// Reset Camera
function resetCamera() {
  setCameraPreset('iso');
}

// Lighting & Atmosphere Transition
function setTheme(themeName) {
  const theme = THEMES[themeName];
  if (!theme) return;

  state.theme = themeName;
  appEl.setAttribute('data-theme', themeName);

  // Update dock buttons
  document.querySelectorAll('#themeGroup .dock-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === themeName);
  });

  // Apply Directional Sun & Sky lighting
  if (objects.sunLight) {
    objects.sunLight.color.copy(theme.sunColor);
    objects.sunLight.intensity = theme.sunIntensity;
  }
  if (objects.skyLight) {
    objects.skyLight.color.copy(theme.skyColor);
    objects.skyLight.intensity = theme.skyIntensity;
  }

  // Bedside Lamp behavior based on theme
  if (themeName === 'night' || themeName === 'rain') {
    state.lampOn = true;
  }
  updateLampLighting();

  // Rain sound sync
  if (themeName === 'rain') {
    sound.toggleRain(true);
    rainAudioBtn.classList.add('active');
  } else if (!rainAudioBtn.dataset.manual) {
    sound.toggleRain(false);
    rainAudioBtn.classList.remove('active');
  }

  showToast(`Atmosphere set to ${theme.label}`, '🌤️');
}

function cycleTheme() {
  const themes = ['night', 'day', 'sunset', 'rain'];
  const nextIdx = (themes.indexOf(state.theme) + 1) % themes.length;
  setTheme(themes[nextIdx]);
}

function setupLightingAndTheme() {
  setTheme('night');
}

// Bedside Lamp Toggle
function toggleLamp() {
  state.lampOn = !state.lampOn;
  sound.playSwitch(state.lampOn);
  updateLampLighting();

  toggleLampBtn.classList.toggle('active', state.lampOn);
  showToast(`Bedside lamp turned ${state.lampOn ? 'ON' : 'OFF'}`, state.lampOn ? '💡' : '🌑');
}

function updateLampLighting() {
  const intensity = state.lampOn ? (THEMES[state.theme]?.lampIntensity || 1.6) : 0.0;
  if (objects.lampLight1) objects.lampLight1.intensity = intensity;
  if (objects.lampLight2) objects.lampLight2.intensity = intensity;
}

// Chair Swivel
function spinChair() {
  if (state.chairSpinning) return;
  state.chairSpinning = true;
  state.chairAngle = 0;
  sound.playWhoosh();
  showToast('Swiveled the office chair!', '🪑');
}

// House Plant Interaction
function waterPlant() {
  state.plantHydration = Math.min(100, state.plantHydration + 15);
  sound.playWaterChime();

  // Emerald confetti burst over plant
  const v = new THREE.Vector3();
  if (objects.plant && threeCamera) {
    objects.plant.getWorldPosition(v);
    v.project(threeCamera);
    const screenX = (v.x * 0.5 + 0.5);
    const screenY = (-v.y * 0.5 + 0.5);
    confetti({
      particleCount: 35,
      spread: 60,
      origin: { x: screenX, y: screenY },
      colors: ['#10b981', '#34d399', '#6ee7b7', '#fef08a']
    });
  }

  showToast(`🌱 Plant watered! Hydration: ${state.plantHydration}%`, '💧');
}

// Coffee Interaction
function drinkCoffee() {
  sound.playPop(1.4);
  showToast('☕ Fresh hot coffee sipped! Focus level 100%', '⚡');
}

// Zen / Relax Mode Toggle
function toggleZenMode(enable = null) {
  state.zenMode = enable !== null ? enable : !state.zenMode;
  if (state.zenMode) {
    sound.toggleAmbient(true);
    lofiBtn.classList.add('active');
    zenOverlay.classList.add('active');
    setTheme('night');
    showToast('Entered Cozy Zen Mode', '🌙');
  } else {
    zenOverlay.classList.remove('active');
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

function handlePointerMove(e) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  if (isPointerDown) {
    const distance = Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y);
    if (distance > 6) {
      isDragging = true;
      hoverTooltip.classList.remove('visible');
    }
    return;
  }

  if (!threeScene || !threeCamera) return;

  raycaster.setFromCamera(mouse, threeCamera);
  const hits = raycaster.intersectObjects(threeScene.children, true);

  let targetSpot = null;
  if (hits.length > 0) {
    targetSpot = findInteractiveParent(hits[0].object);
  }

  if (targetSpot) {
    state.hoveredInteractive = targetSpot;
    canvas.classList.add('pointer-cursor');
    hoverTooltip.textContent = `${targetSpot.icon} ${targetSpot.label} — Click to interact`;
    hoverTooltip.style.left = `${e.clientX}px`;
    hoverTooltip.style.top = `${e.clientY}px`;
    hoverTooltip.classList.add('visible');
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
  if (e.button === 0 && !isDragging && state.hoveredInteractive) {
    sound.playPop();
    state.hoveredInteractive.action();
  }
  isDragging = false;
}

// Spline's elastic rotation limit clears this internal flag at the outer edge,
// which otherwise makes a held drag stop responding until the next click.
function keepOrbitDragActive(e) {
  const orbitControls = splineApp._controls?.orbitControls;
  if (e.buttons !== 0 && orbitControls?.state !== -1) {
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
function openModal(modalName) {
  sound.playPop(1.2);
  closeAllModals();

  let targetModal = null;
  if (modalName === 'projects') targetModal = projectsModal;
  if (modalName === 'skills') targetModal = skillsModal;
  if (modalName === 'about') targetModal = aboutModal;

  if (targetModal) {
    targetModal.classList.add('open');
    if (modalName === 'projects') {
      confetti({ particleCount: 25, spread: 70, origin: { y: 0.6 } });
    }
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
}

// Render Project Showcase & Skills Content
function renderContent() {
  // 1. Projects
  const projectsGrid = document.getElementById('projectsGrid');
  if (projectsGrid) {
    projectsGrid.innerHTML = PORTFOLIO_DATA.projects.map(p => `
      <div class="project-card">
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
        <div class="project-stats-row">
          ${Object.entries(p.stats).map(([k, v]) => `
            <div class="project-stat-item">
              <span class="stat-val">${v}</span>
              <span class="stat-lbl">${k.toUpperCase()}</span>
            </div>
          `).join('')}
        </div>
        <div class="project-links">
          <a href="${p.links.demo}" target="_blank" class="btn-primary">
            <span>🚀 Live Demo</span>
          </a>
          <a href="${p.links.github}" target="_blank" class="btn-secondary">
            <span>Code &rarr;</span>
          </a>
        </div>
      </div>
    `).join('');
  }

  // 2. Skills & Books
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

      <div style="margin-top: 10px;">
        <div class="skill-category-title">📖 Atelier Reading Shelf</div>
        <div class="books-grid">
          ${PORTFOLIO_DATA.books.map(b => `
            <div class="book-card" style="border-left-color: ${b.color};">
              <div class="book-title">${b.title}</div>
              <div class="book-author">by ${b.author}</div>
              <div class="book-progress-wrapper">
                <span class="stat-val" style="color: ${b.color};">${b.progress}%</span>
                <span>&bull; ${b.status}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 3. About & Contact
  const aboutContainer = document.getElementById('aboutContainer');
  const dev = PORTFOLIO_DATA.developer;
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
            <a href="${s.url}" target="_blank" class="social-pill">
              <span>${s.label}</span>
              <span>&nearr;</span>
            </a>
          `).join('')}
        </div>

        <div style="margin-top: 10px;">
          <div class="skill-category-title">✉️ Send a Message</div>
          <form class="contact-form" id="contactForm" onsubmit="event.preventDefault(); window.submitContact();">
            <input type="text" class="form-input" placeholder="Your Name" required>
            <input type="email" class="form-input" placeholder="Your Email" required>
            <textarea class="form-textarea" rows="3" placeholder="Tell me about your project..." required></textarea>
            <button type="submit" class="btn-primary" style="align-self: flex-start;">Send Message 🚀</button>
          </form>
        </div>
      </div>
    `;
  }
}

window.submitContact = function() {
  sound.playPop(1.5);
  confetti({ particleCount: 30, spread: 70, origin: { y: 0.7 } });
  showToast('Message sent successfully! Thanks for reaching out.', '💌');
  closeAllModals();
};

// Event Listeners Setup
function setupEventListeners() {
  // Canvas pointer raycasting and click handling. Orbit is constrained; panning is disabled.
  canvas.addEventListener('pointermove', handlePointerMove);
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

  // Top Nav Modal Buttons
  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      openModal(btn.dataset.modal);
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
    showToast(`Cozy Lofi Chords: ${isPlaying ? 'ON' : 'OFF'}`, '🎵');
  });

  rainAudioBtn.addEventListener('click', () => {
    rainAudioBtn.dataset.manual = 'true';
    const isPlaying = sound.toggleRain();
    rainAudioBtn.classList.toggle('active', isPlaying);
    showToast(`Rain Ambience: ${isPlaying ? 'ON' : 'OFF'}`, '🌧️');
  });

  muteBtn.addEventListener('click', () => {
    const isMuted = sound.toggleMute();
    muteBtn.textContent = isMuted ? '🔇' : '🔊';
    muteBtn.classList.toggle('active', isMuted);
    showToast(`Sound Effects: ${isMuted ? 'MUTED' : 'ENABLED'}`, isMuted ? '🔇' : '🔊');
  });

  // Theme Dock Buttons
  document.querySelectorAll('#themeGroup [data-theme]').forEach(btn => {
    btn.addEventListener('click', () => setTheme(btn.dataset.theme));
  });

  // Camera Dock Buttons
  document.querySelectorAll('#cameraGroup [data-cam]').forEach(btn => {
    btn.addEventListener('click', () => setCameraPreset(btn.dataset.cam));
  });
  resetCamBtn.addEventListener('click', resetCamera);

  // Quick Action Buttons
  toggleLampBtn.addEventListener('click', toggleLamp);
  spinChairBtn.addEventListener('click', spinChair);
  waterPlantBtn.addEventListener('click', waterPlant);

  togglePinsBtn.addEventListener('click', () => {
    state.pinsVisible = !state.pinsVisible;
    togglePinsBtn.classList.toggle('active', state.pinsVisible);
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

  exitZenBtn.addEventListener('click', () => toggleZenMode(false));
  zenOverlay.addEventListener('click', (e) => {
    if (e.target === zenOverlay) toggleZenMode(false);
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
      toggleZenMode(false);
    } else if (e.key === 'l' || e.key === 'L') {
      toggleLamp();
    } else if (e.key === 'c' || e.key === 'C') {
      spinChair();
    } else if (e.key === '1') {
      setTheme('day');
    } else if (e.key === '2') {
      setTheme('sunset');
    } else if (e.key === '3') {
      setTheme('night');
    } else if (e.key === '4') {
      setTheme('rain');
    }
  });
}

// Start application
init();
