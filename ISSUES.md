# Issues Log

## Current Issues

### 1. WebGL Glass Button Visual Appearance Issue
**File:** `src/components/GlassButton/utils/webgl3DPillRenderer.ts`  
**Status:** 🟡 Active Issue - Buttons rendering but appearance needs refinement  
**Priority:** Medium-High

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
- Camera/view matrix setup may need adjustment for proper perspective

**Files Involved:**
- `src/components/GlassButton/utils/webgl3DPillRenderer.ts` - WebGL renderer and shaders
- `src/components/GlassButton/useGlassRenderer.ts` - Rendering hook
- `src/components/GlassButton/utils/backgroundCapture.ts` - Background texture capture
- `src/components/GlassButton/GlassButton.css` - CSS styling (border-radius clipping)

**Technical Details:**
- Current geometry: Simple quad (-1 to 1 in X/Y, flat in Z)
- Shader: Simplified fragment shader with normal-based UV offset for refraction
- Blur: 9-sample Gaussian blur approximation
- Refraction: Uses normal XY components for UV distortion
- Fresnel: Mix between 0.9 and 0.95 based on view angle
- Alpha: Minimum 0.8 for visibility

**Next Steps:**
1. Review current shader implementation and parameters
2. Check if geometry needs to be more sophisticated (proper 3D pill with curvature)
3. Adjust refraction strength, blur amount, and Fresnel values
4. Verify lighting direction and intensity
5. Test different alpha values for better visibility/transparency balance
6. Consider adding WebGL-rendered border if CSS border-radius clipping is causing issues
7. Compare visual result with expected glass pill appearance
8. Check camera/view matrix setup for proper 3D perspective
9. Verify texture sampling and background capture is correct

**Related Documentation:**
- See `SESSION_HANDOFF.md` for implementation details
- See `TODO.md` Task 3 for design specifications

---

## Completed Fixes

### ✅ WebGL Glass Button Implementation
- WebGL 3D renderer created and integrated
- Shader compilation working
- Background texture capture implemented
- Buttons rendering with glass effect
- Status: Functional but visual appearance needs refinement

---

## Notes

- Issues in `old/` folder are archived/backup files and not current
- Current issues should be tracked in this file (root directory)
- See `SESSION_HANDOFF.md` for recent changes and current state
