# Next Steps

**Last updated:** February 2026

## Current state

- Build passes; codebase stable.
- Cool minimal palette, WebGL 3D glass pill buttons, Apple-like design language in place.
- Ready to deploy and continue with polish/UX tasks.

## Immediate next step: GitHub Pages

1. **Enable GitHub Pages** (repo **Settings → Pages**).
2. **Deploy from branch or Actions:**
   - Either: add a GitHub Actions workflow that runs `npm run build` and deploys `dist/` to Pages.
   - Or: build locally, commit the `dist/` output (e.g. to `gh-pages` or `docs/` on `main`) and set Pages to that branch/folder.
3. **Base path:** For project-site URL `https://connilefleur.github.io/portfolio_2026/`, set in `vite.config.ts`:
   - `base: '/portfolio_2026/'`
   - (Revert to `base: '/'` if using a custom domain or a `username.github.io` repo later.)

After that, the site should be live at: **https://connilefleur.github.io/portfolio_2026/**

## After deployment

Continue in this order (from `TODO.md`):

1. **Visual appearance polish** – consistency, contrast, hover states.
2. **Terminal friendliness & messaging** – friendlier errors and command output.
3. **Link hover behavior & styling** – use accent palette, smooth transitions.
4. **Viewer styling enhancement** – image/video/3D viewer polish.
5. **Google Fonts API integration** – config-driven font loading (optional).
6. **Command aliases** – e.g. `ls`→`open`, `q`→`close`, `?`→`help`.
7. **Game features** – e.g. high scores in localStorage.

See `TODO.md` and `ISSUES.md` for full task details.
