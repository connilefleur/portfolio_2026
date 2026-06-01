# Portfolio — Claude orientation

## Servers
| App | Command | Port | Config |
|-----|---------|------|--------|
| V2 (active) | `npm run dev:v2` | **5174** | `vite.v2.config.ts` |
| V1 | `npm run dev` | 5173 | `vite.config.ts` |

Run from `/home/deployer/projects/portfolio/`.

## V2 source (`v2/src/`)
- `pages/Scope.tsx` — landing page ("Work" in nav): thin wrapper around PhysarumCanvas + Viewer wiring
- `components/PhysarumCanvas.tsx` — WebGL2 Barkley reaction-diffusion sim; project nodes as floating labels; pauses when Viewer is open
- `pages/List.tsx` — project matrix table
- `pages/Contact.tsx` — contact page
- `components/Layout.tsx` — shell, top/bottom bar, Clock, Viewer overlay
- `data/projects.ts` — hardcoded project data (sync from content/projects.csv manually)
- `data/types.ts` — Project / MediaItem types
- `styles/globals.css` — all styles (tokens, shell, nodes/nlabel, list, viewer)

## Content pipeline (shared V1/V2)
- Edit project metadata in `content/projects.csv` (semicolon-delimited)
- Then manually update `v2/src/data/projects.ts` to match
- Media lives in `public/projects/<slug>/images/` and `/videos/`

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
