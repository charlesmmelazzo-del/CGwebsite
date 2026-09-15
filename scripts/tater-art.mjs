#!/usr/bin/env node
// ─── Tater Tales — art import ────────────────────────────────────────────────
//
// Cuts the owner's sheets out of ~/Desktop/Game Assets/Tater Tales into
// public/popup/art/tater, and writes src/components/popup/games/tater/artManifest.ts
// so the game knows every strip's frame size and where its feet are.
//
// The sheets follow docs/tater-tales-prompts.md: magenta #FF00FF background,
// bright green rules between equal cells. Rules are found by looking for them,
// so a sheet drawn slightly off an even grid still cuts cleanly.
//
// Three treatments:
//
//   1. ANIMATION ROWS (6 × 4 sheets). Magenta keyed out, every frame of a row
//      cropped to ONE shared box so the character keeps the position it was
//      drawn at in its cell — cropping each frame to its own artwork makes a
//      character hop sideways whenever an arm goes up. Then shrunk to its
//      in-game size and snapped to hard alpha.
//   2. TILES (3 × 3 sheets). Already true pixel art at 6 image pixels per art
//      pixel, so they are sampled nearest-neighbour back down to 1:1.
//   3. CUTSCENES. Full pictures, nothing keyed, shrunk and palettised.
//
// Usage:  node scripts/tater-art.mjs [--dry]

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";

const ROOT = path.join(os.homedir(), "Desktop", "Game Assets", "Tater Tales");
const DEST = path.join(process.cwd(), "public", "popup", "art", "tater");
const MANIFEST = path.join(process.cwd(), "src", "components", "popup", "games", "tater", "artManifest.ts");
const DRY = process.argv.includes("--dry");

/** Must match PIXEL_SCALE in tater/constants.ts: art is written at device resolution. */
const PIXEL_SCALE = 3;

// ─── What is on each sheet ───────────────────────────────────────────────────
//
// `h` is the in-game height, in logical pixels, of the row's MAIN character in
// frame one — the importer measures that character and scales the whole row to
// match, so a sheet drawn with a big Tater and a sheet drawn with a small one
// both come out the same size in game.
//
// A row can be split: `split: [["a", 2], ["b", 2], ["c", 2]]` cuts it into
// separate strips of that many frames, each with its own box.

const ELMER = 32;
const ALLIE = 36;
const TATER = 74;
const BOTTLE = 32;
const PET = 13;

const SHEETS = [
  {
    file: "elmer-mixey-animation-01-v1.png",
    rows: [
      { name: "elmer-shake", h: ELMER },
      { name: "elmer-blast", h: ELMER, scaleFrom: [0, 0] },
      { split: [["elmer-fly-up", 2], ["elmer-fly-diag", 2], ["elmer-fly-side", 2]], h: ELMER, scaleFrom: [0, 0], anchor: "centre" },
      { name: "elmer-land", h: ELMER, scaleFrom: [0, 0] },
    ],
  },
  {
    file: "elmer-mixey-guillermo-animation-02-v1.png",
    rows: [
      { name: "elmer-fall", h: 29, scaleFrom: [3, 0], anchor: "centre" },
      { name: "elmer-thud", h: 29, scaleFrom: [3, 0], ref: 5 },
      { name: "guillermo-luck", h: BOTTLE },
      { name: "elmer-react", h: 29, scaleFrom: [3, 0] },
    ],
  },
  {
    file: "tater-allie-animation-03-v1.png",
    rows: [
      { name: "allie-help", h: ALLIE },
      { name: "tater-land", h: TATER, ref: 4 },
      { name: "tater-grab", h: TATER },
      { name: "tater-leap", h: TATER, ref: 1 },
    ],
  },
  {
    file: "bottle-rescue-animation-04-v1.png",
    rows: [
      { name: "thanks-gin", h: BOTTLE },
      { name: "thanks-tequila", h: BOTTLE },
      { name: "thanks-rum", h: BOTTLE },
      { name: "thanks-scotch", h: BOTTLE },
    ],
  },
  {
    file: "bottle-rescue-pets-animation-05-v1.png",
    rows: [
      { name: "thanks-brandy", h: BOTTLE },
      { name: "thanks-malort", h: BOTTLE },
      { name: "thanks-chartreuse", h: BOTTLE },
      { split: [["mixer-cola", 2], ["mixer-gingerbeer", 2], ["mixer-tonic", 2]], h: PET },
    ],
  },
  {
    file: "finale-animation-06-v1.png",
    rows: [
      { name: "tater-summit", h: TATER },
      { name: "elmer-spray", h: ELMER + 2 },
      { name: "tater-soaked", h: TATER },
      { name: "duo-jump", h: ELMER, ref: 5 },
    ],
  },
  {
    file: "victory-animation-07-v1.png",
    rows: [
      { name: "tater-summit-solo", h: TATER },
      { name: "tater-soaked-solo", h: TATER, ref: 1 },
      { name: "elmer-jump", h: ELMER, ref: 5 },
      { name: "allie-cheer", h: ALLIE, ref: 2 },
    ],
  },
];

