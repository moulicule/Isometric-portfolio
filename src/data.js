// Project showcase data, skills, and developer profile

export const PORTFOLIO_DATA = {
  developer: {
    name: "Moulik Nanda",
    title: "M.A. Experience Design @Srishti Manipal Institute of Art, Design and Technology",
    bio: "I am a multidisciplinary designer driven by storytelling, tinkering and iterating. I have hands on experience in design research, UI/UX, design systems, web, 3D/CAD, motion graphics and film. I remain fluid in mediums, and care far more about solving the right problem, rather than the tools it takes to get there.",
    photo: "/images/moulik-nanda.jpg",
    photoAlt: "Moulik Nanda sitting cross-legged with two laptops",
    location: "Bangalore, India",
    email: "mouliknanda@gmail.com",
    resume: "/documents/moulik-nanda-design-cv.pdf",
    socials: [
      { label: "LinkedIn", url: "https://www.linkedin.com/in/moulik-nanda-868469205/", icon: "linkedin" }
    ]
  },
  projects: [
    {
      id: "cap",
      summary: "A wearable privacy project exploring recording and consent, with an expressive companion, Cappy, on its screen.",
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
      id: "airlearn",
      summary: "Turning educator-written scripts into language lessons through UI design, Figma templates, and AI-generated visuals at Unacademy.",
      title: "Airlearn @Unacademy",
      badge: "UI Design Internship",
      category: "UI design for EdTech",
      description: "For a two-month summer internship at Unacademy, I turned educator-written scripts into lesson screens for Airlearn, a language learning app. I adapted company Figma templates and mid journey images to create lessons across several languages. My daily workflow covered 7–10 lessons, Midjourney visuals, and working on feedback from senior designers and educators.",
      image: "/projects/airlearn/assets/cover-thumb.webp",
      imageAlt: "Airlearn internship: sky-blue case study with the waving mascot and Finnish and Korean lesson screens",
      tags: ["UI Design", "Figma", "Language Learning", "Midjourney"],
      links: [
        { label: "Explore case study", url: "/projects/airlearn/index.html" },
        { label: "View Figma work", url: "https://www.figma.com/design/dRf6MEUD0QRJimYOsy5YI3/airlearn?node-id=0-1" }
      ]
    },
    {
      id: "designing-dignity",
      summary: "Exploring access to prosthetic care and everyday footwear choice through field research, service design, and physical prototyping.",
      title: "Designing Dignity",
      badge: "Master’s Project",
      category: "User research, product & service design",
      description: "A  prosthetics and orthotics design project, grounded in actual on-field research. I explored women’s access to prosthetic care through a community-based service model and prototyped a detachable footwear lock system to expand everyday footwear choice. The work brings together care access, cultural expression, and dignity.",
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
      summary: "Designing a service ecosystem that gives urban Indian families more room to grieve, from planning to remembrance.",
      title: "Urban Death Care",
      badge: "Master’s Project",
      category: "Service Design & Systems Thinking",
      description: "A service design project exploring how death care can give urban Indian families more room to grieve. Through family and provider interviews, surveys, and service mapping, we developed a proposed ecosystem spanning pre-planning, crisis coordination, administrative support, and remembrance.",
      image: "/projects/urban-death-care/assets/cover.svg",
      imageAlt: "Urban Death Care concept overview connecting planning, crisis support, transition, and remembrance around room to grieve",
      tags: ["Service Design", "User Research", "Journey Mapping", "Systems Thinking"],
      links: [
        { label: "Explore case study", url: "/projects/urban-death-care/index.html" },
        { label: "Project documentation", url: "/projects/urban-death-care/index.html#documentation" }
      ]
    }
  ],
  funProjects: [
    {
      id: "timescape",
      summary: "An interactive installation that lets visitors shape time, colour, and a projected tesseract with their hands.",
      title: "Timescape",
      badge: "Interactive Exhibition",
      category: "Generative Art Installation",
      description: "An experiment in making time something you can play with. Timescape uses webcam hand tracking to rotate, zoom, and twist a projected tesseract. Holding a fist captures trails of colour as a generative artwork to keep. Shown at Bangalore International Centre (BIC) alongside two teammates’ interpretations, it invited visitors to shape the visuals with their hands.",
      image: "/projects/timescape/exhibition-thumb.webp",
      imageAlt: "A visitor raises both hands to interact with Timescape’s colourful generative visuals on a large exhibition screen",
      tags: ["Creative Coding", "p5.js", "Hand Tracking", "Generative Art"],
      links: [
        { label: "Try Timescape", url: "https://moulicule.github.io/timescape-Moulik/" },
        { label: "View source", url: "https://github.com/moulicule/timescape-Moulik" }
      ]
    },
    {
      id: "film-motion",
      summary: "A collection of film, motion graphics, and video editing, including my animation and effects work for Sunbird in the Garden.",
      title: "Film, Motion & Video Editing",
      badge: "Selected Work",
      category: "Video editing · Motion graphics · Film",
      description: "A collection of my video editing, motion graphics, and film work, from short films and animation to marketing videos, reels, and more. My latest work here is Sunbird in the Garden, an abstract animated short made for the Moving Image Art seminar, where I contributed motion graphics and special effects. The film combines rotoscoping and hand-drawn animation with experimental storytelling.",
      image: "/projects/film-motion/cover.svg",
      imageAlt: "A tilted filmstrip with an amber play symbol and concentric circles",
      tags: ["Video Editing", "Motion Graphics", "Special Effects", "Experimental Film", "Animation"],
      links: [
        { label: "Video portfolio", url: "https://drive.google.com/drive/folders/1qoEE_AjW4LM1DI3Lty8lldMrqGmoOaJA" },
        { label: "Watch Sunbird in the Garden", url: "https://drive.google.com/file/d/1iDBPJtSaNEq1VJtFWDFnEhzARwvIaR8o/view" }
      ]
    }
  ],
  skills: [
    {
      category: "UI/UX & Interaction Design",
      icon: "laptop",
      items: [
        { name: "UI/UX & User-Centred Design" },
        { name: "Figma & FigJam" },
        { name: "Wireframing & Interactive Prototyping" },
        { name: "User Flows & Information Architecture" },
        { name: "Design Systems & Component Libraries" },
        { name: "Accessibility & Mobile-First Design" },
        { name: "Microinteractions & UI Animation" },
        { name: "Spline & 3D Interaction Design" }
      ]
    },
    {
      category: "Research & Service Design",
      icon: "book-open",
      items: [
        { name: "User Research, Interviews & Surveys" },
        { name: "Usability Testing & Think-Aloud Studies" },
        { name: "Competitive Analysis" },
        { name: "Personas & Journey Mapping" },
        { name: "Stakeholder Mapping & Systems Thinking" },
        { name: "Service Blueprints & Inclusive Design" }
      ]
    },
    {
      category: "Product Design & Making",
      icon: "box",
      items: [
        { name: "CAD: Fusion 360 & Tinkercad" },
        { name: "Physical Prototyping & 3D Printing" },
        { name: "Design Thinking & Critical Making" }
      ]
    },
    {
      category: "Physical Computing",
      icon: "zap",
      items: [
        { name: "ESP32 & Arduino Prototyping" },
        { name: "C++ Firmware & PlatformIO" },
        { name: "Sensors, Displays & Haptic Feedback" }
      ]
    },
    {
      category: "Motion, Visual Design & Film",
      icon: "camera",
      items: [
        { name: "Motion Graphics & After Effects" },
        { name: "Video Production, Editing & Premiere Pro" },
        { name: "Photoshop, Illustrator & InDesign" },
        { name: "Visual Identity, Logos & Typography" },
        { name: "Storyboarding & Creative Direction" }
      ]
    },
    {
      category: "Web & Creative Development",
      icon: "gamepad",
      items: [
        { name: "HTML, CSS & JavaScript" },
        { name: "Three.js & Interactive 3D" },
        { name: "GSAP & Web Animation" },
        { name: "Responsive Web Design" }
      ]
    }
  ]
};
