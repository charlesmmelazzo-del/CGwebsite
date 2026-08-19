#!/usr/bin/env node
// ─── Tiki Wars — art import ──────────────────────────────────────────────────
//
// Copies the owner's sprite sheets out of his working folder into
// public/popup/art/tiki/, doing the two things his export cannot:
//
//   1. CUT THE BACKGROUND OUT. His exports are flat RGB with no alpha — the
//      "transparency" checkerboard is baked in as real grey pixels, so dropped
//      in raw every character would render inside a grey checkered box. This
//      flood-fills inward from the border and makes the connected background
//      transparent. It works because the art has a heavy black outline: the
//      fill runs up to the outline and stops, so a white-and-silver bottle
//      keeps its highlights. A flat chroma colour (magenta) is handled too, for
//      future sheets.
//
//   2. STRAIGHTEN THE FRAMES. Within a sheet the character drifts sideways from
//      cell to cell — about 100px across four cells — which reads as a wobble.
//      Each frame is re-centred horizontally on its own pixel centroid.
//      VERTICAL position is left alone: the up-and-down in a walk cycle is the
//      bob, and removing it would make the walk look like a slide.
//
// Usage:  node scripts/tiki-art.mjs [--dry]

import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SRC = path.join(os.homedir(), "Desktop", "Game Assets", "Tiki Wars", "Character Assets");
const DEST = path.join(process.cwd(), "public", "popup", "art", "tiki");

/** His filename -> the name the game's sprite manifest looks for. */
const MAP = {
  "Player Walking Sheet.png": "player.png",     // the 4x1 walk SHEET
  "Player Turn .png": "player-turn.png",
  "Player Turn Shades.png": "player-turn-shades.png",
  "Lime Soldier Sheet.png": "lime.png",
  "Kiwi Soldier Sheet.png": "kiwi.png",
  "Shotgun Arms.png": "gun-shotgun.png",
  "Uzi Arms.png": "gun-uzi.png",
};

/** Overlays keep the body's framing — trimming them would slide the arms off. */
const OVERLAY = { "gun-shotgun.png": true, "gun-uzi.png": true };

/** Sheets that must have their frames straightened, and how many frames. */
const FRAMES = {
  "player.png": 4,
  "lime.png": 4,
  "kiwi.png": 4,
};

// ─── PNG ─────────────────────────────────────────────────────────────────────

function crc32(buf) {
  let c, t = [];
  for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  let crc = 0xffffffff;
  for (const b of buf) crc = t[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function readPNG(file) {
  const b = fs.readFileSync(file);
  let o = 8, ihdr = null; const idat = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o), type = b.toString("ascii", o + 4, o + 8);
    const data = b.subarray(o + 8, o + 8 + len);
    if (type === "IHDR") ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], ctype: data[9], interlace: data[12] };
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    o += 12 + len;
  }
  if (ihdr.depth !== 8 || ihdr.interlace) throw new Error(`${file}: unsupported PNG`);
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ihdr.ctype];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const { w, h } = ihdr, stride = w * ch, out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++], line = raw.subarray(p, p + stride); p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, bb = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += bb; else if (f === 3) v += (a + bb) >> 1;
      else if (f === 4) { const pa = Math.abs(bb - c), pb = Math.abs(a - c), pc = Math.abs(a + bb - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? bb : c; }
      cur[x] = v & 0xff;
    }
  }
  // Normalise everything to RGBA so the rest of the tool has one shape to think about.
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    const s = i * ch;
    if (ch === 4) { rgba[j] = out[s]; rgba[j+1] = out[s+1]; rgba[j+2] = out[s+2]; rgba[j+3] = out[s+3]; }
    else if (ch === 3) { rgba[j] = out[s]; rgba[j+1] = out[s+1]; rgba[j+2] = out[s+2]; rgba[j+3] = 255; }
    else if (ch === 2) { rgba[j] = rgba[j+1] = rgba[j+2] = out[s]; rgba[j+3] = out[s+1]; }
    else { rgba[j] = rgba[j+1] = rgba[j+2] = out[s]; rgba[j+3] = 255; }
  }
  return { w, h, data: rgba, hadAlpha: ch === 4 || ch === 2 };
}

function writePNG(file, w, h, rgba) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;
    rgba.copy(raw, o, y * w * 4, (y + 1) * w * 4);
    o += w * 4;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]));
}

// ─── Background removal ──────────────────────────────────────────────────────

/**
 * Is this pixel part of the background?
 *
 * Two shapes are accepted. A CHECKERBOARD is light and unsaturated — the two
 * greys the export bakes in. A CHROMA key is a flat saturated colour, which is
 * what future sheets should use (magenta) because it can never be confused with
 * anything in the artwork.
 */