/** The interface sheet: 6 × 2, of which only row two is used (the arrow is drawn in code). */
const UI_SHEET = "game-interface-01-v1.png";
const GAUGE_H = 66;
const ICON_H = 10;

/** stage-tiles-<file>-final.png → the zone key the game uses. */
const TILE_ZONES = [
  ["shelf", "shelf"], ["sky", "sky"], ["space", "space"], ["moon", "moon"], ["mars", "mars"],
  ["pluto", "pluto"], ["spaceship", "ship"], ["heaven", "heaven"], ["summit", "summit"],
];
/** Art pixels per image pixel on the tile sheets. */
const TILE_PX = 6;

/** Cutscenes are shown fitted to the screen width; this is what they are stored at. */
const CUTSCENE_W = 576;

// ─── Pixels ──────────────────────────────────────────────────────────────────

async function readRGBA(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, data };
}

function crop(img, x0, y0, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = y0 + y;
    if (sy < 0 || sy >= img.h) continue;
    for (let x = 0; x < w; x++) {
      const sx = x0 + x;
      if (sx < 0 || sx >= img.w) continue;
      img.data.copy(out, (y * w + x) * 4, (sy * img.w + sx) * 4, (sy * img.w + sx) * 4 + 4);
    }
  }
  return { w, h, data: out };
}

const isGreen = (r, g, b) => g > 140 && r < 130 && b < 130;
/** How magenta a pixel is: 0 for anything neutral, ~255 for #FF00FF. */
const magentaness = (r, g, b) => Math.max(0, Math.min(r, b) - g - Math.abs(r - b) * 0.5);

/** Centres-free rule finder: returns [start, end] runs of mostly-green lines. */
function findRules(img, axis) {
  const along = axis === "rows" ? img.h : img.w;
  const across = axis === "rows" ? img.w : img.h;
  const hits = [];
  for (let i = 0; i < along; i++) {
    let green = 0, n = 0;
    for (let j = 0; j < across; j += 3) {
      const x = axis === "rows" ? j : i;
      const y = axis === "rows" ? i : j;
      const p = (y * img.w + x) * 4;
      if (isGreen(img.data[p], img.data[p + 1], img.data[p + 2])) green++;
      n++;
    }
    if (green / n > 0.55) hits.push(i);
  }
  const runs = [];
  let run = [];
  for (const i of hits) {
    if (run.length && i - run[run.length - 1] > 2) { runs.push([run[0], run[run.length - 1]]); run = []; }
    run.push(i);
  }
  if (run.length) runs.push([run[0], run[run.length - 1]]);
  return runs;
}

/**
 * Cell rectangles, inner edges only (the rules and their anti-aliased fringe
 * are left out). Falls back to an even split, loudly.
 */
function cellRects(img, cols, rows, label, fringe = 5) {
  let v = findRules(img, "cols");
  let h = findRules(img, "rows");
  const edges = (runs, size, count) => {
    // Accept rules including or excluding the outer border.
    if (runs.length === count + 1) return runs;
    if (runs.length === count - 1) return [[-1, -1], ...runs, [size, size]];
    return null;
  };
  let ve = edges(v, img.w, cols);
  let he = edges(h, img.h, rows);
  if (!ve || !he) {
    console.warn(`  ! ${label}: rules not found as expected (${v.length} vertical, ${h.length} horizontal) — even split`);
    const even = (size, count) =>
      Array.from({ length: count + 1 }, (_, i) => { const p = Math.round((size * i) / count); return [p, p]; });
    ve = even(img.w, cols);
    he = even(img.h, rows);
  }
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = ve[c][1] + 1 + fringe, x1 = ve[c + 1][0] - fringe;
      const y0 = he[r][1] + 1 + fringe, y1 = he[r + 1][0] - fringe;
      out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
  }
  return out;
}

