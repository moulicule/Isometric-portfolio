// Project showcase data, skills, and developer profile

export const PORTFOLIO_DATA = {
  developer: {
    name: "Moulik Nanda",
    title: "Creative Technologist & Full-Stack 3D Web Engineer",
    bio: "I craft immersive 3D web experiences, creative interfaces, and robust modern web applications at the intersection of design, engineering, and spatial computing.",
    location: "San Francisco, CA / Remote",
    status: "Available for ambitious projects",
    email: "mouliknanda@gmail.com",
    socials: [
      { label: "LinkedIn", url: "https://www.linkedin.com/in/moulik-nanda-868469205/", icon: "linkedin" }
    ]
  },
  projects: [
    {
      id: "cap",
      title: "CAP (Catch a Pervert)",
      badge: "Master’s Project",
      category: "Experience Design & Physical Computing",
      description: "Meet Cappy, a wearable privacy companion that explores recording and consent through expressive eyes and haptic alerts. Follow my design process, explore the hardware in 3D, and try Cappy’s reactions in an interactive browser simulation.",
      image: "/projects/cap/assets/p19-1.webp",
      imageAlt: "My orange Cappy 2.0 prototype with bright white eyes, sitting on a shelf",
      tags: ["Product Design", "Critical Making", "Wearable Design", "ESP32", "Prototyping"],
      links: [
        { label: "Explore case study", url: "/projects/cap/index.html" },
        { label: "Build journal", url: "/projects/cap/journal.html" }
      ]
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
  ]
};
