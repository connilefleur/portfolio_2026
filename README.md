# Connilefleur Portfolio

React + Vite portfolio featuring a WebGL2 Barkley reaction-diffusion simulation as the landing page.

## Requirements

- Node.js 20+
- npm 10+

## Quick Start

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5174`.

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Dev server on port 5174 |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production bundle |
| `npm run typecheck` | TypeScript check |
| `npm run generate:projects` | Process drop_in/ assets → public/projects/ |
| `npm run scan:secrets` | Check for committed secrets |

## Architecture

```
v2/src/
  pages/     Work.tsx       — landing (WebGL mycelium) + inline list view
             Contact.tsx    — contact page
             Tools.tsx      — free HDA tools
             Imprint.tsx    — legal
  components/ Layout.tsx    — shell, top/bottom bars, Viewer overlay
              PhysarumCanvas.tsx — WebGL2 Barkley RD sim + project node labels
              Viewer.tsx    — project detail overlay + CompareSlider
  data/       projects.ts   — project data (sync manually from content/projects.csv)
              types.ts      — Project, MediaItem types
  styles/     globals.css   — all styles

public/projects/<slug>/     — served media (images + videos)
content/projects.csv        — project metadata source of truth
drop_in/<slug>/             — media source inbox (gitignored, never served directly)
scripts/                    — asset pipeline tools
```

## Media Pipeline

Source files (large PNGs, raw renders, videos) go into `drop_in/<slug>/` and are never served directly. Run the render scripts to produce optimized assets:

```bash
# Responsive WebP from source PNG
python3 scripts/render-responsive-image.py \
  --input "drop_in/<slug>/file.png" \
  --output-dir "public/projects/<slug>/images/_responsive" \
  --output-prefix "file" \
  --widths "480,960,1600,2400"

# Web-optimized video + poster
python3 scripts/render-web-video.py \
  --input "drop_in/<slug>/file.mp4" \
  --output-dir "public/projects/<slug>/videos"
```

Wire responsive variants into `v2/src/data/projects.ts` using the `srcSet` field on media items.

## Deploy

Any static host serving `dist/` works. The Vite build is a standard SPA — configure the host to redirect all paths to `index.html`.
