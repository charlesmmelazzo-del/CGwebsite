// ─── Tater Tales — art at runtime ────────────────────────────────────────────
//
// Every image is cut by scripts/tater-art.mjs and described in artManifest.ts:
// frames per strip, frame size in DEVICE pixels, and an anchor (the middle of
// the feet, or the middle of the body for anything airborne).
//
// Everything here draws in LOGICAL coordinates, under the canvas's
// PIXEL_SCALE transform. Because the art is written at device resolution a
// sprite drawn at its own logical size lands on the buffer one to one.

import { ART, type ArtName } from "./artManifest";
import { PIXEL_SCALE, T } from "./constants";
import type { ZoneArt } from "./zones";

const ART_BASE = "/popup/art/tater";

// ─── Loading ─────────────────────────────────────────────────────────────────

type Status = "loading" | "ready" | "failed";

const images = new Map<string, HTMLImageElement>();
const status = new Map<string, Status>();

/** The image for a name, requesting it the first time it is asked for. Null until loaded. */
export function getImage(name: ArtName): HTMLImageElement | null {
  const state = status.get(name);
  if (state === "ready") return images.get(name) ?? null;
  if (state === "loading" || state === "failed") return null;
  if (typeof window === "undefined") return null;

  status.set(name, "loading");
  const img = new Image();
  img.decoding = "async";
  img.onload = () => { images.set(name, img); status.set(name, "ready"); };
  img.onerror = () => status.set(name, "failed");
  img.src = `${ART_BASE}/${name}.png`;
  return null;
}

/** Start downloads now, for art the next screen is about to need. */
export function prefetch(names: ArtName[]): void {
  for (const n of names) getImage(n);
}

/** True once every name has either loaded or failed. */
export function settled(names: ArtName[]): boolean {
  return names.every((n) => {
    getImage(n);
    const s = status.get(n);
    return s === "ready" || s === "failed";
  });
}

const S = PIXEL_SCALE;

/** Logical size of one frame. */
export function frameSize(name: ArtName): { w: number; h: number } {
  const a = ART[name];
  return { w: a.fw / S, h: a.fh / S };
}

export function frameCount(name: ArtName): number {
  return ART[name].frames;
}

/**
 * One frame of a strip, placed by its anchor.
 *
 * `(x, y)` is where the anchor goes. `flip` mirrors about the anchor, so a
 * character facing the other way still stands on the same spot.
 */
export function drawArt(
  ctx: CanvasRenderingContext2D,
  name: ArtName,
  frame: number,
  x: number,
  y: number,
  opts: { flip?: boolean; alpha?: number; scale?: number } = {}
): boolean {
  const img = getImage(name);
  if (!img) return false;
  const a = ART[name];
  const i = ((Math.floor(frame) % a.frames) + a.frames) % a.frames;
  // `scale` enlarges by whole device pixels per art pixel — for the stage
  // decorations, which are drawn at tile density and would otherwise be specks.
  const k = opts.scale ?? 1;
  const w = (a.fw / S) * k, h = (a.fh / S) * k;
  const ax = (a.ax / S) * k, ay = (a.ay / S) * k;
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  // Snap to the device grid so a moving sprite does not shimmer.
  const px = Math.round(x * S) / S, py = Math.round(y * S) / S;
  if (opts.flip) {
    ctx.translate(px + ax, py - ay);
    ctx.scale(-1, 1);
    ctx.drawImage(img, i * a.fw, 0, a.fw, a.fh, 0, 0, w, h);
  } else {
    ctx.drawImage(img, i * a.fw, 0, a.fw, a.fh, px - ax, py - ay, w, h);
  }
  ctx.restore();
  return true;
}

/** A whole image at a given logical rectangle. */
export function drawWhole(
  ctx: CanvasRenderingContext2D, name: ArtName, x: number, y: number, w: number, h: number
): boolean {
  const img = getImage(name);
  if (!img) return false;
  ctx.drawImage(img, x, y, w, h);
  return true;
}

// ─── Primitives ──────────────────────────────────────────────────────────────

