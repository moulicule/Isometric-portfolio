# 🏠 Interactive Isometric Atelier | 3D Project Webpage

An interactive, real-time 3D isometric room portfolio webpage powered by **Spline 3D** (`@splinetool/runtime`), **Three.js**, and modern web standards. Built from the project's native `scene (1).splinecode` asset.

![Isometric Room Preview](file:///Users/mouliknanda/.gemini/antigravity/brain/9956607a-94ed-4328-8f4a-bb2535b0f499/.user_uploaded/media_1790674324195.jpg)

---

## ✨ Features & Interactivity

### 🎮 3D Room Interactions
- **💻 Computer Workstation**: Click the monitor or keyboard to launch the interactive **Project Showcase modal** featuring live demos, tech tags, and code repositories.
- **💡 Bedside Lamp**: Click the lamp or the nightstand to toggle the bedside light ON/OFF. Dynamically modulates the Point Light intensity, casting real-time warm golden radiance across the room.
- **🪑 Swivel Chair**: Click the office chair to trigger a 360-degree spring-damped swivel animation with spatial sound.
- **📚 Bookshelf**: Click the wall bookshelf to open the **Tech Stack & Atelier Reading Shelf** with categorized proficiencies and book progress.
- **🌱 House Plant**: Click the potted plant to water it, displaying hydration levels and blooming emerald confetti celebrations!
- **🛏️ Cozy Bed**: Click the bed to enter **Zen Mode**—dimming room lights, launching soothing ambient lofi soundscapes, and displaying a live digital focus clock.
- **🌤️ Skylight Window**: Click the skylight to cycle through dynamic atmospheric moods: **Day**, **Golden Sunset**, **Cozy Night**, and **Rainy Lofi**.
- **☕ Coffee Mug**: Click to take a coffee break with focus stats boost.
- **⏰ Live Wall Clock**: The hour (`Cylinder 19`) and minute (`Cylinder 18`) hands on the 3D wall clock tick and rotate in real-time according to the user's system clock.
- **👤 Sticky Notes**: Click the colorful sticky notes on the wall to open the **Developer Profile & Quick Contact Form**.

### 🎧 Procedural Web Audio Engine (100% Offline)
- Synthesizes realistic mechanical switch clicks, hover pops, chair swooshes, and water chimes using the native **Web Audio API**.
- Includes toggleable **Cozy Lofi Harmonic Synth Pad** and procedural **Filtered Rain Generator** with zero external mp3 dependencies.

### 📐 Camera & Perspectives
- **Isometric (Default)**: Classic isometric architectural angle.
- **Desk Focus**: Zooms directly into the workstation and computer screen.
- **Bed Focus**: Zooms into the cozy reading and sleeping corner.
- **Limited Orbit**: The room stays centered and can rotate up to 15° left or right from its starting view; use the perspective buttons to switch views.

### ⌨️ Keyboard Shortcuts
- `L`: Toggle Bedside Lamp ON / OFF
- `C`: Swivel Office Chair
- `1`: Switch to Day Mode
- `2`: Switch to Sunset Mode
- `3`: Switch to Night Mode
- `4`: Switch to Rainy Mode
- `ESC`: Close open modals / Exit Zen Mode

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+) and npm

### Development
```bash
# Start Vite development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build
```bash
# Compile optimized bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 📁 Project Architecture
```
.
├── index.html              # HTML structure with HUD dock, top navigation, & modals
├── public/
│   └── scene.splinecode    # Static Spline 3D binary scene asset
├── src/
│   ├── main.js             # Spline runtime controller, raycasting, camera transitions & UI
│   ├── audio.js            # Procedural Web Audio API sound synthesis engine
│   ├── data.js             # Project showcase, skills, and developer profile data
│   └── style.css           # Glassmorphic UI styles, animations, and responsive layouts
└── package.json            # Project dependencies (@splinetool/runtime, three, canvas-confetti, vite)
```
