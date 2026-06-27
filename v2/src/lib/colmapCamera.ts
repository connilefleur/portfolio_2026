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
