// Project showcase data, skills, and developer profile

export const PORTFOLIO_DATA = {
  developer: {
    name: "Moulik Nanda",
    title: "Multidisciplinary Designer, M.A. Experience Design @Srishti Manipal Institute of Art, Design and Technology",
    bio: "I am a multidisciplinary designer driven by tinkering, iterating, and making. With hands-on experience spanning design research, UI/UX, design systems, web, 3D/CAD, motion graphics, and film, I stay medium-agnostic, caring far more about solving the right problem than the tools it takes to get there.",
    photo: "/images/moulik-nanda.jpg",
    photoAlt: "Moulik Nanda sitting cross-legged with two laptops",
    location: "Bangalore, India",
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
      category: "End-to-end product development",
      description: "CAP is my wearable privacy project; Cappy is the expressive companion who lives on its screen. Together, they explore recording and consent through animated eyes and haptic alerts. Follow my design process, explore the hardware in 3D, and try Cappy’s reactions in an interactive browser simulation.",
      image: "/projects/cap/assets/p19-1.webp",
      imageAlt: "My orange CAP 2.0 prototype on a shelf, with Cappy’s bright white eyes on its screen",
      tags: ["Product Design", "Critical Making", "Wearable Design", "ESP32", "Prototyping", "CAD"],
      links: [
        { label: "Explore case study", url: "/projects/cap/index.html" },
        { label: "Build journal", url: "/projects/cap/journal.html" }
      ]
    },
    {
      id: "designing-dignity",
      title: "Designing Dignity",
      badge: "Master’s Project",
      category: "Prosthetics & Orthotics\nService + Product Design",
      description: "A semester project with Ishita Sarin, grounded in field research at BMVSS (Jaipur Foot) and SMS Hospital in Jaipur. We explored women’s access to prosthetic care through a community-based service model and prototyped a removable Chappal & Jutti Lock to expand everyday footwear choice. The work brings together care access, cultural expression, and dignity.",
      image: "/projects/designing-dignity/chappal-lock.webp",
      imageAlt: "Purple sandal fitted with the 3D-printed Chappal Lock prototype and an adjustable black heel strap",
      tags: ["Inclusive Design", "Service Design", "User Research", "CAD", "3D Printing"],
      links: [
        { label: "Project overview (PDF)", url: "/projects/designing-dignity/project-overview.pdf" },
        { label: "Design process (PDF)", url: "/projects/designing-dignity/design-process.pdf" }
      ]
    },
    {
      id: "urban-death-care",
      title: "Urban Death Care",
      badge: "Master’s Project",
      category: "Service Design & Systems Thinking",
      description: "A semester project with Sudarsinii Mazumdar exploring how death care can give urban Indian families more room to grieve. Through family and provider interviews, surveys, and service mapping, we developed a proposed ecosystem spanning pre-planning, crisis coordination, administrative support, and remembrance.",
      image: "/projects/urban-death-care/assets/cover.svg",
      imageAlt: "Urban Death Care concept overview connecting planning, crisis support, transition, and remembrance around room to grieve",
      tags: ["Service Design", "User Research", "Journey Mapping", "Systems Thinking"],
      links: [
        { label: "Explore case study", url: "/projects/urban-death-care/index.html" },
        { label: "Project documentation", url: "/projects/urban-death-care/index.html#documentation" }
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
