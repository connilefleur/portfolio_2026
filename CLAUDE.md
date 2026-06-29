# Portfolio — Claude orientation

## Dev server
```
npm run dev   →   http://127.0.0.1:5174
```
Run from `/home/deployer/projects/portfolio/`. Config: `vite.config.ts`.

## Source (`v2/src/`)
- `pages/Work.tsx` — landing page ("Work" in nav): canvas view + list view + Viewer wiring
- `components/CanvasView.tsx` — WebGL2 Physarum reaction-diffusion sim; project nodes as floating labels; RAF fully stops when Viewer is open
- `pages/Contact.tsx` — contact page
- `pages/Tools.tsx` — tools/apps page
- `components/Layout.tsx` — shell, top/bottom bar (no Clock), Viewer overlay
- `components/Viewer.tsx` — project media viewer (images, videos with play button, compare slider)
- `data/projects.ts` — hardcoded project data (sync from content/projects.csv manually)
- `data/types.ts` — Project / MediaItem types
- `styles/globals.css` — all styles (tokens, shell, nodes/nlabel, list, viewer)

## Content pipeline
- Edit project metadata in `content/projects.csv` (semicolon-delimited)
- Then manually update `v2/src/data/projects.ts` to match
- Served media lives in `public/projects/<slug>/images/` and `/videos/`

