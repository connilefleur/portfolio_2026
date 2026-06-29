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
 * The splat pipeline needs WebGL2 + float colour buffers; touch devices get the straight
 * video (matches the rest of the site's touch UX). SSR-safe (guards `window`).
 */
export function canRunSplat(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(hover: none)').matches) return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    return !!gl && !!gl.getExtension('EXT_color_buffer_float');
  } catch {
    return false;
  }
}

/**
 * URLs to preload for a given capability. Full path = every segment video + every splat;
 * fallback = just the single continuous hero video.
 */
export function preloadUrls(splatOk: boolean): string[] {
  if (!splatOk) return [HERO_VIDEO_FULL];
  const segs = TIMELINE.map((c) => c.src);
  const splats = Object.values(SPLAT_SCENES).map((s) => s.splatUrl);
  return [...segs, ...splats];
}
