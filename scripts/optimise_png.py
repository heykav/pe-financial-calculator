#!/usr/bin/env python3
"""Palette-quantise README screenshots to keep the repository small.

    python3 scripts/optimise_png.py docs/screenshot.png docs/img/app-*.png

Converts each PNG to a 256-colour palette (Pillow, median cut, no dithering so flat UI
colours stay flat) and rewrites it with zlib optimisation, only if the result is smaller.
Pillow is a local tool here, not a dependency of the app. Prints before/after sizes.
"""
import os
import sys

from PIL import Image


def optimise(path: str) -> None:
    before = os.path.getsize(path)
    with Image.open(path) as img:
        rgb = img.convert("RGB")
    pal = rgb.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    tmp = path + ".tmp"
    pal.save(tmp, format="PNG", optimize=True)
    after = os.path.getsize(tmp)
    if after < before:
        os.replace(tmp, path)
    else:
        os.remove(tmp)
        after = before
    print(f"{path}\t{before}\t->\t{after}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for p in sys.argv[1:]:
        optimise(p)
