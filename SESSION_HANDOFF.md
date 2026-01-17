# Session Handoff - Terminal Portfolio

## Current State (January 2025)

### Project Overview
A terminal-style portfolio website built with React, TypeScript, and xterm.js. Visitors interact with the site through terminal commands to browse projects, view media, play games, and access information.

### Key Features Implemented

#### 1. Terminal Interface
- Full-screen terminal emulator using xterm.js
- Clickable commands (cyan underlined text)
- Clickable external links (email mailto, Instagram URLs)
- Command history with arrow keys
- Tab completion
- ANSI color support
- Game mode support with real-time keyboard input
- Responsive font sizing (15px mobile, 14px desktop)
- macOS Terminal-style padding (12px/16px desktop, 10px/12px mobile)
- Async command support (for contact/imprint)

#### 2. ANSI Art System
- **Logo**: Dynamic "connilefleur" logo generated on page load using ANSI art generator
- **Generator**: `ansi <text>` command generates ASCII art from any text (max 20 chars)
- **Responsive**: Line wrapping when text doesn't fit terminal width
- **Mobile Sizing**: Logo is half the size on mobile (8px font during logo, 16px for text)
- **Desktop Sizing**: Logo uses full width and wraps naturally
- **Location**: 
  - Generator: `src/utils/ansi/generator.ts`
  - Logo: `src/components/Terminal/ansi/logo.ts`
- **Status**: ✅ Working - Logo displays correctly on mobile (smaller) and desktop (larger)

