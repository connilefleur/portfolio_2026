#!/usr/bin/env python3
import argparse
import json
import subprocess
from pathlib import Path


def ffprobe_json(input_path: Path):
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "stream=index,codec_type,codec_name,width,height,pix_fmt",
        "-show_entries",
        "format=size,duration,bit_rate",
        "-of",
        "json",
        str(input_path),
    ]
    return json.loads(subprocess.check_output(cmd, text=True))


def scale_filter(max_edge: int) -> str:
    return f"scale=w={max_edge}:h={max_edge}:force_original_aspect_ratio=decrease:force_divisible_by=2"




def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--video-output", required=True)
    parser.add_argument("--poster-output", required=True)
    parser.add_argument("--video-max-edge", type=int, default=1920)
    parser.add_argument("--poster-max-edge", type=int, default=1600)
    parser.add_argument("--crf", type=int, default=35)
    parser.add_argument("--cpu-used", type=int, default=6)
    parser.add_argument("--audio-bitrate", default="128k")
    parser.add_argument("--codec", choices=["av1", "vp9"], default="av1")
    args = parser.parse_args()

    input_path = Path(args.input)
    video_output = Path(args.video_output)
    poster_output = Path(args.poster_output)
    video_output.parent.mkdir(parents=True, exist_ok=True)
    poster_output.parent.mkdir(parents=True, exist_ok=True)

    source_info = ffprobe_json(input_path)
    streams = source_info.get("streams") or []
    has_audio = any(stream.get("codec_type") == "audio" for stream in streams)

    if args.codec == "av1":
        codec_flags = [
            "-c:v", "libsvtav1",
            "-crf", str(args.crf),
            "-preset", str(args.cpu_used),
            "-pix_fmt", "yuv420p",
            "-svtav1-params", "film-grain=8",
        ]
    else:
        codec_flags = [
            "-c:v", "libvpx-vp9",
            "-b:v", "0",
            "-crf", str(args.crf),
            "-pix_fmt", "yuv420p",
            "-deadline", "good",
            "-cpu-used", str(args.cpu_used),
            "-row-mt", "1",
        ]

    encode_cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_path),
        "-map",
        "0:v:0",
        "-dn",
        "-vf",
        scale_filter(args.video_max_edge),
        *codec_flags,
    ]
    if has_audio:
        encode_cmd += [
            "-map",
            "0:a?",
            "-c:a",
            "libopus",
            "-b:a",
            args.audio_bitrate,
            "-ac",
            "2",
        ]
    else:
        encode_cmd += ["-an"]
    encode_cmd.append(str(video_output))
    subprocess.check_call(encode_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    poster_cmd = [
        "ffmpeg",
        "-y",
        "-i", str(input_path),
        "-frames:v", "1",
        "-vf", scale_filter(args.poster_max_edge),
        "-q:v", "3",
        str(poster_output),
    ]
    subprocess.check_call(poster_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    output_info = ffprobe_json(video_output)
    video_stream = next((stream for stream in (output_info.get("streams") or []) if stream.get("codec_type") == "video"), {})
    format_info = output_info.get("format") or {}

    print(json.dumps({
        "width": video_stream.get("width"),
        "height": video_stream.get("height"),
        "duration": format_info.get("duration"),
        "videoSizeBytes": video_output.stat().st_size,
        "posterSizeBytes": poster_output.stat().st_size,
    }))


if __name__ == "__main__":
    main()
