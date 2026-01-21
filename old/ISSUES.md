# Issues Log

## Current Issues

### 1. WebGL Glass Button Visual Appearance Issue
**File:** `src/components/GlassButton/utils/webgl3DPillRenderer.ts`  
**Status:** 🟡 Active Issue - Buttons rendering but appearance needs refinement

**Current State:**
- WebGL 3D glass pill renderer is implemented and functional
- Shader compiles successfully
- Buttons are visible and rendering
- Background texture is being captured and applied
- Refraction effect is working (background grid distorts through buttons)

**Problem:**
The glass buttons do not look correct visually. While the technical implementation is working (WebGL rendering, shader compilation, texture sampling), the visual appearance needs improvement.

**Potential Issues:**
- Geometry may be too simple (currently using flat quad instead of proper 3D pill shape)
- Refraction distortion may be too subtle or incorrect
- Blur amount may need adjustment
- Fresnel effect parameters may need tuning
- Lighting may be incorrect or too subtle
- Alpha/transparency values may need refinement
- Border/stroke rendering may be missing or incorrect

**Files Involved:**
- `src/components/GlassButton/utils/webgl3DPillRenderer.ts` - WebGL renderer and shaders
- `src/components/GlassButton/useGlassRenderer.ts` - Rendering hook
- `src/components/GlassButton/utils/backgroundCapture.ts` - Background texture capture
- `src/components/GlassButton/GlassButton.css` - CSS styling (border-radius clipping)

**Next Steps:**
1. Review current shader implementation and parameters
2. Check if geometry needs to be more sophisticated (proper 3D pill with curvature)
3. Adjust refraction strength, blur amount, and Fresnel values
4. Verify lighting direction and intensity
5. Test different alpha values for better visibility/transparency balance
6. Consider adding WebGL-rendered border if CSS border-radius clipping is causing issues
7. Compare visual result with expected glass pill appearance

**Priority:** Medium-High (Visual polish, but buttons are functional)

---

### 2. Welcome Message Enhancement (Future Improvement)
**File:** `src/components/Terminal/Terminal.tsx`  
**Location:** Lines 110-122  
**Status:** 🟡 Enhancement - Not critical, working version restored

**Current Working State:**
The terminal currently displays a working welcome message with:
- Clickable `open` command with instructions
- Clickable `help` command with instructions  
- ESC key instructions
- Proper persistent command tracking

**Current Code:**
```typescript
// Welcome message with clickable commands
// Align to left edge (no leading spaces) to match ANSI art and tagline/subtitle
const openLine = parseClickableCommands("[ Type or click [cmd:open] to browse projects ]");
writeLine(openLine);
persistentCommandInstances.add('open:initial');

const helpLine = parseClickableCommands("[ Type or click [cmd:help] for more commands ]");
writeLine(helpLine);
persistentCommandInstances.add('help:initial');

const escLine = parseClickableCommands("[ Press ESC or browser back button to close overlays ]");
writeLine(escLine);
```

**Proposed Enhancement:**
Add a welcome introduction line before the command instructions:
```typescript
writeLine('');
const welcomeIntro = parseClickableCommands("Welcome! Click the highlighted commands below, or type your own.");
writeLine(welcomeIntro);
writeLine('');
const openLine = parseClickableCommands("→ Click [cmd:open] or type 'open' to browse projects");
writeLine(openLine);
persistentCommandInstances.add('open:initial');

const helpLine = parseClickableCommands("→ Click [cmd:help] or type 'help' for more commands");
writeLine(helpLine);
persistentCommandInstances.add('help:initial');

writeLine('');
const escLine = parseClickableCommands("Press ESC or browser back button to close overlays");
writeLine(escLine);
writeLine('');
writePrompt();

// Track initial line count for limited history mode
// Update count to include welcome intro line
initialLineCountRef.current = logoLinesArray.length + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1;
```

**Impact:**
- Current version works correctly
- Enhancement would improve user experience with clearer welcome message
- Low priority - can be implemented later

---

## Completed Fixes

### ✅ Enhanced Clickable Command Styling
- Added hover effects, visual indicators, and improved contrast
- Added pulse animation on initial load
- Status: Working, needs refinement (added to polish list)

### ✅ Friendly Error Messages  
- Replaced technical error messages with conversational alternatives
- Added clickable suggestions and common commands
- Added instructions about clicking vs typing
- Status: Working, needs text refinement (added to polish list)

---

## Notes

- **Status Update (Latest Session):** Files have been restored from git to working state
- The corruption issue was resolved by reverting to the last working commit
- The welcome message enhancement can be implemented later as a planned improvement
- Current working version displays functional welcome message with clickable commands
