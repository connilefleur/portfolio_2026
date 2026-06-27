import type { HeroCamera } from '../lib/colmapCamera';

export interface SplatScene {
  id: string;
  /** Served path to the trained splat (.ply for now, .ksplat for prod). */
  splatUrl: string;
  /** Video frame this splat is matched to (0-indexed). */
  videoFrame: number;
  /** Dev-only reference still extracted from that frame, for alignment. */
  refFrameUrl: string;
  hero: HeroCamera;
  /**
   * DOF seeds — starting points only, dialed by eye against the footage.
   * focusDistance defaults to orbitRadius (focus locked on the product);
   * fstop from the JSON is unverified (render had DOF off).
   */
  dof: { focusDistance: number; fstop: number };
}

export const VIDEO_FPS = 30;

export const SPLAT_SCENES: Record<string, SplatScene> = {
  serum: {
    id: 'serum',
    splatUrl: '/projects/sun-matters/splat/serum.ply',
    videoFrame: 300,
    refFrameUrl: '/projects/sun-matters/splat/_ref/frame_300.png',
    hero: {
      worldPosition: [-1.67472005, 1.62150002, 3.20009995],
      qvecWxyz: [-0.1210465949, 0.9787832964, -0.0202907286, 0.1640709203],
      orbitCenter: [-0.72591752, 0.89065498, 0.44952926],
      orbitRadius: 3.0,
      fovVDeg: 8.578307,
      imageWidth: 1920,
      imageHeight: 1080,
    },
    dof: { focusDistance: 3.0, fstop: 3.2 },
  },
  stick: {
    id: 'stick',
    splatUrl: '/projects/sun-matters/splat/stick.ply',
    videoFrame: 700,
    refFrameUrl: '/projects/sun-matters/splat/_ref/frame_700.png',
    hero: {
      worldPosition: [0.06, 0.94999999, 2.70000005],
      qvecWxyz: [0.0, 0.9924394221, 0.0, -0.1227354611],
      orbitCenter: [-0.42723003, 0.94999999, 0.76025599],
      orbitRadius: 2.0,
      fovVDeg: 11.56299,
      imageWidth: 1920,
      imageHeight: 1080,
    },
    dof: { focusDistance: 2.0, fstop: 3.2 },
  },
};
