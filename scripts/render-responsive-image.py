#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
from PIL import Image, ImageOps


def save_variant(img, original, output_path: Path, quality: int = 92, lossless: bool = False):
    ext = output_path.suffix.lower()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if ext in {".jpg", ".jpeg"}:
        save_kwargs = {
            "format": "JPEG",
            "quality": 95,
            "optimize": True,
            "progressive": True,
            "subsampling": 0,
        }
        if original.info.get("icc_profile"):
            save_kwargs["icc_profile"] = original.info["icc_profile"]
        exif = original.info.get("exif")
        if exif:
            save_kwargs["exif"] = exif
        img.convert("RGB").save(output_path, **save_kwargs)
        return

    if ext == ".png":
        img.save(output_path, format="PNG", optimize=True, compress_level=9)
        return

    if ext == ".webp":
        img.save(output_path, format="WEBP", lossless=lossless, quality=quality, method=6)
        return

    raise ValueError(f"Unsupported responsive image format: {ext}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--output-prefix", required=True)
    parser.add_argument("--widths", required=True)
    parser.add_argument("--relative-dir", default="")
    parser.add_argument("--quality", type=int, default=92, help="Lossy WebP quality (1-100)")
    parser.add_argument("--lossless", action="store_true", help="Use lossless WebP (for screenshots)")
    args = parser.parse_args()

    source_path = Path(args.input)
    output_dir = Path(args.output_dir)
    widths = [int(value) for value in args.widths.split(",") if value.strip()]

    with Image.open(source_path) as original:
        image = ImageOps.exif_transpose(original)
        original_width, original_height = image.size
        results = []

        for width in widths:
            if width <= 0 or width >= original_width:
                continue
            height = max(1, round(original_height * (width / original_width)))
            resized = image.resize((width, height), Image.Resampling.LANCZOS)
            output_name = f"{args.output_prefix}-w{width}.webp"
            output_path = output_dir / output_name
            save_variant(resized, original, output_path, quality=args.quality, lossless=args.lossless)
            relative_dir = args.relative_dir.strip("/")
            relative_src = f"{relative_dir}/{output_name}" if relative_dir else output_name
            results.append({
                "src": relative_src,
                "width": width,
                "height": height,
            })

    print(json.dumps(results))


if __name__ == "__main__":
    main()
