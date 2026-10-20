"""
Cocktail Creepypastas — cut the bartender and logo sprite sheets.

The owner's ChatGPT sheets are white pixel art on pure black, with bright green
(#00FF00) lines between equal cells (see the "Bartender & Logo Sprites" prompt):

  1-logo.png          1 x 2: full logo (used), compact logo (ignored)
  2B-idle.png  2C-talking.png  2D-greeting.png  2E-thinking.png  2F-writing.png
                      2 x 2 each, frames left to right then top to bottom

The green bands are found by scanning for them, each cell is cut just inside
them, any green fringe is blacked out, and frames are trimmed above his head and shrunk to 384x432 with
8 grey levels (crisp and ~15 KB each). Every frame keeps its full cell, so the
counter and his head stay where ChatGPT put them — measured identical across
all 20 frames of the first set.

  pip install pillow numpy
  python3 scripts/creepypastas-art.py <folder with the PNGs>
Writes public/popup/creepypastas/logo.png and bartender/<pose>-<n>.png
"""
import os, sys
import numpy as np
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else "."
OUT = os.path.join("public", "popup", "creepypastas")
# Rows of each 1024-tall frame to keep: trims the empty black above his head
# (content starts at row ~104 in every frame) so the speech bubble can sit
# right on top of him. The same rows for every frame keeps him registered.
KEEP_ROWS = (88, 952)
FRAME_SIZE = (384, 432)

POSES = {"2B-idle": "idle", "2C-talking": "talking", "2D-greeting": "greeting",
         "2E-thinking": "thinking", "2F-writing": "writing"}


def green_mask(a):
    r, g, b = (a[..., i].astype(int) for i in range(3))
    return (g > 150) & (g - r > 80) & (g - b > 80)


def spans(fraction, n):
    """Cells between the green bands along one axis."""
    idx = np.where(fraction > 0.5)[0]
    bands = []
    for i in idx:
        if bands and i <= bands[-1][1] + 2:
            bands[-1][1] = i
        else:
            bands.append([i, i])
    edges = [-1] + [x for b in bands for x in b] + [n]
    gaps = [(edges[i] + 1, edges[i + 1]) for i in range(0, len(edges) - 1, 2)]
    return [(s, e) for s, e in gaps if e - s > 50]


def cells(path):
    a = np.array(Image.open(path).convert("RGB"))
    gm = green_mask(a)
    rows, cols = spans(gm.mean(1), a.shape[0]), spans(gm.mean(0), a.shape[1])
    return [a[r0 + 4:r1 - 3, c0 + 4:c1 - 3] for r0, r1 in rows for c0, c1 in cols]


def clean(cell):
    cell = cell.copy()
    cell[green_mask(cell)] = 0
    return Image.fromarray(cell).convert("L")


def save(img, path, size):
    img = img.resize(size, Image.LANCZOS).point(lambda v: int(round(v / 255 * 7)) * 255 // 7)
    img.save(path, optimize=True)


os.makedirs(os.path.join(OUT, "bartender"), exist_ok=True)
for sheet, pose in POSES.items():
    frames = cells(os.path.join(SRC, sheet + ".png"))
    assert len(frames) == 4, f"{sheet}: expected 4 frames, found {len(frames)}"
    for i, f in enumerate(frames):
        assert f.shape[0] >= KEEP_ROWS[1], f"{sheet}: frame shorter than expected"
        save(clean(f[KEEP_ROWS[0]:KEEP_ROWS[1]]), os.path.join(OUT, "bartender", f"{pose}-{i + 1}.png"), FRAME_SIZE)

logos = cells(os.path.join(SRC, "1-logo.png"))
assert len(logos) == 2, f"logo: expected 2 cells, found {len(logos)}"
# Only the first (dripping) logo is used; the owner preferred it on phones too.
for cell, name in zip(logos[:1], ["logo"]):
    g = np.array(clean(cell))
    ys, xs = np.where(g > 60)
    pad = 12
    crop = Image.fromarray(g[max(0, ys.min() - pad):ys.max() + pad, max(0, xs.min() - pad):xs.max() + pad])
    save(crop, os.path.join(OUT, name + ".png"), (1000, round(crop.height * 1000 / crop.width)))

print("Cut 20 bartender frames and the logo into", OUT)
