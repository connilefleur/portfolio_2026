# PlayCanvas Splat Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Sun Matters splat renderer (Spark/Three.js) with the PlayCanvas engine, matching SuperSplat fidelity, while preserving the existing video↔splat experience.

**Architecture:** Reimplement the internals of `v2/src/lib/splatViewer.ts` using the PlayCanvas engine (`Application` + `gsplat` component), preserving the existing `SplatViewerController` interface so `SunMatters.tsx` and `SplatView.tsx` are unaffected. Drive parallax/zoom and render-gating from PlayCanvas's `update`/`autoRender`. Remove Three.js.

**Tech Stack:** TypeScript, React, Vite, PlayCanvas engine (`playcanvas` npm), SOG gsplat assets.

## Global Constraints

- **Verification reality:** WebGL2 float color buffers are unavailable headless on this host — the splat **cannot** render in CI/headless, so there are no unit tests for the render path. Automated gate per task = `npx tsc --noEmit` green (and `npm run build` green where noted). Acceptance = in-browser check by the user.
- **Dev server:** `npm run dev` → http://127.0.0.1:5174 (config `vite.config.ts`). Run from repo root.
- **Preserve the public interface** of `mountSplatViewer` / `SplatViewerController` exactly — `SunMatters.tsx` and `SplatView.tsx` depend on it.
- **Opaque black canvas** for the splat (clearColor `0,0,0,1`); crossfade is CSS opacity on the canvas element.
- **Camera:** vertical fov = `hero.fovVDeg`, near `0.01`, far `1000`; parallax via `lookAt(orbitCenter)` (not COLMAP quaternion).
- **DPR cap default 2.**
- **Branch:** `playcanvas-splat-viewer`. Commit after each task.
- **Asset paths:** `public/projects/sun-matters/splat/{serum,stick}.sog` (served at `/projects/sun-matters/splat/...`).
- **Engine API note:** PlayCanvas major versions differ slightly in app init. This plan uses the stable convenience API (`new Application(canvas, opts)` + `app.start()`). If the installed version's import names differ, consult https://api.playcanvas.com/engine/ and adjust imports only — the structure holds.

---

### Task 1: Add the PlayCanvas dependency

**Files:**
- Modify: `package.json` (dependencies)
- Modify: `package-lock.json` (via npm)

**Interfaces:**
- Produces: `playcanvas` importable in `v2/src/`. Three.js stays installed for now (removed in Task 6) so the build stays green throughout.

- [ ] **Step 1: Install playcanvas**

Run: `npm install playcanvas`
Expected: adds `playcanvas` to `dependencies`, updates lockfile, exits 0.

- [ ] **Step 2: Record the installed version + confirm the gsplat/Application API**

Run: `node -e "const p=require('playcanvas/package.json'); console.log(p.version)"`
Then confirm the named exports exist:
Run: `node -e "const pc=require('playcanvas'); console.log(['Application','Asset','Entity','Color','Vec3','Quat','FILLMODE_NONE','RESOLUTION_AUTO'].map(k=>k+':'+(k in pc)).join(' '))"`
Expected: prints a version (e.g. `2.x.x`) and every key `:true`. If any is `false`, note the correct export name from the API ref before Task 2.

- [ ] **Step 3: Verify the existing build is still green**

