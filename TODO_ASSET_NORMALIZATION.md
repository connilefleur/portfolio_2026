# Asset normalization status

## Completed
- Public asset filenames are normalized to safe web paths.
- Generated manifest references are normalized to match.
- Data Viz loading works again with normalized asset URLs.
- Compatible `.mov` assets are losslessly remuxed to `.mp4` with stream copy only (no video/audio re-encode).
- Duplicate `.mov` assets are skipped when a sibling `.mp4` source already exists.
- Responsive image derivatives are generated for web loading (`960w`, `1600w`) while originals remain untouched.
- React image components now expose responsive sources via `srcset` so the browser can load smaller assets when appropriate.
- A generated report records normalization successes, warnings, and failures at `public/asset-normalization-report.json`.
- Verified on the live dev server and in production build.

## Current scope status
Reliability-first normalization plus responsive image delivery is complete.

## Guarantees for current scope
- No aspect-ratio changes.
- Originals in `content/projects/*` remain the source of truth.
- No image recompression of originals.
- Responsive image derivatives are additional web delivery copies only.
- No lossy video transcode.

## Not implemented yet
- Alternate image formats (WebP/AVIF) with explicit quality policy
- Video transcode pipeline beyond safe lossless remux cases
- Adaptive streaming / HLS packaging
- Placeholders / thumbnails / posters

## Next recommended phase
1. Add optional modern-image formats with careful quality review.
2. Decide whether long-form/self-hosted video should get additional bitrate ladders.
3. Add placeholders or thumbnails only where they measurably improve UX.
4. Re-check visual quality and loading behavior project-by-project.
