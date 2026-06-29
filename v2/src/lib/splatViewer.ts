// Shared Gaussian-splat viewer — PlayCanvas engine (the SAME engine as SuperSplat). The
// render path is copied 1:1 from the official @playcanvas/supersplat-viewer (src/viewer.ts):
// the gsplat renders through a CameraFrame into a FLOAT target (RGBA16F/32F) so the many
// low-alpha gaussians accumulate at high precision (no 8-bit banding on smooth surfaces),
// AND its `gsplatOutputVS` shader chunk is overridden to an IDENTITY so the splats keep
// their GAMMA colour and blend in gamma space instead of being linearized into the float
// buffer (linear blend over-brightens high-contrast edges = the caustic/needle fringing).
// The backbuffer is flagged sRGB so the final compose blit doesn't re-encode. Together this
// is exactly the SuperSplat look — clean edges AND smooth surfaces — which neither pure
// gamma/8-bit ("bare") nor plain linear-CameraFrame gave on their own. (opts.bare=true is a
// fallback that renders straight to the 8-bit backbuffer for A/B.) Consumed by the Sun
// Matters video↔splat experience via the SplatViewerController below.
import {
  Application, Asset, Entity, Color, Vec3, Quat,
  FILLMODE_NONE, RESOLUTION_FIXED,
  CameraFrame, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F,
  TONEMAP_NONE, TONEMAP_LINEAR,
  ShaderChunks, RenderTarget,
  GSPLAT_RENDERER_AUTO, GSPLAT_RENDERER_RASTER_CPU_SORT,
  GSPLAT_RENDERER_RASTER_GPU_SORT, GSPLAT_RENDERER_COMPUTE,
} from 'playcanvas';
import type { SplatScene } from '../data/splatScenes';

const MAX_AZ = 5, MAX_EL = 5, DAMP = 0.07; // parallax: ±5° az/el, spring damping

// Identity gsplat output chunks (copied 1:1 from @playcanvas/supersplat-viewer). Replace the
// engine's `gsplatOutputVS` so the splat's stored gamma colour is written as-is (no linearize)
// → gaussians blend in gamma space inside the CameraFrame float target.
const GAMMA_CHUNK_GLSL = `
vec3 prepareOutputFromGamma(vec3 gammaColor, float depth) {
    return gammaColor;
}
`;
const GAMMA_CHUNK_WGSL = `
fn prepareOutputFromGamma(gammaColor: vec3f, depth: f32) -> vec3f {
    return gammaColor;
}
`;

/** gsplat sort/raster backend name → engine constant (only effective on the unified path). */
const SORTERS: Record<string, number> = {
  auto: GSPLAT_RENDERER_AUTO, cpu: GSPLAT_RENDERER_RASTER_CPU_SORT,
  gpu: GSPLAT_RENDERER_RASTER_GPU_SORT, compute: GSPLAT_RENDERER_COMPUTE,
};

/** Live-tunable performance knobs for the /splat harness (no remount). */
export interface PerfParams {
  /** Internal render scale × display DPR. <1 renders fewer pixels (big GPU win), >1 supersamples. */
  renderScale: number;
  /**
   * Adaptive resolution: extra scale multiplier applied ONLY while the view is moving (mouse
   * parallax / zoom / settle glide). Motion hides the softness, and the frame it settles on
   * snaps back to full `renderScale` — so the still image you actually look at stays pixel-perfect.
   * 1 = disabled (no downscale on motion). 0.6 = render at 60% during motion (big iGPU win).
   */
  motionScale: number;
  /** Render only when the view changes (true) vs every frame (false, for A/B). */
  onDemand: boolean;
  /** Sort/raster backend. gpu/compute offload the per-frame depth sort (needs the unified path). */
  sorter: 'auto' | 'cpu' | 'gpu' | 'compute';
}
export const PERF_DEFAULTS: PerfParams = { renderScale: 1, motionScale: 0.75, onDemand: true, sorter: 'auto' };

