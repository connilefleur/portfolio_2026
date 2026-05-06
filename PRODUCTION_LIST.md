# Portfolio Production List

Assets to produce per project. Place files in the folder shown, use the naming convention exactly.

---

## Folder structure

```
public/projects/
├── e30/
│   ├── images/          ← existing renders + new breakdown shots
│   └── videos/          ← (if any)
├── glasses/
│   ├── images/          ← existing renders + AOV breakdown
│   └── videos/          ← turntable animation
├── vfx/
│   ├── images/          ← breakdown stills (create folder)
│   └── videos/          ← existing clips
├── web/
│   ├── images/          ← screenshots
│   └── videos/          ← screen recordings (optional)
├── flythroughs/
│   ├── images/          ← pipeline screenshots
│   └── videos/          ← flythrough clips (001 already here)
└── reel/
    └── videos/          ← existing clips, no additions needed
```

---

## Naming convention

```
{project}-{type}-{descriptor}.{ext}
```

- `project` = folder slug: `e30`, `glasses`, `vfx`, `web`, `flythroughs`, `reel`
- `type` = `render`, `viewport`, `node`, `aov`, `breakdown`, `screenshot`, `video`
- `descriptor` = what it shows, kebab-case, sequence suffix if multiple: `-001`, `-002`

**Examples:**
```
e30-viewport-inflation-001.jpg
e30-node-network.jpg
e30-render-wedge-grid.jpg

glasses-aov-beauty.jpg
glasses-aov-specdir.jpg
glasses-aov-breakdown.jpg
glasses-node-material.jpg
glasses-video-turntable.mp4

vfx-breakdown-shot01-before.jpg
vfx-breakdown-shot01-after.jpg

flythroughs-video-001.mp4         ← already in folder
flythroughs-video-002.mp4
flythroughs-video-003.mp4
flythroughs-screenshot-colmap.jpg
flythroughs-node-gsops.jpg

web-screenshot-{sitename}.jpg
web-video-{sitename}.mp4
```

---

## 001 · E30 Pressure Sim

**Folder:** `public/projects/e30/images/`

| File | What to shoot |
|------|---------------|
| `e30-viewport-inflation-001.jpg` | Early inflation — panels just starting to swell |
| `e30-viewport-inflation-002.jpg` | Mid-inflation — tension visible at panel seams |
| `e30-viewport-inflation-003.jpg` | Full inflation — maximum pressure |
| `e30-viewport-pressure-attr.jpg` | Geometry colored by pressure attribute value |
| `e30-node-network.jpg` | Vellum Configure Body → Constraints → Solver chain |
| `e30-render-wedge-grid.jpg` | 2×4 or 3×3 wedge render — stiffness/damping/pressure variations |
| `e30-render-seam-detail.jpg` | Close-up render of panel seam crumpling |

---

## 002 · Glass Lookdev

**Folders:** `public/projects/glasses/images/` and `glasses/videos/`

| File | What to shoot/render |
|------|----------------------|
| `glasses-aov-beauty.jpg` | Full beauty pass |
| `glasses-aov-specdir.jpg` | Direct specular / caustics pass |
| `glasses-aov-transdir.jpg` | Transmission / refraction pass |
| `glasses-aov-diffdir.jpg` | Diffuse pass |
| `glasses-aov-breakdown.jpg` | All passes tiled as one breakdown image |
| `glasses-node-material.jpg` | Octane material graph — IOR, dispersion, transmission nodes |
| `glasses-node-lighting.jpg` | Light rig in Houdini viewport — HDRI + fill/rim |
| `glasses-video-turntable.mp4` | 5–10 sec 360° rotation loop |

---

## 003 · Skrrt Cobain — So High

**Folder:** `public/projects/vfx/images/` (create) and `vfx/videos/`

| File | What to pull/export |
|------|---------------------|
| `vfx-breakdown-shot01-before.jpg` | Clean plate, shot 1 |
| `vfx-breakdown-shot01-after.jpg` | Final composite, shot 1 |
| `vfx-breakdown-shot02-before.jpg` | Clean plate, shot 2 |
| `vfx-breakdown-shot02-after.jpg` | Final composite, shot 2 |
| `vfx-breakdown-layers.jpg` | Layer stack — beauty + grade + CG elements as strips |

Pull stills directly from the existing comp project. No new rendering needed.

---

## 004 · Web & Interactive

**Folder:** `public/projects/web/images/` and `web/videos/`

One screenshot + one recording per case minimum. Use site name as descriptor:

| File pattern | What to capture |
|--------------|-----------------|
| `web-screenshot-{sitename}.jpg` | Key section or full-page screenshot |
| `web-video-{sitename}.mp4` | Screen recording showing interaction or scroll |

---

## 005 · Painting Flythroughs

**Folder:** `public/projects/flythroughs/images/` and `flythroughs/videos/`

**Videos — upload remaining clips:**

| File | What it is |
|------|------------|
| `flythroughs-video-001.mp4` | ✓ Already in folder |
| `flythroughs-video-002.mp4` | Second painting flythrough |
| `flythroughs-video-003.mp4` | Third painting flythrough |

**Pipeline screenshots — to capture:**

| File | What to shoot |
|------|---------------|
| `flythroughs-screenshot-colmap.jpg` | COLMAP point cloud reconstruction view |
| `flythroughs-screenshot-lightfield.jpg` | Lightfield Studio training / splat preview |
| `flythroughs-node-gsops.jpg` | GSOPs node network in Houdini — splat manipulation |
| `flythroughs-node-relight.jpg` | Octane Relight setup in Houdini |
| `flythroughs-screenshot-ai-grid.jpg` | Grid of AI-generated perspective images used as input |

---

## REEL · Simulation Reel

**Folder:** `public/projects/reel/videos/` — no new files needed.

Existing clips are complete. Trim to under 30 sec each if not already done.

---

## Priority order

1. **Glasses AOVs + turntable** — one Octane session, high visual payoff
2. **E30 wedge grid + viewport screenshots** — sim exists, wedge and render
3. **Flythroughs videos 002 + 003** — upload existing renders
4. **Flythroughs pipeline screenshots** — COLMAP, GSOPs, Relight
5. **VFX breakdown stills** — pull from comp, no rendering
6. **Web screenshots** — as cases are ready
