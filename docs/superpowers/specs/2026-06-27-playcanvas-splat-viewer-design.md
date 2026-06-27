# PlayCanvas Splat Viewer — Design

**Date:** 2026-06-27
**Status:** Approved (design); pending implementation plan
**Branch:** `playcanvas-splat-viewer`

## Problem

The Sun Matters interactive video↔Gaussian-splat experience renders its splat with
`@sparkjsdev/spark` (Three.js). The same `.ply` files render correctly in SuperSplat
and other viewers, but in Spark they display wrong (washed out, see-through "holes" in
the background, generally "weird"), despite the product/reflections being roughly
shape-correct.

A best-practices audit (this session) confirmed our Spark setup already **matches the
canonical Spark examples** (default color management, `antialias:false`, `RawShaderMaterial`
so Three does not double-encode, valid asset serving). The only deviations were the
optional 180° orientation flip (already tried via `?splateuler=180,0,0`) and the camera
far plane. In other words there is **no simple documented setup toggle left** — the
remaining issues are subtle convention/quality problems that have already cost multiple
sessions.

SuperSplat — which renders the file perfectly with zero tuning — **is** the PlayCanvas
engine. Switching the viewer to PlayCanvas gives guaranteed-correct rendering (color,
sort, orientation, full SH) at the cost of a bounded rewrite of one module.

## Goal

Replace the Spark/Three splat renderer with the **PlayCanvas engine** (`playcanvas` on
npm, `GSplatComponent`), matching SuperSplat fidelity, while preserving the entire
existing Sun Matters experience (video-below, splat crossfade, parallax, decel/hold/
return, Continue→next-clip, mobile fallback).

## Key Decisions (locked)

1. **Asset format: SOG.** User re-exports `serum` + `stick` as `.sog` from SuperSplat
   (guaranteed-identical look, ~95% smaller than the `.ply`). Loader is format-agnostic,
   so this is also future-swappable.
2. **Remove Three.js entirely.** Three is used only by the splat viewer + `colmapCamera.ts`
   (Physarum canvas is raw WebGL2). Drop `three` + `@types/three`, add `playcanvas`.
   The archived `_archive/splat-dof/` (Three-based) is outside the Vite root and not
   compiled, so it is unaffected.
3. **Drop-in approach.** Reimplement the *internals* of `mountSplatViewer` with PlayCanvas
   and preserve the `SplatViewerController` interface exactly, so `SunMatters.tsx` and
   `SplatView.tsx` keep working unchanged.

## Architecture

The seam between the React orchestration and the rendering engine is the
`SplatViewerController` interface returned by `mountSplatViewer(box, scene, opts)`:

```
ready: Promise<void>
canvas: HTMLCanvasElement
setRenderEnabled(enabled): void   // RAF on/off — zero GL when closed
setInputEnabled(enabled): void    // lock + ease back to hero pose
atHero(eps?): boolean             // settled within eps of hero
warmFrames(): number              // rendered frames since (re)enable
setOpacity(o): void               // CSS opacity on the canvas (crossfade)
dispose(): void
```

Both `SunMatters.tsx` (full experience) and `SplatView.tsx` (`/splat-view` diagnostic
harness) consume only this interface. Reimplementing the internals leaves the experience,
crossfade, and mobile fallback untouched.

### Components

**`v2/src/lib/splatViewer.ts` (reimplemented, same public interface)**
- `new pc.Application(canvas, { graphicsDeviceOptions: { antialias: false } })`.
- Canvas sized to the box × `min(devicePixelRatio, cap)`; `FILLMODE_NONE` (fixed 16:9
  box, not the window). Resize on box size change.
- **Camera entity:** `clearColor = (0,0,0,1)` opaque black (matches today's opaque-canvas
  compositing); vertical `fov = hero.fovVDeg` (`horizontalFov = false`); near `0.01`,
  far `1000`. Driven each frame by the existing orbit math: position =
  `orbitCenter + sprung(baseOffset)`, then `lookAt(orbitCenter)`. (lookAt, not the COLMAP
  quaternion — roll is negligible and lookAt matched pixel-perfect in the prior viewer.)
