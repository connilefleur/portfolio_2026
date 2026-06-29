// Asset list + capability check for the Sun Matters interactive experience.
// Deliberately PlayCanvas-free so the preloader (InteractiveStage) can import it without
// pulling the heavy splat/playcanvas chunk into the main bundle.

import { SPLAT_SCENES } from './splatScenes';
import { TIMELINE } from './sunMattersTimeline';

// Full continuous hero video — the mobile / no-WebGL fallback (no splat orchestration).
export const HERO_VIDEO_FULL = '/projects/sun-matters/videos/sun-matters-bottle-scene.webm';

/** Poster shown behind the preloader bar and as the experience's first paint. */
export const EXPERIENCE_POSTER = '/projects/sun-matters/videos/sun-matters-bottle-scene-poster.jpg';

/** basename of a served path, e.g. '/a/b/serum.sog' → 'serum.sog'. */
export const basename = (url: string): string => url.split('/').pop() ?? url;

/**
 * The splat pipeline needs WebGL2 + float colour buffers. Unlike the rest of the site's
 * touch UX (which flips to list/video), the Sun Matters experience runs the SAME on desktop
 * and mobile — so there is deliberately NO `hover: none` / touch gate here; touch parallax is
 * handled in the viewer. We only fall back when the GPU genuinely can't render the splat.
 * SSR-safe (guards `window`).
 */
export function canRunSplat(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    return !!gl && !!gl.getExtension('EXT_color_buffer_float');
  } catch {
    return false;
  }
}

/**
 * Whether this browser can decode our AV1/WebM clips. Chrome/Firefox/modern Edge: yes.
 * Safari (esp. iOS) generally cannot → it gets the H.264/MP4 siblings instead. Memoised.
 */
let _av1: boolean | undefined;
export function supportsAv1(): boolean {
  if (_av1 !== undefined) return _av1;
  if (typeof document === 'undefined') return (_av1 = false);
  const v = document.createElement('video');
  _av1 = v.canPlayType('video/webm; codecs="av01.0.05M.08"') !== '';
  return _av1;
}

/**
 * Resolve a base `.webm` clip URL to the codec this browser can actually play: AV1/WebM where
 * supported, else the H.264 `.mp4` sibling (same basename, sat next to it). Both the preloader
 * and the experience route every video URL through this so the blob-map keys line up.
 */
export function videoSrc(webmUrl: string): string {
  return supportsAv1() ? webmUrl : webmUrl.replace(/\.webm$/, '.mp4');
}

/**
 * URLs to preload for a given capability. Full path = every segment video + every splat;
 * fallback = just the single continuous hero video.
 */
export function preloadUrls(splatOk: boolean): string[] {
  if (!splatOk) return [videoSrc(HERO_VIDEO_FULL)];
  const segs = TIMELINE.map((c) => videoSrc(c.src));
  const splats = Object.values(SPLAT_SCENES).map((s) => s.splatUrl);
  return [...segs, ...splats];
}
