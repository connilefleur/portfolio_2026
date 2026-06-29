# Archived: splat DOF + alignment harness

Removed from the live project on 2026-06-26. The Sun Matters experience now
runs the splat **sharp** (no depth-of-field, no entry focus-rack) with only the
colour-grade post pass. These files are kept here in case DOF is wanted again.
This folder is outside the Vite root (`v2/`) so nothing here is compiled.

## What's here
- `splatViewer.dof.ts` — the full DOF-capable viewer: gather/mip bokeh pass,
  half-res HalfFloat depth pass, splat-shader patch (`dofOutputMode` per-splat
  view-depth), `DofParams` + `setDof`. Also contains the same colour grade the
  live viewer kept.
- `SplatTest.tsx` — the dev alignment harness (`/splat-test`) with DOF sliders
  (dofOn / focus / aperture / maxCoC / samples), used to dial the bokeh in.

## To restore DOF
1. `cp _archive/splat-dof/splatViewer.dof.ts v2/src/lib/splatViewer.ts`
2. `cp _archive/splat-dof/SplatTest.tsx v2/src/pages/SplatTest.tsx`
3. Re-add the lazy import + DEV-gated `/splat-test` route in `v2/src/App.tsx`.
4. In `SunMatters.tsx`, re-add the focus-rack (RACK_* consts, `rackFocus`, the
   `setDof` calls in the hold block) if the entry rack is wanted too.

The live (stripped) viewer keeps an identical render path minus the DOF branch:
splat → `colorRT` → grade quad → screen. Restoring just adds the depth pass +
bokeh quad back on top.
