# Portfolio — Claude orientation

## Dev server
```
npm run dev   →   http://127.0.0.1:5174
```
Run from `/home/deployer/projects/portfolio/`. Config: `vite.config.ts`.

## Source (`v2/src/`)
- `pages/Scope.tsx` — landing page ("Work" in nav): thin wrapper around PhysarumCanvas + Viewer wiring
- `components/PhysarumCanvas.tsx` — WebGL2 Barkley reaction-diffusion sim; project nodes as floating labels; pauses when Viewer is open
- `pages/List.tsx` — project matrix table
- `pages/Contact.tsx` — contact page
- `components/Layout.tsx` — shell, top/bottom bar, Clock, Viewer overlay
- `data/projects.ts` — hardcoded project data (sync from content/projects.csv manually)
- `data/types.ts` — Project / MediaItem types
- `styles/globals.css` — all styles (tokens, shell, nodes/nlabel, list, viewer)

## Content pipeline
- Edit project metadata in `content/projects.csv` (semicolon-delimited)
- Then manually update `v2/src/data/projects.ts` to match
- Served media lives in `public/projects/<slug>/images/` and `/videos/`

## Drop-in media workflow
`drop_in/<slug>/` is the **source inbox** (gitignored, never modified by Claude).
Raw PNGs/source files go in there — **never copy them directly to public/**.

### Adding images
```bash
# From source PNG in drop_in/<slug>/file.png → responsive WebP set
python3 scripts/render-responsive-image.py \
  --input "drop_in/<slug>/file.png" \
  --output-dir "public/projects/<slug>/images/_responsive" \
  --output-prefix "file" \
  --widths "480,960,1600,2400"
```
Outputs: `file-480w.webp`, `file-960w.webp`, `file-1600w.webp`, `file-2400w.webp`  
Wire up in `projects.ts` with `srcSet: "...-480w.webp 480w, ...-960w.webp 960w, ..."` and `url` pointing to the largest variant.  
**Never convert from an intermediate JPEG/WebP — always from the original source file.**

### Adding videos
```bash
python3 scripts/render-web-video.py \
  --input "drop_in/<slug>/file.mp4" \
  --output-dir "public/projects/<slug>/videos"
```
Outputs VP9/WebM + poster image at ≤1920px.

### Quality reference (photos)
`w480=q90  w960=q92  w1600=q93  w2400=q93` — screenshots get lossless WebP.

## Design tokens (dark default)
```
--bg #08090c  --ink #e4e8f2  --mute #8c95a8
--hair #1e2028  --hi #4a9eff  --node #0e1016
--mono "JetBrains Mono"
```
Light override via `@media (prefers-color-scheme: light)` in globals.css.

## PhysarumCanvas (WebGL RD sim)
- Barkley reaction-diffusion, `SIM_SCALE=1.5`, `SUBSTEPS=3`
- Project nodes: `NODE_POS` map in PhysarumCanvas.tsx (GL coords, y=0 bottom)
- Wall texture: Canvas 2D "connilefleur" text + label rects as obstacles; Y-flipped for GL
- Pacemakers fire along label perimeters, staggered phase per node
- Display: ring-based (bright border, dim interior) + neighbour-sample collision boost
- Drift: 4 aperiodic sine sums per param (a, chaos, Du, b) — no DOM updates
- Sim pauses (RAF skips GL) when `?project=` param is present

## Gotchas
- Never create `v2/list.html` or `v2/contact.html` — Vite would serve them directly, bypassing React Router
- New public assets may return `text/html` after Vite start — `servePublicAlways` plugin in config fixes this; restart server if it still happens
- WebGL2 `EXT_color_buffer_float` is required; headless SwiftShader doesn't support it → canvas stays black in CI/headless screenshots
