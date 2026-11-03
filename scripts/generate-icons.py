"""Regenerate committed PWA PNG icons: python3 scripts/generate-icons.py (Pillow).
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
image = Image.new('RGB', (1536, 1536), '#174b3c')
draw = ImageDraw.Draw(image)
scale = 3
def box(values):
    return tuple(round(v * scale) for v in values)
draw.rounded_rectangle(box((135, 115, 377, 419)), radius=34*scale, fill='#7d9c74')
draw.rounded_rectangle(box((135, 99, 377, 403)), radius=34*scale, fill='#f2eedb')
# The leaf is drawn as two quadratic curves, sampled without font dependencies.
def bezier(p0, p1, p2, count=45):
    return [((1-t)**2*p0[0] + 2*(1-t)*t*p1[0] + t*t*p2[0],
             (1-t)**2*p0[1] + 2*(1-t)*t*p1[1] + t*t*p2[1]) for t in [i/count for i in range(count+1)]]
leaf = bezier((321, 179), (169, 158), (206, 278)) + bezier((206, 278), (337, 355), (321, 179))
draw.line([(round(x*scale),round(y*scale)) for x,y in leaf], fill='#28634a', width=15*scale, joint='curve')
draw.line(box((204, 335, 282, 224)), fill='#28634a', width=15*scale)
for size in (192, 512):
    image.resize((size, size), Image.Resampling.LANCZOS).save(root / 'public' / f'icon-{size}.png')
