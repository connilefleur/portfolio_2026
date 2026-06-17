export type EngineType = 'tm' | 'physarum' | 'flow';

export interface Engine {
  // Run one frame. Returns an R32F texture with visual intensity [0,1].
  step(now: number): WebGLTexture;
  // Rebuild sim textures after resize.
  resize(TW: number, TH: number): void;
  // Optional: TM uses this to keep label-rects as RD walls.
  setWallTex?(tex: WebGLTexture): void;
  // Optional: camera tilt in radians (rx=pitch, ry=yaw) for 3D parallax.
  setTilt?(rx: number, ry: number): void;
  // Optional: hovered node position (normalised [0,1]) for growth boost.
  setHover?(x: number, y: number, active: boolean): void;
  // Optional: brightness multiplier — differs per colour scheme.
  setBrightness?(v: number): void;
  // Returns true once per cycle reset so the caller can flush effect accum buffers.
  pollReset?(): boolean;
  destroy(): void;
}
