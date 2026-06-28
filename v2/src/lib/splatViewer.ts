// Shared Gaussian-splat viewer — PlayCanvas engine (matches SuperSplat, which is
// the PlayCanvas gsplat renderer). The splat is rendered through a CameraFrame into a
// float (RGBA16F/32F) target — matching SuperSplat — so many low-alpha gaussians
// accumulate without the 8-bit quantization that caused the see-through/streaky look.
// Consumed by the Sun Matters video↔splat experience via the SplatViewerController below.
import {
  Application, Asset, Entity, Color, Vec3, Quat,
  FILLMODE_NONE, RESOLUTION_FIXED,
  CameraFrame, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA8,
  TONEMAP_NONE, TONEMAP_LINEAR, TONEMAP_FILMIC, TONEMAP_HEJL,
  TONEMAP_ACES, TONEMAP_ACES2, TONEMAP_NEUTRAL,
} from 'playcanvas';
import type { SplatScene } from '../data/splatScenes';

const MAX_AZ = 5, MAX_EL = 5, DAMP = 0.07; // parallax: ±5° az/el, spring damping

/** Tonemap name → engine constant, for the debug panel + toneMapping mount opt. */
const TONEMAPS: Record<string, number> = {
  none: TONEMAP_NONE, linear: TONEMAP_LINEAR, filmic: TONEMAP_FILMIC,
  hejl: TONEMAP_HEJL, aces: TONEMAP_ACES, aces2: TONEMAP_ACES2, neutral: TONEMAP_NEUTRAL,
};

/**
 * Every live-tunable render parameter, for the /splat debug panel. Generous on purpose —
 * includes unlikely culprits so the cause can be dialed/ruled out in-browser. Each maps to
 * a live PlayCanvas setter (no remount / no ply reload). Scene-dependent fov/near/far/euler
 * have no fixed default (derived from the scene) so they're separate from the defaults below.
 */
export interface SplatDebugParams {
  /** Internal render scale ×DPR. <1 renders lower (bigger Mip floor → hides needles), >1 supersamples. */
  renderScale: number;
  toneMapping: 'none' | 'linear' | 'filmic' | 'hejl' | 'aces' | 'aces2' | 'neutral';
  /** CameraFrame MSAA samples 1–4 (1 = off). */
  samples: number;
  /** CameraFrame post sharpen 0–1 (0 = none). */
  sharpness: number;
  /** CameraFrame render-target scale 0.1–1 (downscale-then-upscale). */
  renderTargetScale: number;
  /** Float (RGBA16F/32F) vs 8-bit (RGBA8) accumulation buffer. */
  hdr: boolean;
  /** Temporal AA (jittered multi-frame accumulation) — clean stills if camera idle. */
  taa: boolean;
  taaJitter: number;
  /** gsplat Mip alpha compensation (footprint dilation is always on; this scales alpha). */
  antiAlias: boolean;
  alphaClip: number;
  minContribution: number;
  minPixelSize: number;
  colorUpdateAngle: number;
  radialSorting: boolean;
  /** vertical FOV deg — controls on-screen magnification of the gaussians. */
  fov: number;
  near: number;
  far: number;
  /** splat orientation XYZ euler deg. */
  euler: [number, number, number];
}

