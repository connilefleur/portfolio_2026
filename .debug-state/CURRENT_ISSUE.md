# Current Issues

## No Known Issues

All previously reported issues have been resolved:

- ✅ **Game Exit**: Now resets terminal to initial state (logo + welcome message) when exiting games
- ✅ **ANSI Logo Sizing**: Mobile logo is now smaller than desktop (half size)
- ✅ **Text Wrapping**: Welcome text and help text wrap properly on mobile
- ✅ **Game Layout**: Games use full width on mobile, taking top 50% of screen with controls in bottom 50%

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
