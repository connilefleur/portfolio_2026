# Connilefleur Portfolio (Canvas)

React + Vite portfolio with a canvas-like tile navigation system, landing intro animation, and project detail tiles.

## Requirements

- Node.js 20+
- npm 10+

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Build / Validation

```bash
npm run check
```

This runs:
- `generate:projects` (builds `public/projects-index.json` from content)
- `typecheck`
- production `vite build`

## Scripts

- `npm run dev` - local development
- `npm run generate:projects` - generate project index JSON
- `npm run typecheck` - TypeScript project references build check
- `npm run build` - production build
- `npm run check` - full local validation path
- `npm run preview` - preview production bundle

## Architecture

- Entry: `src/main.tsx`
- App shell and navigation state: `src/App.tsx`
- Tile engine: `src/canvas/CanvasEngine.tsx`
- Tile registry and adjacency: `src/canvas/tileRegistry.ts`
- Content loader: `src/data/siteData.ts`
- Tiles: `src/tiles/*`
- Global interaction overlay (nav rope lines): `src/components/NavRopeOverlay.tsx`

## UX Notes

- URL state sync via `?tile=<tile-id>`
- Keyboard navigation on tile grid
- Landing intro runs on initial landing visit and can be skipped when deep-linking to non-landing tiles
- Hover/tap trigger differences are handled for intro interaction and rope overlay

## Deploy

Any static host that serves `dist/` works (Vercel, Netlify, GitHub Pages with SPA fallback).

Build artifacts are produced in `dist/`.

## Handoff

Current implementation state and recent decisions are documented in:

- `CURRENT_STATE.md`
- `SESSION_HANDOFF.md`