Run: `npx tsc --noEmit`
Expected: exit 0 (nothing imports playcanvas yet; Spark/Three untouched).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add playcanvas engine dependency"
```

---

### Task 2: Reimplement `splatViewer.ts` with PlayCanvas

This is the core task: a full rewrite of the module internals, preserving the public
interface. It includes camera, gsplat load, parallax/zoom, and render-gating — one
cohesive module, so it ships as one deliverable.

**Files:**
- Rewrite: `v2/src/lib/splatViewer.ts`

**Interfaces:**
- Consumes: `SplatScene` from `../data/splatScenes` (`{ id, splatUrl, hero: { orbitCenter, worldPosition, fovVDeg, ... } }`).
- Produces (UNCHANGED public surface):
  - `interface MountOptions { renderEnabled?: boolean; splatEuler?: [number,number,number]; dprCap?: number; onFps?: (fps:number)=>void; onStatus?: (s:string, ok:boolean|null)=>void; }`
  - `interface SplatViewerController { ready: Promise<void>; canvas: HTMLCanvasElement; setRenderEnabled(e:boolean):void; setInputEnabled(e:boolean):void; atHero(eps?:number):boolean; warmFrames():number; setOpacity(o:number):void; dispose():void; }`
  - `function mountSplatViewer(box: HTMLElement, scene: SplatScene, opts?: MountOptions): SplatViewerController`

- [ ] **Step 1: Replace the file contents**

Write `v2/src/lib/splatViewer.ts`:

```ts
// Shared Gaussian-splat viewer — PlayCanvas engine (matches SuperSplat, which is
// the PlayCanvas gsplat renderer). Swapped from @sparkjsdev/spark on 2026-06-27
// because Spark mis-rendered these scenes (washed out + background holes) despite a
// canonical setup. Consumed by the Sun Matters video↔splat experience and the
// /splat-view diagnostic harness via the SplatViewerController interface below.
import {
  Application, Asset, Entity, Color, Vec3, Quat,
  FILLMODE_NONE, RESOLUTION_AUTO,
} from 'playcanvas';
import type { SplatScene } from '../data/splatScenes';

const MAX_AZ = 5, MAX_EL = 5, DAMP = 0.07; // parallax: ±5° az/el, spring damping

export interface MountOptions {
  /** Start rendering once loaded (default true). False = preload silently (no GL). */
  renderEnabled?: boolean;
  /** Debug splat orientation as XYZ Euler degrees — verification knob. Default identity. */
  splatEuler?: [number, number, number];
  /** devicePixelRatio cap. Default 2. */
  dprCap?: number;
  onFps?: (fps: number) => void;
  onStatus?: (status: string, ok: boolean | null) => void;
}

export interface SplatViewerController {
  /** Resolves once the splat is loaded and rendering. */
  ready: Promise<void>;
  canvas: HTMLCanvasElement;
  /** Start/stop drawing — off while the experience is closed (no GL draws). */
  setRenderEnabled: (enabled: boolean) => void;
  /** When false, parallax eases back to the hero pose and pointer input is ignored. */
  setInputEnabled: (enabled: boolean) => void;
  /** True once the camera has settled within eps of the exact hero pose. */
  atHero: (eps?: number) => boolean;
  /** Frames rendered since the loop was last (re)enabled — gate crossfades on warmth. */
  warmFrames: () => number;
  /** Crossfade helper — sets the splat canvas opacity (0..1). */
  setOpacity: (o: number) => void;
  dispose: () => void;
}

