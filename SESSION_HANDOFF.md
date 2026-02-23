# Session Handoff

## What Was Implemented

1. Landing intro behavior stabilized and refined
- Uses a dedicated fullscreen overlay element (portal to `document.body`)
- Overlay shrink matches landing frame bounds (position/scale/radius) via runtime measurement
- Intro label remains visually consistent with landing brand style
- Hover/tap trigger behavior split by pointer capability

2. Navigation affordance
- Added red rope line interaction for top nav actions (`NavRopeOverlay`)
- Rope snaps to nearest active nav anchor
- Rope start is clipped to an ellipse around anchor (prevents crossing label text)
- Rope auto-hides when cursor is directly over anchor text zone

3. Recognition tile cleanup
- Removed `PORTFOLIO 2026` from recognition top header

4. Imprint + nav/content updates
- Added an `Imprint` slide using data from `content/site-info.json` (`siteInfo.imprint`)
- Landing stack updated: `Contact` now first, `Imprint` added as last entry
- `about-me` page kept in code but removed from active tile registry/navigation (deactivated)
- Recognition row `VIEW` action now routes to `Contact` (`work-together`)

5. Project hygiene / production-readiness
- Added `.gitignore`
- Added scripts: `typecheck`, `check`
- Added README and refreshed architecture/state docs

6. File-based CMS-style content model
- Added `content/projects.csv` as the text metadata source for all projects
- Added per-project asset folders under `content/projects/<slug>/` with `images/`, `videos/`, `models/`
- Updated `scripts/generate-projects-index.mjs` to:
  - parse CSV project rows
  - support semicolon-delimited CSV
  - include project slide text fields `approach` and `outcomes`
  - copy content assets into `public/projects/<slug>/`
  - generate `public/projects-index.json`
  - fall back to existing `public/projects/<slug>/` media if content assets are not present

## Important Files

- `src/App.tsx`
- `src/tiles/LandingTile.tsx`
- `src/components/NavRopeOverlay.tsx`
- `src/styles/layout.css`
- `src/canvas/CanvasEngine.tsx`
- `src/canvas/tileRegistry.ts`

## Known Behavior / Tradeoffs

- Rope effect is desktop-first (disabled on touch pointers)
- Rope range can be tuned via constants in `NavRopeOverlay.tsx`:
  - `SNAP_RADIUS`
  - `HIDE_LINE_DISTANCE`
- Intro timing is controlled in `src/styles/layout.css` under:
  - `.landing-intro-overlay`
  - `.landing-intro-frame .landing-content`
  - `.landing-intro-enter`
- Large raw media files are intentionally not committed in this push.
  - Plan: host heavy videos externally (e.g. Vimeo) and/or ship optimized derivatives (`webm`, responsive image sizes, `webp`) through a dedicated media pipeline.

## Suggested Next Tasks

1. Fine-tune rope distance thresholds and line visual weight.
2. Add subtle active-state style to nav anchors themselves to pair with the rope.
3. Add visual regression snapshots (Playwright or Percy) for intro + nav interactions.
