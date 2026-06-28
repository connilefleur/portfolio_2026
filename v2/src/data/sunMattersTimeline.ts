// Sun Matters experience timeline.
//
// The hero video is split into segments at the two hero frames (300, 700), so
// each interactive stop is the NATURAL END of a segment — the file simply ends
// and the browser holds the last painted frame (rock-solid, nothing to "roll"
// into). The seam is invisible because a segment's last frame is identical to
// the next segment's first frame, which is also the splat's hero pose:
//
//   seg-a [frames 0..300]   ends on 300  ─┐ serum stop (hold 300, splat in)
//   seg-b [frames 300..700] starts on 300 ┘ ends on 700 ─┐ stick stop
//   seg-c [frames 700..end] starts on 700                ┘
//
// Segments must be cut frame-accurately (re-encode) so 300 / 700 land exactly.
// Boundary frames are intentionally duplicated across adjacent segments.

export const SEG_DIR = '/projects/sun-matters/videos/segments';

export interface TimelineClip {
  src: string;
  /** If set, hold this clip's last frame and run the splat stop for this scene. */
  stopSceneId?: string;
}

export const TIMELINE: TimelineClip[] = [
  { src: `${SEG_DIR}/seg-a-000-300.webm`, stopSceneId: 'serum' },
  { src: `${SEG_DIR}/seg-b-300-700.webm`, stopSceneId: 'stick' },
  { src: `${SEG_DIR}/seg-c-700-end.webm` },
];
