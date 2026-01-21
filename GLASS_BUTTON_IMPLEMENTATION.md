# Full Canvas Glass Button Implementation Plan

## Overview
Implementing realistic glass buttons using Canvas API to match Figma design exactly. This replaces CSS-only approach which cannot achieve noise texture displacement, proper blend modes, and exact layer compositing.

## Architecture

### Component Structure
```
GlassButton/
├── GlassButton.tsx          # Main component wrapper
├── useGlassRenderer.ts       # Canvas rendering hook
├── types.ts                  # TypeScript types
└── utils/
    ├── canvasHelpers.ts      # Noise, blur, gradient utilities
    └── blendModes.ts         # Blend mode implementations
```

### Component API
```typescript
interface GlassButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  // Optional: Custom dimensions if needed
  width?: number;
  height?: number;
}
```

## Figma Design Specifications

### Top Parent Frame
- **Size:** 258x84 (adjustable based on content)
- **Corner Radius:** 174px (pill shape)
- **iOS Corner Smoothing:** 60%
- **Fill:** rgba(255, 255, 255, 0.01) - 1% pure white
- **Stroke:** Linear vertical gradient
  - Top: rgba(255, 255, 255, 0.4) - 40% white
  - Bottom: rgba(255, 255, 255, 0.32) - 32% white
  - Position: Inside
  - Weight: 1px

### Layer Stack (Bottom to Top)

#### Layer 1: Rounded Background Rectangle
- **Fill:** rgba(255, 255, 255, 0.01) - 1% white
- **Size:** Larger than parent (gets clipped)
- **Effects:**
  - Background blur uniform: blur 4px
  - Texture noise: Large scaled wavy (displaces blur for glassy refracted look)

#### Layer 2: Group Container

##### 2.1.1: Base Gray Fill
- **Fill:** rgba(217, 217, 217, 0.5) - D9D9D9 50%
- **Size:** Same as parent frame
- **No effects**

##### 2.1.2: Dark Blur Layer
- **Fill:** rgba(84, 84, 84, 0.1) - 545454 10%
- **Size:** Same as parent frame
- **Effect:** Background blur uniform size 90px

##### 2.1.3: Inner Highlight Group

###### 2.1.3.1: Inner Blur Layer
- **Fill:** rgba(217, 217, 217, 1.0) - D9D9D9 100%
- **Size:** 5-10% smaller than parent
- **Effect:** Layer blur size 6px

###### 2.1.3.2: Ellipse Glow
- **Shape:** Ellipse
- **Size:** 2x parent size (centered)
- **Fill:** rgba(0, 0, 0, 0.1) - black 10%
- **Effect:** Background blur size 8px
- **Purpose:** Dark glow/overlay for contrast

##### 2.1.4: Dark Gradient Stroke (Multiply)
- **Fill:** None
- **Blend Mode:** Multiply
- **Stroke:** Linear gradient (top-left to bottom-right)
  - Start: rgba(0, 0, 0, 0.8) - 80% black
  - Middle: rgba(0, 0, 0, 0.2) - 20% black
  - End: rgba(0, 0, 0, 0.8) - 80% black
- **Effect:** Layer blur size 8px
- **Weight:** 1px

##### 2.1.5: White Gradient Stroke (Plus Lighter)
- **Fill:** None
- **Blend Mode:** Plus Lighter
- **Stroke:** Centered linear gradient (top-left to bottom-right)
  - Start: rgba(255, 255, 255, 0.8) - 80% white
  - Quarter: rgba(255, 255, 255, 0.05) - 5% white
  - Three-quarter: rgba(255, 255, 255, 0.05) - 5% white
  - End: rgba(255, 255, 255, 0.8) - 80% white
- **Effect:** Layer blur size 3px
- **Weight:** 1px

##### 2.1.6: Solid White Stroke (Plus Lighter)
- **Fill:** None
- **Blend Mode:** Plus Lighter
- **Stroke:** rgba(255, 255, 255, 0.2) - solid white 20%
- **Effect:** Layer blur size 3px
- **Weight:** 1px

## Implementation Steps

### Step 1: Component Structure
1. Create `GlassButton.tsx` with basic structure
2. Set up canvas element with ref
3. Handle resize observer for dynamic sizing
4. Render children on top of canvas

### Step 2: Canvas Setup
1. Get canvas context (2d)
2. Set up canvas dimensions (device pixel ratio aware)
3. Create offscreen canvas for compositing layers
4. Set up coordinate system

### Step 3: Noise Texture Generation
1. Implement Perlin noise or turbulence function
2. Generate large scaled wavy pattern
3. Apply as displacement map for blur
4. Cache noise texture for performance

### Step 4: Corner Path Generation
1. Calculate iOS-style smooth corners (60% smoothing)
2. Create custom path with smooth curves
3. Use for clipping and stroke rendering
4. Approximate with bezier curves if needed

### Step 5: Layer Rendering (Bottom to Top)

#### 5.1: Background Rectangle with Noise
```javascript
// Create noise texture
const noise = generateNoiseTexture(width, height, scale);
// Apply background blur with displacement
const blurred = applyBlurWithDisplacement(base, noise, blurAmount);
```

#### 5.2: Base Gray Fill
```javascript
ctx.fillStyle = 'rgba(217, 217, 217, 0.5)';
ctx.fill(path);
```

#### 5.3: Dark Blur Layer
```javascript
ctx.fillStyle = 'rgba(84, 84, 84, 0.1)';
ctx.fill(path);
// Apply backdrop blur (blur behind)
ctx.filter = 'blur(90px)';
```

