#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Rebuild the checked-in lossless 2× atlas. Requires ImageMagick and Pillow.

Run from the repository root: python3 scripts/render-atlas.py
Normal builds use the committed WebP and need neither tool.
"""
import subprocess
import tempfile
from pathlib import Path
from PIL import Image

with tempfile.TemporaryDirectory() as directory:
    png = Path(directory) / 'atlas.png'
    subprocess.run(['convert', '-background', 'none', '-density', '192',
                    'public/themes/postmodern.svg', '-resize', '5504x352', str(png)], check=True)
    with Image.open(png) as image:
        assert image.size == (5504, 352)
        image.convert('RGBA').save('public/themes/postmodern.webp', lossless=True, method=6)