function bgTest(img) {
  // Sample the border to work out which we are dealing with.
  const { w, h, data } = img;
  let mag = 0, grey = 0, n = 0;
  const look = (x, y) => {
    const i = (y * w + x) * 4, r = data[i], g = data[i+1], b = data[i+2];
    n++;
    if (r > 150 && g < 110 && b > 150) mag++;
    else if (Math.max(r,g,b) - Math.min(r,g,b) < 26 && Math.max(r,g,b) > 200) grey++;
  };
  for (let x = 0; x < w; x += 4) { look(x, 0); look(x, h - 1); }
  for (let y = 0; y < h; y += 4) { look(0, y); look(w - 1, y); }

  if (mag / n > 0.6) {
    return { kind: "chroma", is: (r, g, b) => r > 140 && g < 120 && b > 140 };
  }
  return { kind: "checkerboard", is: (r, g, b) =>
    Math.max(r,g,b) - Math.min(r,g,b) < 26 && Math.max(r,g,b) > 196 };
}

/**
 * Flood fill the background from the border inward.
 *
 * Connected-from-the-edge, NOT a global colour match. That distinction is the
 * whole reason this is safe on a white-and-silver bottle: the interior
 * highlights are the same brightness as the checkerboard, but they are walled
 * off by the character's black outline, so the fill never reaches them.
 */
function cutBackground(img) {
  const { w, h, data } = img;
  const test = bgTest(img);
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p]) return;
    const i = p * 4;
    if (!test.is(data[i], data[i+1], data[i+2])) return;
    seen[p] = 1; stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }

  while (stack.length) {
    const p = stack.pop(), x = p % w, y = (p - x) / w;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }

  let cut = 0;
  for (let p = 0; p < w * h; p++) if (seen[p]) { data[p * 4 + 3] = 0; cut++; }
  return { kind: test.kind, cut, total: w * h };
}

// ─── Frame straightening ─────────────────────────────────────────────────────

/** Horizontal centroid of the opaque pixels in a cell. */
function centroidX(img, x0, cw) {
  const { w, h, data } = img;
  let sum = 0, n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = x0; x < x0 + cw; x++) {
      const a = data[(y * w + x) * 4 + 3];
      if (a > 40) { sum += x - x0; n++; }
    }
  }
  return n ? sum / n : cw / 2;
}

/** Slide each cell horizontally so its centroid sits at the cell centre. */
function straighten(img, frames) {
  const { w, h, data } = img;
  const cw = Math.floor(w / frames);
  const out = Buffer.alloc(w * h * 4);
  const shifts = [];
  for (let f = 0; f < frames; f++) {
    const x0 = f * cw;
    const shift = Math.round(cw / 2 - centroidX(img, x0, cw));
    shifts.push(shift);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < cw; x++) {
        const src = x - shift;
        if (src < 0 || src >= cw) continue;
        const si = (y * w + x0 + src) * 4, di = (y * w + x0 + x) * 4;
        out[di] = data[si]; out[di+1] = data[si+1]; out[di+2] = data[si+2]; out[di+3] = data[si+3];
      }
    }
  }
  return { data: out, shifts };
}

// ─── Trim ────────────────────────────────────────────────────────────────────

/**
 * Crop the dead margin off a sheet.
 *
 * The game sizes a sprite by the HEIGHT OF ITS CELL, so empty space inside the
 * cell shrinks the character: the hero filled 73% of his cell and the lime only
 * 52%, which is why the first import drew everyone far too small for the sizes
 * in the design doc.
 *
 * Cropping is done ONCE for the whole sheet, not per cell, and that matters:
 *   * VERTICALLY, the union of every frame is used, so the up-and-down bob of a
 *     walk cycle is preserved. Trimming each frame to its own feet would flatten
 *     the walk into a slide.
 *   * HORIZONTALLY, the widest frame sets the cell width and every cell keeps
 *     its centre, so the frames stay registered with each other.
 */
function trim(img, frames, pad = 4) {
  const { w, h, data } = img;
  const cw = Math.floor(w / frames);
  const A = (x, y) => data[(y * w + x) * 4 + 3];

  let top = h, bot = -1, halfW = 0;
  for (let f = 0; f < frames; f++) {
    const x0 = f * cw, mid = x0 + cw / 2;
    for (let y = 0; y < h; y++) {
      for (let x = x0; x < x0 + cw; x++) {
        if (A(x, y) > 24) {
          if (y < top) top = y;
          if (y > bot) bot = y;
          const d = Math.abs(x + 0.5 - mid);
          if (d > halfW) halfW = d;
        }
      }
    }
  }
  if (bot < 0) return img;

  top = Math.max(0, top - pad);
  bot = Math.min(h - 1, bot + pad);
  const newCW = Math.min(cw, Math.ceil((halfW + pad) * 2));
  const newH = bot - top + 1;
  const out = Buffer.alloc(newCW * frames * newH * 4);
  const outW = newCW * frames;

  for (let f = 0; f < frames; f++) {
    const srcMid = f * cw + cw / 2;
    const srcX0 = Math.round(srcMid - newCW / 2);
    for (let y = 0; y < newH; y++) {
      for (let x = 0; x < newCW; x++) {
        const sx = srcX0 + x, sy = top + y;
        if (sx < 0 || sx >= w) continue;
        const si = (sy * w + sx) * 4, di = (y * outW + f * newCW + x) * 4;
        out[di] = data[si]; out[di+1] = data[si+1]; out[di+2] = data[si+2]; out[di+3] = data[si+3];
      }
    }
  }
  return { w: outW, h: newH, data: out, hadAlpha: true };
}