/**
 * Key the magenta out of a cell.
 *
 * Flood from the border through anything magenta-LEANING, so the soft pink
 * fringe where a keyline meets the background goes with the background instead
 * of surviving as a halo. Then remove enclosed magenta (the gap under an arm),
 * and despill what is left along the edge.
 */
function keyOut(cell) {
  const { w, h, data } = cell;
  const bg = new Uint8Array(w * h);
  const stack = [];
  const leaning = (i) => {
    const p = i * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    return magentaness(r, g, b) > 45 || isGreen(r, g, b);
  };
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (bg[i] || !leaning(i)) return;
    bg[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const m = magentaness(r, g, b);
    if (bg[i] || m > 110) { data[p + 3] = 0; continue; }
    if (m > 20) {
      // Despill: pull red and blue back toward green.
      const cap = g + 20;
      data[p] = Math.min(r, Math.max(cap, r - m));
      data[p + 2] = Math.min(b, Math.max(cap, b - m));
    }
  }
  return cell;
}

/** Bounding box of opaque pixels, or null. */
function bbox(cell) {
  let x0 = cell.w, y0 = cell.h, x1 = -1, y1 = -1;
  for (let y = 0; y < cell.h; y++) {
    for (let x = 0; x < cell.w; x++) {
      if (cell.data[(y * cell.w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/**
 * Where a frame stands: the middle of its lowest band of pixels, and the bottom.
 * Measured on the reference frame, in that frame's own coordinates.
 */
function feet(cell, box) {
  const band = Math.max(3, Math.round((box.y1 - box.y0) * 0.08));
  let sum = 0, n = 0;
  for (let y = box.y1 - band; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) {
      if (cell.data[(y * cell.w + x) * 4 + 3] > 8) { sum += x; n++; }
    }
  }
  return { x: n ? sum / n : (box.x0 + box.x1) / 2, y: box.y1 + 1 };
}

/** Lay frames side by side into one strip. */
function stripOf(frames) {
  const fw = frames[0].w, fh = frames[0].h;
  const out = Buffer.alloc(fw * frames.length * fh * 4);
  frames.forEach((f, i) => {
    for (let y = 0; y < fh; y++) f.data.copy(out, (y * fw * frames.length + i * fw) * 4, y * fw * 4, (y + 1) * fw * 4);
  });
  return { w: fw * frames.length, h: fh, data: out };
}

/** Resize RGBA with alpha-aware filtering, then snap alpha hard. */
async function resize(cell, w, h, kernel = "lanczos3") {
  const { data, info } = await sharp(cell.data, { raw: { width: cell.w, height: cell.h, channels: 4 } })
    .resize(Math.max(1, w), Math.max(1, h), { kernel, fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let p = 0; p < data.length; p += 4) data[p + 3] = data[p + 3] >= 110 ? 255 : 0;
  return { w: info.width, h: info.height, data };
}

async function write(cell, name, colours = 96) {
  const file = path.join(DEST, `${name}.png`);
  if (DRY) { console.log(`  would write ${name}.png  ${cell.w}x${cell.h}`); return; }
  await sharp(cell.data, { raw: { width: cell.w, height: cell.h, channels: 4 } })
    .png({ palette: true, colours, effort: 8 })
    .toFile(file);
  const kb = (fs.statSync(file).size / 1024).toFixed(0);
  console.log(`  ${name}.png  ${cell.w}x${cell.h}  ${kb}KB`);
}

const manifest = {};

// ─── Animation sheets ────────────────────────────────────────────────────────

async function doAnimationSheet(sheet) {
  const file = path.join(ROOT, sheet.file);
  if (!fs.existsSync(file)) { console.log(`— ${sheet.file} missing, skipping`); return; }
  console.log(`\n${sheet.file}`);
  const img = await readRGBA(file);
  const rects = cellRects(img, 6, 4, sheet.file);
  // Every cell of a sheet the same size, so a shared box means the same place.
  const cw = Math.min(...rects.map((r) => r.w));
  const ch = Math.min(...rects.map((r) => r.h));

  for (let r = 0; r < sheet.rows.length; r++) {
    const row = sheet.rows[r];
    const cells = [];
    for (let c = 0; c < 6; c++) {
      const rc = rects[r * 6 + c];
      cells.push(keyOut(crop(img, rc.x, rc.y, cw, ch)));
    }
    const groups = row.split
      ? row.split.reduce((acc, [name, n]) => {
          const start = acc.reduce((s, g) => s + g.frames.length, 0);
          acc.push({ name, frames: cells.slice(start, start + n) });
          return acc;
        }, [])
      : [{ name: row.name, frames: cells }];

    // One scale for the whole row, taken from its reference frame, so split
    // strips (the three flight angles) stay the same size as each other.
    // `scaleFrom: [row, frame]` borrows another row's measurement — the flight
    // row's frames include the soda jet, so measuring them would shrink Elmer.
    let scaleCell;
    if (row.scaleFrom) {
      const rc = rects[row.scaleFrom[0] * 6 + row.scaleFrom[1]];
      scaleCell = keyOut(crop(img, rc.x, rc.y, cw, ch));
    } else {
      scaleCell = cells[row.ref ?? 0];
    }
    const refBox = bbox(scaleCell);
    const scale = (row.h * PIXEL_SCALE) / (refBox.y1 - refBox.y0 + 1);

    for (const g of groups) {
      const boxes = g.frames.map(bbox).filter(Boolean);
      const u = {
        x0: Math.min(...boxes.map((b) => b.x0)), y0: Math.min(...boxes.map((b) => b.y0)),
        x1: Math.max(...boxes.map((b) => b.x1)), y1: Math.max(...boxes.map((b) => b.y1)),
      };
      const uw = u.x1 - u.x0 + 1, uh = u.y1 - u.y0 + 1;
      const frames = g.frames.map((f) => crop(f, u.x0, u.y0, uw, uh));
      const fw = Math.round(uw * scale), fh = Math.round(uh * scale);
      const scaled = [];
      for (const f of frames) scaled.push(await resize(f, fw, fh));

      // Anchor from the group's first frame (or the row's reference, if it is in this group).
      const localRef = row.split ? 0 : (row.ref ?? 0);
      const src = g.frames[localRef];
      const sb = bbox(src);
      let ax, ay;
      if (row.anchor === "centre") {
        ax = ((sb.x0 + sb.x1) / 2 - u.x0) * scale;
        ay = ((sb.y0 + sb.y1) / 2 - u.y0) * scale;
      } else {
        const ft = feet(src, sb);
        ax = (ft.x - u.x0) * scale;
        ay = (ft.y - u.y0) * scale;
      }
      await write(stripOf(scaled), g.name);
      manifest[g.name] = {
        frames: g.frames.length, fw, fh,
        ax: Math.round(ax), ay: Math.round(ay),
      };
    }
  }
}

// ─── Interface ───────────────────────────────────────────────────────────────

async function doUi() {
  const file = path.join(ROOT, UI_SHEET);
  if (!fs.existsSync(file)) { console.log(`— ${UI_SHEET} missing, skipping`); return; }
  console.log(`\n${UI_SHEET}`);
  const img = await readRGBA(file);
  const rects = cellRects(img, 6, 2, UI_SHEET);
  const cells = rects.slice(6).map((rc) => keyOut(crop(img, rc.x, rc.y, rc.w, rc.h)));

  // The two gauges must stay registered, so both are cropped to the union box.
  const b0 = bbox(cells[0]), b1 = bbox(cells[1]);
  const u = { x0: Math.min(b0.x0, b1.x0), y0: Math.min(b0.y0, b1.y0), x1: Math.max(b0.x1, b1.x1), y1: Math.max(b0.y1, b1.y1) };
  const gw = u.x1 - u.x0 + 1, gh = u.y1 - u.y0 + 1;
  const gs = (GAUGE_H * PIXEL_SCALE) / gh;
  const outW = Math.round(gw * gs), outH = GAUGE_H * PIXEL_SCALE;
  const empty = await resize(crop(cells[0], u.x0, u.y0, gw, gh), outW, outH, "nearest");
  const full = await resize(crop(cells[1], u.x0, u.y0, gw, gh), outW, outH, "nearest");
  await write(empty, "gauge-empty");
  await write(full, "gauge-full");
  // Where the liquid runs inside the tube, measured off the full gauge: the
  // rows between the caps where the middle column is not the empty tube colour.
  manifest["gauge-empty"] = { frames: 1, fw: outW, fh: outH, ax: 0, ay: 0 };
  manifest["gauge-full"] = { frames: 1, fw: outW, fh: outH, ax: 0, ay: 0 };

  const one = async (cell, name, s) => {
    const b = bbox(cell);
    const c = crop(cell, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
    const out = await resize(c, Math.round(c.w * s), Math.round(c.h * s), "nearest");
    await write(out, name);
    manifest[name] = { frames: 1, fw: out.w, fh: out.h, ax: Math.round(out.w / 2), ay: out.h };
  };
  // The foam at the gauge's own scale, so it is exactly as wide as the tube.
  await one(cells[2], "gauge-foam", gs);
  const iconScale = (cell) => { const b = bbox(cell); return (ICON_H * PIXEL_SCALE) / (b.y1 - b.y0 + 1); };
  await one(cells[3], "icon-cola", iconScale(cells[3]));
  await one(cells[4], "icon-gingerbeer", iconScale(cells[4]));
  await one(cells[5], "icon-tonic", iconScale(cells[5]));
}

// ─── Tiles ───────────────────────────────────────────────────────────────────

async function doTiles() {
  for (const [fileKey, zone] of TILE_ZONES) {
    const file = path.join(ROOT, `stage-tiles-${fileKey}-final.png`);
    if (!fs.existsSync(file)) { console.log(`— stage-tiles-${fileKey}-final.png missing, skipping`); continue; }
    console.log(`\nstage-tiles-${fileKey}-final.png`);
    const img = await readRGBA(file);
    // These sheets are clean: an even thirds split with no fringe is exact.
    const third = Math.floor(img.w / 3);
    const cell = (i) => {
      const c = crop(img, (i % 3) * third + 1, Math.floor(i / 3) * third + 1, third - 2, third - 2);
      // Exact magenta only — there is no anti-aliasing to chase.
      for (let p = 0; p < c.data.length; p += 4) {
        const r = c.data[p], g = c.data[p + 1], b = c.data[p + 2];
        if ((r > 230 && g < 40 && b > 230) || isGreen(r, g, b)) c.data[p + 3] = 0;
      }
      const b = bbox(c);
      const t = crop(c, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
      // Snap to the art grid, then write at PIXEL_SCALE / TILE_PX... the tile's
      // own pixels become one logical pixel each divided by 3 — see TILE_SCALE
      // in constants.ts: one art pixel is one DEVICE pixel.
      const w = Math.round(t.w / TILE_PX), h = Math.round(t.h / TILE_PX);
      const out = { w, h, data: Buffer.alloc(w * h * 4) };
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const sx = Math.min(t.w - 1, x * TILE_PX + (TILE_PX >> 1));
          const sy = Math.min(t.h - 1, y * TILE_PX + (TILE_PX >> 1));
          t.data.copy(out.data, (y * w + x) * 4, (sy * t.w + sx) * 4, (sy * t.w + sx) * 4 + 4);
        }
      }
      return out;
    };
    const names = ["left", "mid", "right", "mid2", "wall", "wall2", "sign", "deco1", "deco2"];
    const tiles = names.map((_, i) => cell(i));
    // Platforms and walls as two strips; decorations loose.
    const plat = stripOf([tiles[0], tiles[1], tiles[2], tiles[3]].map((t) => pad(t, tiles[1].w, tiles[1].h)));
    await write(plat, `tile-${zone}-platform`, 32);
    manifest[`tile-${zone}-platform`] = { frames: 4, fw: tiles[1].w, fh: tiles[1].h, ax: 0, ay: 0 };
    const wall = stripOf([tiles[4], tiles[5], tiles[6]].map((t) => pad(t, tiles[4].w, tiles[4].h)));
    await write(wall, `tile-${zone}-wall`, 32);
    manifest[`tile-${zone}-wall`] = { frames: 3, fw: tiles[4].w, fh: tiles[4].h, ax: 0, ay: 0 };
    for (const k of [7, 8]) {
      await write(tiles[k], `tile-${zone}-${names[k]}`, 32);
      manifest[`tile-${zone}-${names[k]}`] = { frames: 1, fw: tiles[k].w, fh: tiles[k].h, ax: Math.round(tiles[k].w / 2), ay: tiles[k].h };
    }
  }
}

/** Pad (top-left) or crop a tile to exactly w × h. */
function pad(t, w, h) {
  if (t.w === w && t.h === h) return t;
  return crop(t, 0, 0, w, h);
}

// ─── Cutscenes, title, logo ──────────────────────────────────────────────────

async function doPictures() {
  const list = [];
  for (let i = 1; i <= 23; i++) {
    const n = String(i).padStart(2, "0");
    list.push([`tater-tales-cutscene-${n}-v1.png`, `cutscene-${n}`]);
  }
  list.push(["tater-tales-title-screen-v1.png", "title"]);
  console.log("\ncutscenes");
  for (const [src, name] of list) {
    const file = path.join(ROOT, src);
    if (!fs.existsSync(file)) { console.log(`— ${src} missing, skipping`); continue; }
    const out = path.join(DEST, `${name}.png`);
    const meta = await sharp(file).metadata();
    const h = Math.round((meta.height * CUTSCENE_W) / meta.width);
    if (DRY) { console.log(`  would write ${name}.png ${CUTSCENE_W}x${h}`); continue; }
    await sharp(file).removeAlpha().resize(CUTSCENE_W, h, { kernel: "lanczos3" })
      .png({ palette: true, colours: 64, effort: 8 }).toFile(out);
    console.log(`  ${name}.png  ${CUTSCENE_W}x${h}  ${(fs.statSync(out).size / 1024).toFixed(0)}KB`);
    manifest[name] = { frames: 1, fw: CUTSCENE_W, fh: h, ax: 0, ay: 0 };
  }

  const logo = path.join(ROOT, "tater-tales-logo-v1.png");
  if (fs.existsSync(logo)) {
    console.log("\nlogo");
    const img = await readRGBA(logo);
    const keyed = keyOut(img);
    const b = bbox(keyed);
    const c = crop(keyed, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
    const w = 220 * PIXEL_SCALE;
    const out = await resize(c, w, Math.round((c.h * w) / c.w));
    await write(out, "logo", 64);
    manifest.logo = { frames: 1, fw: out.w, fh: out.h, ax: Math.round(out.w / 2), ay: 0 };
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(ROOT)) {
    console.error(`No art folder at ${ROOT}`);
    process.exit(1);
  }
  if (!DRY) fs.mkdirSync(DEST, { recursive: true });

  for (const s of SHEETS) await doAnimationSheet(s);
  await doUi();
  await doTiles();
  await doPictures();

  const names = Object.keys(manifest).sort();
  const body = names.map((n) => `  "${n}": ${JSON.stringify(manifest[n]).replace(/"(\w+)":/g, "$1: ")},`).join("\n");
  const ts = `// GENERATED by scripts/tater-art.mjs — do not edit by hand.
//
// Every image in public/popup/art/tater: how many frames its strip holds, the
// size of one frame in DEVICE pixels (divide by PIXEL_SCALE for logical), and
// the anchor inside a frame — the middle of the feet for a character, the
// middle of the body for anything airborne.

export interface ArtEntry { frames: number; fw: number; fh: number; ax: number; ay: number }

export const ART = {
${body}
} as const satisfies Record<string, ArtEntry>;

export type ArtName = keyof typeof ART;
`;
  if (DRY) console.log(`\nwould write ${MANIFEST} (${names.length} entries)`);
  else { fs.writeFileSync(MANIFEST, ts); console.log(`\nmanifest: ${names.length} entries`); }
}

main().catch((e) => { console.error(e); process.exit(1); });