export function mountSplatViewer(
  box: HTMLElement,
  scene: SplatScene,
  opts: MountOptions = {},
): SplatViewerController {
  const pr = Math.min(window.devicePixelRatio, opts.dprCap ?? 2);

  // Opaque black canvas: gaussian edges have alpha < 1, so a transparent canvas
  // would let the video behind bleed through. The video↔splat crossfade is done
  // via CSS opacity on this element.
  const canvas = document.createElement('canvas');
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;z-index:1';
  box.appendChild(canvas);

  // antialias off — no benefit for splats, costs perf (PlayCanvas + Spark both advise).
  const app = new Application(canvas, { graphicsDeviceOptions: { antialias: false } });
  app.setCanvasFillMode(FILLMODE_NONE);    // we live in a fixed 16:9 box, not the window
  app.setCanvasResolution(RESOLUTION_AUTO);
  app.graphicsDevice.maxPixelRatio = pr;
  app.autoRender = false;                  // render-gating: we toggle this on/off

  // --- camera --------------------------------------------------------------
  const camera = new Entity('camera');
  camera.addComponent('camera', {
    clearColor: new Color(0, 0, 0, 1),
    fov: scene.hero.fovVDeg,               // vertical fov (horizontalFov defaults false)
    nearClip: 0.01,
    farClip: 1000,
  });
  app.root.addChild(camera);

  // --- splat ---------------------------------------------------------------
  const splatEntity = new Entity('splat');
  const eu = opts.splatEuler ?? [0, 0, 0];
  splatEntity.setLocalEulerAngles(eu[0], eu[1], eu[2]);
  app.root.addChild(splatEntity);

  const asset = new Asset(scene.id, 'gsplat', { url: scene.splatUrl });
  app.assets.add(asset);

  // --- parallax + spring zoom (pivot = orbitCenter, locked radius) ----------
  const center = new Vec3(scene.hero.orbitCenter[0], scene.hero.orbitCenter[1], scene.hero.orbitCenter[2]);
  const baseOffset = new Vec3(scene.hero.worldPosition[0], scene.hero.worldPosition[1], scene.hero.worldPosition[2]).sub(center);
  const up = new Vec3(0, 1, 0);
  let tgtAz = 0, tgtEl = 0, curAz = 0, curEl = 0, tgtZoom = 0, curZoom = 0;
  let inputEnabled = true;

  const qAz = new Quat(), qEl = new Quat();
  const offset = new Vec3(), right = new Vec3();

  const positionCamera = (): void => {
    curAz += (tgtAz - curAz) * DAMP; curEl += (tgtEl - curEl) * DAMP;
    tgtZoom *= 0.86; curZoom += (tgtZoom - curZoom) * 0.18;
    // az about world up, then el about the resulting right axis (degrees — pc convention)
    qAz.setFromAxisAngle(up, curAz);
    qAz.transformVector(baseOffset, offset);
    right.cross(up, offset).normalize();
    qEl.setFromAxisAngle(right, curEl);
    qEl.transformVector(offset, offset);
    offset.mulScalar(1 - curZoom);
    camera.setPosition(center.x + offset.x, center.y + offset.y, center.z + offset.z);
    camera.lookAt(center.x, center.y, center.z);
  };

  const onMove = (e: PointerEvent): void => {
    if (!inputEnabled) return;
    const r = box.getBoundingClientRect();
    tgtAz = -(((e.clientX - r.left) / r.width) * 2 - 1) * MAX_AZ;
    tgtEl = -(((e.clientY - r.top) / r.height) * 2 - 1) * MAX_EL;
  };
  const onLeave = (): void => { tgtAz = 0; tgtEl = 0; };
  const onWheel = (e: WheelEvent): void => {
    if (!inputEnabled) return;
    e.preventDefault();
    tgtZoom = Math.max(-0.1, Math.min(0.32, tgtZoom - e.deltaY * 0.0009));
  };
  box.addEventListener('pointermove', onMove);
  box.addEventListener('pointerleave', onLeave);
  box.addEventListener('wheel', onWheel, { passive: false });

  // --- render gating + warmth ----------------------------------------------
  let disposed = false, loaded = false, warm = 0, frames = 0, fpsT = performance.now();
  let renderEnabled = opts.renderEnabled ?? true;

  // size sync each update (box may resize); cheap no-op when unchanged
  const syncSize = (): void => {
    const w = box.clientWidth, h = box.clientHeight;
    if (w && h && (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr))) {
      app.resizeCanvas(w, h);
    }
  };

  app.on('update', () => {
    if (disposed) return;
    syncSize();
    positionCamera();
  });
  app.on('postrender', () => {
    warm++; frames++;
    const now = performance.now();
    if (now - fpsT >= 500) { opts.onFps?.(Math.round((frames * 1000) / (now - fpsT))); frames = 0; fpsT = now; }
  });

  app.start();                 // initialises the device + tick (update fires every frame)
  // autoRender was set false above and stays false until the asset loads (ready()).

  const ready = new Promise<void>((resolve, reject) => {
    asset.once('load', () => {
      if (disposed) return resolve();
      splatEntity.addComponent('gsplat', { asset });
      camera.camera!.fov = scene.hero.fovVDeg;
      loaded = true;
      warm = 0; fpsT = performance.now(); frames = 0;
      app.autoRender = renderEnabled;
      opts.onStatus?.('loaded', true);
      resolve();
    });
    asset.once('error', (err: string) => {
      if (!disposed) { opts.onStatus?.('load error', null); console.error('[splat] load failed', err); }
      reject(new Error(err));
    });
    app.assets.load(asset);
  });

  return {
    ready,
    canvas,
    setRenderEnabled: (enabled) => {
      renderEnabled = enabled;
      app.autoRender = enabled && loaded;
      if (enabled) { warm = 0; fpsT = performance.now(); frames = 0; }
    },
    setInputEnabled: (enabled) => {
      inputEnabled = enabled;
      if (!enabled) { tgtAz = 0; tgtEl = 0; tgtZoom = 0; } // ease back to hero
    },
    atHero: (eps = 0.002) =>
      Math.abs(curAz) < eps && Math.abs(curEl) < eps && Math.abs(curZoom) < eps,
    warmFrames: () => warm,
    setOpacity: (o) => { canvas.style.opacity = String(o); },
    dispose: () => {
      disposed = true;
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerleave', onLeave);
      box.removeEventListener('wheel', onWheel);
      try { app.destroy(); } catch { /* ignore */ }
      if (canvas.parentNode === box) box.removeChild(canvas);
    },
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0. (If `camera.camera!.fov` errors on the non-null assertion, use `(camera.camera as any).fov` is NOT allowed — instead read the component via `camera.findComponent('camera')`; prefer keeping the typed `camera.camera` accessor which PlayCanvas provides.)

- [ ] **Step 3: Confirm the module serves**

With `npm run dev` running:
Run: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5174/v2/src/lib/splatViewer.ts`
Expected: `200`.

- [ ] **Step 4: ACCEPTANCE (user, in-browser) — the core validation**

Open `http://127.0.0.1:5174/splat-view?scene=stick`. (Uses the existing `stick.ply` until Task 5 swaps to SOG — fine for a render check.)
Confirm: the splat renders, orientation is upright/correct, colour is NOT washed out, and the background has NO holes — i.e. it looks like SuperSplat. If orientation is off, find the right flip via `?splateuler=x,y,z` and report the value (baked as default in Task 5 cleanup if needed).
This step answers the whole question: does PlayCanvas fix the rendering. Do not proceed until confirmed.

- [ ] **Step 5: Commit**

```bash
git add v2/src/lib/splatViewer.ts
git commit -m "feat: reimplement splat viewer on the PlayCanvas engine"
```

---

### Task 3: Strip Three.js from `colmapCamera.ts`

**Files:**
- Modify: `v2/src/lib/colmapCamera.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `interface HeroCamera { ... }` (unchanged, still imported by `splatScenes.ts`). Removes `ThreePose` and `colmapToThree` (unused — runtime camera uses `lookAt`).

- [ ] **Step 1: Reduce the file to the type only**

Replace `v2/src/lib/colmapCamera.ts` contents:

```ts
/**
 * A hero camera pose exported from Houdini → COLMAP (OpenCV convention).
 * World units are true Houdini units (poses were authored, not SfM-estimated),
 * so distances are 1:1 with the trained splat.
 *
 * NOTE: the runtime viewer drives the camera with position + lookAt(orbitCenter)
 * (roll is negligible), so the COLMAP→GL quaternion conversion is not needed at
 * runtime. If a roll-accurate static pose is ever required, reintroduce a
 * conversion using PlayCanvas math (Quat/Mat4).
 */
export interface HeroCamera {
  /** Camera centre in world space (Houdini units). */
  worldPosition: [number, number, number];
  /** world→camera rotation quaternion, COLMAP order (w, x, y, z). */
  qvecWxyz: [number, number, number, number];
  /** Pivot the camera orbits around — the product, in world space. */
  orbitCenter: [number, number, number];
  /** Camera→centre distance (Houdini units). Locked: no dolly. */
  orbitRadius: number;
  /** Vertical field of view in degrees (matches the rendered frame). */
  fovVDeg: number;
  /** Source frame size, for aspect ratio. */
  imageWidth: number;
  imageHeight: number;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 (nothing imported `colmapToThree`/`ThreePose`).

- [ ] **Step 3: Commit**

```bash
git add v2/src/lib/colmapCamera.ts
git commit -m "refactor: drop three-based colmapToThree, keep HeroCamera type"
```

---

### Task 4: Clean Spark-only options out of the pages

**Files:**
- Modify: `v2/src/pages/SunMatters.tsx`
- Modify: `v2/src/pages/SplatView.tsx`

**Interfaces:**
- Consumes: `mountSplatViewer` / `MountOptions` from Task 2 (`splatEuler`, `dprCap` only — no `focalAdjustment`, `sortRadial`, etc.).
- Produces: no interface changes.

- [ ] **Step 1: SunMatters — drop `focalAdjustment`, keep `splatEuler` passthrough**

In `v2/src/pages/SunMatters.tsx`, remove the `focalAdjustment` parse line and its use. Locate:

```ts
    // ?focaladj=<n> — Spark projected-splat scale (2 = PlayCanvas/SuperSplat match).
    const focalAdjustment = +(sp.get('focaladj') ?? '') || undefined;
```
Delete those two lines. Then change the mount call:

```ts
      splat = mountSplatViewer(splatBox, SPLAT_SCENES[sceneId], { renderEnabled: false, splatEuler, focalAdjustment });
```
to:
```ts
      splat = mountSplatViewer(splatBox, SPLAT_SCENES[sceneId], { renderEnabled: false, splatEuler });
```
Update the nearby comment that references "Spark's PLY convention" to read "splat orientation verification (PlayCanvas)".

- [ ] **Step 2: SplatView — drop Spark-only knobs, keep `splateuler` + `dpr`**

In `v2/src/pages/SplatView.tsx`, reduce the mount options to what `MountOptions` now supports. Replace the mount call block:

```ts
    const ctrl = mountSplatViewer(box, SPLAT_SCENES[scene], {
      renderEnabled: true, splatEuler,
      focalAdjustment: num('focaladj'),
      dprCap: num('dpr'),
      sortRadial: bool('sortradial'),
      maxStdDev: num('maxstddev'),
      blurAmount: num('blur'),
      preBlurAmount: num('preblur'),
      minAlpha: num('minalpha'),
      clipXY: num('clipxy'),
      premultipliedAlpha: bool('premult'),
      encodeLinear: bool('linear'),
      onFps: setFps,
      onStatus: (s) => setStatus(s),
    });
```
with:
```ts
    const ctrl = mountSplatViewer(box, SPLAT_SCENES[scene], {
      renderEnabled: true, splatEuler,
      dprCap: num('dpr'),
      onFps: setFps,
      onStatus: (s) => setStatus(s),
    });
```
If `bool(...)` becomes unused after this, delete its declaration to keep the lint clean. Update the header comment + HUD line so they only mention `scene`, `splateuler`, and `dpr` (remove `sortradial`/`focaladj`/etc.). Replace the HUD expression that referenced `bool('sortradial')` and `sp.get('focaladj')` with:
```tsx
        {scene} · {status} · {fps} fps{splatEuler ? ` · eul ${splatEuler.join(',')}` : ''}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: ACCEPTANCE (user) — full experience smoke**

Open `http://127.0.0.1:5174/sun-matters` (still on `stick.ply`/`serum.ksplat` until Task 5). Confirm: clips play, splat crossfades in at the stop, parallax works, Continue returns to hero and hands off to the next clip. (Final colour/quality acceptance is after the SOG swap in Task 5.)

- [ ] **Step 5: Commit**

```bash
git add v2/src/pages/SunMatters.tsx v2/src/pages/SplatView.tsx
git commit -m "refactor: drop Spark-only viewer options from sun-matters pages"
```

---

### Task 5: Wire SOG assets

**Precondition (user):** export `serum.sog` and `stick.sog` from SuperSplat into
`drop_in/sun_matters/splat/` (or provide them). If SuperSplat emits a `meta.json`+webp
bundle rather than a single `.sog`, note the actual entry filename — the `gsplat` asset
`url` must point at it.

**Files:**
- Add: `public/projects/sun-matters/splat/serum.sog`, `public/projects/sun-matters/splat/stick.sog`
- Modify: `v2/src/data/splatScenes.ts`

**Interfaces:**
- Consumes: `HeroCamera` (Task 3). Produces: `SPLAT_SCENES[*].splatUrl` now `.sog`.

- [ ] **Step 1: Copy the SOG files into public**

```bash
cp drop_in/sun_matters/splat/serum.sog public/projects/sun-matters/splat/serum.sog
cp drop_in/sun_matters/splat/stick.sog  public/projects/sun-matters/splat/stick.sog
```
Run: `ls -la public/projects/sun-matters/splat/*.sog`
Expected: both files present, non-zero size.

- [ ] **Step 2: Point both scenes at the SOG files**

In `v2/src/data/splatScenes.ts`, change:
```ts
    splatUrl: '/projects/sun-matters/splat/serum.ksplat',
```
to:
```ts
    splatUrl: '/projects/sun-matters/splat/serum.sog',
```
and:
```ts
    splatUrl: '/projects/sun-matters/splat/stick.ply',
```
to:
```ts
    splatUrl: '/projects/sun-matters/splat/stick.sog',
```
Also update the `splatUrl` doc comment from "(.ply for now, .ksplat for prod)" to "(.sog — SuperSplat/PlayCanvas compressed gsplat)".

- [ ] **Step 3: Confirm the assets serve as binary**

With `npm run dev` running:
Run: `curl -s -o /dev/null -w "%{http_code} %{size_download}\n" http://127.0.0.1:5174/projects/sun-matters/splat/stick.sog`
Expected: `200` and a non-zero byte count. (If `text/html`/zero, restart the dev server — `servePublicAlways` race, per CLAUDE.md.)

- [ ] **Step 4: ACCEPTANCE (user) — final fidelity check**

Open `/splat-view?scene=stick` and `?scene=serum`: confirm colour matches SuperSplat (not washed out), no holes, correct orientation. Then `/sun-matters`: full run, both stops seamless. If orientation needs a flip, bake the winning `splatEuler` value as the default in `splatViewer.ts` (`opts.splatEuler ?? [x,y,z]`) and re-commit.

- [ ] **Step 5: Commit**

```bash
git add public/projects/sun-matters/splat/serum.sog public/projects/sun-matters/splat/stick.sog v2/src/data/splatScenes.ts
git commit -m "content: SOG splat assets + point scenes at them"
```

---

### Task 6: Remove Three.js

Done last, once nothing imports `three`.

**Files:**
- Modify: `package.json`, `package-lock.json`

**Interfaces:** none.

- [ ] **Step 1: Confirm nothing imports three**

Run: `grep -rn "from 'three'\|from \"three\"" v2/src vite.config.ts 2>/dev/null`
Expected: no output. (If anything prints, resolve it before removing the dependency.)

- [ ] **Step 2: Uninstall**

Run: `npm uninstall three @types/three`
Expected: removes both from `package.json`, updates lockfile, exits 0.

- [ ] **Step 3: Typecheck + production build**

Run: `npx tsc --noEmit && npm run build`
Expected: both exit 0. The production bundle builds without three.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: remove three.js (replaced by playcanvas)"
```

---

## Notes for the implementer

- **`app.autoRender` gating:** with `autoRender=false` PlayCanvas runs `update` (cheap CPU — drives parallax/size-sync) but issues no draw calls, so "closed = no GL draws" holds. `setRenderEnabled` flips it. The `update`/`postrender` handlers are registered once; `dispose` calls `app.destroy()` which tears them down.
- **`camera.camera` accessor:** PlayCanvas types expose the camera component as `entity.camera`. If TS complains about possibly-undefined, guard with `if (camera.camera) camera.camera.fov = ...`.
- **If `new Application(...)` is deprecated** in the installed major version in favour of async `createGraphicsDevice` + `AppBase`, switch the init block only (keep the rest); see the engine API ref noted in Global Constraints.
- **Orientation:** the COLMAP hero poses were authored in true world units; load the splat at identity and verify in `/splat-view`. Bake any needed flip as the `splatEuler` default.
- **CLAUDE.md update** (fold into the final commit or a follow-up): replace the "Sun Matters splat experience" renderer section (currently describes Spark, PAUSED) with the PlayCanvas state once verified.
```