#### 3. Theme System
- **Dark mode only** (light mode removed)
- All colors centralized in `src/config/theme.ts`
- All text outside terminal is white (#ffffff)
- Terminal uses RGB colors for syntax highlighting
- CSS variables for easy color updates

#### 4. Custom Font
- **Doto** font family (Google Fonts)
- Variable weight (100-900)
- Loaded via `@import` in `src/styles/fonts.css`
- Used everywhere including terminal

#### 5. Commands Structure
Commands are organized by functionality:
- **Core**: `help`, `open`, `close`, `clear`
- **Navigation**: `contact`, `imprint` (display in terminal, not overlays)
- **System**: `whoami`, `uname`, `neofetch`
- **ANSI**: `ansi <text>`
- **Games**: `snake`, `tetris`

#### 6. Project System
- Projects in `/public/projects/` folders
- Each project has `meta.json` manifest
- Supports: images, videos, 3D models (GLB/GLTF), image stacks
- Build-time discovery script generates `projects-index.json`
- Overlays only used for project viewers (not for contact/imprint)

#### 7. Terminal Games
- **Snake**: Classic snake game with score tracking
- **Tetris**: Full Tetris implementation with levels, line clearing, next piece preview
- **Features**:
  - Lightweight rendering (~15 FPS game loop, ~6-7 FPS for Snake updates)
  - Responsive width (full width on mobile, max 30/10 on desktop)
  - Games start paused - click/tap to start
  - Click/tap to pause/resume during gameplay
  - Click/tap to restart when game over
  - ESC to exit (resets terminal to initial state)
- **Mobile Layout**: 
  - Games use full terminal width on mobile
  - Games take ~40% of screen height (top portion)
  - Controls in bottom 50% of screen
- **Mobile Controls**: Virtual arrow keys displayed below game on mobile/tablet
  - Snake: Arrow keys only
  - Tetris: Arrow keys + rotate button (↻)
  - Full-width layout with larger buttons for better touch targets
- **Location**: `src/components/Terminal/commands/games/`
  - Shared utilities: `src/components/Terminal/commands/games/shared/types.ts`

#### 8. Mobile Support
- **Responsive Design**: Games and ANSI art adapt to screen size
- **Mobile Game Controls**: Virtual arrow keys for touch devices (full-width layout)
- **ESC Button**: Shows as button on both desktop and mobile in hint bar
- **Touch Handling**: Proper tap detection (distinguishes taps from scrolls/drags)
- **Font Sizing**: 15px on mobile (tablets), 14px on small mobile for better wrapping
- **Text Wrapping**: Welcome and help text use manual line breaks on mobile

#### 9. Overlay System
- **Viewers**: Project media viewers (images, videos, 3D models, image stacks)
- **Content**: Contact and imprint display directly in terminal (no overlays)
- **Close Behavior**: Only ESC key/button closes overlays (no click-to-close on empty space)
- **ESC Button**: Embedded in "Press [ESC] to close" text on desktop, separate button on mobile

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
│   │   │   ├── navigation/      # Contact, imprint (terminal display)
│   │   │   ├── system/          # System info commands
│   │   │   ├── ansi/            # ANSI art command
│   │   │   └── games/           # Terminal games
│   │   │       ├── shared/      # Shared game utilities
│   │   │       │   └── types.ts # Point interface, calculateGameDimensions()
│   │   │       ├── snake.ts     # Snake game
│   │   │       └── tetris.ts    # Tetris game
│   │   ├── utils/
│   │   │   └── clickableCommands.ts # Clickable command parsing & management
│   │   ├── hooks/               # Custom hooks (for future use)
│   │   ├── constants.ts         # Shared constants (PROMPT)
│   │   ├── Terminal.tsx         # Main terminal component
│   │   ├── HintBar.tsx         # Bottom hint bar (ESC button)
│   │   └── MobileGameControls.tsx # Virtual arrow keys for mobile
│   └── Viewer/                  # Media viewers (projects only)
├── config/
│   └── theme.ts                 # All colors (dark mode only)
├── hooks/
│   ├── useTheme.ts              # Theme application
│   ├── useProjects.ts           # Project loading
│   └── useViewer.ts             # Viewer state
├── styles/
│   ├── fonts.css                # Font declarations (Doto from Google Fonts)
│   ├── global.css               # Base styles and imports
│   ├── terminal.css             # Terminal-specific styles
│   ├── components.css           # Component styles (hint bar, mobile controls)
│   └── viewer.css               # Viewer and overlay styles
└── utils/
    ├── ansi/
    │   ├── generator.ts         # ANSI art generator (responsive, line wrapping)
    │   └── index.ts
    └── markdown.ts              # Markdown to HTML converter
```

### Color System

All colors in `src/config/theme.ts`:
- **Background**: Dark (#0d0d0d, #1a1a1a, #222222)
- **Text**: White (#ffffff) everywhere outside terminal
- **Terminal**: RGB colors for syntax highlighting
- **Buttons**: White text, transparent backgrounds

### Known Issues

**None** - All features working as expected.

---

### Recent Changes (Latest Session)

#### Code Organization
- ✅ Extracted clickable commands utilities to separate file
- ✅ Created shared game utilities (Point interface, dimension calculation)
- ✅ Organized styles into separate files by concern
- ✅ Created constants file for shared values
- ✅ Games now use shared dimension calculation

#### Visual & UX Improvements
- ✅ **ANSI Logo**: Mobile version is half the size of desktop (8px font during logo rendering)
- ✅ **Welcome Text**: Better wrapping on mobile with manual line breaks
- ✅ **Help Text**: Formatted with `[ ]` brackets, better wrapping
- ✅ **Text Alignment**: All text aligns to left edge consistently
- ✅ **Spacing**: Consistent vertical spacing between all elements
- ✅ **macOS Terminal Padding**: Added padding for better readability (12px/16px desktop, 10px/12px mobile)

#### Game Improvements
- ✅ **Mobile Layout**: Games use full terminal width, take ~40% of screen height
- ✅ **Mobile Controls**: Full-width layout with larger buttons (70px height, 2rem font)
- ✅ **Game Exit**: Clean reset to initial state (logo + welcome message)
- ✅ **Touch Targets**: Improved button sizes and spacing for mobile

### Build & Development

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # Build for production (generates dist/)
npm run discover     # Regenerate projects index
npm run preview      # Preview production build
```

### Next Steps / Focus Areas

**Current Focus**: Visual appearance and styling
- Colors and theme refinement
- Project viewer styling and presentation
- Overall visual polish

**Future Considerations**:
- Add more command aliases
- Optimize font loading (currently using @import)
- Add more terminal games if desired
- Consider adding game high scores/persistence

### Important Files

- **Theme**: `src/config/theme.ts` - Change all colors here
- **Commands**: `src/components/Terminal/commands/` - Add new commands here (supports async)
- **Games**: `src/components/Terminal/commands/games/` - Add new games here
- **Game Utilities**: `src/components/Terminal/commands/games/shared/types.ts` - Shared game code
- **ANSI Generator**: `src/utils/ansi/generator.ts` - Extend font patterns, responsive logic
- **Logo**: `src/components/Terminal/ansi/logo.ts` - Logo display
- **Terminal**: `src/components/Terminal/Terminal.tsx` - Main terminal component
- **Clickable Commands**: `src/components/Terminal/utils/clickableCommands.ts` - Command parsing
- **Constants**: `src/components/Terminal/constants.ts` - Shared constants
- **Mobile Controls**: `src/components/Terminal/MobileGameControls.tsx` - Virtual arrow keys
- **Hint Bar**: `src/components/Terminal/HintBar.tsx` - ESC button (desktop/mobile)
- **Styles**: `src/styles/` - Organized by concern (terminal, components, viewer)
- **Fonts**: `src/styles/fonts.css` - Google Fonts import for Doto

### Game Implementation Details

- **Game Loop**: Uses `setInterval` at 66ms (~15 FPS) for lightweight performance
- **Game State**: Tracked in Terminal component via `gameHandlerRef` and `currentGameIdRef`
- **Keyboard Input**: Global handler in capture phase intercepts keys before terminal consumes them
- **Mobile Controls**: Virtual buttons dispatch KeyboardEvent to window for game handlers
- **Exit Behavior**: Games reset terminal to initial state (logo + welcome message)
- **History**: Game commands remain in history after exit (can use arrow keys to recall)
- **Dimensions**: Games use shared `calculateGameDimensions()` function for responsive sizing

### Command System

- **Sync Commands**: Most commands execute synchronously
- **Async Commands**: Contact and imprint fetch markdown files asynchronously
- **Clickable Commands**: Use `[cmd:command]` or `[cmd:display|command]` syntax
- **External Links**: Use `[link:url|text]` or `[mailto:email|text]` syntax
- **Command History**: All commands saved to history, accessible with arrow keys

### Code Organization

- **Utilities**: `src/components/Terminal/utils/` - Reusable terminal utilities
- **Hooks**: `src/components/Terminal/hooks/` - Custom hooks (prepared for future use)
- **Shared Game Code**: `src/components/Terminal/commands/games/shared/` - Common game utilities
- **Styles**: Organized into `terminal.css`, `components.css`, `viewer.css` for better maintainability
