#!/usr/bin/env node
// ─── Let's Do Shots! — art import ────────────────────────────────────────────
//
// Cuts the owner's sheets out of his working folder into public/popup/art/shots
// and writes the one thing that cannot be derived at runtime: where each guest's
// speech bubble is.
//
// The sheets are RULED. He draws a bright green line between the bottles and a
// magenta line between the guest panels, so unlike the Tiki Wars sheets — whose
// frames have to be found by tracing blobs, see scripts/tiki-art.mjs — the cuts
// here are found by looking for the rules. That is exact, and no artwork can
// break it by touching a cell edge.
//
// Three kinds of source, three treatments:
//
//   1. BOTTLE SPRITES — one 5x2 sheet on magenta with green rules, each bottle
//      captioned with its name. The cell is cut, the magenta keyed out, the
//      caption dropped (it labels the sheet for a human; it is not part of the
//      sprite), then trimmed to the bottle.
//
//   2. GUEST PANELS — 22 sheets, each three full-bleed scenes (ordering, angry,
//      delighted) split by magenta rules. Scenes, not sprites: nothing is keyed
//      out. Each carries an EMPTY speech bubble whose position moves from sheet
//      to sheet, so its rectangle is measured here and written to guestArt.ts.
//
//   3. BARTENDER PANELS — full scenes, lettered already. Cut down, nothing else.
//
// Everything is written as a PALETTE png. The art is flat-shaded pixel work, so
// 128 colours is visually lossless on it and cuts a guest panel from 530KB to
// about 50 — which is the difference between a stage's art arriving before the
// guest has finished reading the quip and arriving after they have given up.
//
// Usage:  node scripts/shots-art.mjs [--dry]

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";

const ROOT = path.join(os.homedir(), "Desktop", "Game Assets", "Shots");
const DEST = path.join(process.cwd(), "public", "popup", "art", "shots");
const GEN = path.join(process.cwd(), "src", "components", "popup", "games", "shots", "guestArt.ts");

/**
 * The ten bottles in the order they are drawn: left to right, top row first.
 * This list IS the contract with the sheet — if it is ever redrawn in a
 * different order, this is the one line that changes.
 */
const BOTTLE_ORDER = [
  "bourbon", "gin", "tequila", "scotch", "rum",
  "chartreuse", "amaro", "aperitivo", "liqueur", "malort",
];

/** The three panels on a guest sheet, left to right. */
const GUEST_PANELS = ["order", "mad", "happy"];

/**
 * How far into a cell to step before reading it.
 *
 * The rules are cleanly detected, but they are ANTI-ALIASED: a couple of pixels
 * either side are a blend of rule and background that is neither green enough
 * nor magenta enough for either test. Left in, that fringe survives the key as
 * a hairline of content along the cell's top edge — and the caption finder then
 * sees hairline, gap, bottle, decides the bottle is the caption, and erases it.
 * Three bottles came through as 7px-tall slivers before this existed.
 */
const RULE_FRINGE = 5;

// ─── Pixels ──────────────────────────────────────────────────────────────────

/** Read an image as flat RGBA. */
async function readRGBA(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, data };
}

/** Copy a rectangle out. */
function crop(img, x0, y0, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = y0 + y;
    if (sy < 0 || sy >= img.h) continue;
    for (let x = 0; x < w; x++) {
      const sx = x0 + x;
      if (sx < 0 || sx >= img.w) continue;
      const si = (sy * img.w + sx) * 4, di = (y * w + x) * 4;
      out[di] = img.data[si]; out[di+1] = img.data[si+1];
      out[di+2] = img.data[si+2]; out[di+3] = img.data[si+3];
    }
  }
  return { w, h, data: out };
}

/**
 * Encode: resize to a height, quantise, write.
 *
 * lanczos3 rather than nearest: the source is pixel art drawn at roughly 4x, so
 * every logical pixel is a block of sixteen and a filtered reduction lands back
 * on clean blocks. Nearest-neighbour at a non-integer ratio drops rows out of
 * those blocks instead, which is what makes a downscaled pixel sprite shimmer.
 */
async function encode(file, img, targetH, colors) {
  return sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } })
    .resize({ height: Math.min(targetH, img.h), kernel: "lanczos3", withoutEnlargement: true })
    .png({ palette: true, colors, dither: 0.6, effort: 10, compressionLevel: 9 })
    .toFile(file);
}

