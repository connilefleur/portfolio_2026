# Sun Matters splat — match SuperSplat render quality via CameraFrame

**Date:** 2026-06-27
**Status:** Design approved → ready for plan
**Scope:** one file — `v2/src/lib/splatViewer.ts`. No page/interface/asset changes.

## Problem

Our PlayCanvas splat viewer (`/splat`, and the Sun Matters experience) renders the
exact same `.ply` that looks **perfect** in SuperSplat — same engine, SuperSplat's
default settings — but ours looks **streaky / painterly / washed / see-through**,
not as full or sharp.

Reference A/B (stick scene, `drop_in/debug_splat/`):
- `Screenshot from 2026-06-27 09-08-07.png` — the `.ply` inspected in SuperSplat
  (PlayCanvas engine, default settings): sharp gloss, clean speculars, solid
  floor/wall, full contrast. **Known-good.**
- `Screenshot from 2026-06-27 09-08-13.png` — our `/splat` (bare render): vertical
  banding/streaks on the smooth glossy body, washed-flat background. **The bug.**

The `.ply` was made in Lichtfeld; it loads fine in SuperSplat with default settings.
The file is not the problem — the render path is.

## Root cause (structural, not a tunable)

Confirmed against the official `@playcanvas/supersplat-viewer` source and the
installed engine (`playcanvas@2.20.0`):

- SuperSplat / its viewer render the gsplat through a **`CameraFrame`** render
  pipeline into a **high-precision float render target** (`RGBA16F` / `RGBA32F`),
  then tonemap + compose to the screen.
- We render the gsplat **bare to the 8-bit canvas backbuffer** (`app.autoRender`,
  no CameraFrame).

Gaussian splatting alpha-blends many low-alpha overlapping gaussians front-to-back.
In an **8-bit** target, that repeated accumulation quantizes — on smooth glossy
gradients this surfaces as the exact vertical banding/streaks and "thin/washed"
look we see. A **float** accumulation target removes it. This is the one structural
difference left after every gsplat param was already matched in prior sessions
(`alphaClip 1/255`, `minContribution 1`, `colorUpdateAngle 2`, `antiAlias`,
`radialSorting`) — so adopting CameraFrame **is** the root-cause test, not another
tuning knob. (Ref: memory `feedback-stop-tuning-find-root-cause`.)

## Design

Wrap our existing camera in a `CameraFrame` and configure it to match SuperSplat.
Everything else in `splatViewer.ts` stays as-is.

### Changes (all in `v2/src/lib/splatViewer.ts`)

1. **Imports:** add `CameraFrame`, `PIXELFORMAT_RGBA16F`, `PIXELFORMAT_RGBA32F`,
   `TONEMAP_NONE`, `TONEMAP_LINEAR` from `playcanvas`.

2. **Construct after the camera entity exists** (camera component must be live):
   ```ts
   const cf = new CameraFrame(app, camera.camera!);
   cf.rendering.renderFormats = [PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F];
   cf.rendering.toneMapping  = toneMap;     // see knob below
   cf.rendering.samples      = 1;           // SuperSplat default; no MSAA
   // all post FX (bloom/ssao/grading/vignette/dof/taa/fringing) left at defaults = OFF
   cf.update();
   cf.enable();
   ```
   If float formats are unsupported the engine silently falls back to `RGBA8`
   (per API docs) → no worse than today. (Our app already requires WebGL2 +
   `EXT_color_buffer_float`, so real browsers get float.)

3. **toneMapping knob** — the one value we can't read from an export. Default to
   match the SuperSplat **editor** reference. Add a `toneMapping?: 'none' | 'linear'`
   mount option (mapped to `TONEMAP_NONE` / `TONEMAP_LINEAR`), surfaced on `/splat`
   as `?tonemap=none|linear` for a live A/B against screenshot 09-08-07. Bake the
   winner as the default once confirmed in-browser.
   - Starting default: **`linear`** (memory records the SuperSplat editor default as
     `TONEMAP_LINEAR`). If linear looks too bright/shifted vs the reference, `none`.

4. **Render gating unchanged.** CameraFrame changes *how* the camera draws, not
   *whether*. Keep `app.autoRender = false` at mount and `app.autoRender = renderEnabled`
   gating in the load handler / `setRenderEnabled`. Parallax, spring-zoom, hero pose,
   near/far, gsplat params, opacity crossfade, warmth, `SplatViewerController`
   interface — all untouched.

5. **Dispose:** call `cf.destroy()` in `dispose()` before `app.destroy()`.

### Explicitly NOT in scope
- No page changes (`SunMatters.tsx`, `SplatView.tsx` consume the same controller).
- No asset/format changes (stays on the current `.ply`s).
- No post-processing effects (bloom, grading, DOF) — SuperSplat's plain look uses none.
- No gsplat-param changes — already matched.

## Verification (in-browser only — cannot be headless)

WebGL2 float render targets are absent in SwiftShader, so headless screenshots can't
validate (project gotcha `feedback-webgl-headless`). User verifies:
- `http://127.0.0.1:5174/splat` (stick) and `?scene=serum`.
- Success = vertical banding/streaks gone, gloss + background density/contrast match
  `Screenshot from 2026-06-27 09-08-07.png`.
- A/B `?tonemap=none` vs `?tonemap=linear`; bake the winner as default.

## Risks
- **Color/brightness shift** from tonemapping or linear↔sRGB through the compose pass
  — mitigated by the live toneMapping knob.
- **Perf:** one extra full-screen compose pass + float RT. Negligible at our box size;
  `setRenderEnabled(false)` still fully gates GL when the experience is closed.
- If CameraFrame does **not** remove the streaks, that is decisive evidence the cause
  is upstream (source/LOD/sort), not the render target — revisit the file/Lichtfeld
  export rather than tuning further.
