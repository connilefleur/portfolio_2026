# SuperSplat CameraFrame Render Path — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make our PlayCanvas splat viewer match SuperSplat's render quality by routing the camera through a `CameraFrame` into a high-precision float render target (kills the 8-bit accumulation banding/streaks).

**Architecture:** Wrap the existing camera in a `playcanvas` `CameraFrame`, set `rendering.renderFormats` to float (`RGBA16F`/`RGBA32F`) and `rendering.toneMapping` to a configurable value. No post-effects. Everything else in `splatViewer.ts` (parallax, crossfade, hero pose, render-gating, controller interface) is untouched. Expose a `?tonemap=none|linear` knob on the `/splat` harness for an in-browser A/B against the SuperSplat reference.

**Tech Stack:** TypeScript, `playcanvas@2.20.0`, Vite. Verification: `tsc` typecheck + dev-server module transform + user in-browser visual A/B (WebGL2 float buffers cannot run headless).

## Global Constraints

- Single render file: `v2/src/lib/splatViewer.ts`. Only page touched: `v2/src/pages/SplatView.tsx` (to wire the `?tonemap` knob).
- No asset/format changes (stays on current `.ply`s). No gsplat-param changes (already matched). No bloom/ssao/grading/vignette/dof/taa.
- Preserve the `SplatViewerController` interface exactly — `SunMatters.tsx` and `SplatView.tsx` consume it; SunMatters must compile unchanged.
- Float-format fallback to `RGBA8` is acceptable (engine-automatic); never throw if floats unsupported.
- Headless verification is impossible (project gotcha: SwiftShader lacks `EXT_color_buffer_float`). Automated gate = typecheck + Vite transform; visual pass/fail = user in browser.
- PlayCanvas constants (verified present in `playcanvas@2.20.0`): `CameraFrame`, `PIXELFORMAT_RGBA16F`, `PIXELFORMAT_RGBA32F`, `TONEMAP_NONE`, `TONEMAP_LINEAR` — all from the main `playcanvas` entry.

---

### Task 1: Route the camera through a CameraFrame float pipeline

**Files:**
- Modify: `v2/src/lib/splatViewer.ts`

**Interfaces:**
- Consumes: existing `mountSplatViewer(box, scene, opts)`, the `camera` Entity with a live `camera.camera` CameraComponent, `app` (`Application`).
- Produces: new optional mount field `MountOptions.toneMapping?: 'none' | 'linear'` (default `'linear'`). Controller interface unchanged.

- [ ] **Step 1: Extend the imports**

In the `import { … } from 'playcanvas';` block, add the new symbols:

```ts
import {
  Application, Asset, Entity, Color, Vec3, Quat,
  FILLMODE_NONE, RESOLUTION_AUTO,
  CameraFrame, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F,
  TONEMAP_NONE, TONEMAP_LINEAR,
} from 'playcanvas';
```

- [ ] **Step 2: Add the `toneMapping` mount option**

In the `MountOptions` interface, add:

```ts
  /**
   * Tonemapping applied by the CameraFrame compose pass. SuperSplat's reference look
   * is the editor default. 'linear' = TONEMAP_LINEAR (editor default per prior sessions),
   * 'none' = TONEMAP_NONE (1:1 passthrough). Live A/B via /splat ?tonemap=. Default 'linear'.
   */
  toneMapping?: 'none' | 'linear';
```

- [ ] **Step 3: Construct + configure the CameraFrame after the camera is added to the root**

Immediately after `app.root.addChild(camera);` (the camera block, ~line 128), insert:

```ts
  // --- CameraFrame: render the gsplat through a high-precision FLOAT target ---------
  // SuperSplat (same engine) accumulates many low-alpha gaussians into RGBA16F/32F and
  // tonemaps/composes to screen. We previously rendered the gsplat BARE to the 8-bit
  // backbuffer → quantized accumulation = the vertical banding/streaks + "thin/washed"
  // look on smooth glossy surfaces. Float accumulation removes it. This is the one
  // structural difference left after every gsplat param was already matched.
  // All post-effects (bloom/ssao/grading/vignette/dof/taa) stay OFF — SuperSplat's plain
  // look uses none. toneMapping is the single value we can't read from an export → knob.
  const toneMap = (opts.toneMapping ?? 'linear') === 'none' ? TONEMAP_NONE : TONEMAP_LINEAR;
  const cameraFrame = new CameraFrame(app, camera.camera!);
  cameraFrame.rendering.renderFormats = [PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F];
  cameraFrame.rendering.toneMapping = toneMap;
  cameraFrame.rendering.samples = 1;            // SuperSplat default; no MSAA (splats don't benefit)
  cameraFrame.update();                          // apply rendering changes
  cameraFrame.enable();
```

- [ ] **Step 4: Destroy the CameraFrame on dispose**

In the returned controller's `dispose`, before `try { app.destroy(); } …`, add:

```ts
      try { cameraFrame.destroy(); } catch { /* ignore */ }
```

- [ ] **Step 5: Typecheck**

Run: `cd /home/deployer/projects/portfolio && npx tsc -p tsconfig.json --noEmit`
Expected: PASS (no errors). If `camera.camera` is possibly-null per TS, the `!` non-null assertion already used elsewhere in this file covers it.

- [ ] **Step 6: Verify Vite transforms the module cleanly**

Dev server runs at `http://127.0.0.1:5174`. Touch nothing else; confirm the module compiles:
Run: `curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:5174/v2/src/lib/splatViewer.ts"`
Expected: `200`. (A transform error surfaces as 500.)

- [ ] **Step 7: Commit**

```bash
cd /home/deployer/projects/portfolio
git add v2/src/lib/splatViewer.ts
git commit -m "fix: render splat through CameraFrame float pipeline (match SuperSplat)"
```

---

### Task 2: Wire the `?tonemap=` A/B knob into the /splat harness

**Files:**
- Modify: `v2/src/pages/SplatView.tsx`

**Interfaces:**
- Consumes: `MountOptions.toneMapping` from Task 1; existing `mountSplatViewer` call in `SplatView.tsx`.
- Produces: `/splat?tonemap=none` and `/splat?tonemap=linear` select the toneMapping at mount.

- [ ] **Step 1: Read the param and pass it through**

In `SplatView.tsx`, where `scene` is read from the query (`const scene = new URLSearchParams(location.search).get('scene') ?? 'stick';`), add directly below it:

```ts
  const tm = new URLSearchParams(location.search).get('tonemap');
  const toneMapping = tm === 'none' ? 'none' : tm === 'linear' ? 'linear' : undefined;
```

Then in the `mountSplatViewer(box, SPLAT_SCENES[scene], { … })` options object, add the field (alongside the existing options):

```ts
      toneMapping,
```

(Passing `undefined` lets the viewer default to `'linear'` — no behavior change unless `?tonemap=` is set.)

- [ ] **Step 2: Typecheck**

Run: `cd /home/deployer/projects/portfolio && npx tsc -p tsconfig.json --noEmit`
Expected: PASS. (`toneMapping` typed `'none' | 'linear' | undefined` matches `MountOptions.toneMapping?`.)

- [ ] **Step 3: Verify Vite transforms the page**

Run: `curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:5174/v2/src/pages/SplatView.tsx"`
Expected: `200`.

- [ ] **Step 4: Commit**

```bash
cd /home/deployer/projects/portfolio
git add v2/src/pages/SplatView.tsx
git commit -m "feat: /splat ?tonemap=none|linear A/B knob for CameraFrame"
```

---

### Task 3: In-browser verification + bake the toneMapping default

**Files:** none (verification + a possible one-line default change already covered by Task 1's `?? 'linear'`).

- [ ] **Step 1: User loads the harness in a real browser**

Open `http://127.0.0.1:5174/splat` (stick) and `http://127.0.0.1:5174/splat?scene=serum`.
Compare against `drop_in/debug_splat/Screenshot from 2026-06-27 09-08-07.png` (SuperSplat reference).
Expected: vertical banding/streaks gone; gloss + background density/contrast match the reference.

- [ ] **Step 2: A/B the toneMapping**

Compare `http://127.0.0.1:5174/splat?tonemap=linear` vs `http://127.0.0.1:5174/splat?tonemap=none`.
Pick the one that matches the SuperSplat reference colour/brightness.

- [ ] **Step 3: If `none` wins, change the default**

If `none` matched better, change the default in `splatViewer.ts` Step 3:
`const toneMap = (opts.toneMapping ?? 'none') === 'none' ? TONEMAP_NONE : TONEMAP_LINEAR;`
Then commit: `git commit -am "fix: default splat toneMapping to none (matched SuperSplat)"`.
If `linear` matched, no change needed.

- [ ] **Step 4: Decisive negative result (if streaks remain)**

If float CameraFrame does NOT remove the streaks, the cause is upstream (source `.ply` / LOD / sort), not the render target. Do not resume parameter tuning — record the finding and revisit the Lichtfeld export / file identity. (Ref memory `feedback-stop-tuning-find-root-cause`.)

---

## Self-Review

**Spec coverage:** CameraFrame + float renderFormats (Task 1 Step 3) ✓; toneMapping default + knob (Task 1 Step 2, Task 2) ✓; render-gating untouched (no change to autoRender logic) ✓; dispose cleanup (Task 1 Step 4) ✓; in-browser verification + bake (Task 3) ✓; no post-FX / no gsplat / no asset changes (Global Constraints) ✓.

**Placeholder scan:** none — every code step shows exact code; commands have expected output.

**Type consistency:** `toneMapping?: 'none' | 'linear'` defined in Task 1, consumed identically in Task 2; `cameraFrame` named consistently across Steps 3–4.