// ─── Downscale ───────────────────────────────────────────────────────────────

/**
 * Target height for an imported sheet, in pixels.
 *
 * The biggest thing on screen is the hero at 84 logical px, which is 168 device
 * pixels at PIXEL_SCALE 2. The source art is 1536 tall — nine times more than
 * can ever be shown. Shipping that to a phone at a bar is megabytes of detail
 * the screen physically cannot render, so it is boxed down to roughly 1.7x the
 * largest size it will be drawn at, which is enough headroom for the runtime
 * depth-bucket resampling to stay crisp.
 */
const TARGET_H = 384;

/**
 * Box-filter downscale, averaging RGB WEIGHTED BY ALPHA.
 *
 * This weighting is the whole trick. Cutting the background leaves those pixels
 * transparent but their RGB still holds the old checkerboard grey. A naive
 * average would pull that grey into every edge and ring each character with a
 * pale halo. Weighting by alpha means fully transparent pixels contribute
 * nothing at all to the colour.
 */
function downscale(img, targetH) {
  const { w, h, data } = img;
  if (h <= targetH) return img;
  const scale = targetH / h;
  const nw = Math.max(1, Math.round(w * scale)), nh = targetH;
  const out = Buffer.alloc(nw * nh * 4);

  for (let y = 0; y < nh; y++) {
    const y0 = Math.floor((y * h) / nh), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * h) / nh));
    for (let x = 0; x < nw; x++) {
      const x0 = Math.floor((x * w) / nw), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * w) / nw));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * w + sx) * 4, al = data[i + 3];
          r += data[i] * al; g += data[i + 1] * al; b += data[i + 2] * al;
          a += al; n++;
        }
      }
      const di = (y * nw + x) * 4;
      if (a > 0) { out[di] = Math.round(r / a); out[di+1] = Math.round(g / a); out[di+2] = Math.round(b / a); }
      out[di + 3] = Math.round(a / n);
    }
  }
  return { w: nw, h: nh, data: out, hadAlpha: true };
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const dry = process.argv.includes("--dry");
if (!fs.existsSync(SRC)) { console.error("Source folder not found:\n  " + SRC); process.exit(1); }
fs.mkdirSync(DEST, { recursive: true });

let done = 0;
for (const [from, to] of Object.entries(MAP)) {
  const src = path.join(SRC, from);
  if (!fs.existsSync(src)) { console.log(`  skip  ${from}  (not found)`); continue; }

  const img = readPNG(src);
  const cutInfo = img.hadAlpha ? { kind: "already had alpha", cut: 0 } : cutBackground(img);
  let shifts = null;
  // Straighten BEFORE downscaling, so the shift is measured at full resolution.
  if (FRAMES[to]) ({ data: img.data, shifts } = straighten(img, FRAMES[to]));

  const srcW = img.w, srcH = img.h;
  // Weapon overlays are NOT trimmed: they have to keep the same framing as the
  // body they sit on top of, and cropping them to their own content would slide
  // the arms off the character.
  const trimmed = OVERLAY[to] ? img : trim(img, FRAMES[to] ?? 1);
  const small = downscale(trimmed, TARGET_H);

  if (!dry) writePNG(path.join(DEST, to), small.w, small.h, small.data);
  done++;
  const bytes = dry ? 0 : fs.statSync(path.join(DEST, to)).size;
  console.log(
    `  ${to.padEnd(24)} ${srcW}x${srcH} -> ${small.w}x${small.h}` +
    (OVERLAY[to] ? "  [overlay: untrimmed]" : "") +
    `  bg:${cutInfo.kind}` +
    (shifts ? `  recentred [${shifts.join(", ")}]px` : "") +
    (bytes ? `  ${(bytes / 1024).toFixed(0)}KB` : "")
  );
}
console.log(`\n${done} file(s)${dry ? " (dry run — nothing written)" : ` -> ${path.relative(process.cwd(), DEST)}`}`);
