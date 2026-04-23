# Asset normalization / viewer polish TODO

## Done
- [x] Audit current Data Viz loading failure
- [x] Confirm failure is dev-serving/path related, not broken source images
- [x] Tune viewer dim overlay timing with pan
- [x] Fade inactive viewer next/previous buttons out instead of greying them out
- [x] Add asset filename normalization in the project index generator
- [x] Normalize generated manifest paths for hero/viewer media references
- [x] Regenerate public assets and verify Data Viz on the live dev server
- [x] Verify production build after normalization

## Next / later
- [ ] Add responsive image derivatives (`srcset` / size tiers)
- [ ] Decide format policy per asset class (JPEG/WebP/AVIF where useful)
- [ ] Add optional video normalization/transcode policy for web-safe delivery
- [ ] Add optional placeholders/thumbs/posters where they improve UX

## Continue here next
1. Design responsive derivative sizes and manifest shape.
2. Add generator output for small/medium/large image variants while keeping originals untouched.
3. Teach the React media components to prefer normalized responsive sources.
4. Re-check visual quality and loading behavior project-by-project.

## Notes
- `data_viz` now uses normalized public filenames like `images/data-viz-rop-image1-0001.jpg`.
- Originals remain in `content/projects/*` and are still the source of truth.
- The current normalization step changes filenames/paths only; it does **not** recompress or reduce quality yet.