- **Splat entity:** `addComponent('gsplat', { asset })` from `pc.Asset(scene.splatUrl,
  'gsplat')`. Loaded at identity orientation; a debug Euler override remains for in-browser
  verification.
- **Render gating:** `app.autoRender = false`; our own RAF updates the parallax/zoom
  springs then requests `app.renderNextFrame`. `setRenderEnabled(false)` stops the RAF
  (no GL work while closed). `warmFrames` increments per rendered frame.
- **Parallax/zoom:** ported 1:1 from the current viewer (orbitCenter pivot, ±5° az/el
  spring with `DAMP`, scroll spring-zoom), using `pc.Vec3`/`pc.Quat`.
- `setOpacity` → CSS opacity on the canvas element; `atHero` → spring-threshold check;
  `dispose` → `app.destroy()` + remove canvas + remove listeners.

**`v2/src/lib/colmapCamera.ts`**
- Strip the `three` import. Keep the `HeroCamera` interface (imported by `splatScenes.ts`).
- Remove the now-unused `colmapToThree` (runtime camera uses lookAt). If a roll-accurate
  pose is ever needed, a `pc` port can be added later.

**`v2/src/data/splatScenes.ts`**
- Point both `splatUrl`s at the `.sog` files. Hero camera data unchanged.

**`v2/src/pages/SunMatters.tsx` / `v2/src/pages/SplatView.tsx`**
- Remove the Spark-only `splatEuler` / `focalAdjustment` plumbing from the mount calls and
  URL parsing. Keep a generic debug orientation knob in `/splat-view` for verification.
  No orchestration/logic changes.

**Dependencies**
- Remove `three`, `@types/three`; add `playcanvas`. Update lockfile.

**Assets**
- User exports `serum.sog` + `stick.sog` from SuperSplat into
  `drop_in/sun_matters/splat/...`; copied to
  `public/projects/sun-matters/splat/{serum,stick}.sog`.

## Data Flow (unchanged from today)

Clip plays → decelerates → ends on hero frame (browser holds last frame) → splat warmed
(GL on) → splat crossfades in over the held frame → user parallaxes → Continue → camera
eases to exact hero pose (`atHero`) → next clip pre-seeked to its first frame (== held
frame) brought up behind the splat → splat fades out → next clip plays. Splat canvas
`z-index` above both videos; crossfade via CSS opacity.

## Error / Edge Handling

- **No WebGL2 / float buffers / touch:** existing `canRunSplat()` gate → plain full-video
  fallback. Unchanged.
- **Asset load failure:** `ready` rejects → `onStatus('load error')`; SunMatters surfaces
  the error string (existing path).
- **Render gating off while closed:** RAF stopped → no GL work (existing guarantee).

## Risks & Mitigations

1. **Orientation: splat stored frame vs. COLMAP camera frame** may need an offset →
   debug Euler knob in `/splat-view`; bake the verified value as the default.
2. **SOG URL shape** (single `.sog` vs. `meta.json`+webp bundle) → confirm against the
   actual SuperSplat export before wiring `splatUrl`.
3. **PlayCanvas render-gating semantics** (`autoRender=false` + `renderNextFrame`) →
   verified against the engine API; fall back to `app.render()` manual call if needed.
4. **Camera fov axis** — PlayCanvas `fov` is vertical when `horizontalFov=false`; confirm
   it matches the 1920×1080 hero framing in the locked 16:9 box.

## Verification

- **Automated gate:** `tsc --noEmit` and the production build both green. (WebGL cannot
  render headless on this host — known limitation — so no headless screenshot.)
- **In-browser (user):** `/splat-view?scene=stick` then `?scene=serum` — confirm
  orientation, color (not washed out), and no background holes; then the full
  `/sun-matters` run — both stops seamless, parallax + Continue + return-to-hero working.

## Out of Scope

- Re-cutting video segments (blocked on a fresh ProRes master — separate task).
- DOF / color-grade passes (previously removed; not reintroduced).
- Production integration / iframe CSP handoff (follow-up once the renderer is verified).