/** Defaults the viewer applies at mount (scene-independent subset). The panel seeds from these. */
export const SPLAT_DEBUG_DEFAULTS: Omit<SplatDebugParams, 'fov' | 'near' | 'far' | 'euler'> = {
  renderScale: 1, toneMapping: 'linear', samples: 1, sharpness: 0, renderTargetScale: 1,
  hdr: true, taa: false, taaJitter: 1,
  antiAlias: true, alphaClip: 1 / 255, minContribution: 1, minPixelSize: 2,
  colorUpdateAngle: 2, radialSorting: true,
};

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
  /** Unified gsplat rendering. The gsplat quality params (antiAlias/alphaClip/
   *  minContribution/radialSorting) ONLY exist on the unified path and are what the
   *  official SuperSplat viewer uses; non-unified silently ignores them (no antiAlias =
   *  oversharpened/aliased). Unified needs the CameraFrame pipeline to composite right,
   *  which we now have — so default TRUE to match SuperSplat. */
  unified?: boolean;
  /**
   * Tonemapping applied by the CameraFrame compose pass. SuperSplat's reference look
   * is the editor default. 'linear' = TONEMAP_LINEAR (editor default per prior sessions),
   * 'none' = TONEMAP_NONE (1:1 passthrough). Live A/B via /splat ?tonemap=. Default 'linear'.
   */
  toneMapping?: 'none' | 'linear';
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
  /** Debug: live render numbers (actual backbuffer px, dpr, maxPixelRatio, fov, splats). */
  stats: () => { bbW: number; bbH: number; dpr: number; maxPR: number; fov: number; splats: number };
  /** Live-apply any subset of debug params (no remount / no ply reload). Used by /splat panel. */
  setDebug: (p: Partial<SplatDebugParams>) => void;
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
  const curPr = (): number => Math.min((window.devicePixelRatio || 1) * userScale, dprCap);

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
  const cameraFrame = new CameraFrame(app, camera.camera!);
  cameraFrame.rendering.renderFormats = [PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F];
  cameraFrame.rendering.toneMapping = toneMap;
  cameraFrame.rendering.samples = 1;            // SuperSplat default; no MSAA (splats don't benefit)
  cameraFrame.update();                          // apply the rendering changes above

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
    const pr = curPr();
    const bw = Math.round(w * pr), bh = Math.round(h * pr);
    if (w && h && (canvas.width !== bw || canvas.height !== bh)) {
      app.setCanvasResolution(RESOLUTION_FIXED, bw, bh); // backbuffer = clientSize × pr
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
      const unified = opts.unified ?? true;
      splatEntity.addComponent('gsplat', { asset, unified });
      // Force the highest LOD only — never decimate splats on the product surface
      // (no-op for non-LOD .ply/.sog, but guarantees full detail for LOD assets).
      const gs = splatEntity.gsplat;
      if (gs) { gs.lodRangeMin = 0; gs.lodRangeMax = 1000; } // official viewer values
      // GSplatParams (alphaClip/minContribution/etc.) only affect the UNIFIED path, and
      // its material doesn't exist until a unified gsplat is added — so (re)apply here.
      if (unified) applyGsplatParams();
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
    setDebug: (p) => {
      let cf = false; // any CameraFrame.rendering/taa change needs cameraFrame.update()
      const r = cameraFrame.rendering, t = cameraFrame.taa, g = app.scene.gsplat, cam = camera.camera!;
      if (p.renderScale !== undefined) userScale = p.renderScale; // syncSize resizes next frame
      if (p.toneMapping !== undefined) { r.toneMapping = TONEMAPS[p.toneMapping] ?? TONEMAP_LINEAR; cf = true; }
      if (p.samples !== undefined) { r.samples = p.samples; cf = true; }
      if (p.sharpness !== undefined) { r.sharpness = p.sharpness; cf = true; }
      if (p.renderTargetScale !== undefined) { r.renderTargetScale = p.renderTargetScale; cf = true; }
      if (p.hdr !== undefined) { r.renderFormats = p.hdr ? [PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F] : [PIXELFORMAT_RGBA8]; cf = true; }
      if (p.taa !== undefined) { t.enabled = p.taa; cf = true; }
      if (p.taaJitter !== undefined) { t.jitter = p.taaJitter; cf = true; }
      if (p.antiAlias !== undefined) g.antiAlias = p.antiAlias;
      if (p.alphaClip !== undefined) g.alphaClip = p.alphaClip;
      if (p.minContribution !== undefined) g.minContribution = p.minContribution;
      if (p.minPixelSize !== undefined) g.minPixelSize = p.minPixelSize;
      if (p.colorUpdateAngle !== undefined) g.colorUpdateAngle = p.colorUpdateAngle;
      if (p.radialSorting !== undefined) g.radialSorting = p.radialSorting;
      if (p.fov !== undefined) cam.fov = p.fov;
      if (p.near !== undefined) cam.nearClip = p.near;
      if (p.far !== undefined) cam.farClip = p.far;
      if (p.euler !== undefined) splatEntity.setLocalEulerAngles(p.euler[0], p.euler[1], p.euler[2]);
      if (cf) cameraFrame.update();
    },
    stats: () => {
      const gd = app.graphicsDevice as unknown as { width: number; height: number; maxPixelRatio: number };
      const res = asset.resource as unknown as { numSplats?: number } | null;
      return {
        bbW: gd.width, bbH: gd.height,
        dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
        maxPR: gd.maxPixelRatio,
        fov: camera.camera ? Math.round(camera.camera.fov * 100) / 100 : 0,
        splats: res?.numSplats ?? 0,
      };
    },
    dispose: () => {
      disposed = true;
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerleave', onLeave);
      box.removeEventListener('wheel', onWheel);
      try { cameraFrame.destroy(); } catch { /* ignore */ }
      try { app.destroy(); } catch { /* ignore */ }
      if (canvas.parentNode === box) box.removeChild(canvas);
    },
  };
}
