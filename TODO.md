# TODO List - Portfolio Improvements

**Last Updated:** January 2025  
**Status:** All core features working ✅ | Ready for enhancements

---

## 📋 Task Overview

### Priority 1: Visual & Design Polish
1. ✅ Welcome Message Enhancement
2. ✅ Color System Refactoring (Cool Minimal Palette)
3. 🟡 Apple-like Design Language (In Progress - refining glass buttons)
4. ⬜ Visual Appearance Polish
5. ⬜ Viewer Styling Enhancement

### Priority 2: UX & Performance
6. ✅ Font Loading Optimization
7. ⬜ Google Fonts API Integration
8. ⬜ Link Hover Behavior & Styling
9. ⬜ Terminal Friendliness & Messaging
10. ⬜ Command Aliases Review

### Priority 3: Feature Additions
11. ⬜ Game Features Enhancement

---

## 📝 Detailed Tasks

### 1. Welcome Message Enhancement
**Status:** ✅ Completed  
**Priority:** Medium  
**Files:** `src/components/Terminal/utils/displayLogo.ts`  
**Completed:**
- Added welcome introduction line
- Improved formatting with arrow indicators (→)
- Added spacing between sections
- Fixed persistent command clickability
- Made welcome message more monochrome (only logo and name colored)
- Changed prompt from "visitor@portfolio" to "user@portfoliOS"

---

### 2. Color System Refactoring (Cool Minimal Palette)
**Status:** ✅ Completed  
**Priority:** High  
**Files:** `src/config/theme.ts`, `src/styles/*.css`, `src/App.tsx`, `src/components/Viewer/Viewer.tsx`  
**Completed:**

**Cool Minimal Palette Implemented:**
- Base: `#0f1419` (dark blue-grey)
- Surface: `#1a2332` (slate)
- Accent: `#5a7a7a` (muted teal)
- Highlight: `#7a9a9a` (lighter teal)

**Changes Made:**
- ✅ Updated `theme.ts` with complete Cool Minimal Palette
- ✅ Replaced all hardcoded colors with CSS variables
- ✅ Updated terminal ANSI colors to match palette (muted, cohesive colors)
- ✅ Replaced hardcoded colors in `App.tsx` (loading text)
- ✅ Replaced hardcoded colors in `Viewer.tsx` (loading text)
- ✅ Added comments to `clickableCommands.ts` explaining cyan color mapping
- ✅ Saved alternative palettes (Muted Earth Tones, Warm Muted) as commented code for easy switching
- ✅ All CSS files already using CSS variables (no changes needed)