## Drop-in media workflow
`drop_in/<slug>/` is the **source inbox** (gitignored, never modified by Claude).
Raw source files (PNG, ProRes MOV, MP4) go in there — **never copy raw files directly to public/**.

### Media policy
| Media type | Format | Quality | Notes |
|---|---|---|---|
| Primary renders / photos | Lossy WebP | q92 | `--quality 92` (default) |
| Secondary / screenshots | Lossless WebP | lossless | `--lossless` flag |
| Videos | AV1/WebM | CRF 35, preset 6 | `--codec av1` (default) |
| Video posters | JPEG first frame | q3 | auto-extracted at t=0 |

**Never convert from an intermediate JPEG/WebP — always from the original source file.**

### Adding images
```bash
# Primary renders — lossy WebP (default)
python3 scripts/render-responsive-image.py \
  --input "drop_in/<slug>/file.png" \
  --output-dir "public/projects/<slug>/images/_responsive" \
  --output-prefix "file" \
  --widths "480,960,1600,2400"

# Secondary screenshots — lossless WebP
python3 scripts/render-responsive-image.py \
  --input "drop_in/<slug>/screenshot.png" \
  --output-dir "public/projects/<slug>/images/_responsive" \
  --output-prefix "screenshot" \
  --widths "480,960" \
  --lossless
```
Outputs: `file-w480.webp`, `file-w960.webp`, etc.  
Wire up in `projects.ts` with `url` pointing to the largest variant and `srcSet` listing all widths.

### Adding videos
```bash
python3 scripts/render-web-video.py \
  --input "drop_in/<slug>/file.mov" \
  --video-output "public/projects/<slug>/videos/file.webm" \
  --poster-output "public/projects/<slug>/videos/file-poster.jpg" \
  --codec av1 --crf 35 --cpu-used 6
```
Outputs AV1/WebM + JPEG poster (first frame, ≤1920px).  
Wire up in `projects.ts` with both `url` and `poster` fields set.

## Design tokens (dark default)
```
--bg #08090c  --ink #e4e8f2  --mute #8c95a8
--hair #1e2028  --hi #4a9eff  --node #0e1016
--mono "JetBrains Mono"
```
Light override via `@media (prefers-color-scheme: light)` in globals.css.
Light `--hi` is `#1562d6` (not #2878e8) — darker for WCAG AA contrast on light bg.

## PhysarumCanvas (WebGL RD sim)
- Jones (2010) Physarum polycephalum agent sim, `SIM_SCALE=1.0`
- Dark mode: bg matches page --bg [0.031,0.035,0.047] (#08090c), ink = --ink [0.894,0.910,0.949] (#e4e8f2) — bright veins on black, bright=1.0
- Project nodes: randomised per session into a 3×3 zone grid with jitter
- Wall texture: label rects as obstacles (white=blocked); Y-flipped for GL; VIS shader also masks walls
- Agents seeded radially outward from label perimeters → growth expands away from labels
- RAF fully stops when viewer is open (phaseState === 'open', 180ms after open transition)
- Controls: press `C` — engine selector (PHY/FLOW/TM), DISP (displacement only), FX (displacement + trail)

## Mobile touch UX
- Desktop: Physarum canvas view. Touch devices: always list/table view (detected via `window.matchMedia('(hover: none)')`)
- Table has 3 category columns: `Lens` (photo+video merged), `CGI`, `Code`
- Single tap expands row + column (2fr) to a square cell; second tap on same cell opens Viewer
- Viewer swipe: left/right with two-phase animation; dot pagination shown on touch only
- Media list hidden on touch (`@media (hover: none) and (pointer: coarse)`)

## Accessibility
- `#vw-overlay` gets `inert` when viewer is closed — prevents keyboard focus reaching hidden close button
- `inert` not in React types; spread as `{...(!project ? { inert: '' } : {}) as React.HTMLAttributes<HTMLDivElement>}`

## Sun Matters splat experience (SHIPS IN PROD — embedded in the Viewer)
- Interactive video↔Gaussian-splat viewer. **Prod entry: the `type:'interactive'` media item that is `media[0]` of the `sun-matters` project** in `projects.ts` — opening the project in the Viewer hosts the experience in `.vw-slide` (no separate route/tile). `/sun-matters` route still exists but is **DEV-only, for debugging — TODO remove** once the embed is signed off.
- **Component split:**
  - `components/InteractiveStage.tsx` — preloader (poster + progress bar). Downloads all assets as blobs (`fetch` + streamed progress), then lazy-mounts the experience and hands it an original-URL→blob-URL map. Owns a ResizeObserver'd 16:9 box (so splat aspect matches the video exactly) and revokes object URLs on unmount. **Stays in the main bundle (no playcanvas import).**
  - `components/SunMattersExperience.tsx` — the orchestration (segment videos hold on a hero frame → splat crossfades in → mouse parallax → Continue → next clip). **Lazy chunk** (pulls playcanvas only when the interactive item mounts). Consumes the preloaded blob URLs; no fetching of its own.
  - `data/sunMattersAssets.ts` — playcanvas-free helpers: `canRunSplat()`, `preloadUrls(splatOk)`, `HERO_VIDEO_FULL`, `EXPERIENCE_POSTER`, `basename()`. Imported by InteractiveStage so the preloader stays light.
  - `pages/SunMatters.tsx` — thin full-screen wrapper around `InteractiveStage` (the DEV route).
- Other files: `lib/splatViewer.ts` (mountSplatViewer controller), `data/splatScenes.ts` (hero camera per scene; optional `splatFilename` = extension hint for blob URLs), `data/sunMattersTimeline.ts` (segment manifest), `lib/colmapCamera.ts`.
- **Assets: `public/projects/sun-matters/splat/{serum,stick}.sog` (~7 MB each, SuperSplat SOG — PRIMARY).** Raw `{serum,stick}.ply` (99 MB, full SH deg-3) still on disk for the `/splat` A/B toggle. `videos/segments/seg-{a,b,c}` cut frame-accurately at hero frames 300/700 via `scripts/cut-sun-matters-segments.sh` (inclusive ranges → boundary frames duplicated; verify with frame counts 301/401/400).
- **Perf knobs (`splatViewer.ts`):** render-on-demand (GPU idles when still — fps measured in the update tick so idle reads 0) + **adaptive resolution** (`PerfParams.motionScale`, default 0.6: renders at motionScale× DPR while the view moves, snaps to full DPR on settle — big iGPU win, still frame stays sharp). Both A/B-tunable live in the `/splat` debug panel.
- **Renderer: `playcanvas` 2.20 — the SAME engine as SuperSplat (guaranteed-correct colour/sort/SH).** (History: mkkellogg → Spark → PlayCanvas; both predecessors removed.)
- ✅ **RESOLVED — render quality matches SuperSplat.** The render path in `splatViewer.ts` is copied 1:1 from the official `@playcanvas/supersplat-viewer`: gsplat through a **CameraFrame float target** (RGBA16F/32F) for precision, with the **`gsplatOutputVS` chunk overridden to identity** (`prepareOutputFromGamma` returns its input) so gaussians blend in **gamma space** not linear, plus **`RenderTarget.isColorBufferSrgb=true`** on the backbuffer so the compose blit doesn't re-encode. = gamma-space compositing AT float precision → clean edges AND smooth surfaces. The whole multi-session "see-through/streaky/washed" fight was a colour-space conversion bug: we were linearizing the splat's gamma colour into the float buffer. `opts.bare=true` is a fallback (gamma/8-bit, no CameraFrame). Don't re-tune gsplat params — this was structural, see memory `project-interactive-overlay`.
- DOF was removed earlier; archived in `_archive/splat-dof/` (outside Vite root, not compiled).

## Gotchas
- Never create `v2/list.html` or `v2/contact.html` — Vite would serve them directly, bypassing React Router
- New public assets may return `text/html` after Vite start — `servePublicAlways` plugin in config fixes this; restart server if it still happens
- WebGL2 `EXT_color_buffer_float` is required; headless SwiftShader doesn't support it → canvas stays black in CI/headless screenshots
- Reel videos and VFX campaign video were encoded from h264/MP4 sources (no ProRes on-server); user provides ProRes for future updates
- E30 main video still H.264 — user will provide ProRes for AV1 re-encode
- VFX campaign (`skrtcobain-sohigh-online-v07-1080p-vp9.webm`) still VP9 — user to re-encode from ProRes locally
- Lighthouse dev-mode performance scores are meaningless (unminified bundles); production score is 97
