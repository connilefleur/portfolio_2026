# connilefleur portfolio

React + Vite portfolio. Landing page is a Jones (2010) agent-based Physarum polycephalum WebGL2 simulation — project nodes float as labels over the mycelium field. Scrollable pages (Tools, Contact, Imprint) keep top and bottom bars fixed while only the content area scrolls.

## Requirements

- Node.js 20+
- npm 10+
- Python 3 + Pillow (image pipeline)
- ffmpeg (video pipeline)

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
| `npm run scan:secrets` | Check for committed secrets |

## Architecture

```
v2/src/
  pages/
    Work.tsx          — landing (WebGL Physarum canvas, desktop) + list view (touch)
    Contact.tsx       — contact page
    Tools.tsx         — pipeline HDAs + Prop Phone app
    Imprint.tsx       — legal
  components/
    Layout.tsx        — shell, fixed top/bottom bars, Clock
    CanvasView.tsx    — WebGL2 canvas host, randomised node positions, label overlay
    Viewer.tsx        — project detail overlay + CompareSlider
    canvas/
      engines/
        physarum.ts   — Jones agent sim (600k agents, RGBA32F ping-pong)
        flow.ts       — flow field engine
        tm.ts         — tone-mapped engine
      effects.ts      — accumulation buffer, displacement, display pass
      types.ts        — Engine / EffectStack interfaces
      glUtils.ts      — WebGL helpers
  data/
    projects.ts       — project data (sync manually from content/projects.csv)
    types.ts          — Project, MediaItem types
  styles/
    globals.css       — all styles (tokens, shell, nodes, list, viewer, tools)

public/projects/<slug>/   — served media (images + videos)
content/projects.csv      — project metadata source of truth
drop_in/<slug>/           — media source inbox (gitignored, never served directly)
scripts/                  — asset pipeline tools
```

## Media Pipeline

Source files go into `drop_in/<slug>/` and are never served directly. Run the render scripts to produce web-optimised assets in `public/projects/<slug>/`.

### Images → responsive WebP

Always outputs WebP regardless of source format (PNG, JPG, etc.).

```bash
python3 scripts/render-responsive-image.py \
  --input "drop_in/<slug>/file.png" \
  --output-dir "public/projects/<slug>/images/_responsive" \
  --output-prefix "file" \
  --widths "480,960,1600,2160"
```

Wire into `projects.ts`:
```ts
{ url: '.../_responsive/file-w1600.webp',
  srcSet: '.../_responsive/file-w480.webp 480w, ...w960.webp 960w, ...w1600.webp 1600w',
  type: 'image', label: 'Render 001' }
```

### Videos → VP9/WebM

Always outputs VP9/WebM + JPEG poster. Source can be ProRes MOV, MP4, etc.

```bash
python3 scripts/render-web-video.py \
  --input "drop_in/<slug>/file.mov" \
  --video-output "public/projects/<slug>/videos/file.webm" \
  --poster-output "public/projects/<slug>/videos/file-poster.jpg"
```

## Design Tokens

```
--bg    #08090c    --ink   #e4e8f2
--mute  #8c95a8    --hair  #1e2028
--hi    #4a9eff    --node  #0e1016
--mono  "Inter"    --code  "JetBrains Mono"
```

Light mode override via `@media (prefers-color-scheme: light)` in `globals.css`.

## Deploy

Any static host serving `dist/`. Configure the host to redirect all paths to `index.html` (SPA routing).

> **Note:** Video files (`*.webm`, `*.mp4`, `*.mov`) are gitignored. Serve them from external storage or re-run the video pipeline after cloning.