#### 5.4: Inner Highlight Group
```javascript
// Inner blur layer (smaller)
const innerPath = createScaledPath(path, 0.92); // 8% smaller
ctx.fillStyle = 'rgba(217, 217, 217, 1.0)';
ctx.filter = 'blur(6px)';
ctx.fill(innerPath);

// Ellipse glow
ctx.beginPath();
ctx.ellipse(centerX, centerY, width, height, 0, 0, Math.PI * 2);
ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
ctx.filter = 'blur(8px)';
ctx.fill();
```

#### 5.5: Gradient Strokes
```javascript
// Dark gradient stroke (multiply)
ctx.globalCompositeOperation = 'multiply';
const darkGradient = createLinearGradient(topLeft, bottomRight);
darkGradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
darkGradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.2)');
darkGradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
ctx.strokeStyle = darkGradient;
ctx.lineWidth = 1;
ctx.filter = 'blur(8px)';
ctx.stroke(path);

// White gradient stroke (plus lighter)
ctx.globalCompositeOperation = 'plus-lighter'; // Custom implementation
const whiteGradient = createLinearGradient(topLeft, bottomRight);
whiteGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
whiteGradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.05)');
whiteGradient.addColorStop(0.75, 'rgba(255, 255, 255, 0.05)');
whiteGradient.addColorStop(1, 'rgba(255, 255, 255, 0.8)');
ctx.strokeStyle = whiteGradient;
ctx.lineWidth = 1;
ctx.filter = 'blur(3px)';
ctx.stroke(path);

// Solid white stroke (plus lighter)
ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
ctx.filter = 'blur(3px)';
ctx.stroke(path);
```

#### 5.6: Parent Frame Stroke
```javascript
// Vertical gradient stroke
const verticalGradient = createLinearGradient(top, bottom);
verticalGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
verticalGradient.addColorStop(1, 'rgba(255, 255, 255, 0.32)');
ctx.strokeStyle = verticalGradient;
ctx.lineWidth = 1;
ctx.stroke(path);
```

### Step 6: Blend Mode Implementation
1. **Multiply:** Native `globalCompositeOperation = 'multiply'`
2. **Plus Lighter:** Custom implementation (add colors, clamp to 255)

```javascript
function plusLighterBlend(source, destination) {
  return {
    r: Math.min(255, source.r + destination.r),
    g: Math.min(255, source.g + destination.g),
    b: Math.min(255, source.b + destination.b),
    a: Math.min(1, source.a + destination.a)
  };
}
```

### Step 7: Optimization
1. **Render Caching:**
   - Render base layers once on mount
   - Cache as ImageData or offscreen canvas
   - On hover, just adjust brightness/opacity of cached result

2. **Resize Handling:**
   - Debounce resize events (100ms)
   - Re-render only when size actually changes
   - Use ResizeObserver for efficient detection

3. **Performance Targets:**
   - Initial render: <20ms per button
   - Hover update: <10ms (using cache)
   - Total for 3-4 buttons: <80ms

### Step 8: Integration
1. Update `HintBar.tsx`:
   ```tsx
   <GlassButton onClick={() => inject('help')}>
     <code>help</code>
   </GlassButton>
   ```

2. Ensure content renders on top:
   ```tsx
   <div className="glass-button-wrapper">
     <canvas ref={canvasRef} className="glass-button-canvas" />
     <div className="glass-button-content">
       {children}
     </div>
   </div>
   ```

3. CSS positioning:
   ```css
   .glass-button-wrapper {
     position: relative;
     display: inline-flex;
   }
   .glass-button-canvas {
     position: absolute;
     inset: 0;
     pointer-events: none;
   }
   .glass-button-content {
     position: relative;
     z-index: 1;
   }
   ```

## Technical Challenges & Solutions

### Challenge 1: Noise Texture Displacement
**Problem:** CSS cannot displace blur with noise texture  
**Solution:** Generate noise in Canvas, apply as displacement map before blur

### Challenge 2: Plus Lighter Blend Mode
**Problem:** Canvas doesn't have native "plus-lighter"  
**Solution:** Custom blend function that adds RGB values and clamps

### Challenge 3: iOS Corner Smoothing
**Problem:** CSS border-radius doesn't match iOS 60% smoothing  
**Solution:** Custom path with smooth bezier curves approximating iOS corners

### Challenge 4: Background Blur vs Layer Blur
**Problem:** Need to blur what's behind vs blur the layer itself  
**Solution:** 
- Background blur: Use backdrop-filter (CSS) or manual sampling
- Layer blur: Use Canvas filter property

### Challenge 5: Gradient Stroke Masking
**Problem:** Need gradient across full shape but only show as stroke  
**Solution:** 
1. Draw full gradient shape
2. Use composite operation to mask out center
3. Or use clipping path for stroke-only rendering

## Testing Checklist

- [ ] Buttons render correctly on mount
- [ ] Hover state updates smoothly
- [ ] Buttons resize with content
- [ ] Corner radius matches Figma (proportional)
- [ ] Noise texture visible and displaces blur
- [ ] Blend modes work correctly
- [ ] Gradient strokes render properly
- [ ] No interference with terminal
- [ ] Performance acceptable (<80ms for all buttons)
- [ ] Works on mobile devices
- [ ] Works with different content sizes
- [ ] Accessibility maintained (keyboard navigation)

## Performance Monitoring

Add performance markers:
```javascript
performance.mark('glass-render-start');
// ... rendering code ...
performance.mark('glass-render-end');
performance.measure('glass-render', 'glass-render-start', 'glass-render-end');
```

Target: <20ms per button initial render

## Future Enhancements

- [ ] Add animation for state transitions
- [ ] Support for different glass styles (variants)
- [ ] Theme-aware glass colors
- [ ] Reduced motion support
- [ ] WebGL version for even better performance (if needed)