export interface MountOptions {
  /** Start rendering once loaded (default true). False = preload silently (no GL). */
  renderEnabled?: boolean;
  /** Debug splat orientation as XYZ Euler degrees — verification knob. Default identity. */
  splatEuler?: [number, number, number];
  /** Hard cap on render scale (supersampling ceiling). Default 3. */
  dprCap?: number;
  /**
   * Supersample factor applied on top of the display DPR for the internal render
   * resolution. >1 renders larger then downsamples. Default 1 (native, = SuperSplat
   * pixelScale). Raising it shrinks gaussians vs the discard threshold, so prefer the
   * gsplat settings below for density.
   */
  superSample?: number;
  /** PlayCanvas gsplat AA compensation (for AA/Mip-trained splats). Default true. */
  gsplatAntiAlias?: boolean;
  /** Discard splats below this screen-px size (engine default 2). Default 0 = keep all. */
  gsplatMinPixelSize?: number;
  /** Override camera near clip (default: auto-fit to splat bounds). */
  near?: number;
  /** Override camera far clip (default: auto-fit to splat bounds). */
  far?: number;
  /**
   * Unified vs non-unified gsplat rendering. Default FALSE (non-unified) — this is what
   * the SuperSplat EDITOR uses (`addComponent('gsplat', { unified: false })`), and the
   * editor is our confirmed-clean reference on the EXACT same .ply.
   *
   * Why non-unified matters here: this asset is a raw 25k-iter checkpoint full of faint
   * needle gaussians (median opacity ~2%, ~50% of splats >100× axis ratio). The unified
   * path (a) QUANTIZES SH to 11/10/11 bits and (b) only culls via alphaClip/minContribution
   * — and raising those enough to kill the needles also kills the faint splats the scene
   * is built from → see-through returns. That trade-off is unwinnable, which is why every
   * panel tweak failed. Non-unified renders full-precision SH and accumulates the faint
   * splats without that per-fragment clip, so the needles stop reading as caustic streaks —
   * exactly why the same file is clean in the editor. (The unified-only params in
   * applyGsplatParams become no-ops here; harmless.) Still rendered through CameraFrame's
   * float target either way. Was only ever tested unified-vs-non BEFORE the float fix, when
   * 8-bit banding masked the difference — hence the stale "no difference" note. */
  unified?: boolean;
  /**
   * Tonemapping applied by the CameraFrame compose pass. SuperSplat's reference look
   * is the editor default. 'linear' = TONEMAP_LINEAR (editor default per prior sessions),
   * 'none' = TONEMAP_NONE (1:1 passthrough). Live A/B via /splat ?tonemap=. Default 'linear'.
   */
  toneMapping?: 'none' | 'linear';
  /**
   * Render the gsplat straight to the 8-bit backbuffer with NO CameraFrame. Default FALSE.
   * The default (false) path is the official supersplat-viewer pipeline: CameraFrame float
   * target + identity `gsplatOutputVS` chunk (gamma-space blend) + sRGB backbuffer flag —
   * gamma-space compositing at FLOAT precision, so clean edges AND smooth surfaces. bare=true
   * keeps the old editor-style gamma/8-bit path (clean edges but 8-bit accumulation banding
   * on smooth glossy surfaces) for A/B in the /splat panel. */
  bare?: boolean;
  /**
   * Render only when the view actually changes (parallax/zoom in motion, ease-back, warmup),
   * idling the GPU when the splat is static at the hero pose. Default TRUE — the splat is
   * static geometry, so holding still needs no redraws. The per-frame update loop (input +
   * camera damping) never stops, so the first moved frame draws immediately = instant, smooth
   * resume with no spin-up. Crossfades need no redraws (CSS opacity over the last drawn frame).
   * Set false for a continuous-render A/B. */
  onDemand?: boolean;
  /**
   * gsplat sort/raster backend. 'auto' (default) lets the engine pick. 'gpu'/'compute' offload
   * the per-frame depth sort off the CPU — only effective on the UNIFIED path, so selecting a
   * non-auto sorter implies unified rendering. */
  sorter?: 'auto' | 'cpu' | 'gpu' | 'compute';
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
  /** Live-apply perf knobs (no remount). Used by the /splat harness. */
  setPerf: (p: Partial<PerfParams>) => void;
  /** Live render numbers for the /splat HUD. */
  stats: () => { fps: number; bbW: number; bbH: number; dpr: number; splats: number };
  dispose: () => void;
}

