# Architecture & Project Plan

## Overview

A fullscreen, terminal-style portfolio website where the terminal IS the interface. Visitors explore projects by typing commands like in a Linux shell. Everything is simulated, static, and deployed without a backend.

## Project Structure

```
/
├── public/
│   ├── projects/              # Project folders (each with meta.json + media)
│   │   └── example-project/
│   │       ├── meta.json
│   │       └── image.jpg
│   ├── content/
│   │   ├── contact.md         # Contact information
│   │   └── impressum.md       # Legal notice / imprint
│   └── projects-index.json    # Auto-generated at build time
│
├── src/
│   ├── index.tsx              # App entry point
│   ├── App.tsx                # Main app component
│   │
│   ├── components/
│   │   ├── Terminal/
│   │   │   ├── Terminal.tsx       # xterm.js wrapper
│   │   │   ├── CommandParser.ts   # Command parsing logic
│   │   │   ├── commands/          # Individual command handlers
│   │   │   │   ├── index.ts
│   │   │   │   ├── help.ts
│   │   │   │   ├── projects.ts
│   │   │   │   ├── project.ts
│   │   │   │   ├── contact.ts
│   │   │   │   ├── imprint.ts
│   │   │   │   └── system.ts      # whoami, uname, neofetch, clear
│   │   │   └── HintBar.tsx        # Bottom command hints
│   │   │
│   │   └── Viewer/
│   │       ├── Viewer.tsx         # Viewer container/switcher
│   │       ├── ImageViewer.tsx    # Single image display
│   │       ├── VideoViewer.tsx    # Video player
│   │       ├── ThreeDViewer.tsx   # 3D model viewer (three.js)
│   │       └── ImageStackViewer.tsx # Image sequence viewer
│   │
│   ├── hooks/
│   │   ├── useTerminal.ts         # Terminal state management
│   │   ├── useProjects.ts         # Project data loading
│   │   └── useViewer.ts           # Viewer state management
│   │
│   ├── types/
│   │   ├── commands.ts            # Command type definitions
│   │   ├── projects.ts            # Project/media type definitions
│   │   └── terminal.ts            # Terminal state types
│   │
│   ├── utils/
│   │   ├── projectLoader.ts       # Load projects from index
│   │   └── markdownParser.ts      # Parse contact/impressum markdown
│   │
│   └── styles/
│       ├── terminal.css           # Terminal styling
│       ├── viewer.css             # Viewer overlay styles
│       └── global.css             # Base styles
│
├── scripts/
│   └── discover-projects.js       # Build-time project scanner
│
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── ARCHITECTURE.md
└── PROJECT_TEMPLATE.md
```

## Component Architecture

### Terminal Component
- Uses **xterm.js** for authentic terminal emulation
- Handles keyboard input, command history, tab completion
- Parses commands and dispatches to handlers
- Remains interactive even when viewer is open

### Viewer Component
- Overlay that appears when viewing project media
- Supports: images, videos, 3D models (GLB/GLTF), image stacks
- Can be closed with `close` command or Escape key
- Positioned above terminal but terminal stays usable

### HintBar Component
- Fixed bar at bottom of screen
- Shows clickable command shortcuts
- Clicking injects and executes the command

## Command System

| Command | Description |
|---------|-------------|
| `help` | List available commands |
| `projects` | List all projects |
| `project <name>` | Open project viewer |
| `close` | Close current viewer |
| `contact` | Show contact information |
| `imprint` | Show legal notice |
| `clear` | Clear terminal screen |
| `whoami` | Display user info (easter egg) |
| `uname` | System info (easter egg) |
| `neofetch` | ASCII art system info |

## Data Flow

```
Build Time:
  /public/projects/**/meta.json  →  discover-projects.js  →  projects-index.json

Runtime:
  App loads  →  Fetch projects-index.json  →  Commands query project data
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite 5 |
| Terminal | xterm.js + xterm-addon-fit |
| 3D Viewer | Three.js + @react-three/fiber + @react-three/drei |
| Styling | Plain CSS (no framework) |
| Build Scripts | Node.js |

## Deployment

1. Run `npm run build`
2. Upload `dist/` folder to any static host
3. Configure custom domain + HTTPS

Works on: Strato, IONOS, Netlify, Vercel, GitHub Pages, or any static hosting.

## Key Design Decisions

1. **No runtime backend** - All content is static, generated at build time
2. **Real terminal emulator** - xterm.js provides authentic feel, not CSS tricks
3. **Folder-based content** - Projects are just folders with meta.json
4. **Terminal stays active** - Viewer is an overlay, not a page navigation
5. **Simulated shell** - Honest about being fake, no security concerns
