#!/usr/bin/env node
/**
 * Passport home-screen icons: a small passport booklet with the Common Good logo on the cover, in brass.
 *
 *     node scripts/passport-icon.mjs
 *
 * Source: scripts/passport-icon/cg-logo-hand.png (the owner's logo, black line art on white) and
 * scripts/passport-icon/passport-word.txt (the "PASSPORT" lettering as an SVG path, from file 16).
 * Writes the committed icons to public/passport/icons/ (and the older addresses in public/passport/), so the app
 * never fetches the original at run time. Uses sharp, already a dependency.
 *
 * The white background becomes transparent and the line art is recoloured to the Passport brass. Lines are thickened
 * a little for each size so the drawing does not fade to nothing when it is small. Under 256px the lettering would be
 * unreadable, so those sizes (and the maskable icon, which phones show small) carry the hand and wormwood only; the
 * 512px icon carries the full logo with "COMMON GOOD / COCKTAIL HOUSE".
 */
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "passport-icon");
const PUB = join(HERE, "..", "public", "passport");
const OUT = join(PUB, "icons");

// The Passport palette (src/components/passport/theme.ts and the file 16 booklet).
const BG = "#13170F";
const BRASS = "#C9A96E"; // C.brass / BRASS in src/lib/passport/accents.ts
const PAGE = "#E9E1CB";
const COVER = "#2A3B2C";
const SPINE = "#1C281E";
const STITCH = "#3B5040";
const MASKABLE_SCALE = 0.78; // keeps the booklet inside the central 80% safe zone

const WORD = readFileSync(join(SRC, "passport-word.txt"), "utf8").trim();

/** The booklet, drawn in 512 design units: pages behind, the dark cover, the spine band and "PASSPORT". */
const booklet = () => `
  <rect x="148.0" y="95.0" width="236.0" height="322.0" rx="20.0" fill="${PAGE}" opacity="0.55"/>
  <rect x="143.0" y="91.5" width="236.0" height="329.0" rx="20.0" fill="${PAGE}"/>
  <rect x="138.0" y="88.0" width="236.0" height="336.0" rx="20.0" fill="${COVER}"/>
  <path d="M158.0,88.0 H168.0 V424.0 H158.0 A20.0,20.0 0 0 1 138.0,404.0 V108.0 A20.0,20.0 0 0 1 158.0,88.0 Z" fill="${SPINE}"/>
  <rect x="168.0" y="88.0" width="2.2" height="336.0" fill="${STITCH}"/>
  <path d="${WORD}" fill="${BRASS}"/>`;

/** Where the logo sits on the cover (512 design units): a box, centred, the mark fitted inside it. */
const BOX = {
  hand: { cx: 268, cy: 204, w: 166, h: 186 },
  full: { cx: 271, cy: 203, w: 178, h: 170 },
};

// ---- The logo as ink (0 = paper, 255 = line), split into hand and lettering ------------------------------------
const { data: grey, info } = await sharp(join(SRC, "cg-logo-hand.png")).greyscale().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
if (info.channels !== 1) throw new Error("expected one channel");
const ink = new Uint8Array(W * H);
// Levels: paper and faint speckle go fully transparent, the antialiased edges of each line stay soft.
for (let i = 0; i < W * H; i++) ink[i] = Math.max(0, Math.min(255, Math.round(((255 - grey[i]) - 24) * 255 / 196)));
// The lettering arches over the top; the hand starts below it, except the raised index fingertip, which reaches up
// between "COCKTAIL" and "HOUSE" (measured on the 1000px source).
const isHand = (x, y) => y * 1000 / H >= 404 || (y * 1000 / H >= 340 && x * 1000 / W >= 425 && x * 1000 / W <= 580);
const handInk = new Uint8Array(W * H), wordInk = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x;
  (isHand(x, y) ? handInk : wordInk)[i] = ink[i];
}

const bbox = (a) => {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (a[y * W + x] > 40) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
};

/** Greyscale dilation with a round brush: thickens lines and keeps their soft edges. */
function dilate(a, r) {
  if (r <= 0) return a;
  const offs = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r) offs.push([dx, dy]);
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let m = 0;
    for (const [dx, dy] of offs) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const v = a[yy * W + xx];
      if (v > m) { m = v; if (m === 255) break; }
    }
    out[y * W + x] = m;
  }
  return out;
}

const HAND_STROKE = 2.5; // the hand's line width in the source, in px
const dilateCache = new Map();
const dilated = (which, r) => {
  const k = `${which}:${r}`;
  if (!dilateCache.has(k)) dilateCache.set(k, dilate(which === "hand" ? handInk : wordInk, r));
  return dilateCache.get(k);
};

/**
 * The brass mark, `variant` ("hand" or "full") fitted to a box `bw` x `bh` px, with the hand's lines about
 * `strokePx` wide at that size. Returns an RGBA PNG buffer and its pixel size.
 */
