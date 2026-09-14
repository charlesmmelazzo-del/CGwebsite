#!/usr/bin/env node
// ─── High Scores — UI art import ─────────────────────────────────────────────
//
// Cuts the owner's pixel-art UI sheets (buttons, round controls, the cabinet
// bezel, the raffle ticket) out of his ChatGPT folder into
// public/popup/art/ui, and writes ui.json with the measurements the site
// needs to stretch them: where a pill's rounded ends stop, how thick the bezel
// is, where the ticket's number box sits.
//
// Same sheet convention as tater-art.mjs and shots-art.mjs: MAGENTA background,
// GREEN rules between equal cells. The keying and rule-finding are copied
// from tater-art.mjs rather than shared, matching how the other import
// scripts are kept standalone.
//
// Usage:  node scripts/ui-art.mjs [--src <folder>] [--dest <folder>]

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const SRC = arg("--src", path.join(os.homedir(), "Documents", "ChatGPT", "Website assets"));
const DEST = arg("--dest", path.join(process.cwd(), "public", "popup", "art", "ui"));

const FILES = {
  buttons: "high-scores-buttons-draft.png",
  controls: "high-scores-controls-v2.png",
  bezel: "high-scores-bezel-draft.png",
  tickets: "high-scores-raffle-tickets-draft.png",
};

/** buttons sheet rows, top to bottom. Columns: normal, pressed, disabled. */
const PILL_COLORS = ["teal", "red", "gold", "purple"];

/** controls sheet, read left to right, top to bottom, in pairs where pressed. */
const CONTROLS = [
  ["arrow-left", "arrow-left-pressed", "arrow-right", "arrow-right-pressed"],
  ["close", "close-pressed", "pause", "pause-pressed"],
  ["light-on", "light-off", "star", "ticket-icon"],
  ["joystick", "trophy", "coin", "coupe"],
];

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
      const si = (sy * img.w + sx) * 4, di = (y * w + x) * 4;
      img.data.copy(out, di, si, si + 4);
    }
  }
  return { w, h, data: out };
}

const isMagenta = (r, g, b) => r > 150 && b > 150 && g < 110 && Math.abs(r - b) < 90;
const isGreen = (r, g, b) => g > 140 && r < 130 && b < 130;
const alphaAt = (img, x, y) => img.data[(y * img.w + x) * 4 + 3];

// Wider than tater-art.mjs: these rules blend into the magenta as a grey band.
const RULE_FRINGE = 12;

function findRules(img, axis) {
  const along = axis === "rows" ? img.h : img.w;
  const across = axis === "rows" ? img.w : img.h;
  const hits = [];
  for (let i = 0; i < along; i++) {
    let green = 0;
    for (let j = 0; j < across; j += 3) {
      const x = axis === "rows" ? j : i;
      const y = axis === "rows" ? i : j;
      const p = (y * img.w + x) * 4;
      if (isGreen(img.data[p], img.data[p + 1], img.data[p + 2])) green++;
    }
    if (green / Math.ceil(across / 3) > 0.7) hits.push(i);
  }
  const centres = [];
  let run = [];
  for (const i of hits) {
    if (run.length && i - run[run.length - 1] > 2) { centres.push(mid(run)); run = []; }
    run.push(i);
  }
  if (run.length) centres.push(mid(run));
  return centres;
}
const mid = (run) => Math.round((run[0] + run[run.length - 1]) / 2);

/** Inner rules only — the outside border is drawn too and must be dropped. */
function edges(lines, size, count) {
  const inner = lines.filter((l) => l > size * 0.02 && l < size * 0.98);
  if (inner.length >= count - 1) return [0, ...inner.slice(0, count - 1), size];
  console.warn(`  ! found ${inner.length} rules, expected ${count - 1} — splitting evenly`);
  return Array.from({ length: count + 1 }, (_, i) => Math.round((size * i) / count));
}

function cells(img, cols, rows) {
  const xs = edges(findRules(img, "cols"), img.w, cols);
  const ys = edges(findRules(img, "rows"), img.h, rows);
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = xs[c] + RULE_FRINGE, y0 = ys[r] + RULE_FRINGE;
      out.push(crop(img, x0, y0, xs[c + 1] - RULE_FRINGE - x0, ys[r + 1] - RULE_FRINGE - y0));
    }
  }
  return out;
}

