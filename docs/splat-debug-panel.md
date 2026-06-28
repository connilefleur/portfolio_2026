# Splat render debug panel (`/splat`)

Dev-only tool for diagnosing and dialing the Sun Matters Gaussian-splat render quality
in isolation — the splat alone on black, no video, with a live control panel. Every
control applies **instantly** via `SplatViewerController.setDebug()` (no remount, no
reload of the 99 MB `.ply`).

> Routes are registered only in dev (`import.meta.env.DEV`). Run `npm run dev` →
> `http://127.0.0.1:5174/splat`.

## Open it

| URL | Scene |
|---|---|
| `http://127.0.0.1:5174/splat` | stick (default) |
| `http://127.0.0.1:5174/splat?scene=serum` | serum |

You can also switch scenes with the **stick / serum** buttons at the top of the panel.

Move the mouse over the splat for the ±5° parallax; scroll to spring-zoom. The panel
header shows live `status · fps · backbuffer px · dpr · fov · splat count`.

## The controls

All values start at the viewer's real defaults (scene-derived for fov/near/far).

**Resolution / sampling**
- `renderScale` — internal render resolution ×DPR. **< 1 renders lower** (the engine's
  fixed ~0.3 px Mip floor then covers relatively *more* of each gaussian → hides thin
  "needle" splats); **> 1 supersamples** (floor covers less → reveals them). This is the
  lever for the needle-streak artifact.
- `samples` — MSAA 1–4 (1 = off).
- `renderTgtScale` — CameraFrame render-target scale (downscale-then-upscale).
- `sharpness` — CameraFrame post sharpen (0 = none).
- `HDR float buffer` — RGBA16F/32F (on) vs RGBA8 (off) accumulation. Off = the old 8-bit
  banding/see-through.
- `TAA` + `taaJitter` — temporal AA: accumulates jittered frames, converging to a clean
  **still** when the camera is idle (suspected reason SuperSplat's stills look clean).

**gsplat** (these only exist on the unified path, which is on by default)
- `antiAlias` — Mip alpha compensation. Note the footprint dilation is *always* on; this
  only scales alpha, so it shifts brightness more than geometry.
- `alphaClip`, `minContribution` — coverage / faint-splat culling (low = fuller).
- `minPixelSize` — discard splats below N screen px (0 = keep all).
- `colorUpdateAngle` — view-dependent colour update granularity.
- `radialSorting` — radial vs planar depth sort.

**camera**
- `fov` — vertical FOV. Lower = more telephoto = gaussians bigger on screen (reveals
  asset detail/needles); higher = smaller. Good for testing whether an artifact is
  magnification of the asset vs a render bug.
- `near` / `far` — clip planes (default product-tight: `orbitRadius × 0.5` … `× 10`).

**tonemap** — none / linear / filmic / hejl / aces / aces2 / neutral.

**splat orientation** — euler X/Y/Z degrees (orientation debug).

## Workflow

1. Dial controls until the splat matches the SuperSplat reference.
2. Hit **copy JSON** — copies the full current parameter set to the clipboard.
3. Paste it back so the winning values can be baked as the viewer defaults in
   `v2/src/lib/splatViewer.ts` (the experience at `/sun-matters` uses the same viewer,
   so baked defaults apply there automatically).
4. **reset** returns everything to the scene's defaults.

## Where it lives

- `v2/src/pages/SplatDebug.tsx` — the page + panel UI.
- `v2/src/lib/splatViewer.ts` — `mountSplatViewer`, the `SplatDebugParams` type,
  `SPLAT_DEBUG_DEFAULTS`, and `controller.setDebug()` (the live setters).
- Route wired in `v2/src/App.tsx` (dev-only).

Can't be verified headless — WebGL2 float render targets aren't available in the
headless/SwiftShader renderer, so the panel must be used in a real browser.
