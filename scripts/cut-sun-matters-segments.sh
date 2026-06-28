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
# Colour: the ProRes master is ALREADY sRGB display, full range. So we do NO colour
# conversion — no transfer math, no range scaling — we ONLY TAG the output so the
# <video> is signalled correctly and matches the sRGB WebGL splat canvas. bt709
# primaries == sRGB primaries; iec61966-2-1 == sRGB transfer; pc == full range.
# (The -color_* flags below are metadata only; there is no scale/range filter that
# would alter pixel values.)
set -e
cd "$(dirname "$0")/.."

M=${1:-drop_in/sun_matters/Sun_Matters.Bottle_Scene.mov}
OUT=public/projects/sun-matters/videos/segments
mkdir -p "$OUT"

enc() { # $1 = select expr   $2 = outfile
  echo ">>> encoding $2"
  # Declare the SAME colour on input and output (sRGB transfer, bt709 primaries, full
  # range). With in==out, swscale does NO range/transfer conversion during the
  # unavoidable 10-bit 4:2:2 → 8-bit 4:2:0 resample (web AV1 needs yuv420p) — pixel
  # display values are preserved and the stream is simply tagged sRGB/full.
  ffmpeg -hide_banner -v error -y \
    -color_primaries bt709 -color_trc iec61966-2-1 -colorspace bt709 -color_range pc \
    -i "$M" -map 0:v:0 -dn \
    -vf "select='$1',setpts=N/FRAME_RATE/TB" -fps_mode vfr \
    -c:v libsvtav1 -crf 35 -preset 6 -pix_fmt yuv420p -svtav1-params film-grain=8 \
    -color_primaries bt709 -color_trc iec61966-2-1 -colorspace bt709 -color_range pc \
    "$OUT/$2"
  echo ">>> done $2"
}

enc "between(n\,0\,300)"   "seg-a-000-300.webm"
enc "between(n\,300\,700)" "seg-b-300-700.webm"
enc "gte(n\,700)"          "seg-c-700-end.webm"

echo "=== frame counts ==="
for f in "$OUT"/*.webm; do
  printf "%s : " "$f"
  ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of csv=p=0 "$f"
done
echo "=== colour tags (expect: bt709 / iec61966-2-1 / pc) ==="
ffprobe -v error -select_streams v:0 \
  -show_entries stream=color_range,color_transfer,color_primaries \
  -of default=noprint_wrappers=1 "$OUT/seg-a-000-300.webm"