// ─── Finding the rules ───────────────────────────────────────────────────────
//
// Both key colours are tested by RELATIVE channel order, not absolute
// brightness. Across the 22 guest sheets the divider magenta runs from a hot
// (215,20,140) to a muddy (141,19,75); what they all share is green sitting
// well below both red and blue. That is also true of the rule's blended edge,
// so the whole rule is caught rather than just its core.

const isMagenta = (r, g, b) => r > 95 && g < r * 0.55 && b > r * 0.3 && b < r * 0.85 && g < b - 15;
const isGreen = (r, g, b) => g > 130 && r < g - 45 && b < g - 45;

/** Rows or columns that are mostly `test`, as [start, end] runs. */
function ruleRuns(img, test, axis, minFrac = 0.55) {
  const { w, h, data } = img;
  const n = axis === "col" ? w : h, across = axis === "col" ? h : w;
  const hit = [];
  for (let i = 0; i < n; i++) {
    let count = 0, total = 0;
    for (let j = 0; j < across; j += 2) {
      const x = axis === "col" ? i : j, y = axis === "col" ? j : i;
      const p = (y * w + x) * 4;
      total++;
      if (test(data[p], data[p+1], data[p+2])) count++;
    }
    hit.push(count / total > minFrac);
  }
  const runs = []; let s = -1;
  for (let i = 0; i <= n; i++) {
    const on = i < n && hit[i];
    if (on && s < 0) s = i;
    else if (!on && s >= 0) { runs.push([s, i - 1]); s = -1; }
  }
  // A sheet is ruled around its border as well as between its cells, and a
  // border is not a divider — counting one as such produces an empty first cell.
  return runs.filter(([a, b]) => a > 4 && b < n - 5);
}

/**
 * Cell boundaries along one axis.
 *
 * Falls back to an even split when the expected number of rules is not found,
 * so a sheet delivered without its guides still imports — visibly wrong at the
 * seams, which is a much better failure than nothing at all.
 */
function bandsFor(img, test, axis, expected, label) {
  const n = axis === "col" ? img.w : img.h;
  let rules = ruleRuns(img, test, axis);
  if (rules.length !== expected - 1) {
    // Keep only the run nearest each nominal boundary. On a guest sheet the
    // picture itself — neon, a red banquette — can read as a rule on its own.
    const found = [];
    for (let k = 1; k < expected; k++) {
      const nom = Math.round((n * k) / expected);
      const near = rules.filter(([a, b]) => b >= nom - 40 && a <= nom + 40);
      if (near.length) found.push([Math.min(...near.map((r) => r[0])), Math.max(...near.map((r) => r[1]))]);
    }
    if (found.length === expected - 1) rules = found;
  }
  if (rules.length !== expected - 1) {
    console.log(`  WARNING  ${label}: ${rules.length} rule(s) on the ${axis} axis, expected ${expected - 1} — splitting evenly`);
    const bands = [];
    for (let k = 0; k < expected; k++) {
      bands.push([Math.round((n * k) / expected) + 6, Math.round((n * (k + 1)) / expected) - 6]);
    }
    return bands;
  }
  rules.sort((a, b) => a[0] - b[0]);
  const bands = [];
  let from = 0;
  for (const [a, b] of rules) { bands.push([from, a - 1]); from = b + 1; }
  bands.push([from, n - 1]);
  return bands;
}

// ─── Chroma ──────────────────────────────────────────────────────────────────
// Same approach as tiki-art.mjs; the reasoning is written out there.

/** Flood the key inward from the border. Connected, so interior highlights live. */
function cutMagenta(img) {
  const { w, h, data } = img;
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p]) return;
    const i = p * 4;
    if (!isMagenta(data[i], data[i+1], data[i+2])) return;
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
  return cut;
}

/**
 * Key colour the flood could not reach — pockets the artwork encloses, and the
 * blended fringe just outside the fill's reach.
 *
 * Stricter than the flood's test because it ignores connectivity: the purple
 * Liqueur bottle is the closest thing on the sheet to the key, and it has to
 * survive this untouched.
 */
function killStrays(img) {
  const { w, h, data } = img;
  let cut = 0;
  for (let i = 0; i < w * h; i++) {
    const j = i * 4;
    if (data[j + 3] === 0) continue;
    const r = data[j], g = data[j+1], b = data[j+2];
    if (r > 150 && b > 95 && g < 95 && r - g > 85 && b - g > 45) { data[j + 3] = 0; cut++; continue; }
    if (isGreen(r, g, b)) { data[j + 3] = 0; cut++; }
  }
  return cut;
}

