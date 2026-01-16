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
- Responsive font sizing (16px mobile, 14px desktop)
- Async command support (for contact/imprint)

#### 2. ANSI Art System
- **Logo**: Dynamic "connilefleur" logo generated on page load using ANSI art generator
- **Generator**: `ansi <text>` command generates ASCII art from any text (max 20 chars)
- **Responsive**: Line wrapping when text doesn't fit terminal width
- **Mobile**: Uses full 5-line pattern (compact 3-line was causing display issues)
- **Location**: 
  - Generator: `src/utils/ansi/generator.ts`
  - Logo: `src/components/Terminal/ansi/logo.ts`
- **Status**: ✅ Fixed - Logo displays correctly on mobile and desktop with proper wrapping

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
- **Removed**: Gerstner-Programm font files deleted from `/public/fonts/`

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
  - Responsive width (adapts to terminal/screen size)
  - Games start paused - click/tap to start
  - Click/tap to pause/resume during gameplay
  - Click/tap to restart when game over
  - ESC to exit (attempts to restore terminal to pre-game state)
- **Mobile Controls**: Virtual arrow keys displayed below game on mobile/tablet
  - Snake: Arrow keys only
  - Tetris: Arrow keys + rotate button (↻)
  - Positioned centered above hint bar
- **Location**: `src/components/Terminal/commands/games/`

#### 8. Mobile Support
- **Responsive Design**: Games and ANSI art adapt to screen size
- **Mobile Game Controls**: Virtual arrow keys for touch devices
- **ESC Button**: Shows as button on both desktop and mobile in hint bar
- **Touch Handling**: Proper tap detection (distinguishes taps from scrolls/drags)
- **Font Sizing**: Larger font on mobile (16px) for better tap targets

#### 9. Overlay System
- **Viewers**: Project media viewers (images, videos, 3D models, image stacks)
- **Content**: Contact and imprint now display directly in terminal (no overlays)
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
│   │   │   ├── index.ts         # Command registry & executor (supports async)
│   │   │   ├── core/            # Essential commands
│   │   │   ├── navigation/      # Contact, imprint (terminal display)
│   │   │   ├── system/          # System info commands
│   │   │   ├── ansi/            # ANSI art command
│   │   │   └── games/           # Terminal games
│   │   │       ├── snake.ts     # Snake game
│   │   │       └── tetris.ts   # Tetris game
│   │   ├── Terminal.tsx         # Main terminal component (game mode, async commands, links)
│   │   ├── HintBar.tsx         # Bottom hint bar (ESC button for desktop/mobile)
│   │   └── MobileGameControls.tsx # Virtual arrow keys for mobile
│   └── Viewer/                  # Media viewers (projects only)
├── config/
│   └── theme.ts                 # All colors (dark mode only)
├── hooks/
│   ├── useTheme.ts              # Theme application
│   ├── useProjects.ts           # Project loading
│   ├── useViewer.ts             # Viewer state
│   └── useContent.ts            # Content overlays (deprecated for contact/imprint)
├── styles/
│   ├── fonts.css                # Font declarations (Doto from Google Fonts)
│   └── global.css               # Global styles (responsive terminal fonts)
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

1. **⚠️ Game Exit Terminal State Restoration**: When exiting a game with ESC, the terminal should return to the exact state it was in before the game was launched (showing previous history). Currently, the scroll position restoration doesn't work correctly. See `.debug-state/CURRENT_ISSUE.md` for details.

### Build & Development

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # Build for production (generates dist/)
npm run discover     # Regenerate projects index
npm run preview      # Preview production build
```

### Recent Changes (Latest Session)

- **ANSI Logo Fixed**: Fixed logo wrapping issues on mobile - now uses full 5-line pattern
- **Contact/Imprint**: Moved from overlays to terminal display with clickable links
- **External Links**: Added support for clickable email (mailto) and Instagram links in terminal
- **Overlay Close Behavior**: Removed click-to-close on empty space, only ESC key/button closes
- **ESC Button**: Embedded in text on desktop ("Press [ESC] to close"), separate button on mobile
- **Logo Display**: Logo and welcome message only appear on initial page load
- **Clear Command**: No longer shows logo, just clears terminal
- **Game Exit**: Attempts to restore terminal state (work in progress)
- **Terminal History**: Preserved when exiting games (command remains in history)

### Next Steps / TODO

- **URGENT**: Fix game exit terminal state restoration - properly restore terminal to pre-game state
- Consider adding more command aliases
- Optimize font loading (currently using @import)
- Add more terminal games if desired
- Consider adding game high scores/persistence

### Important Files

- **Theme**: `src/config/theme.ts` - Change all colors here
- **Commands**: `src/components/Terminal/commands/` - Add new commands here (supports async)
- **Games**: `src/components/Terminal/commands/games/` - Add new games here
- **ANSI Generator**: `src/utils/ansi/generator.ts` - Extend font patterns, responsive logic
- **Logo**: `src/components/Terminal/ansi/logo.ts` - Logo display
- **Terminal**: `src/components/Terminal/Terminal.tsx` - Game mode, keyboard handling, async commands, links
- **Mobile Controls**: `src/components/Terminal/MobileGameControls.tsx` - Virtual arrow keys
- **Hint Bar**: `src/components/Terminal/HintBar.tsx` - ESC button (desktop/mobile)
- **Fonts**: `src/styles/fonts.css` - Google Fonts import for Doto
- **Global Styles**: `src/styles/global.css` - Responsive terminal fonts, mobile game controls

### Game Implementation Details

- **Game Loop**: Uses `setInterval` at 66ms (~15 FPS) for lightweight performance
- **Game State**: Tracked in Terminal component via `gameHandlerRef` and `currentGameIdRef`
- **Keyboard Input**: Global handler in capture phase intercepts keys before terminal consumes them
- **Mobile Controls**: Virtual buttons dispatch KeyboardEvent to window for game handlers
- **Exit Behavior**: Games attempt to restore terminal to pre-game state (saves scroll position, but restoration needs work)
- **History**: Game commands remain in history after exit (can use arrow keys to recall)

### Command System

- **Sync Commands**: Most commands execute synchronously
- **Async Commands**: Contact and imprint fetch markdown files asynchronously
- **Clickable Commands**: Use `[cmd:command]` or `[cmd:display|command]` syntax
- **External Links**: Use `[link:url|text]` or `[mailto:email|text]` syntax
- **Command History**: All commands saved to history, accessible with arrow keys
