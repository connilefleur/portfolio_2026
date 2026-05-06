# Portfolio — Claude orientation

## Servers
| App | Command | Port | Config |
|-----|---------|------|--------|
| V2 (active) | `npm run dev:v2` | **5174** | `vite.v2.config.ts` |
| V1 | `npm run dev` | 5173 | `vite.config.ts` |

Run from `/home/deployer/projects/portfolio/`.

## V2 source (`v2/src/`)
- `pages/Scope.tsx` — vectorscope landing (SVG + HTML nodes, collision resolver, category filter)
- `pages/List.tsx` — project matrix table
- `pages/Contact.tsx` — contact page
- `components/Layout.tsx` — shell, top/bottom bar, Clock, Viewer overlay
- `data/projects.ts` — hardcoded project data (sync from content/projects.csv manually)
- `data/types.ts` — Project / AxisKey types
- `styles/globals.css` — all styles (tokens, scope, nodes, list, viewer)

## Content pipeline (shared V1/V2)
- Edit project metadata in `content/projects.csv` (semicolon-delimited)
- Then manually update `v2/src/data/projects.ts` to match
- Media lives in `public/projects/<slug>/images/` and `/videos/`

## Design tokens (dark default)
```
--bg #08090c  --ink #e4e8f2  --mute #6a7180
--hair #16181f  --hi #4a9eff  --node #0e1016
--mono "JetBrains Mono"
```
Light override via `@media (prefers-color-scheme: light)` in globals.css.

## Scope constants (Scope.tsx)
```
VBW=1000 VBH=700  CX=500 CY=350  R_MIN=140 R_MAX=310
Axes: video=45° cgi=135° data=225° photo=315°
```

## Gotchas
- Never create `v2/list.html` or `v2/contact.html` — Vite would serve them directly, bypassing React Router
- `#scope-svg` has `pointer-events:none`; clickable SVG children need `pointerEvents:'auto'` inline
- New public assets may return `text/html` after Vite start — `servePublicAlways` plugin in config fixes this; restart server if it still happens