/** Flood the magenta from the border, then clear any enclosed magenta too. */
function keyOut(cell) {
  const { w, h, data } = cell;
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h || seen[y * w + x]) return;
    const p = (y * w + x) * 4;
    if (!isMagenta(data[p], data[p + 1], data[p + 2]) && !isGreen(data[p], data[p + 1], data[p + 2])) return;
    seen[y * w + x] = 1;
    stack.push(x, y);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    // Enclosed magenta, plus the pink fringe where the generator blended the
    // outline into the background: anything clearly leaning magenta goes.
    const leansMagenta = r > 120 && b > 120 && g < r * 0.55 && g < b * 0.55;
    if (seen[i] || isMagenta(r, g, b) || leansMagenta) data[p + 3] = 0;
  }
  // Darker blends survive the pass above as a purple hairline under the
  // outline. Peel magenta-tinted pixels off the edge of the art, twice.
  for (let pass = 0; pass < 2; pass++) {
    const clear = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = (y * w + x) * 4;
        if (data[p + 3] === 0) continue;
        const r = data[p], g = data[p + 1], b = data[p + 2];
        const tinted = r > g * 1.8 + 20 && b > g * 1.8 + 20 && Math.abs(r - b) < 50;
        if (!tinted) continue;
        const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
          const nx = x + dx, ny = y + dy;
          return nx < 0 || ny < 0 || nx >= w || ny >= h || data[(ny * w + nx) * 4 + 3] === 0;
        });
        if (edge) clear.push(p);
      }
    }
    for (const p of clear) data[p + 3] = 0;
  }
  return cell;
}

