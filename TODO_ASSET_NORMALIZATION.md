# Asset normalization status

## Completed
- Public asset filenames are normalized to safe web paths.
- Generated manifest references are normalized to match.
- Data Viz loading works again with normalized asset URLs.
- Verified on the live dev server and in production build.

## Current scope status
Base normalization is complete.

## Not implemented yet
- Responsive image derivatives / `srcset`
- Format optimization policy (WebP/AVIF/JPEG decisions)
- Video normalization/transcode pipeline
- Placeholders / thumbnails / posters

## Next recommended phase
1. Define responsive derivative sizes and manifest shape.
2. Generate small/medium/large image variants while keeping originals untouched.
3. Update React media components to use responsive normalized sources.
4. Re-verify quality and loading behavior project-by-project.
