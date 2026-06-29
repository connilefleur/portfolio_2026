#!/usr/bin/env bash
# Cut the Sun Matters hero video into the 3 interactive segments, frame-accurate,
# from the ProRes master. Each clip ENDS on a hero frame so the browser naturally
# holds the last painted frame for the splat hold (see sunMattersTimeline.ts).
#
#   seg-a [0..300]   ends on 300  → serum stop
#   seg-b [300..700] ends on 700  → stick stop   (was 730; moved 2026-06-26)
#   seg-c [700..end]
#
# Boundary frames are intentionally duplicated across adjacent segments. Re-run
# this after the master is regraded — just point M at the new ProRes.
#
# Each segment is emitted TWICE: AV1/WebM (primary — Chrome/Firefox/modern) and an
# H.264/MP4 sibling of the same basename (Safari, esp. iOS, can't decode AV1). The
# runtime picks per-browser via videoSrc() in sunMattersAssets.ts. A full-length
# hero MP4 is also emitted as the no-WebGL fallback clip.
#
# Colour: the ProRes master is ALREADY sRGB display, full range. So we do NO colour
# conversion — no transfer math, no range scaling — we ONLY TAG the output so the
# <video> is signalled correctly and matches the sRGB WebGL splat canvas. bt709
# primaries == sRGB primaries; iec61966-2-1 == sRGB transfer; pc == full range.
# (The -color_* flags below are metadata only; there is no scale/range filter that
# would alter pixel values.)
set -e
cd "$(dirname "$0")/.."

M=${1:-drop_in/sun_matters/Sun_Matters.Bottle_Scene_V2.mov}
OUT=public/projects/sun-matters/videos/segments
HEROUT=public/projects/sun-matters/videos
mkdir -p "$OUT"

# shared colour tags: sRGB transfer, bt709 primaries, full range (metadata only — no
# scale/range filter alters pixel values; matches the sRGB WebGL splat canvas).
CT=(-color_primaries bt709 -color_trc iec61966-2-1 -colorspace bt709 -color_range pc)

enc() { # $1 = select expr   $2 = outfile
  echo ">>> encoding $2"
  # Declare the SAME colour on input and output. With in==out, swscale does NO range/
  # transfer conversion during the unavoidable 10-bit 4:2:2 → 8-bit 4:2:0 resample (web
  # AV1 needs yuv420p) — pixel display values are preserved, stream tagged sRGB/full.
  ffmpeg -hide_banner -v error -y "${CT[@]}" -i "$M" -map 0:v:0 -dn \
    -vf "select='$1',setpts=N/FRAME_RATE/TB" -fps_mode vfr \
    -c:v libsvtav1 -crf 35 -preset 6 -pix_fmt yuv420p -svtav1-params film-grain=8 \
    "${CT[@]}" "$OUT/$2"
  echo ">>> done $2"
}

encmp4() { # $1 = select expr   $2 = outfile   (H.264 Safari sibling)
  echo ">>> encoding $2"
  # crf 23 — Safari-only path: AV1 is ~10× smaller, so keep the MP4 lean (the preloader
  # downloads every segment as a blob up front; ~15 MB total on iOS vs ~1.2 MB AV1).
  ffmpeg -hide_banner -v error -y "${CT[@]}" -i "$M" -map 0:v:0 -dn \
    -vf "select='$1',setpts=N/FRAME_RATE/TB" -fps_mode vfr \
    -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p \
    "${CT[@]}" -movflags +faststart "$OUT/$2"
  echo ">>> done $2"
}

enc    "between(n\,0\,300)"   "seg-a-000-300.webm"
enc    "between(n\,300\,700)" "seg-b-300-700.webm"
enc    "gte(n\,700)"          "seg-c-700-end.webm"
encmp4 "between(n\,0\,300)"   "seg-a-000-300.mp4"
encmp4 "between(n\,300\,700)" "seg-b-300-700.mp4"
encmp4 "gte(n\,700)"          "seg-c-700-end.mp4"

# full-length hero MP4 — the no-WebGL fallback clip (Safari-playable)
echo ">>> encoding hero sun-matters-bottle-scene.mp4"
ffmpeg -hide_banner -v error -y "${CT[@]}" -i "$M" -map 0:v:0 -dn \
  -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p \
  "${CT[@]}" -movflags +faststart "$HEROUT/sun-matters-bottle-scene.mp4"

echo "=== frame counts ==="
for f in "$OUT"/seg-*.webm "$OUT"/seg-*.mp4; do
  printf "%s : " "$f"
  ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of csv=p=0 "$f"
done
echo "=== colour tags (expect: bt709 / iec61966-2-1 / pc) ==="
ffprobe -v error -select_streams v:0 \
  -show_entries stream=color_range,color_transfer,color_primaries \
  -of default=noprint_wrappers=1 "$OUT/seg-a-000-300.webm"
