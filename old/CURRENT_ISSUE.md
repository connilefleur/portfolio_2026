# Current Issues

## Status: Active Issue - WebGL Glass Button Appearance

**Latest Update:** WebGL glass buttons are rendering but visual appearance needs refinement.

## Current Active Issue

### WebGL Glass Button Visual Appearance
- **Status:** 🟡 Active - Buttons rendering but don't look correct
- **File:** `src/components/GlassButton/utils/webgl3DPillRenderer.ts`
- **Details:** See ISSUES.md for full details
- **Priority:** Medium-High (Visual polish needed)

## Future Enhancements (Not Critical)

### Welcome Message Enhancement
- Current welcome message works correctly
- Enhancement to add welcome intro text can be implemented later
- See ISSUES.md for details

---

## Previously Resolved Issues

All previously reported issues have been resolved:

- ✅ **Game Exit**: Now resets terminal to initial state (logo + welcome message) when exiting games
- ✅ **ANSI Logo Sizing**: Mobile logo is now smaller than desktop (half size)
- ✅ **Text Wrapping**: Welcome text and help text wrap properly on mobile
- ✅ **Game Layout**: Games use full width on mobile, taking top 50% of screen with controls in bottom 50%
- ✅ **Mobile Controls on iPad**: Fixed touch detection to work on all iPad sizes (uses touch detection instead of screen size)
- ✅ **Landscape Mode**: Games now use horizontal split in landscape orientation (game on left, controls on right)
- ✅ **Terminal Display**: Fixed CSS import order issue that prevented terminal from displaying

---

## Previous Issues (Resolved)

### Game Exit Terminal State Restoration (RESOLVED)
**Solution**: Simplified approach - games now reset terminal to initial state (logo + welcome) when exiting, providing a clean, consistent experience.

### ANSI Logo Mobile Sizing (RESOLVED)
**Solution**: Mobile logo uses 8px font size (half of 16px) during logo rendering, then restores to 16px for regular text. Logo also uses smaller width percentage on mobile.

### Text Wrapping on Mobile (RESOLVED)
**Solution**: Welcome text and help text use manual line breaks on mobile for better readability, and font size reduced slightly (15px) to improve wrapping.

### Game Layout on Mobile (RESOLVED)
**Solution**: Games use full terminal width on mobile, taking ~40% of screen height. Mobile controls use full width with larger buttons for better touch targets.

### Mobile Controls on iPad (RESOLVED)
**Solution**: Changed from screen-size-based detection to touch capability detection. Controls now appear on all touch devices (phones, tablets, iPads of any size) regardless of screen dimensions.

### Landscape Mode Game Layout (RESOLVED)
**Solution**: Games now detect landscape orientation and use horizontal split - game takes ~60% width on left, controls positioned on right side. Games automatically restart when orientation changes.

### Terminal Display Issue (RESOLVED)
**Solution**: Fixed CSS @import statements to be at the top of global.css (CSS requirement). Added immediate fitAddon.fit() call after terminal initialization for proper sizing.