async function mark(variant, bw, bh, strokePx) {
  const b = bbox(variant === "hand" ? handInk : ink);
  const sw = b.x1 - b.x0 + 1, sh = b.y1 - b.y0 + 1;
  const s = Math.min(bw / sw, bh / sh);
  const r = Math.max(0, Math.round((strokePx / s - HAND_STROKE) / 2));
  const hand = dilated("hand", r);
  // The lettering is already bold; it gets at most a hair of extra weight.
  const word = variant === "full" ? dilated("word", Math.min(1, r)) : null;
  const pad = r + 2;
  const cx0 = Math.max(0, b.x0 - pad), cy0 = Math.max(0, b.y0 - pad);
  const cw = Math.min(W, b.x1 + pad + 1) - cx0, ch = Math.min(H, b.y1 + pad + 1) - cy0;
  const crop = Buffer.alloc(cw * ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = (cy0 + y) * W + cx0 + x;
    crop[y * cw + x] = word ? Math.max(hand[i], word[i]) : hand[i];
  }
  const tw = Math.max(1, Math.round(cw * s)), th = Math.max(1, Math.round(ch * s));
  const alpha = await sharp(crop, { raw: { width: cw, height: ch, channels: 1 } })
    .resize(tw, th, { kernel: "lanczos3", fit: "fill" }).extractChannel(0).raw().toBuffer();
  const [R, G, B] = [1, 3, 5].map((o) => parseInt(BRASS.slice(o, o + 2), 16));
  const rgba = Buffer.alloc(tw * th * 4);
  for (let i = 0; i < tw * th; i++) { rgba[i * 4] = R; rgba[i * 4 + 1] = G; rgba[i * 4 + 2] = B; rgba[i * 4 + 3] = alpha[i]; }
  const png = await sharp(rgba, { raw: { width: tw, height: th, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
  return { png, w: tw, h: th };
}

/** One icon: `size` px square, opaque (iOS and Android round or mask the corners themselves). */
async function icon({ size, variant, maskable = false, strokePx }) {
  const m = maskable ? MASKABLE_SCALE : 1;
  const k = (size / 512) * m; // design unit -> px
  const at = (u) => size / 2 + (u - 256) * k;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <rect width="512" height="512" fill="${BG}"/>
  <g transform="translate(256 256) scale(${m}) translate(-256 -256)">${booklet()}</g></svg>`;
  const box = BOX[variant];
  const mk = await mark(variant, box.w * k, box.h * k, strokePx);
  const left = Math.round(at(box.cx) - mk.w / 2), top = Math.round(at(box.cy) - mk.h / 2);
  const png = await sharp(Buffer.from(svg)).composite([{ input: mk.png, left, top }])
    .flatten({ background: BG }).removeAlpha().png({ compressionLevel: 9 }).toBuffer();
  return { png, svg, mk, box };
}

/** The same design as an SVG (the mark embedded as a PNG), kept beside the PNGs as the editable picture. */
async function svgFile({ variant, maskable = false }) {
  const m = maskable ? MASKABLE_SCALE : 1;
  const box = BOX[variant];
  // Drawn for a 512px rendering, at twice that resolution so it stays crisp when scaled up.
  const mk = await mark(variant, box.w * m * 2, box.h * m * 2, (variant === "full" ? 1.6 : 1.5) * 2);
  const w = mk.w / 2 / m, h = mk.h / 2 / m;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="${BG}"/>
  <g transform="translate(256 256) scale(${m}) translate(-256 -256)">${booklet()}
  <image x="${(box.cx - w / 2).toFixed(1)}" y="${(box.cy - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" xlink:href="data:image/png;base64,${mk.png.toString("base64")}"/>
  </g>
</svg>
`;
}

const SIZES = [
  // Under 256px: the hand and wormwood only; the lettering would be a blur.
  { file: "apple-touch-icon.png", size: 180, variant: "hand", strokePx: 1.1 },
  { file: "icon-192.png", size: 192, variant: "hand", strokePx: 1.1 },
  // 512: the full logo, lettering and all (install sheets and splash screens show it large).
  { file: "icon-512.png", size: 512, variant: "full", strokePx: 1.6 },
  // Maskable: launchers show it at home-screen size, so the hand only, inside the safe zone.
  { file: "icon-maskable-512.png", size: 512, variant: "hand", maskable: true, strokePx: 1.5 },
];

for (const s of SIZES) {
  const { png } = await icon(s);
  writeFileSync(join(OUT, s.file), png);
  const meta = await sharp(png).metadata();
  console.log(`${s.file}: ${meta.width}x${meta.height}, ${meta.channels} channels, ${png.length} bytes`);
}
// The addresses phones that installed Passport before file 16 still hold: the same pictures.
for (const f of ["apple-touch-icon.png", "icon-192.png", "icon-512.png"]) copyFileSync(join(OUT, f), join(PUB, f));
writeFileSync(join(OUT, "icon.svg"), await svgFile({ variant: "full" }));
writeFileSync(join(OUT, "icon-maskable.svg"), await svgFile({ variant: "hand", maskable: true }));
console.log("icon.svg, icon-maskable.svg written");

// The hand alone, for the app's own header and Home button: white lines on transparent, used as a CSS mask so the
// app can colour it (brass in the header, dark green on the brass Home button). Drawn at 3x the size it is shown on
// a phone (38px tall), so a 3x screen shows it pixel for pixel, with fine lines (about 1px at that size) so it
// stays crisp rather than soft.
{
  const mk = await mark("hand", 38 * 3 * (138 / 167), 38 * 3, 1.0 * 3);
  const { data, info: mi } = await sharp(mk.png).raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < mi.width * mi.height; i++) { data[i * 4] = 255; data[i * 4 + 1] = 255; data[i * 4 + 2] = 255; }
  const png = await sharp(data, { raw: { width: mi.width, height: mi.height, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(join(OUT, "hand-mark.png"), png);
  console.log(`hand-mark.png: ${mi.width}x${mi.height}, ${png.length} bytes`);
}