function bbox(cell) {
  let x0 = cell.w, y0 = cell.h, x1 = -1, y1 = -1;
  for (let y = 0; y < cell.h; y++) {
    for (let x = 0; x < cell.w; x++) {
      if (alphaAt(cell, x, y) > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/**
 * Crop several cells to ONE shared box, so a button and its pressed version
 * line up exactly when swapped — the pressed cap sits lower in its cell, and
 * trimming each on its own would pull it back up.
 */
function cropShared(list) {
  const boxes = list.map(bbox).filter(Boolean);
  const x0 = Math.min(...boxes.map((b) => b.x0)), y0 = Math.min(...boxes.map((b) => b.y0));
  const x1 = Math.max(...boxes.map((b) => b.x1)), y1 = Math.max(...boxes.map((b) => b.y1));
  return list.map((c) => crop(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1));
}

async function write(cell, name) {
  const file = path.join(DEST, `${name}.png`);
  await sharp(cell.data, { raw: { width: cell.w, height: cell.h, channels: 4 } })
    .png({ palette: true, colours: 64, effort: 8 })
    .toFile(file);
  console.log(`  ${name}.png  ${cell.w}x${cell.h}  ${(fs.statSync(file).size / 1024).toFixed(0)}KB`);
}

// ─── Measurements ────────────────────────────────────────────────────────────

/** Opaque row span of one column. */
function columnSpan(cell, x) {
  let top = -1, bottom = -1;
  for (let y = 0; y < cell.h; y++) {
    if (alphaAt(cell, x, y) > 8) { if (top < 0) top = y; bottom = y; }
  }
  return { top, bottom };
}

/**
 * Where a pill's rounded end stops, from its left edge.
 *
 * The middle of the pill is a run of identical columns. Walking in from the
 * edge, the cap ends at the first column whose top and bottom match the
 * middle column's — plus a few pixels for the side shading block, which the
 * art draws just inside the round.
 */
function capWidth(cell) {
  const centre = columnSpan(cell, Math.floor(cell.w / 2));
  let left = 0;
  while (left < cell.w / 2) {
    const s = columnSpan(cell, left);
    if (Math.abs(s.top - centre.top) <= 2 && Math.abs(s.bottom - centre.bottom) <= 2) break;
    left++;
  }
  let right = 0;
  while (right < cell.w / 2) {
    const s = columnSpan(cell, cell.w - 1 - right);
    if (Math.abs(s.top - centre.top) <= 2 && Math.abs(s.bottom - centre.bottom) <= 2) break;
    right++;
  }
  // The shaded side block runs past where the outline straightens.
  const pad = Math.round(cell.w * 0.07);
  return Math.min(Math.round(cell.w * 0.3), Math.max(left, right) + pad);
}

function vSlice(cell, x0, w) {
  return crop(cell, x0, 0, w, cell.h);
}

/** Thickness of a frame's side at mid-height, and how far its corners reach. */
function frameMetrics(cell) {
  const y = Math.floor(cell.h / 2);
  let x = 0;
  while (x < cell.w && alphaAt(cell, x, y) <= 8) x++;
  const outer = x;
  while (x < cell.w && alphaAt(cell, x, y) > 8) x++;
  const side = x - outer;
  // Walk down the inner edge until it reaches the straight side's position.
  let corner = 0;
  for (let yy = 0; yy < cell.h / 2; yy++) {
    let xx = outer;
    while (xx < cell.w / 2 && alphaAt(cell, xx, yy) > 8) xx++;
    if (xx - outer <= side + 1 && xx - outer >= side - 1) { corner = yy; break; }
  }
  return { side, corner };
}

/** Bounds of the dark box in the middle of a ticket, as fractions. */
function darkBox(cell) {
  const cx = Math.floor(cell.w * 0.35), cy = Math.floor(cell.h / 2);
  const dark = (x, y) => {
    const p = (y * cell.w + x) * 4;
    return cell.data[p + 3] > 8 && cell.data[p] < 70 && cell.data[p + 1] < 70 && cell.data[p + 2] < 70;
  };
  let x0 = cx, x1 = cx, y0 = cy, y1 = cy;
  while (x0 > 0 && dark(x0 - 1, cy)) x0--;
  while (x1 < cell.w - 1 && dark(x1 + 1, cy)) x1++;
  const mx = Math.floor((x0 + x1) / 2);
  while (y0 > 0 && dark(mx, y0 - 1)) y0--;
  while (y1 < cell.h - 1 && dark(mx, y1 + 1)) y1++;
  const pct = (v, of) => Math.round((v / of) * 1000) / 10;
  return { left: pct(x0, cell.w), top: pct(y0, cell.h), width: pct(x1 - x0 + 1, cell.w), height: pct(y1 - y0 + 1, cell.h) };
}

// ─── Run ─────────────────────────────────────────────────────────────────────

fs.mkdirSync(DEST, { recursive: true });
const meta = { pill: {}, frame: {}, ticket: {} };

{
  console.log(`\n${FILES.buttons}`);
  const img = await readRGBA(path.join(SRC, FILES.buttons));
  const list = cells(img, 3, PILL_COLORS.length).map(keyOut);
  for (let r = 0; r < PILL_COLORS.length; r++) {
    const [normal, pressed, disabled] = cropShared(list.slice(r * 3, r * 3 + 3));
    const cap = capWidth(normal);
    const midW = 8;
    const midX = Math.floor(normal.w / 2) - midW / 2;
    const states = { "": normal, "-pressed": pressed };
    // Every row's disabled column is the same grey; keep only one.
    if (r === 0) states["-disabled"] = disabled;
    for (const [suffix, c] of Object.entries(states)) {
      const base = suffix === "-disabled" ? "pill-disabled" : `pill-${PILL_COLORS[r]}${suffix}`;
      await write(vSlice(c, 0, cap), `${base}-l`);
      await write(vSlice(c, midX, midW), `${base}-m`);
      await write(vSlice(c, c.w - cap, cap), `${base}-r`);
    }
    if (r === 0) meta.pill = { width: normal.w, height: normal.h, cap };
  }
}

{
  console.log(`\n${FILES.controls}`);
  const img = await readRGBA(path.join(SRC, FILES.controls));
  const list = cells(img, 4, 4).map(keyOut);
  const at = (r, c) => list[r * 4 + c];
  // Pressed pairs share a box so they swap without jumping.
  const pairs = [[0, 0, 0, 1], [0, 2, 0, 3], [1, 0, 1, 1], [1, 2, 1, 3], [2, 0, 2, 1]];
  const done = new Set();
  for (const [r1, c1, r2, c2] of pairs) {
    const [a, b] = cropShared([at(r1, c1), at(r2, c2)]);
    await write(a, CONTROLS[r1][c1]);
    await write(b, CONTROLS[r2][c2]);
    done.add(`${r1}:${c1}`).add(`${r2}:${c2}`);
  }
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (done.has(`${r}:${c}`)) continue;
      const [cell] = cropShared([at(r, c)]);
      await write(cell, CONTROLS[r][c]);
    }
  }
}

{
  console.log(`\n${FILES.bezel}`);
  const img = await readRGBA(path.join(SRC, FILES.bezel));
  const [frame] = cropShared([keyOut(crop(img, 0, 0, img.w, img.h))]);
  await write(frame, "bezel");
  const { side, corner } = frameMetrics(frame);
  meta.frame = { width: frame.w, height: frame.h, side, slice: Math.max(side, corner) + 4 };
}

{
  console.log(`\n${FILES.tickets}`);
  const img = await readRGBA(path.join(SRC, FILES.tickets));
  const [whole, torn] = cropShared(cells(img, 2, 1).map(keyOut));
  await write(whole, "ticket");
  await write(torn, "ticket-torn");
  meta.ticket = { width: whole.w, height: whole.h, box: darkBox(whole) };
}

fs.writeFileSync(path.join(DEST, "ui.json"), JSON.stringify(meta, null, 2) + "\n");
console.log("\nui.json", JSON.stringify(meta));
