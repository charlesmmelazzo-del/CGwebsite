#!/usr/bin/env python3
"""
Home for the Holidays — cut the owner's ChatGPT art sheets into site assets.

    python3 scripts/holidays-art.py "<folder with the 8 sheets + atlas-manifest.json>"

Uses the measured source_rect for every piece from atlas-manifest.json (the
sheets aren't evenly gridded), keys out the magenta background and green
guide lines with a tolerant classifier, trims, pads each piece onto a
transparent canvas of its intended shape, and writes PNGs (WebP for the big
pictures) to public/popup/holidays/. Needs Pillow + numpy.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "popup" / "holidays"

RANKS = {"a": "A", "j": "J", "q": "Q", "k": "K"}
SUITS = {"spades": "S", "hearts": "H", "diamonds": "D", "clubs": "C"}
GAME_KEYS = {
    "euchre": "euchre", "president": "president", "i_doubt_it": "i-doubt-it", "classic_rummy": "classic-rummy",
    "draw_dominoes": "draw-dominoes", "all_fives": "all-fives", "texas_42": "texas-42", "train_dominoes": "train-dominoes",
    "forbidden_words": "forbidden-words", "word_relay": "word-relay", "fishbowl": "fishbowl", "unique_clues": "unique-clues",
    "massive_decks": "massive-decks", "pass_the_word": "pass-the-word", "word_grid": "word-grid", "five_dice": "five-dice",
    "farkle": "farkle", "shut_the_box": "shut-the-box",
}


def key_out(img: Image.Image) -> Image.Image:
    """Magenta and green → transparent, with a soft edge and despill."""
    a = np.asarray(img.convert("RGB")).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # How magenta / how green each pixel leans (0 = not at all).
    mag = np.clip(np.minimum(r, b) - g, 0, 255)
    grn = np.clip(g - np.maximum(r, b), 0, 255)
    lean = np.maximum(mag, grn).astype(np.float32)
    # Solid background at lean >= 110, fully kept below 40, ramp in between.
    alpha = np.clip(1 - (lean - 40) / 70, 0, 1)
    # Despill: pull leftover magenta/green out of edge pixels.
    out = a.astype(np.float32)
    spill_m = mag > 20
    out[..., 0] = np.where(spill_m, np.minimum(r, g + 30), out[..., 0])
    out[..., 2] = np.where(spill_m, np.minimum(b, g + 30), out[..., 2])
    spill_g = grn > 20
    out[..., 1] = np.where(spill_g, np.minimum(g, np.maximum(r, b) + 20), out[..., 1])
    rgba = np.dstack([np.clip(out, 0, 255), alpha * 255]).astype(np.uint8)
    im = Image.fromarray(rgba)
    # Shave the outermost half-pixel of fringe.
    al = im.getchannel("A").filter(ImageFilter.MinFilter(3))
    im.putalpha(Image.fromarray(np.minimum(np.asarray(al), np.asarray(im.getchannel("A")))))
    return im


def solid_box(im: Image.Image):
    """Bounding box of the art itself, ignoring stray specks of leftover guide colour."""
    a = np.asarray(im.getchannel("A")) > 24
    cols = np.where(a.sum(axis=0) > a.shape[0] * 0.04)[0]
    rows = np.where(a.sum(axis=1) > a.shape[1] * 0.04)[0]
    if not len(cols) or not len(rows):
        return None
    return (int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1)


def fit(im: Image.Image, w: int, h: int, trim=True, pad=0.0) -> Image.Image:
    """Trim transparent edges, then centre on a w×h transparent canvas without stretching."""
    if trim:
        box = solid_box(im)
        if box:
            im = im.crop(box)
    inner_w, inner_h = w * (1 - 2 * pad), h * (1 - 2 * pad)
    scale = min(inner_w / im.width, inner_h / im.height)
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    canvas.paste(im, ((w - im.width) // 2, (h - im.height) // 2), im)
    return canvas


def save(im: Image.Image, rel: str, **kw):
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    if rel.endswith(".webp"):
        im.save(path, "WEBP", quality=86, method=6, **kw)
    else:
        im.save(path, optimize=True, **kw)


def main(folder: Path):
    manifest = json.loads((folder / "atlas-manifest.json").read_text())
    sheets = {s["number"]: s for s in manifest["sheets"]}
    counts = {}

    def pieces(n):
        s = sheets[n]
        src = Image.open(folder / s["file"]).convert("RGB")
        for a in s["assets"]:
            yield a["id"], src.crop(tuple(a["source_rect"]))

    # 1 — card faces, 5:7.
    for aid, crop in pieces(1):
        _, suit, rank = aid.split("-")
        name = RANKS.get(rank, rank.upper()) + SUITS[suit]
        save(fit(key_out(crop), 240, 336), f"cards/{name}.webp")
        counts["cards"] = counts.get("cards", 0) + 1

    # 2 — back, pile, domino back, empty slot, four suit symbols.
    names2 = {"card-back": ("cards/back.webp", 240, 336), "draw-pile": ("cards/pile.webp", 300, 336), "domino-back": ("dominoes/back.webp", 120, 240), "empty-pile": ("cards/empty.webp", 240, 336)}
    for aid, crop in pieces(2):
        if aid.startswith("suit-"):
            save(fit(key_out(crop), 160, 160), f"suits/{aid[5:]}.webp")
        else:
            rel, w, h = names2.get(aid, (f"cards/{aid}.webp", 240, 336))
            save(fit(key_out(crop), w, h), rel)
        counts["pieces"] = counts.get("pieces", 0) + 1

    # 3 — dice, square.
    for aid, crop in pieces(3):
        _, state, face = aid.split("-")
        save(fit(key_out(crop), 160, 160), f"dice/{state}-{face}.webp")
        counts["dice"] = counts.get("dice", 0) + 1

    # 4 — domino halves: keep the whole cell (the 12's lowest pips sit below the cream),
    # back them with cream so nothing shows through, open edge at the bottom.
    for aid, crop in pieces(4):
        keyed = key_out(crop)
        if aid == "domino-divider":
            save(fit(keyed, 200, 40), "dominoes/divider.webp")
            continue
        n = int(aid.split("-")[-1])
        box = keyed.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
        keyed = keyed.crop((box[0], box[1], box[2], keyed.height)) if box else keyed
        cream = Image.new("RGBA", keyed.size, (0, 0, 0, 0))
        # Cream fill under everything inside the outline, extended to the open bottom edge.
        a = np.asarray(keyed.getchannel("A")) > 24
        cols = np.where(a.any(axis=0))[0]
        rows = np.where(a.any(axis=1))[0]
        if len(cols) and len(rows):
            # Match the artwork's own cream (sampled from light pixels in the face).
            px = np.asarray(keyed.convert("RGB")).reshape(-1, 3)
            light = px[(px.min(axis=1) > 200)]
            tone = tuple(int(v) for v in np.median(light, axis=0)) if len(light) else (247, 242, 230)
            fill = Image.new("RGBA", (cols[-1] - cols[0] - 6, keyed.height - rows[0] - 6), (*tone, 255))
            cream.paste(fill, (cols[0] + 3, rows[0] + 3))
        half = Image.alpha_composite(cream, keyed)
        # Halves are nearly square; a square output keeps the open edge flush with the bottom.
        save(half.resize((120, 120), Image.LANCZOS), f"dominoes/half-{n}.webp")
        counts["domino halves"] = counts.get("domino halves", 0) + 1

    # 5 — Shut the Box tiles (open/shut) and the nine letter tiles.
    for aid, crop in pieces(5):
        if aid.startswith("shut-box-open-"):
            save(fit(key_out(crop), 90, 150), f"box/open-{aid.rsplit('-', 1)[1]}.webp")
        elif aid.startswith("shut-box-closed-") or aid.startswith("shut-box-shut-"):
            save(fit(key_out(crop), 90, 150), f"box/shut-{aid.rsplit('-', 1)[1]}.webp")
        else:
            save(fit(key_out(crop), 120, 120), f"letters/{aid.rsplit('-', 1)[1].lower()}.webp")
        counts["tiles"] = counts.get("tiles", 0) + 1

    # 6 — game pictures, 4:5 (olive scenes — keep them square-edged, no trim).
    for aid, crop in pieces(6):
        key = GAME_KEYS[aid.replace("game-picture-", "")]
        save(fit(key_out(crop), 400, 500, trim=True), f"games/{key}.webp")
        counts["game pictures"] = counts.get("game pictures", 0) + 1

    # 7 — page extras, 3:2.
    sizes7 = {"title-home-for-the-holidays": (900, 600), "flourish-divider": (600, 200)}
    for aid, crop in pieces(7):
        w, h = sizes7.get(aid, (360, 240))
        save(fit(key_out(crop), w, h), f"extras/{aid}.webp")
        counts["extras"] = counts.get("extras", 0) + 1

    # 8 — paper texture: used with background-size: cover, so no seam to fix.
    tex = Image.open(folder / sheets[8]["file"]).convert("RGB").resize((900, 900), Image.LANCZOS)
    save(tex, "paper.webp")

    print("Wrote to", OUT.relative_to(ROOT))
    for k, v in counts.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]).expanduser())