export function mountSplatViewer(
  box: HTMLElement,
  scene: SplatScene,
  opts: MountOptions = {},
): SplatViewerController {
  // Render scale = display DPR × userScale (default 1 = native, = SuperSplat pixelScale:1),
  // capped by dprCap. userScale is live-tunable from the debug panel: <1 renders lower (the
  // fixed Mip 0.3px floor then covers relatively MORE of each gaussian → hides thin needles),
  // >1 supersamples (floor covers less → reveals needles). curPr() is read fresh in syncSize.
  const dprCap = opts.dprCap ?? 3;
  let userScale = opts.superSample ?? 1;
  // Adaptive resolution: while `moving`, the backbuffer renders at motionScale× (fewer pixels =
  // big fill-rate win on weak GPUs); it snaps back to full when the view settles. floor keeps a
  // moving frame from going to mush. `moving` is driven by the per-frame motion check below.
  let motionScale = PERF_DEFAULTS.motionScale, moving = false, moveHold = 0;
  const curPr = (): number => {
    const base = Math.min((window.devicePixelRatio || 1) * userScale, dprCap);
    return moving ? Math.max(base * motionScale, 0.5) : base;
  };

  // Opaque black canvas: gaussian edges have alpha < 1, so a transparent canvas
  // would let the video behind bleed through. The video↔splat crossfade is done
  // via CSS opacity on this element.
  const canvas = document.createElement('canvas');
  // touch-action:none → finger-drag drives the parallax (pointermove) instead of scrolling
  // the page, so the look-around works identically on touch and mouse.
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;z-index:1;touch-action:none';
  box.appendChild(canvas);

  // antialias off — no benefit for splats, costs perf (PlayCanvas + Spark both advise).
  // powerPreference high-performance matches the official supersplat-viewer (picks the
  // discrete GPU where present — helps this heavy 400k-splat scene).
  const app = new Application(canvas, {
    graphicsDeviceOptions: { antialias: false, powerPreference: 'high-performance' },
  });
  app.setCanvasFillMode(FILLMODE_NONE);    // we live in a fixed 16:9 box, not the window
  // FIXED resolution (not AUTO): with AUTO the backbuffer = clientSize × min(DPR,
  // maxPixelRatio) — maxPixelRatio only CAPS, so it can NEVER supersample above the
  // display DPR (this is why a past raw-supersample attempt did nothing). We set the
  // backbuffer explicitly to clientSize × pr (pr = DPR × superSample) in syncSize and let
  // CSS (width/height:100%) downscale it — that is real supersampling when superSample > 1.
  app.setCanvasResolution(RESOLUTION_FIXED, 1, 1); // real size set in syncSize once laid out
  app.autoRender = false;                  // render-gating: we toggle this on/off

  // Match SuperSplat's gsplat rendering. These are the fix for "gaussians too small →
  // gaps/artifacts on smooth surfaces":
  //  - gsplatAntiAlias (engine default FALSE): AA compensation. Lichtfeld trains with
  //    anti-aliasing, so gaussians are stored smaller and the renderer must restore
  //    their footprint — off, they render undersized.
  //  - gsplatMinPixelSize (engine default 2): discards splats below N screen px. The
  //    default culls the small gaussians on smooth surfaces → gaps; 0 keeps them.
  // Match the OFFICIAL @playcanvas/supersplat-viewer gsplat params (the standalone viewer
  // that renders splats exactly like SuperSplat). Set DIRECTLY on the scene's GSplatParams
  // (app.scene.gsplat) — NOT scene.applySettings(), which needs a full settings blob (reads
  // physics.gravity) and throws on a partial object. Engine defaults differ exactly where
  // our see-through/coverage look came from:
  //  - alphaClip 0.3 → 1/255  (0.3 under-covers the surface in the prepass = see-through)
  //  - minContribution 3 → 1  (3 drops faint splats → gaps/transparency)
  //  - colorUpdateAngle 10 → 2 (finer view-dependent colour)
  //  - antiAlias true (Lichtfeld trains with AA; the viewer exposes this)
  // minPixelSize is left at the engine default (2) like the official viewer, unless overridden.
  const aa = opts.gsplatAntiAlias ?? true;
  // These setters write to the unified-gsplat MATERIAL parameters, which only exist once
  // a unified gsplat has been added to the scene — so this MUST be (re)applied AFTER the
  // component loads, not just here at mount. Defined once, called in the load handler.
  const applyGsplatParams = (): void => {
    const gsParams = app.scene.gsplat;
    gsParams.antiAlias = aa;
    gsParams.alphaClip = 1 / 255;
    gsParams.minContribution = 1;
    gsParams.colorUpdateAngle = 2;
    gsParams.radialSorting = true;
    if (opts.gsplatMinPixelSize !== undefined) gsParams.minPixelSize = opts.gsplatMinPixelSize;
  };
  applyGsplatParams();

  // --- camera --------------------------------------------------------------
  const camera = new Entity('camera');
  camera.addComponent('camera', {
    clearColor: new Color(0, 0, 0, 1),
    fov: scene.hero.fovVDeg,               // vertical fov (horizontalFov defaults false)
    nearClip: 0.01,
    farClip: 1000,
  });
  app.root.addChild(camera);

  // --- CameraFrame: render the gsplat through a high-precision FLOAT target ---------
  // SuperSplat (same engine) accumulates many low-alpha gaussians into RGBA16F/32F and
  // tonemaps/composes to screen. We previously rendered the gsplat BARE to the 8-bit
  // backbuffer → quantized accumulation = the vertical banding/streaks + "thin/washed"
  // look on smooth glossy surfaces. Float accumulation removes it. This is the one
  // structural difference left after every gsplat param was already matched.
  // All post-effects (bloom/ssao/grading/vignette/dof/taa) stay OFF — SuperSplat's plain
  // look uses none. toneMapping is the single value we can't read from an export → knob.
  // The CameraFrame constructor auto-enables (builds its render pass). We then set our
  // rendering options and call update() to apply them — update() re-reads rendering and
  // pushes formats/toneMapping into the existing pass. Do NOT call enable() again: it is
  // not idempotent (it rebuilds + overwrites the pass, orphaning the constructor's one).
  // Force RGBA16F/32F explicitly: the engine default prefers 111110F first, which has NO
  // alpha channel — wrong for the gsplat's alpha-blended accumulation.
  const toneMap = (opts.toneMapping ?? 'linear') === 'none' ? TONEMAP_NONE : TONEMAP_LINEAR;
  const bare = opts.bare ?? false;               // default = CameraFrame float + gamma overrides (the official-viewer pipeline)
  let restoreSrgb: (() => void) | null = null;   // undo the global RenderTarget patch on dispose
  const cameraFrame = bare ? null : new CameraFrame(app, camera.camera!);
  if (cameraFrame) {
    cameraFrame.rendering.renderFormats = [PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F];
    cameraFrame.rendering.toneMapping = toneMap;
    cameraFrame.rendering.samples = 1;          // SuperSplat default; no MSAA (splats don't benefit)
    cameraFrame.update();                        // apply the rendering changes above

    // ── THE GAMMA-SPACE FLOAT FIX (1:1 from @playcanvas/supersplat-viewer src/viewer.ts) ──
    // The CameraFrame target is LINEAR float. By default the gsplat output chunk linearizes
    // the splat's stored gamma colour → gaussians accumulate in linear space → high-contrast
    // edges over-brighten (the caustic/needle fringing). Override `gsplatOutputVS` with an
    // identity so the splats keep gamma colour and blend in gamma space — still at float
    // precision (no 8-bit banding). Set BEFORE the gsplat shader compiles (component is added
    // later, in the load handler), so this takes effect. ShaderChunks is per-graphicsDevice,
    // so it's scoped to this app and needs no restore.
    ShaderChunks.get(app.graphicsDevice, 'glsl').set('gsplatOutputVS', GAMMA_CHUNK_GLSL);
    ShaderChunks.get(app.graphicsDevice, 'wgsl').set('gsplatOutputVS', GAMMA_CHUNK_WGSL);

    // Flag the backbuffer as sRGB so the final compose blit doesn't do a linear→gamma
    // re-encode on our already-gamma data. This patches RenderTarget.prototype (GLOBAL), so
    // capture the original and restore it on dispose.
    const origIsColorBufferSrgb = RenderTarget.prototype.isColorBufferSrgb;
    RenderTarget.prototype.isColorBufferSrgb = function (this: RenderTarget, index?: number) {
      return this === app.graphicsDevice.backBuffer ? true : origIsColorBufferSrgb.call(this, index);
    };
    restoreSrgb = () => { RenderTarget.prototype.isColorBufferSrgb = origIsColorBufferSrgb; };
  }

  // --- splat ---------------------------------------------------------------
  const splatEntity = new Entity('splat');
  const eu = opts.splatEuler ?? [0, 0, 0];
  splatEntity.setLocalEulerAngles(eu[0], eu[1], eu[2]);
  app.root.addChild(splatEntity);

  // filename is the loader's extension hint when url is a blob: URL (preloaded asset).
  const asset = new Asset(scene.id, 'gsplat', { url: scene.splatUrl, filename: scene.splatFilename });
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
  // app.autoRender stays FALSE; we drive draws manually via app.renderNextFrame so the GPU
  // only works when the view changes (render-on-demand). The update tick (input + camera
  // damping) keeps firing every frame regardless, so a moved frame is drawn immediately =
  // instant resume with no spin-up. `dirty` is a small countdown of frames still owed a draw;
  // motion / resize / warmup top it up, idle drains it to 0 (GPU sleeps at the hero pose).
  let disposed = false, loaded = false, warm = 0, frames = 0, fpsT = performance.now(), lastFps = 0;
  let renderEnabled = opts.renderEnabled ?? true;
  let onDemand = opts.onDemand ?? true;
  let dirty = 0, prevAz = 0, prevEl = 0, prevZoom = 0;
  const POSE_EPS = 1e-4, WARMUP = 10, MOVE_TAIL = 3, MOTION_HOLD = 3;
  const markDirty = (n: number): void => { if (n > dirty) dirty = n; };

  // size sync each update (box may resize). Returns true if it resized the backbuffer.
  const syncSize = (): boolean => {
    const w = box.clientWidth, h = box.clientHeight;
    const pr = curPr();
    const bw = Math.round(w * pr), bh = Math.round(h * pr);
    if (w && h && (canvas.width !== bw || canvas.height !== bh)) {
      app.setCanvasResolution(RESOLUTION_FIXED, bw, bh); // backbuffer = clientSize × pr
      return true;
    }
    return false;
  };

  app.on('update', () => {
    if (disposed) return;
    positionCamera();
    // camera motion since last frame (settling damping / mouse parallax / ease-back to hero)?
    const moved = Math.abs(curAz - prevAz) > POSE_EPS || Math.abs(curEl - prevEl) > POSE_EPS ||
        Math.abs(curZoom - prevZoom) > POSE_EPS;
    prevAz = curAz; prevEl = curEl; prevZoom = curZoom;
    if (moved) markDirty(MOVE_TAIL);
    // Adaptive resolution: hold the low-res state for a few frames after the last detected
    // motion (debounce so stop/start wiggles don't thrash the backbuffer realloc), then drop
    // back to full. syncSize compares against the live curPr() — so when `moving` flips, it
    // resizes the backbuffer (down on motion-start, up on settle) and that resize tops up
    // `dirty`, guaranteeing the settled frame is redrawn at full resolution.
    if (moved) moveHold = MOTION_HOLD; else if (moveHold > 0) moveHold--;
    moving = moveHold > 0;
    if (syncSize()) markDirty(MOVE_TAIL);

    // fps is measured HERE (the update tick fires every frame, even when idle) over wall-clock
    // time, counting only frames that actually drew (postrender). When the view settles and the
    // GPU sleeps, no draws land in the window → fps correctly reports 0 (vs freezing on the last
    // value if measured in postrender, which stops firing at idle).
    const now = performance.now();
    if (now - fpsT >= 500) { lastFps = Math.round((frames * 1000) / (now - fpsT)); opts.onFps?.(lastFps); frames = 0; fpsT = now; }

    if (!loaded || !renderEnabled) { dirty = 0; return; }
    if (!onDemand) { app.renderNextFrame = true; return; }   // continuous A/B
    if (dirty > 0) { app.renderNextFrame = true; dirty--; }  // draw the frames we still owe
  });
  app.on('postrender', () => { warm++; frames++; });         // count actual draws for fps + warmup

  app.start();                 // initialises the device + tick (update fires every frame)
  // autoRender stays false; renderNextFrame (above) draws on demand once the asset loads.

  const ready = new Promise<void>((resolve, reject) => {
    asset.once('load', () => {
      if (disposed) return resolve();
      // Non-unified matches the SuperSplat editor (clean on this file). A non-auto sorter
      // (gpu/compute) only works on the unified path, so selecting one implies unified.
      const unified = opts.unified ?? (!!opts.sorter && opts.sorter !== 'auto');
      splatEntity.addComponent('gsplat', { asset, unified });
      // Force the highest LOD only — never decimate splats on the product surface
      // (no-op for non-LOD .ply/.sog, but guarantees full detail for LOD assets).
      const gs = splatEntity.gsplat;
      if (gs) { gs.lodRangeMin = 0; gs.lodRangeMax = 1000; } // official viewer values
      // GSplatParams (alphaClip/minContribution/etc.) only affect the UNIFIED path, and
      // its material doesn't exist until a unified gsplat is added — so (re)apply here.
      if (unified) {
        applyGsplatParams();
        if (opts.sorter && opts.sorter !== 'auto') app.scene.gsplat.renderer = SORTERS[opts.sorter];
      }
      camera.camera!.fov = scene.hero.fovVDeg;

      // Tight near/far around the PRODUCT (camera sits orbitRadius from it). The splat's
      // own AABB is useless here — stray floater splats inflate it, which forces near≈0
      // (no depth precision at the product) and lets close floaters haze over it. A
      // product-tight window restores precision. Override with opts.near/opts.far.
      const rad = scene.hero.orbitRadius;
      camera.camera!.nearClip = opts.near ?? rad * 0.5;
      camera.camera!.farClip = opts.far ?? rad * 10;
      loaded = true;
      warm = 0; fpsT = performance.now(); frames = 0;
      if (renderEnabled) markDirty(WARMUP);   // draw the first frames (warm the crossfade)
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
      if (enabled) { warm = 0; fpsT = performance.now(); frames = 0; markDirty(WARMUP); }
    },
    setInputEnabled: (enabled) => {
      inputEnabled = enabled;
      if (!enabled) { tgtAz = 0; tgtEl = 0; tgtZoom = 0; markDirty(WARMUP); } // animate ease-back to hero
    },
    atHero: (eps = 0.002) =>
      Math.abs(curAz) < eps && Math.abs(curEl) < eps && Math.abs(curZoom) < eps,
    warmFrames: () => warm,
    setOpacity: (o) => { canvas.style.opacity = String(o); },
    setPerf: (p) => {
      if (p.renderScale !== undefined) { userScale = p.renderScale; markDirty(MOVE_TAIL); }
      if (p.motionScale !== undefined) { motionScale = p.motionScale; markDirty(MOVE_TAIL); }
      if (p.onDemand !== undefined) { onDemand = p.onDemand; markDirty(WARMUP); }
      if (p.sorter !== undefined) {
        // unified-only; harmless no-op on the non-unified path
        try { app.scene.gsplat.renderer = SORTERS[p.sorter] ?? GSPLAT_RENDERER_AUTO; markDirty(MOVE_TAIL); } catch { /* ignore */ }
      }
    },
    stats: () => {
      const gd = app.graphicsDevice as unknown as { width: number; height: number };
      const res = asset.resource as unknown as { numSplats?: number } | null;
      return {
        fps: lastFps, bbW: gd.width, bbH: gd.height,
        dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
        splats: res?.numSplats ?? 0,
      };
    },
    dispose: () => {
      disposed = true;
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerleave', onLeave);
      box.removeEventListener('wheel', onWheel);
      try { cameraFrame?.destroy(); } catch { /* ignore */ }
      try { restoreSrgb?.(); } catch { /* ignore */ }   // undo the global RenderTarget patch
      try { app.destroy(); } catch { /* ignore */ }
      if (canvas.parentNode === box) box.removeChild(canvas);
    },
  };
}