**Color System:**
- Comprehensive color system with background, text, border, accent, button, and overlay colors
- Terminal colors fully integrated with palette
- Text colors: primary (#e0e0e0), secondary (#b0b0b0), tertiary (#808080)
- Border colors using slate tones
- Accent colors (teal) for interactive elements

**Benefits Achieved:**
- ✅ Easy theme switching (alternative palettes ready)
- ✅ Consistent color usage across entire application
- ✅ Better maintainability (single source of truth)
- ✅ Professional appearance with cohesive color scheme

---

### 3. Apple-like Design Language
**Status:** ✅ Completed  
**Priority:** High  
**Files:** `src/styles/components.css`, `src/components/Terminal/HintBar.tsx`, `src/components/WindowControls.tsx`, `src/styles/viewer.css`, `src/components/GlassButton/`  
**Estimated Effort:** 3-4 hours

**Current State:**
- ✅ Liquid glass overlays implemented
- ✅ Squircle corners applied
- ✅ macOS window controls added
- ✅ Multi-layer shadows implemented
- ✅ Smooth animations added
- ✅ **Realistic 3D glass pill buttons implemented with WebGL**

**Completed:**
- ✅ Liquid glass effect on viewer and content overlays
- ✅ Squircle corners (12px-16px) on buttons and content boxes
- ✅ macOS-style window controls (red/yellow/green dots) in Viewer
- ✅ Multi-layer shadows for depth
- ✅ Smooth Apple-style animations (cubic-bezier transitions)
- ✅ Depth shadow behind floating buttons
- ✅ Terminal full-screen (removed bottom padding for hint bar)
- ✅ Empty line after command output for better spacing
- ✅ Removed hint bar background (buttons now float)
- ✅ Larger buttons with consistent spacing
- ✅ **WebGL 3D glass pill buttons:**
  - ✅ **GlassButton component created and integrated**
  - ✅ **Background grid system:** 30px cross grid (light grey #b8b8b8, darker crosses #989898)
  - ✅ **WebGL renderer:** 3D geometry with realistic glass refraction
  - ✅ **Glass effect:** Normal-based refraction, blur, Fresnel, lighting
  - ✅ **Layout:** Terminal full-height, buttons overlay with proper transparency
  - ✅ **Status:** Working and visible - glass pills show realistic refraction of background grid
  
**Current Implementation: Canvas-based Clear Glass with Refraction**

**Architecture:**
- Create `GlassButton` React component that wraps button content
- Use Canvas API to render all glass effect layers exactly as in Figma
- Component will be drop-in replacement for existing buttons
- No interference with xterm.js terminal (separate canvas elements)

**Figma Design Specifications:**
- **Top Parent Frame:** 258x84 (adjustable to content), corner radius 174, iOS corner smoothing 60%
- **Fill:** 1% pure white (almost transparent)
- **Stroke:** Linear vertical gradient (top 40% white, bottom 32% white), inside position, weight 1

**Layer Structure (bottom to top):**
1. **Rounded background rectangle:**
   - 1% white fill, larger than parent (clipped)
   - Background blur uniform: blur 4
   - Texture noise: large scaled wavy (displaces blur for glassy refracted look)

2. **Group container:**
   - 2.1.1: Rectangle - D9D9D9 50% fill, same size as parent
   - 2.1.2: Rectangle - 545454 10% fill, background blur uniform size 90
   - 2.1.3: Group:
     - 2.1.3.1: Layer 5-10% smaller, layer blur size 6, fill D9D9D9 100%
     - 2.1.3.2: Ellipse 2x parent size, background blur size 8, fill black 10% (glow/overlay)
   - 2.1.4: Rectangle - blend mode multiply, stroke linear gradient (top-left to bottom-right, black 80% → 20% → 80%), layer blur size 8, no fill
   - 2.1.5: Rectangle - blend mode plus lighter, stroke centered linear gradient (top-left to bottom-right, white 80% → 5% → 5% → 80%), layer blur size 3, no fill
   - 2.1.6: Rectangle - blend mode plus lighter, stroke solid white 20%, weight 1, layer blur size 3, no fill

**Implementation Plan:**

**Phase 1: Component Structure** ✅ **COMPLETED**
- [x] Create `src/components/GlassButton/GlassButton.tsx`
- [x] Create `src/components/GlassButton/useGlassRenderer.ts` hook
- [x] Create `src/components/GlassButton/types.ts` for types
- [x] Component props: `children`, `onClick`, `className`, `hover` state

**Phase 2: Canvas Rendering Engine** ✅ **COMPLETED** (Simplified approach)
- [x] Implement noise texture generation (turbulence function for organic pattern)
- [x] Implement background blur with noise displacement
- [x] Implement blur effects (filter: blur())
- [x] Implement bilinear interpolation for smooth displacement
- [x] Clean rounded corners (arc-based, not iOS smoothing)

**Phase 3: Glass Effect Rendering** ✅ **COMPLETED**
- [x] Render background grid through glass (WebGL texture)
- [x] Apply blur effect (9-sample Gaussian blur in shader)
- [x] Apply refraction distortion (normal-based UV offset)
- [x] Render with proper transparency (Fresnel effect)
- [x] Add lighting and tint for realistic glass appearance
- [x] **COMPLETED:** WebGL shader working with realistic glass refraction

**Phase 4: Optimization** ✅ **COMPLETED** (WebGL approach)
- [x] WebGL rendering for better performance
- [x] Animation loop for smooth rendering
- [x] Background texture caching
- [x] Efficient shader implementation
- [x] Performance: WebGL rendering at 60fps target

**Phase 5: Integration** ✅ **COMPLETED**
- [x] Update `HintBar.tsx` to use `GlassButton` component
- [x] Replace existing button elements with `<GlassButton>`
- [x] Ensure content renders on top
- [x] Terminal full-height, buttons overlay

**Phase 6: Styling & Polish** ✅ **COMPLETED**
- [x] Buttons responsive to content size
- [x] Pill shape with proper overflow handling (CSS border-radius)
- [x] Glass effect visible and working
- [x] Refraction distortion showing background grid through buttons
- [x] Proper transparency with Fresnel effect
- [x] Tested and working in browser

**Technical Details:**
- **Blend Modes:** `globalCompositeOperation = 'multiply'` and custom plus-lighter implementation
- **Noise:** Perlin noise or turbulence function for wavy texture
- **Blur:** Canvas `filter` property or manual blur implementation
- **Gradients:** `createLinearGradient()` for stroke gradients
- **Corner Smoothing:** Custom path with smooth curves (approximate iOS 60% smoothing)

**Performance Considerations:**
- Initial render: ~10-20ms per button (one-time cost)
- Hover update: ~5-10ms (if cached base, just adjust brightness)
- Total for 3-4 buttons: ~50-80ms on mount (acceptable)
- No interference with xterm.js (separate canvas elements)

**Files Created:**
- ✅ `src/components/GlassButton/GlassButton.tsx` - Main component
- ✅ `src/components/GlassButton/useGlassRenderer.ts` - WebGL rendering hook
- ✅ `src/components/GlassButton/types.ts` - TypeScript types
- ✅ `src/components/GlassButton/utils/webgl3DPillRenderer.ts` - WebGL renderer class
- ✅ `src/components/GlassButton/utils/backgroundCapture.ts` - Background capture utility
- ✅ `src/components/GlassButton/GlassButton.css` - Styles
- ✅ `src/components/GlassButton/index.ts` - Exports

**Files to Modify:**
- `src/components/Terminal/HintBar.tsx` - Replace buttons with GlassButton
- `src/styles/components.css` - May need minor adjustments for content positioning

**Proposed Changes:**

**Liquid Glass Effect:**
- Apply frosted glass/blur effect to hint bar (bottom bar)
- Use backdrop-filter: blur() with semi-transparent background
- Subtle border/shadow for depth

**Squircle Corners:**
- Use iOS-style rounded corners (squircle) instead of standard border-radius
- Apply to buttons, overlays, and containers
- Use CSS clip-path or border-radius with specific values

**Apple-style Window Controls:**
- Add close button (red dot) in top-left corner
- Optional: Add minimize/maximize buttons (yellow/green dots)
- Position: Fixed top-left, styled like macOS window controls
- Functionality: Close button closes viewer/overlay

**Additional Apple Design Elements:**
- Subtle shadows and depth
- Smooth animations and transitions
- Refined spacing and typography
- Subtle hover effects
- Link and hover styling (smooth color transitions, underline animations)

**Implementation Considerations:**
- Use CSS backdrop-filter for glass effect (with fallback)
- Consider using SVG for squircle shapes
- Ensure accessibility (close button keyboard navigation)
- Test on mobile (glass effect may need adjustment)
- Keep performance in mind (backdrop-filter can be expensive)

**Areas to Update:**
- Hint bar styling
- Viewer overlay
- Content overlays (contact, imprint)
- Buttons and interactive elements
- Link and hover styling (smooth transitions, Apple-style interactions)
- Terminal container (subtle refinements)

---

### 4. Visual Appearance Polish
**Status:** 🟡 In Progress  
**Priority:** Medium  
**Files:** `src/styles/*.css`, `src/config/theme.ts`  
**Estimated Effort:** 1-2 hours

**Completed:**
- Replaced hardcoded `#ffffff` colors with CSS variables in components.css and viewer.css
- Improved color consistency across components

**Remaining Tasks:**
- Review color scheme consistency across all components
- Check contrast ratios for accessibility
- Review terminal color palette (ANSI colors)
- Verify hover states and interactive elements
- Check mobile vs desktop color consistency

**Areas to Review:**
- Terminal colors (background, text, prompt)
- Clickable command styling (cyan underlined)
- Viewer overlay colors
- Button colors (hint bar, mobile controls)
- Game colors (Snake, Tetris)

**Notes:**
- Current styling is functional but could benefit from polish
- Will be enhanced with new color system (Task 2)

---

### 5. Viewer Styling Enhancement
**Status:** 🟡 Pending  
**Priority:** Medium  
**Files:** `src/components/Viewer/*.tsx`, `src/styles/viewer.css`  
**Estimated Effort:** 2-3 hours

**Tasks:**
- Enhance image viewer presentation
- Improve video viewer controls and styling
- Polish 3D model viewer appearance
- Enhance image stack/slideshow viewer
- Add smooth transitions between media items
- Improve loading states and indicators
- Review responsive behavior on mobile

**Current State:**
- All viewers functional
- Basic styling in place
- Could benefit from visual polish

**Considerations:**
- Maintain fullscreen overlay behavior
- Ensure ESC key functionality preserved
- Keep mobile responsiveness
- Integrate with Apple-like design language (Task 3)

---

### 6. Font Loading Optimization
**Status:** ✅ Completed  
**Priority:** Low-Medium  
**Files:** `index.html`, `src/styles/fonts.css`  
**Completed:**
- Replaced `@import` with `<link>` tags in `index.html`
- Added preconnect links for faster DNS resolution
- Added font preload for better performance
- Removed blocking `@import` statement

---

### 7. Google Fonts API Integration
**Status:** 🟡 Pending  
**Priority:** Medium  
**Files:** `index.html`, `src/styles/fonts.css`, `src/config/fonts.ts` (new), `src/hooks/useFont.ts` (new)  
**Estimated Effort:** 1-2 hours

**Current State:**
- Font is hardcoded in `index.html` as Google Fonts link tag
- Font name "Doto" is hardcoded
- Changing fonts requires manual HTML editing

**Proposed Changes:**
- Create dynamic Google Fonts API integration
- Allow font name to be specified in config
- Automatically fetch and load font from Google Fonts API
- Support font weights and styles
- Fallback to system fonts if API fails
- Cache font loading for performance

**Implementation:**
- Create `src/config/fonts.ts` with font configuration
- Create `src/hooks/useFont.ts` hook to dynamically load fonts
- Use Google Fonts API: `https://fonts.googleapis.com/css2?family={FontName}:wght@{weights}&display=swap`
- Dynamically inject `<link>` tag or use `@import` in CSS
- Support multiple font weights (e.g., 400, 500, 600, 700)
- Add font fallback chain in CSS

**Usage:**
```tsx
// In config/fonts.ts
export const fontConfig = {
  name: 'Doto', // Just provide the font name
  weights: [400, 500, 600, 700],
  display: 'swap',
};

// Font will be automatically loaded from Google Fonts API
```

**Benefits:**
- Easy font switching (just change name in config)
- No manual HTML editing required
- Supports any Google Font
- Automatic API integration
- Better maintainability

**Considerations:**
- Handle font loading errors gracefully
- Support font variants (italic, etc.)
- Consider font preloading for performance
- Validate font name exists in Google Fonts
- Add loading state for font

---

### 8. Link Hover Behavior & Styling
**Status:** 🟡 Pending  
**Priority:** Medium  
**Files:** `src/components/Terminal/utils/clickableCommands.ts`, `src/styles/terminal.css`  
**Estimated Effort:** 30-45 minutes

**Current State:**
- Links and clickable commands use cyan color with underline
- No hover state styling
- No visual feedback on mouse over

**Proposed Changes:**
- Add hover state styling for clickable links and commands
- Adjust hover color (use accent color from new palette)
- Add smooth transition effects
- Ensure hover states work on both desktop and mobile (touch feedback)
- Consider cursor change on hover

**Areas to Review:**
- External links (`[link:url|text]` and `[mailto:email|text]`)
- Clickable commands (`[cmd:command]`)
- CSS hover pseudo-classes for `.xterm-underline` elements
- Touch device hover states

**Implementation Considerations:**
- Use CSS for hover effects (not inline styles)
- Ensure accessibility (keyboard navigation, focus states)
- Test with terminal's underline class elements
- Use colors from new palette system (Task 2)

---

### 9. Terminal Friendliness & Messaging
**Status:** 🟡 Pending  
**Priority:** Medium  
**Files:** `src/components/Terminal/commands/index.ts`, `src/components/Terminal/commands/**/*.ts`  
**Estimated Effort:** 1-2 hours

**Current State:**
- Some error messages are too technical
- System commands output very technical information
- Tone could be more friendly while maintaining tech vibe

**Design Philosophy:**
- **Normal users:** Simple, friendly messages for common actions
- **Tech-savvy users:** Keep technical commands but add friendly touches
- **Easter eggs:** Hidden gems for nerds who explore deeply

**Proposed Changes:**

**Error Messages:**
- Instead of: `"Command not found: ${cmdName}"`
- Use: `"Hmm, I don't know that command. Try [cmd:help] to see what's available!"`

**Loading Errors:**
- Instead of: `"Unable to load contact information."`
- Use: `"Sorry, couldn't load that right now. Please try again later."`

**System Commands (Keep Tech Vibe, Add Friendliness):**
- `uname`: Keep simple, maybe add friendly note
- `neofetch`: Make more personal/friendly, less technical jargon
- `whoami`: Already good (shows logo)

**General Tone:**
- Use "I" instead of "The system"
- Use friendly, conversational language
- Add helpful suggestions
- Avoid unnecessary technical jargon
- Keep easter eggs for tech-savvy users

**Commands to Review:**
- `help` - Already friendly
- `open` - Review output messages
- `contact` - Error message
- `imprint` - Error message
- `uname` - Add friendly touch
- `neofetch` - Make more personal
- `whoami` - Already good
- Error handler in `commands/index.ts`

**Implementation Considerations:**
- Maintain technical accuracy for system commands
- Add personality without being unprofessional
- Keep easter eggs subtle and discoverable
- Test with both user types in mind

---

### 10. Command Aliases Review
**Status:** 🟡 Pending  
**Priority:** Low  
**Files:** `src/components/Terminal/commands/index.ts`, individual command files  
**Estimated Effort:** 30 minutes

**Current Commands:**
- `help` - List commands
- `open` - Browse projects
- `close` - Close viewer
- `contact` - Show contact
- `imprint` - Show legal notice
- `clear` - Clear terminal
- `snake` - Play Snake
- `tetris` - Play Tetris

**Proposed Aliases:**
- `ls` → `open` (common terminal command)
- `q` or `quit` → `close` (quick exit)
- `c` → `clear` (quick clear)
- `?` → `help` (quick help)
- `exit` → `close` (intuitive)

**Implementation:**
- Add alias mapping in command handler
- Ensure aliases work with clickable commands
- Update help text to show aliases

**Considerations:**
- Keep aliases intuitive
- Don't conflict with existing commands
- Test with clickable command system

---

### 11. Game Features Enhancement
**Status:** 🟡 Pending  
**Priority:** Low  
**Files:** `src/components/Terminal/commands/games/snake.ts`, `src/components/Terminal/commands/games/tetris.ts`  
**Estimated Effort:** 1-2 hours

**Current Features (Already Implemented):**
- ✅ Snake game functional
- ✅ Tetris game functional
- ✅ Mobile controls
- ✅ Landscape mode support
- ✅ Orientation change handling
- ✅ Pause functionality (P key or click/tap) - Already implemented
- ✅ Game over detection and display - Already implemented
- ✅ Score display in header - Already implemented
- ✅ Restart functionality (click/tap after game over) - Already implemented

**Remaining Enhancements:**

**High Scores:**
- ⬜ Store high scores in localStorage
- ⬜ Display high score on game start
- ⬜ Show "New High Score!" message when achieved
- ⬜ Persist scores across browser sessions

**Additional Features:**
- ⬜ Enhanced game over screen with explicit restart/exit options
- ⬜ Score display improvements (better formatting, animations)
- ⬜ Difficulty levels (optional)
- ⬜ Leaderboard (optional, future)

**Implementation Considerations:**
- Use localStorage API for persistence
- Format: `{ snake: { highScore: number, date: string }, tetris: { highScore: number, date: string } }`
- Handle localStorage errors gracefully (private browsing, etc.)
- Display high score prominently in game header
- Show celebration message when new high score is achieved

---

## 📊 Progress Tracking

### Completed ✅
- Welcome Message Enhancement
- Font Loading Optimization
- Color System Refactoring (Cool Minimal Palette)
- Theme System Refactoring (dynamic switching, randomization support)
- Font Change (Anonymous Pro monospace)
- Initial color consistency improvements
- Terminal full-screen (removed bottom padding)
- Empty line after command output
- Apple-like Design Language (WebGL 3D glass pill buttons)

### In Progress 🟡
- Visual Appearance Polish (partial)

### Pending ⬜
- Viewer Styling Enhancement
- Google Fonts API Integration
- Link Hover Behavior & Styling
- Terminal Friendliness & Messaging
- Command Aliases Review
- Game Features Enhancement

---

## 🎯 Recommended Order of Implementation

1. ✅ **Welcome Message Enhancement** - Quick win, improves first impression
2. ✅ **Font Loading Optimization** - Performance improvement, relatively quick
3. ✅ **Color System Refactoring** - Foundation for all other visual improvements
4. ✅ **Apple-like Design Language** - Major visual upgrade, WebGL glass buttons complete
5. **Google Fonts API Integration** - Easy font customization, just provide font name
6. **Terminal Friendliness & Messaging** - UX improvement, relatively quick
7. **Link Hover Behavior & Styling** - UX improvement, uses new color system
8. **Visual Appearance Polish** - Final polish using new systems
9. **Viewer Styling Enhancement** - Enhances core feature
10. **Command Aliases** - Nice-to-have UX improvement
11. **Game Features** - Feature addition, lower priority

---

## 📝 Notes

- All tasks are enhancements, not bug fixes
- Current codebase is stable and functional
- Each task can be implemented independently
- Test each change before moving to next task
- Consider user feedback when prioritizing
- Color palettes saved for easy theme switching
- Design philosophy: Friendly for normal users, easter eggs for nerds

---

## 🔗 Related Files

- `ISSUES.md` - Detailed issue documentation
- `.debug-state/PROJECT_STATUS.md` - Project status and history
- `.debug-state/CURRENT_ISSUE.md` - Current issue tracking

---

## 🎨 Color Palette Reference

### Cool Minimal Palette (Current)
- Base: `#0f1419` (dark blue-grey)
- Surface: `#1a2332` (slate)
- Accent: `#5a7a7a` (muted teal)
- Highlight: `#7a9a9a` (lighter teal)

### Muted Earth Tones (Saved for later)
- Base: `#1a1a1a` (dark grey/charcoal)
- Surface: `#2a2a2a` (slightly lighter)
- Accent: `#6b8e6b` (muted sage green)
- Highlight: `#9db89d` (lighter sage)

### Warm Muted Palette (Saved for later)
- Base: `#1e1e1e` (warm dark)
- Surface: `#2d2d2d` (warm grey)
- Accent: `#7a8a7a` (muted olive)
- Highlight: `#a0b0a0` (softer olive)

---

**Next Steps:**
1. Implement Color System Refactoring (Task 2)
2. Implement Apple-like Design Language (Task 3)
3. Continue with remaining tasks in recommended order
