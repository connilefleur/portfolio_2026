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
  dispose: () => void;
}

export function mountSplatViewer(
  box: HTMLElement,
  scene: SplatScene,
  opts: MountOptions = {},
): SplatViewerController {
  // Render scale = display DPR × superSample (default 1 = native, matching SuperSplat's
  // pixelScale:1), capped. Supersampling >1 smooths specular but shrinks each gaussian
  // relative to the fixed-pixel discard threshold → use the gsplat settings below, not
  // raw supersampling, to fix undersized/sparse splats.
  const pr = Math.min((window.devicePixelRatio || 1) * (opts.superSample ?? 1), opts.dprCap ?? 3);

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

  // Match SuperSplat's gsplat rendering. These are the fix for "gaussians too small →
  // gaps/artifacts on smooth surfaces":
  //  - gsplatAntiAlias (engine default FALSE): AA compensation. Lichtfeld trains with
  //    anti-aliasing, so gaussians are stored smaller and the renderer must restore
  //    their footprint — off, they render undersized.
  //  - gsplatMinPixelSize (engine default 2): discards splats below N screen px. The
  //    default culls the small gaussians on smooth surfaces → gaps; 0 keeps them.
  // Set the params DIRECTLY on the scene's GSplatParams (app.scene.gsplat). NOT via
  // scene.applySettings() — that needs a full settings blob (reads physics.gravity) and
  // throws on a partial object, silently leaving the engine defaults (antiAlias=false,
  // minPixelSize=2) in place.
  const aa = opts.gsplatAntiAlias ?? true;
  const minpx = opts.gsplatMinPixelSize ?? 0;
  app.scene.gsplat.antiAlias = aa;
  app.scene.gsplat.minPixelSize = minpx;
  // eslint-disable-next-line no-console
  console.log('[splat] gsplat params:', { antiAlias: aa, minPixelSize: minpx }, '· dpr', window.devicePixelRatio, '· maxPR', app.graphicsDevice.maxPixelRatio);

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
      // Force the highest LOD only — never decimate splats on the product surface
      // (no-op for non-LOD .ply/.sog, but guarantees full detail for LOD assets).
      const gs = splatEntity.gsplat;
      if (gs) { gs.lodRangeMin = 0; gs.lodRangeMax = 0; }
      camera.camera!.fov = scene.hero.fovVDeg;

      // Fit near/far TIGHTLY to the splat bounds (SuperSplat does this). The fixed
      // 0.01/1000 we used = ~100000:1 range = almost no depth precision at the product
      // distance (~2 units) → gsplat depth/blend degrades = the see-through / not-smooth
      // look. Tightening to dist ± boundRadius restores precision.
      const res = asset.resource as unknown as
        { aabb?: { center: { x: number; y: number; z: number }; halfExtents: { x: number; y: number; z: number } } } | null;
      let near = opts.near, far = opts.far;
      if (near === undefined || far === undefined) {
        const wp = scene.hero.worldPosition;
        if (res?.aabb?.center && res.aabb.halfExtents) {
          const c = res.aabb.center, h = res.aabb.halfExtents;
          const r = Math.hypot(h.x, h.y, h.z);
          const dist = Math.hypot(wp[0] - c.x, wp[1] - c.y, wp[2] - c.z);
          near = near ?? Math.max(1e-3, dist - r);
          far = far ?? dist + r;
        } else {
          near = near ?? Math.max(0.05, scene.hero.orbitRadius * 0.3);
          far = far ?? scene.hero.orbitRadius * 25;
        }
      }
      camera.camera!.nearClip = near; camera.camera!.farClip = far;
      // eslint-disable-next-line no-console
      console.log('[splat] nearClip', near, '· farClip', far, '· aabb?', !!res?.aabb);
      loaded = true;
      warm = 0; fpsT = performance.now(); frames = 0;
      app.autoRender = renderEnabled;
      opts.onStatus?.('loaded', true);
      // One delayed render-stats line (after the canvas has settled) — paste this to
      // diagnose resolution / fov / splat-count vs SuperSplat.
      setTimeout(() => {
        if (disposed) return;
        const gd = app.graphicsDevice as unknown as { width: number; height: number; maxPixelRatio: number };
        const res = asset.resource as unknown as { numSplats?: number } | null;
        // eslint-disable-next-line no-console
        console.log(`[splat] RENDER ${gd.width}x${gd.height} backbuffer · dpr ${window.devicePixelRatio} · maxPR ${gd.maxPixelRatio} · box ${box.clientWidth}x${box.clientHeight} · fov ${camera.camera?.fov}° · splats ${res?.numSplats ?? '?'}`);
      }, 1500);
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
      try { app.destroy(); } catch { /* ignore */ }
      if (canvas.parentNode === box) box.removeChild(canvas);
    },
  };
}
