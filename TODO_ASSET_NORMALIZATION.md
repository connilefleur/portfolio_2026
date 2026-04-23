# Asset normalization status

## Completed
- Public asset filenames are normalized to safe web paths.
- Generated manifest references are normalized to match.
- Data Viz loading works again with normalized asset URLs.
- Compatible `.mov` assets are losslessly remuxed to `.mp4` with stream copy only (no video/audio re-encode).
- Duplicate `.mov` assets are skipped when a sibling `.mp4` source already exists.
- A generated report now records normalization successes, warnings, and failures at `public/asset-normalization-report.json`.
- Verified on the live dev server and in production build.

## Current scope status
Normalization is complete for the current reliability-first scope without visual degradation.

## Guarantees for current scope
- No aspect-ratio changes.
- No image recompression.
- No lossy video transcode.
- Originals in `content/projects/*` remain the source of truth.

## Not implemented yet
- Responsive image derivatives / `srcset`
- Format optimization policy (WebP/AVIF/JPEG decisions)
- Video transcode pipeline beyond safe lossless remux cases
- Placeholders / thumbnails / posters

## Next recommended phase
1. Define responsive derivative sizes and manifest shape.
2. Generate small/medium/large image variants while keeping originals untouched.
3. Update React media components to use responsive normalized sources.
4. Re-verify quality and loading behavior project-by-project.
