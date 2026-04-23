# Asset normalization status

## Completed
- Public asset filenames are normalized to safe web paths.
- Generated manifest references are normalized to match.
- Data Viz loading works again with normalized asset URLs.
- Duplicate `.mov` assets are skipped when a sibling `.mp4` source already exists.
- Responsive image derivatives are generated for web loading (`960w`, `1600w`) while originals remain untouched.
- React image components now expose responsive image sources via `srcset`/`sizes` so the browser can load smaller files when appropriate.
- Video delivery copies are now generated as web-friendly H.264/AAC `.mp4` files with `+faststart` for better self-hosted playback.
- Video poster images are generated for faster first paint before playback.
- Originals in `content/projects/*` remain the source of truth; optimized delivery copies live under `public/projects/*`.
- A generated report records normalization successes, warnings, failures, and video size savings at `public/asset-normalization-report.json`.
- Verified on the live dev server and in production build.

## Current scope status
Reliability-first normalization plus responsive images, optimized video delivery copies, and generated posters is complete.

## Guarantees for current scope
- No aspect-ratio changes.
- Originals in `content/projects/*` remain the source of truth.
- Responsive image derivatives are additional web delivery copies only.
- Public video assets are optimized delivery copies; originals are not edited in place.
- Self-hosting is supported with standard browser-friendly `.mp4` output.

## Not implemented yet
- Alternate image formats (WebP/AVIF) with explicit quality policy
- Adaptive streaming / HLS packaging for high-traffic or long-form delivery
- Multiple bitrate ladders / renditions per video
- Fine-grained poster selection or manual poster overrides

## Next recommended phase
1. Add optional modern-image formats with careful quality review.
2. Decide whether the long-form reel needs HLS or multiple bitrate renditions.
3. Add manual per-project poster overrides only where the auto-picked frame is weak.
4. Re-check visual quality and loading behavior project-by-project on mobile.
