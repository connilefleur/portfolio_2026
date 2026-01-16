# Session Handoff - Terminal Portfolio

## Current State (January 2025)

### Project Overview
A terminal-style portfolio website built with React, TypeScript, and xterm.js. Visitors interact with the site through terminal commands to browse projects, view media, and access information.

### Key Features Implemented

#### 1. Terminal Interface
- Full-screen terminal emulator using xterm.js
- Clickable commands (cyan underlined text)
- Command history with arrow keys
- Tab completion
- ANSI color support

#### 2. ANSI Art System
- **Logo**: Dynamic "connilefleur" logo generated on page load using ANSI art generator
- **Generator**: `ansi <text>` command generates ASCII art from any text (max 20 chars)
- **Location**: 
  - Generator: `src/utils/ansi/generator.ts`
  - Logo: `src/components/Terminal/ansi/logo.ts`

#### 3. Theme System
- **Dark mode only** (light mode removed)
- All colors centralized in `src/config/theme.ts`
- All text outside terminal is white (#ffffff)
- Terminal uses RGB colors for syntax highlighting
- CSS variables for easy color updates

#### 4. Custom Font
- **Gerstner-Programm** font family
- All weights and styles loaded (Light, Regular, Medium, Bold + Italics)
- Location: `/public/fonts/`
- Used everywhere except terminal (terminal uses monospace fonts)

#### 5. Commands Structure
Commands are organized by functionality:
- **Core**: `help`, `open`, `close`, `clear`
- **Navigation**: `contact`, `imprint`
- **System**: `whoami`, `uname`, `neofetch`
- **ANSI**: `ansi <text>`

#### 6. Project System
- Projects in `/public/projects/` folders
- Each project has `meta.json` manifest
- Supports: images, videos, 3D models (GLB/GLTF), image stacks
- Build-time discovery script generates `projects-index.json`

### File Structure

```
src/
├── components/
│   ├── Terminal/
│   │   ├── ansi/
│   │   │   ├── index.ts
│   │   │   └── logo.ts          # Connilefleur logo generator
│   │   ├── commands/
│   │   │   ├── index.ts         # Command registry & executor
│   │   │   ├── core/            # Essential commands
│   │   │   ├── navigation/      # Contact, imprint
│   │   │   ├── system/          # System info commands
│   │   │   └── ansi/            # ANSI art command
│   │   ├── Terminal.tsx         # Main terminal component
│   │   └── HintBar.tsx         # Bottom hint bar
│   └── Viewer/                  # Media viewers
├── config/
│   └── theme.ts                 # All colors (dark mode only)
├── hooks/
│   ├── useTheme.ts              # Theme application
│   ├── useProjects.ts           # Project loading
│   ├── useViewer.ts             # Viewer state
│   └── useContent.ts            # Content overlays
├── styles/
│   ├── fonts.css                # Font declarations
│   └── global.css               # Global styles
└── utils/
    └── ansi/
        ├── generator.ts         # ANSI art generator
        └── index.ts
```

### Color System

All colors in `src/config/theme.ts`:
- **Background**: Dark (#0d0d0d, #1a1a1a, #222222)
- **Text**: White (#ffffff) everywhere outside terminal
- **Terminal**: RGB colors for syntax highlighting
- **Buttons**: White text, transparent backgrounds

### Known Issues / Notes

1. **Logo Display**: Logo uses ANSI generator, displays on page load
2. **Focus Outline**: Fixed - buttons blur on ESC to prevent outline
3. **Terminal Theme**: Uses xterm.js with dark theme colors
4. **Font**: Gerstner-Programm used everywhere except terminal (monospace)

### Build & Development

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # Build for production (generates dist/)
npm run discover     # Regenerate projects index
npm run preview      # Preview production build
```

### Recent Changes

- Removed light/dark mode toggle (dark mode only)
- Simplified theme system
- Added ANSI art generator
- Reorganized commands into folders by functionality
- Added Gerstner-Programm font
- All text colors set to white outside terminal
- Logo displays on page load using ANSI generator

### Next Steps / TODO

- Test ANSI art generator with different fonts/styles
- Consider adding more command aliases
- Optimize font loading
- Add more terminal commands if needed

### Important Files

- **Theme**: `src/config/theme.ts` - Change all colors here
- **Commands**: `src/components/Terminal/commands/` - Add new commands here
- **ANSI Generator**: `src/utils/ansi/generator.ts` - Extend font patterns here
- **Logo**: `src/components/Terminal/ansi/logo.ts` - Update logo display