/** Pull the key's cast out of the rim the cut leaves behind. */
function despill(img, reach = 2) {
  const { w, h, data } = img;
  const near = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] !== 0) continue;
      for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          near[ny * w + nx] = 1;
        }
      }
    }
  }
  let fixed = 0;
  for (let i = 0; i < w * h; i++) {
    if (!near[i]) continue;
    const j = i * 4;
    if (data[j + 3] === 0) continue;
    const r = data[j], g = data[j+1], b = data[j+2];
    const cast = Math.min(r, b) - g;
    if (cast > 10) { data[j] = Math.max(g, r - cast); data[j + 2] = Math.max(g, b - cast); fixed++; }
  }
  return fixed;
}

// ─── The printed name under each bottle ──────────────────────────────────────

/**
 * Erase everything below the first run of non-empty rows.
 *
 * Found structurally — bottle, gap, caption — rather than by colour: the labels
 * ON the bottles are white lettering too, and a colour test would take those
 * with it. The largest run is used as the anchor rather than the first, so a
 * stray speck of surviving fringe cannot be mistaken for the bottle.
 */
function dropCaption(img) {
  const { w, h, data } = img;
  const rowHas = [];
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 24) n++;
    rowHas.push(n > 2);
  }
  const runs = []; let s = -1;
  for (let y = 0; y <= h; y++) {
    const on = y < h && rowHas[y];
    if (on && s < 0) s = y;
    else if (!on && s >= 0) { runs.push([s, y - 1]); s = -1; }
  }
  if (runs.length < 2) return 0;
  let main = runs[0];
  for (const r of runs) if (r[1] - r[0] > main[1] - main[0]) main = r;
  let cut = 0;
  for (let y = 0; y < h; y++) {
    if (y >= main[0] && y <= main[1]) continue;
    for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 0) { data[(y * w + x) * 4 + 3] = 0; cut++; }
  }
  return cut;
}

/** Crop to the opaque content, with a little breathing room. */
function trimToContent(img, pad = 3) {
  const { w, h, data } = img;
  let minx = w, maxx = -1, miny = h, maxy = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 24) {
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
    }
  }
  if (maxx < 0) return img;
  minx = Math.max(0, minx - pad); miny = Math.max(0, miny - pad);
  maxx = Math.min(w - 1, maxx + pad); maxy = Math.min(h - 1, maxy + pad);
  return crop(img, minx, miny, maxx - minx + 1, maxy - miny + 1);
}

// ─── The speech bubble ───────────────────────────────────────────────────────

/**
 * Where a panel's empty speech bubble is, as fractions of the panel.
 *
 * Found by MODAL COLOUR rather than by matching a fixed cream: across the cast
 * the fill runs from (243,229,209) to (212,184,151), so any absolute threshold
 * that catches the pale bubbles misses the warm ones outright. What holds for
 * all of them is that the bubble is easily the most common single colour in the
 * top quarter of the panel — it is a large flat shape and everything else up
 * there is texture. So the mode of that band is the fill, and the largest blob
 * of it is the bubble.
 *
 * Two rectangles come back. `shape` is the whole bounding box, tail included.
 * `text` is where the game may actually set type: the INTERSECTION of the
 * bubble's rows across its upper body, so it is guaranteed to sit inside the
 * rounded outline and clear of the tail hanging off the bottom.
 */
