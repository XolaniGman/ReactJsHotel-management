#!/usr/bin/env python3
"""Split a multi-angle car composite grid and stitch the views into a 360 strip.

The fleet detail page shows a real drag-to-rotate turntable when a sprite strip
exists at public/fleet-strips/{unit}.png — this script builds that strip from the
kind of 3x3 "all angles" composite car-listing sites export (the same file the
`watermarked_img_*.jpg` technique produces).

Steps:
  1. Crop the R x C grid into individual angle tiles (row-major, 1-based).
  2. Optionally save each tile as a named JPG (the "split into 9 views" step).
  3. Reorder the selected tiles into a clockwise orbit and stitch them
     side-by-side into a single horizontal strip the viewer slices on drag.

Usage:
  python scripts/composite-to-strip.py composite.jpg -u EC-105
  python scripts/composite-to-strip.py composite.jpg -u EC-105 -o public\\fleet-strips

├─ 01_front_left_three_quarter   02_front_straight   03_driver_side_profile
│  04_rear_left_three_quarter    05_rear_straight    06_rear_right_three_quarter
│  07_passenger_side_profile     08_front_right_three_quarter   09_top_down_view

Default tile order is a clockwise orbit starting at the front: front straight,
front right 3/4, passenger side profile, rear right 3/4, rear straight, rear
left 3/4, driver side profile, front left 3/4, then back to front. The top-down
view is skipped (it doesn't belong on a horizontal turntable), so the default
strip has 8 frames. Override with --order.

Requires Pillow:  python -m pip install Pillow
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from PIL import Image

DEFAULT_LABELS = [
    "01_front_left_three_quarter",
    "02_front_straight",
    "03_driver_side_profile",
    "04_rear_left_three_quarter",
    "05_rear_straight",
    "06_rear_right_three_quarter",
    "07_passenger_side_profile",
    "08_front_right_three_quarter",
    "09_top_down_view",
]

# Clockwise turntable starting at the front. Values are 1-based grid positions
# matching the default 3x3 layout above (us -1 to convert to 0-based).
DEFAULT_ORDER = [2, 8, 7, 6, 5, 4, 3, 1]


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def parse_order(value: str) -> list[int]:
    try:
        idx = [int(x) for x in value.split(",") if x.strip()]
    except ValueError as err:
        raise argparse.ArgumentTypeError(f"--order must be comma-separated 1-based tile indices, got {value!r}") from err
    if not idx:
        raise argparse.ArgumentTypeError("--order must list at least one tile")
    return idx


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("composite", help="Path to the R x C composite image.")
    parser.add_argument("-u", "--unit", required=True, help="Vehicle unit/plate used for the strip filename, e.g. EC-105.")
    parser.add_argument("-o", "--out", default="public/fleet-strips", help="Output folder for the strip (default: public/fleet-strips).")
    parser.add_argument("-g", "--grid", default="3x3", help="Grid dimensions as ROWSxCOLS (default: 3x3).")
    parser.add_argument("-e", "--emit-tiles", action="store_true", help="Also save every cropped tile as a labeled JPG.")
    parser.add_argument("--order", type=parse_order, default=None,
                        help="Comma-separated 1-based tile indices in clockwise orbit order. "
                             "Default skips the top-down view: 2,8,7,6,5,4,3,1.")
    parser.add_argument("--label", default=".png strip", help="Display label used in console messages.")
    args = parser.parse_args()

    src = Path(args.composite)
    if not src.exists():
        print(f"error: composite not found: {src}", file=sys.stderr)
        return 1

    match = re.fullmatch(r"(\d+)[xX](\d+)", args.grid.strip())
    if not match:
        print(f"error: --grid must look like 3x3, got {args.grid!r}", file=sys.stderr)
        return 1
    rows, cols = (int(m) for m in match.groups())

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    img = Image.open(src)
    width, height = img.size
    tile_w, tile_h = width // cols, height // rows
    tiles = img.convert("RGB")

    if args.emit_tiles:
        tiles_dir = out_dir / "tiles"
        tiles_dir.mkdir(parents=True, exist_ok=True)

    positions: list[int] = []
    for idx in range(rows * cols):
        r, c = divmod(idx, cols)
        box = (c * tile_w, r * tile_h, (c + 1) * tile_w, (r + 1) * tile_h)
        tile = tiles.crop(box)
        positions.append(tile)

        if args.emit_tiles:
            label = DEFAULT_LABELS[idx] if idx < len(DEFAULT_LABELS) else f"tile_{idx + 1:02d}"
            dest = tiles_dir / f"{src.stem}_{label}.jpg"
            tile.save(dest, quality=95)
            print(f"tile {idx + 1:02d} -> {dest}")

    order = args.order or DEFAULT_ORDER
    for n in order:
        if n < 1 or n > rows * cols:
            print(f"error: tile index {n} out of range (grid has {rows * cols} tiles)", file=sys.stderr)
            return 1

    # Stitch the chosen tiles side-by-side into one wide strip.
    strip = Image.new("RGB", (tile_w * len(order), tile_h), "#1e2228")
    for i, n in enumerate(order):
        strip.paste(positions[n - 1], (i * tile_w, 0))

    name = slugify(args.unit)
    n_frames = len(order)
    strip_name = f"{name}.{n_frames}f.png" if n_frames != 16 else f"{name}.png"
    dest = out_dir / strip_name
    strip.save(dest, optimize=True)
    print(f"wrote {dest} ({n_frames} frames, order {order})")

    if n_frames != 16:
        print(f"note: strip uses {n_frames} frames, so the app will slice it as {n_frames} frames.")
    print("Place it at public\\fleet-strips\\{unit}.png and the vehicle page will show the draggable 360° view.")
    return 0


if __name__ == "__main__":
    sys.exit(main())