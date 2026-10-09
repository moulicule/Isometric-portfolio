// Project showcase data, skills, and developer profile

export const PORTFOLIO_DATA = {
  developer: {
    name: "Moulik Nanda",
    title: "Creative Technologist & Full-Stack 3D Web Engineer",
    bio: "I craft immersive 3D web experiences, creative interfaces, and robust modern web applications at the intersection of design, engineering, and spatial computing.",
    location: "San Francisco, CA / Remote",
    status: "Available for ambitious projects",
    socials: [
      { label: "GitHub", url: "https://github.com", icon: "github" },
      { label: "LinkedIn", url: "https://linkedin.com", icon: "linkedin" },
      { label: "X / Twitter", url: "https://twitter.com", icon: "twitter" },
      { label: "Email", url: "mailto:hello@example.com", icon: "mail" }
    ]
  },
  projects: [
    {
      id: "isometric-room",
      title: "Interactive 3D Isometric Room",
      badge: "Active Experience",
      category: "3D & Creative",
      description: "A real-time WebGL interactive isometric bedroom & creative workstation with procedural day/night cycles, dynamic lighting, spatial raycasting, and Web Audio synthesis.",
      tags: ["Spline", "Three.js", "WebGL", "Vite", "Web Audio API"],
      links: {
        demo: "#",
        github: "https://github.com"
      },
      stats: { fps: "60 FPS", drawCalls: "32 calls", size: "140 KB" },
      highlights: ["Real-time point & directional light modulation", "Interactive raycasted furniture", "Procedural lofi synth & rain synthesis"]
    },
    {
      id: "neural-studio",
      title: "Neural Canvas Studio",
      badge: "Featured",
      category: "Creative Tech",
      description: "Next-generation generative creative studio running in-browser inference, custom WebGPU compute shaders, and reactive node graph architecture.",
      tags: ["WebGPU", "TypeScript", "React", "Node Graphs", "WASM"],
      links: {
        demo: "https://example.com/neural-studio",
        github: "https://github.com"
      },
      stats: { speed: "2.4ms frame", compute: "WebGPU TSL", format: "Lossless" },
      highlights: ["Zero-latency local canvas processing", "Custom WebGPU shader nodes", "Export to 4K SVG/EXR"]
    },
    {
      id: "veloce-telemetry",
      title: "Veloce Real-Time Telemetry",
      badge: "Enterprise",
      category: "Web Platforms",
      description: "High-throughput cloud monitoring dashboard processing 250,000 events/sec with sub-millisecond chart rendering, WebSocket multiplexing, and glassmorphic UI.",
      tags: ["React 19", "WebSockets", "Canvas2D", "Tailwind", "Go"],
      links: {
        demo: "https://example.com/veloce",
        github: "https://github.com"
      },
      stats: { throughput: "250k/sec", latency: "< 5ms", uptime: "99.99%" },
      highlights: ["Direct canvas streaming pipeline", "Virtual scroll data tables", "Customizable HUD widgets"]
    },
    {
      id: "apex-spatial",
      title: "Apex Spatial Configurator",
      badge: "WebXR",
      category: "3D & Creative",
      description: "Interactive architectural & spatial visualizer enabling instant CAD/GLTF inspection, material customizer, PBR reflections, and WebXR immersive mode.",
      tags: ["Three.js", "WebXR", "GLTF", "PBR Materials", "Post-processing"],
      links: {
        demo: "https://example.com/apex-spatial",
        github: "https://github.com"
      },
      stats: { polycount: "1.2M polys", shadow: "Cascaded", hdr: "Tone-mapped" },
      highlights: ["Interactive physically based materials", "Instant VR head-tracking", "Real-time shadow casting"]
    }
  ],
  skills: [
    {
      category: "3D & Creative Development",
      items: [
        { name: "Spline 3D & Spline Runtime", level: 95 },
        { name: "Three.js & WebGL", level: 92 },
        { name: "WebGPU & TSL Shaders", level: 85 },
        { name: "Blender & 3D Modeling", level: 88 },
        { name: "GLSL / Material Nodes", level: 82 }
      ]
    },
    {
      category: "Modern Frontend",
      items: [
        { name: "JavaScript (ESNext) / TypeScript", level: 96 },
        { name: "React 19 / Next.js / Vue", level: 94 },
        { name: "Vite / Modern Bundlers", level: 95 },
        { name: "Modern CSS / Glassmorphism / Animation", level: 96 },
        { name: "Web Audio API & Canvas", level: 90 }
      ]
    },
    {
      category: "Backend & Systems",
      items: [
        { name: "Node.js / Express / Bun", level: 90 },
        { name: "Python / FastApi", level: 86 },
        { name: "WebSockets & Event-Driven Architecture", level: 92 },
        { name: "PostgreSQL & Redis", level: 84 },
        { name: "REST & GraphQL APIs", level: 89 }
      ]
    },
    {
      category: "Workflow & Tools",
      items: [
        { name: "Git & GitHub CI/CD", level: 92 },
        { name: "Figma & UI Prototyping", level: 90 },
        { name: "Docker & Containerization", level: 84 },
        { name: "Performance Profiling (CWV, FPS)", level: 94 }
      ]
    }
  ],
  books: [
    { title: "Designing Data-Intensive Applications", author: "Martin Kleppmann", status: "Completed", progress: 100, color: "#f97316" },
    { title: "Real-Time Rendering (4th Edition)", author: "Tomas Akenine-Möller et al.", status: "Currently Reading", progress: 74, color: "#3b82f6" },
    { title: "The Nature of Code", author: "Daniel Shiffman", status: "Completed", progress: 100, color: "#10b981" },
    { title: "Structure & Interpretation of Computer Programs", author: "Abelson & Sussman", status: "Reference Guide", progress: 85, color: "#8b5cf6" }
  ]
};