function bubbleRects(img, x0, x1) {
  const { w, h, data } = img, pw = x1 - x0 + 1;
  const tally = new Map();
  for (let y = Math.round(h * 0.03); y < Math.round(h * 0.25); y += 2) {
    for (let x = x0 + Math.round(pw * 0.10); x < x0 + Math.round(pw * 0.80); x += 2) {
      const i = (y * w + x) * 4;
      const k = `${data[i] >> 3},${data[i+1] >> 3},${data[i+2] >> 3}`;
      tally.set(k, (tally.get(k) || 0) + 1);
    }
  }
  let bestKey = null, bestN = 0;
  for (const [k, n] of tally) if (n > bestN) { bestN = n; bestKey = k; }
  if (!bestKey) return null;
  const [mr, mg, mb] = bestKey.split(",").map((v) => (+v) * 8 + 4);
  const is = (x, y) => {
    const i = (y * w + x) * 4;
    return Math.abs(data[i] - mr) < 26 && Math.abs(data[i+1] - mg) < 26 && Math.abs(data[i+2] - mb) < 26;
  };

  // Only the top of the panel is searched: a tan jacket or a lit tabletop can
  // be a larger flat region than the bubble, and it is always further down.
  const ph = Math.round(h * 0.72);
  const seen = new Uint8Array(pw * ph);
  let best = null;
  for (let sy = 0; sy < ph; sy++) {
    for (let sx = 0; sx < pw; sx++) {
      const p = sy * pw + sx;
      if (seen[p] || !is(x0 + sx, sy)) continue;
      let minx = pw, maxx = -1, miny = ph, maxy = -1, cnt = 0;
      const st = [p]; seen[p] = 1;
      while (st.length) {
        const q = st.pop(), qx = q % pw, qy = (q - qx) / pw;
        cnt++;
        if (qx < minx) minx = qx; if (qx > maxx) maxx = qx;
        if (qy < miny) miny = qy; if (qy > maxy) maxy = qy;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = qx + dx, ny = qy + dy;
          if (nx < 0 || ny < 0 || nx >= pw || ny >= ph) continue;
          const r2 = ny * pw + nx;
          if (!seen[r2] && is(x0 + nx, ny)) { seen[r2] = 1; st.push(r2); }
        }
      }
      if (!best || cnt > best.cnt) best = { minx, maxx, miny, maxy, cnt };
    }
  }
  if (!best) return null;

  // The text box: over the bubble's upper body, the columns MOST rows have in
  // common. Percentiles rather than a strict intersection — one row nicked by
  // the tail of a lantern hanging behind the bubble was enough to squeeze the
  // whole box to a third of its width on one panel, and a box narrow enough to
  // break "Bowie" across two lines is worse than one that overhangs a rounded
  // corner by a pixel.
  const bh = best.maxy - best.miny + 1;
  const from = best.miny + Math.round(bh * 0.16), to = best.miny + Math.round(bh * 0.68);
  const lefts = [], rights = [];
  for (let y = from; y <= to; y++) {
    let a = -1, b = -1;
    for (let x = best.minx; x <= best.maxx; x++) if (is(x0 + x, y)) { if (a < 0) a = x; b = x; }
    if (a < 0) continue;
    lefts.push(a); rights.push(b);
  }
  let left, right;
  if (lefts.length >= 4) {
    lefts.sort((a, b) => a - b);
    rights.sort((a, b) => a - b);
    left = lefts[Math.floor(lefts.length * 0.8)];
    right = rights[Math.floor(rights.length * 0.2)];
  }
  if (left === undefined || right === undefined || right - left < pw * 0.4) {
    left = best.minx + Math.round((best.maxx - best.minx) * 0.10);
    right = best.maxx - Math.round((best.maxx - best.minx) * 0.10);
  }
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const ok = best.maxx - best.minx > pw * 0.4 && bh > h * 0.1 && best.miny < h * 0.3;
  return {
    ok,
    text: { x: r3(left / pw), y: r3(from / h), w: r3((right - left + 1) / pw), h: r3((to - from + 1) / h) },
  };
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const dry = process.argv.includes("--dry");
if (!fs.existsSync(ROOT)) {
  console.error(`No source folder at ${ROOT}`);
  process.exit(1);
}
if (!dry) fs.mkdirSync(DEST, { recursive: true });

const KB = (name) => `  ${(fs.statSync(path.join(DEST, name)).size / 1024).toFixed(0)}KB`;
async function write(name, img, targetH, colors) {
  if (dry) return "";
  await encode(path.join(DEST, name), img, targetH, colors);
  return KB(name);
}

// ── 1. Bottles ──
console.log("Bottles");
const sheetPath = [path.join(ROOT, "Bottle Sprites"), path.join(ROOT, "Bottle Sprites.png")]
  .find((p) => fs.existsSync(p));
if (!sheetPath) {
  console.log("  skip  Bottle Sprites (not found)");
} else {
  const sheet = await readRGBA(sheetPath);
  const cols = bandsFor(sheet, isGreen, "col", 5, "Bottle Sprites");
  const rows = bandsFor(sheet, isGreen, "row", 2, "Bottle Sprites");
  let n = 0;
  for (const [y0, y1] of rows) {
    for (const [x0, x1] of cols) {
      const name = BOTTLE_ORDER[n++];
      if (!name) continue;
      const cell = crop(sheet, x0 + RULE_FRINGE, y0 + RULE_FRINGE,
        x1 - x0 + 1 - RULE_FRINGE * 2, y1 - y0 + 1 - RULE_FRINGE * 2);
      cutMagenta(cell);
      killStrays(cell);
      const caption = dropCaption(cell);
      despill(cell);
      const bottle = trimToContent(cell);
      // 200px for a sprite drawn at ~32 logical px (64 device). Ample headroom
      // for the runtime's own resample, and all ten together are under 100KB.
      const size = await write(`bottle-${name}.png`, bottle, 200, 128);
      console.log(`  bottle-${name}.png`.padEnd(28) +
        `${cell.w}x${cell.h} -> ${bottle.w}x${bottle.h}  caption -${caption}px${size}`);
    }
  }
}

