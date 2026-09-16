#!/usr/bin/env python3
"""Stitch real car photos (same car, same shoot) into an 8-frame 360 strip.

Turns a folder of photos of the SAME vehicle shot from different angles into a
sprite strip the app's turntable can slice. Ordering defaults to the files in
alphabetical order (rename them to control the rotation). If the folder holds 4
photos the strip becomes [a,b,c,d, mirror(d), mirror(c), mirror(b), mirror(a)]
so dragging circles back past the far side.

Usage:
  python scripts/stitch-photos.py --dir <folder> -o public/fleet-strips/ec-101.8f.png
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageOps

FRAME_W, FRAME_H = 912, 512

SUPPORTED = {".jpg", ".jpeg", ".png", ".webp"}


def load_frame(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGB")
    w, h = im.size
    target_ratio = FRAME_W / FRAME_H
    cur_ratio = w / h
    if cur_ratio > target_ratio:
        nw = int(h * target_ratio)
        im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = int(w / target_ratio)
        im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    return im.resize((FRAME_W, FRAME_H), Image.LANCZOS)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dir", required=True, help="Folder containing the angle photos.")
    parser.add_argument("-o", "--out", required=True, help="Output strip path, e.g. public/fleet-strips/ec-101.8f.png.")
    parser.add_argument("--mirror", type=str, choices=["auto", "yes", "no"], default="auto",
                        help="Append mirrored frames to double the visible rotation (default: auto = only when 4 photos given).")
    args = parser.parse_args()

    src_dir = Path(args.dir)
    if not src_dir.is_dir():
        print(f"error: folder not found: {src_dir}", file=sys.stderr)
        return 1

    photos = sorted(p for p in src_dir.iterdir() if p.suffix.lower() in SUPPORTED)
    if len(photos) < 2:
        print(f"error: need at least 2 photos in {src_dir} (found {len(photos)})", file=sys.stderr)
        return 1

    mirror = args.mirror
    if mirror == "auto":
        mirror = "yes" if len(photos) == 4 else "no"

    frames = [load_frame(p) for p in photos]
    if mirror == "yes":
        frames += [ImageOps.mirror(f) for f in reversed(frames)]

    strip = Image.new("RGB", (FRAME_W * len(frames), FRAME_H), "#1e2228")
    for i, f in enumerate(frames):
        strip.paste(f, (i * FRAME_W, 0))

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    strip.save(out, optimize=True)
    print(f"wrote {out} ({len(frames)} frames from {len(photos)} photos, mirror={mirror})")
    return 0


if __name__ == "__main__":
    sys.exit(main())