export function fill(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

/** A hard black keyline round a box. */
export function keyline(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string = T.black
) {
  fill(ctx, x - 1, y - 1, w + 2, 1, color);
  fill(ctx, x - 1, y + h, w + 2, 1, color);
  fill(ctx, x - 1, y, 1, h, color);
  fill(ctx, x + w, y, 1, h, color);
}

/** A stable pseudo-random from two integers, for scenery that must not boil. */
export function hash(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ─── Stage tiles ─────────────────────────────────────────────────────────────

/** Logical size of one platform block and one wall block. */
export const BLOCK_W = 16;
export const BLOCK_H = 8;
export const WALL_TILE_H = 32 / S;

/**
 * A shelf built from blocks: left end, middles repeated, right end. The last
 * middle is cut short if the shelf is not a whole number of blocks wide.
 */
export function drawPlatformTiles(
  ctx: CanvasRenderingContext2D, zone: ZoneArt, x: number, y: number, w: number, seed: number
): void {
  const name = `tile-${zone}-platform` as ArtName;
  const img = getImage(name);
  if (!img) {
    fill(ctx, x, y, w, BLOCK_H, "#8B4B14");
    keyline(ctx, x, y, w, BLOCK_H);
    return;
  }
  const a = ART[name];
  const blit = (frame: number, dx: number, cw: number) => {
    ctx.drawImage(img, frame * a.fw, 0, Math.round((cw / BLOCK_W) * a.fw), a.fh, dx, y, cw, BLOCK_H);
  };
  blit(0, x, BLOCK_W);
  let cx = x + BLOCK_W;
  const end = x + w - BLOCK_W;
  let i = 0;
  while (cx < end) {
    const cw = Math.min(BLOCK_W, end - cx);
    blit(hash(seed, i++) > 0.75 ? 3 : 1, cx, cw);
    cx += cw;
  }
  blit(2, end, BLOCK_W);
}

/**
 * One wall block. `frame` 0 and 1 are plain, 2 is the one with the sign.
 * The right-hand wall is the left one mirrored.
 */
export function drawWallTile(
  ctx: CanvasRenderingContext2D, zone: ZoneArt, frame: number, x: number, y: number, mirror: boolean
): void {
  const name = `tile-${zone}-wall` as ArtName;
  const img = getImage(name);
  const h = WALL_TILE_H;
  if (!img) {
    fill(ctx, x, y, BLOCK_W, h, "#2A1A0A");
    return;
  }
  const a = ART[name];
  if (mirror) {
    ctx.save();
    ctx.translate(x + BLOCK_W, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, frame * a.fw, 0, a.fw, a.fh, 0, 0, a.fw / S, h);
    ctx.restore();
  } else {
    ctx.drawImage(img, frame * a.fw, 0, a.fw, a.fh, x, y, a.fw / S, h);
  }
}

// ─── The aim arrow ───────────────────────────────────────────────────────────
//
// Drawn in code rather than from the interface sheet: the sheet's six angles
// came back bunched around 45 degrees, and the arrow has to show the exact
// angle the blast will use. It is rasterised at LOGICAL resolution — one arrow
// pixel is one chunky screen pixel, the same size as the stage blocks' pixels
// times three — so at any angle it stays hard-edged pixel art rather than a
// smoothly rotated image.

const arrowCache = new Map<number, HTMLCanvasElement>();
const ARROW_LEN = 34;
const ARROW_BOX = ARROW_LEN * 2 + 8;

function arrowCanvas(angle: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const key = Math.round((angle * 180) / Math.PI);
  const hit = arrowCache.get(key);
  if (hit) return hit;

  const c = document.createElement("canvas");
  c.width = ARROW_BOX;
  c.height = ARROW_BOX;
  const g = c.getContext("2d");
  if (!g) return null;
  const img = g.createImageData(ARROW_BOX, ARROW_BOX);
  const rad = (key * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const o = ARROW_BOX / 2;

  /** Distance outside the arrow shape, in arrow pixels (<= 0 is inside). */
  const outside = (px: number, py: number) => {
    // Rotate the screen point back into arrow space: base at origin, tip at -L.
    const dx = px - o, dy = py - o;
    const lx = dx * cos + dy * sin;
    const ly = -dx * sin + dy * cos;
    const head = 11;
    if (ly > 0) return Math.max(ly, Math.abs(lx) - 2.5);
    if (ly < -ARROW_LEN) return Math.max(-ARROW_LEN - ly, Math.abs(lx));
    if (ly < -ARROW_LEN + head) {
      const half = ((ly + ARROW_LEN) / head) * 8;
      return Math.abs(lx) - half;
    }
    return Math.abs(lx) - 2.5;
  };

  const put = (x: number, y: number, r: number, gg: number, b: number) => {
    const p = (y * ARROW_BOX + x) * 4;
    img.data[p] = r; img.data[p + 1] = gg; img.data[p + 2] = b; img.data[p + 3] = 255;
  };
  for (let y = 0; y < ARROW_BOX; y++) {
    for (let x = 0; x < ARROW_BOX; x++) {
      const d = outside(x + 0.5, y + 0.5);
      if (d <= -1.2) put(x, y, 0xE8, 0x2A, 0x18);
      else if (d <= 0) put(x, y, 0xFF, 0xC8, 0x2E);
      else if (d <= 1.1) put(x, y, 0x0A, 0x07, 0x10);
    }
  }
  g.putImageData(img, 0, 0);
  arrowCache.set(key, c);
  return c;
}

/** The arrow with its base at (x, y), leaning `angle` radians off straight up. */
export function drawArrow(
  ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, alpha = 1
): void {
  const c = arrowCanvas(angle);
  if (!c) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(c, Math.round(x - ARROW_BOX / 2), Math.round(y - ARROW_BOX / 2));
  ctx.restore();
}

// ─── The carbonation gauge ───────────────────────────────────────────────────

/** Where the liquid runs inside gauge-full.png, in device rows. Measured off the art. */
const GAUGE_TOP = 21;
const GAUGE_BOTTOM = 176;

export function gaugeSize(): { w: number; h: number } {
  return frameSize("gauge-empty");
}

/**
 * The empty tube, with the full one uncovered from the bottom up to `level`.
 * The two images are pixel-for-pixel the same tube, so the reveal is exact.
 */
export function drawGauge(
  ctx: CanvasRenderingContext2D, x: number, y: number, level: number, t: number
): void {
  const empty = getImage("gauge-empty");
  const full = getImage("gauge-full");
  const a = ART["gauge-full"];
  const w = a.fw / S, h = a.fh / S;
  if (!empty || !full) {
    fill(ctx, x, y, 14, 60, T.ink);
    fill(ctx, x + 2, y + 58 - 56 * level, 10, 56 * level, T.cola);
    return;
  }
  ctx.drawImage(empty, x, y, w, h);
  const span = GAUGE_BOTTOM - GAUGE_TOP;
  const rows = Math.round(Math.max(0, Math.min(1, level)) * span);
  if (rows > 0) {
    // Skip the painted foam band at the top of the full tube: the foam is
    // drawn at the level instead, below.
    const srcTop = GAUGE_BOTTOM - rows;
    const src = Math.max(srcTop, GAUGE_TOP + 13);
    ctx.drawImage(full, 0, src, a.fw, GAUGE_BOTTOM - src, x, y + src / S, w, (GAUGE_BOTTOM - src) / S);
    // Foam at the top of the liquid, and a couple of bubbles rising.
    const fy = y + srcTop / S;
    fill(ctx, x + 4, fy, w - 8, 2, "#F4D095");
    fill(ctx, x + 4, fy + 2, w - 8, 1, "#C08040");
    for (let i = 0; i < 3; i++) {
      const by = y + GAUGE_BOTTOM / S - ((t * 18 + i * 17) % Math.max(4, rows / S));
      if (by > fy + 3) fill(ctx, x + 6 + ((i * 5) % Math.max(1, w - 13)), by, 1, 1, T.white);
    }
  }
}