// ── 2. Guests ──
console.log("\nGuests");
const guestDir = path.join(ROOT, "Stage Intro Assets", "Guests");
const guests = [];
if (!fs.existsSync(guestDir)) {
  console.log("  skip  Stage Intro Assets/Guests (not found)");
} else {
  // Sorted by filename so the numbering is stable between runs: a stage picks
  // its guest by index, and a guest who quietly became somebody else between
  // imports would make every saved seed mean something different.
  const files = fs.readdirSync(guestDir).filter((f) => /\.png$/i.test(f) && !f.startsWith(".")).sort();
  for (let gi = 0; gi < files.length; gi++) {
    const f = files[gi];
    const img = await readRGBA(path.join(guestDir, f));
    const cols = bandsFor(img, isMagenta, "col", 3, f);
    const slug = `guest-${String(gi + 1).padStart(2, "0")}`;
    const rects = [];
    let note = "";
    for (let pi = 0; pi < cols.length; pi++) {
      const [x0, x1] = cols[pi];
      const b = bubbleRects(img, x0, x1);
      rects.push(b);
      if (!b || !b.ok) note += `  BUBBLE?${GUEST_PANELS[pi]}`;
      // Panels are scenes: no key to cut, and trimming would eat the frame.
      const panel = crop(img, x0 + 2, 0, x1 - x0 - 3, img.h);
      const size = await write(`${slug}-${GUEST_PANELS[pi]}.png`, panel, 900, 128);
      if (pi === 0) note = `${x1 - x0 + 1}x${img.h}${size}` + note;
    }
    console.log(`  ${slug}`.padEnd(12) + `${f.padEnd(16)} ${note}`);
    guests.push({ slug, rects });
  }
}

// ── 3. Bartender ──
console.log("\nBartender");
const barDir = path.join(ROOT, "Stage Intro Assets", "Bartender");
const BAR_MAP = { "Bartender 1.png": "bartender-ask.png", "Bartender 2.png": "bartender-go.png" };
for (const [from, to] of Object.entries(BAR_MAP)) {
  const p = path.join(barDir, from);
  if (!fs.existsSync(p)) { console.log(`  skip  ${from} (not found)`); continue; }
  const img = await readRGBA(p);
  const size = await write(to, img, 900, 128);
  console.log(`  ${to.padEnd(24)}${img.w}x${img.h}${size}`);
}

// ── 4. The generated bubble table ──
if (guests.length && !dry) {
  const rows = guests.map((g) => {
    const panels = GUEST_PANELS.map((p, i) => {
      const t = g.rects[i]?.text ?? { x: 0.08, y: 0.04, w: 0.74, h: 0.17 };
      return `    ${p}: { x: ${t.x}, y: ${t.y}, w: ${t.w}, h: ${t.h} },`;
    }).join("\n");
    return `  {\n    slug: "${g.slug}",\n${panels}\n  },`;
  }).join("\n");
  const src = `// ─── Let's Do Shots! — guest panels ─────────────────────────────────────────
//
// GENERATED by scripts/shots-art.mjs. Do not edit by hand — re-run the import.
//
// Every guest panel is drawn with an EMPTY speech bubble, and the bubble is in
// a slightly different place on each of the ${guests.length} sheets. These are the rectangles
// the game sets its type into, measured off the artwork at import time and
// expressed as fractions of the panel so they survive any later rescaling.

/** A rectangle inside a panel, 0..1 of that panel's own width and height. */
export interface BubbleRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GuestArt {
  /** File stem under /popup/art/shots/ — \`\${slug}-order.png\` and friends. */
  slug: string;
  /** Ordering their shot, at the top of the stage. */
  order: BubbleRect;
  /** Out of swipes, and still dry. */
  mad: BubbleRect;
  /** Stage cleared, shot in hand. */
  happy: BubbleRect;
}

export const GUESTS: GuestArt[] = [
${rows}
];

export const GUEST_COUNT = GUESTS.length;
`;
  fs.mkdirSync(path.dirname(GEN), { recursive: true });
  fs.writeFileSync(GEN, src);
  console.log(`\n${guests.length} guest(s) -> ${path.relative(process.cwd(), GEN)}`);
}

console.log(dry ? "\n(dry run — nothing written)" : `\nDone -> ${path.relative(process.cwd(), DEST)}`);
