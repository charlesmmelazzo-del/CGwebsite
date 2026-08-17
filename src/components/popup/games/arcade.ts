// ─── Golden-age arcade toolkit ───────────────────────────────────────────────
//
// Everything the mini games need to look like a 1981 upright cabinet: a fixed
// saturated palette, a 5x7 bitmap font, and string-art sprites.
//
// Games render into a small fixed-resolution buffer (224x288 — the portrait
// shape of a Donkey Kong board) which is then scaled up with smoothing off.
// That's what produces honest chunky pixels instead of a smooth modern canvas
// pretending to be retro, and it means the games look identical on a phone at
// the bar and on a desktop.
//
// No image assets: every sprite here is drawn from source, so there's nothing
// to upload, nothing to 404, and the whole thing stays a few kilobytes.

/** The internal buffer every game draws into. */
export const GAME_W = 224;
export const GAME_H = 288;

/**
 * Saturated primaries pulled from the era's hardware palettes — Midway and
 * Atari boards had a small fixed set of colors and it's a big part of why
 * those games look the way they do. Resist adding tasteful modern shades.
 */
export const P = {
  black: "#000000",
  night: "#0B0B18",
  white: "#FFFFFF",
  bone: "#E8E8D0",
  red: "#E42B20",
  crimson: "#A01010",
  orange: "#FF7B00",
  amber: "#FFA000",
  yellow: "#FFD500",
  lime: "#9CE800",
  green: "#00B83C",
  forest: "#006020",
  cyan: "#3CE0E0",
  teal: "#008890",
  blue: "#2038EC",
  navy: "#101858",
  purple: "#8828C8",
  magenta: "#E040C0",
  pink: "#FF9CB0",
  brown: "#8B4513",
  wood: "#B06830",
  tan: "#D8A860",
  skin: "#FFB88C",
  grey: "#909090",
  slate: "#484858",
} as const;

// ─── 5x7 bitmap font ─────────────────────────────────────────────────────────
// Each glyph is 7 rows; each row is 5 bits, bit 4 (16) leftmost.

const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x1f],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x06, 0x06, 0x04],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x00, 0x04],
  "'": [0x04, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00],
  ":": [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x0c, 0x00],
  "-": [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
  "+": [0x00, 0x04, 0x04, 0x1f, 0x04, 0x04, 0x00],
  "=": [0x00, 0x00, 0x1f, 0x00, 0x1f, 0x00, 0x00],
  "/": [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "<": [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02],
  ">": [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08],
  "*": [0x00, 0x15, 0x0e, 0x1f, 0x0e, 0x15, 0x00],
  "$": [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  "%": [0x19, 0x1a, 0x02, 0x04, 0x08, 0x0b, 0x13],
  "#": [0x0a, 0x0a, 0x1f, 0x0a, 0x1f, 0x0a, 0x0a],
  '"': [0x0a, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00],
};

const GLYPH_W = 5;
const GLYPH_H = 7;

export type TextAlign = "left" | "center" | "right";

/** Width in buffer pixels that `text` will occupy at `scale`. */
export function textWidth(text: string, scale = 1): number {
  if (!text.length) return 0;
  return (text.length * (GLYPH_W + 1) - 1) * scale;
}

/**
 * Draw uppercase bitmap text. Lowercase is folded to uppercase — these cabinets
 * didn't have a lowercase, and mixing in a smooth system font would give the
 * whole illusion away.
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  scale = 1,
  align: TextAlign = "left"
) {
  const upper = text.toUpperCase();
  const w = textWidth(upper, scale);
  let cx = align === "center" ? Math.round(x - w / 2) : align === "right" ? x - w : x;

  ctx.fillStyle = color;
  for (const ch of upper) {
    const glyph = FONT[ch] ?? FONT["?"];
    for (let row = 0; row < GLYPH_H; row++) {
      const bits = glyph[row];
      if (!bits) continue;
      for (let col = 0; col < GLYPH_W; col++) {
        if (bits & (1 << (GLYPH_W - 1 - col))) {
          ctx.fillRect(cx + col * scale, y + row * scale, scale, scale);
        }
      }
    }
    cx += (GLYPH_W + 1) * scale;
  }
}

/** Text with a hard 1px drop shadow — keeps it readable over busy backdrops. */
export function drawTextShadow(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  scale = 1,
  align: TextAlign = "left",
  shadow: string = P.black
) {
  drawText(ctx, text, x + scale, y + scale, shadow, scale, align);
  drawText(ctx, text, x, y, color, scale, align);
}

// ─── String-art sprites ──────────────────────────────────────────────────────

/**
 * A sprite is an array of equal-length strings; each character indexes into a
 * color map. "." (or a space) is transparent.
 *
 * Keeping the art as text means it's legible and editable right here in the
 * source, which matters when the whole look of a game is hand-placed pixels.
 */
export type Sprite = string[];

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
  colors: Record<string, string>,
  scale = 1,
  flip = false
) {
  const h = sprite.length;
  for (let row = 0; row < h; row++) {
    const line = sprite[row];
    for (let col = 0; col < line.length; col++) {
      const key = line[col];
      if (key === "." || key === " ") continue;
      const color = colors[key];
      if (!color) continue;
      const drawCol = flip ? line.length - 1 - col : col;
      ctx.fillStyle = color;
      ctx.fillRect(x + drawCol * scale, y + row * scale, scale, scale);
    }
  }
}

export function spriteWidth(sprite: Sprite, scale = 1): number {
  return (sprite[0]?.length ?? 0) * scale;
}
export function spriteHeight(sprite: Sprite, scale = 1): number {
  return sprite.length * scale;
}

// ─── Small drawing conveniences ──────────────────────────────────────────────

export function rect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function outline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  thickness: number = 1
) {
  rect(ctx, x, y, w, thickness, color);
  rect(ctx, x, y + h - thickness, w, thickness, color);
  rect(ctx, x, y, thickness, h, color);
  rect(ctx, x + w - thickness, y, thickness, h, color);
}

export function clear(ctx: CanvasRenderingContext2D, color: string = P.black) {
  rect(ctx, 0, 0, GAME_W, GAME_H, color);
}

/** Horizontal progress/meter bar with a hard border. */
export function meter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fraction: number,
  fill: string,
  frame: string = P.white
) {
  const f = Math.max(0, Math.min(1, fraction));
  rect(ctx, x, y, w, h, P.black);
  outline(ctx, x, y, w, h, frame);
  if (f > 0) rect(ctx, x + 1, y + 1, Math.max(1, (w - 2) * f), h - 2, fill);
}

/** Zero-padded score, the way a cabinet would show it. */
export function pad(n: number, width = 6): string {
  return Math.max(0, Math.floor(n)).toString().padStart(width, "0");
}

// ─── Timing helpers ──────────────────────────────────────────────────────────

/** Square wave in [0,1] — for blinking text and flashing sprites. */
export function blink(t: number, hz = 2): boolean {
  return Math.floor(t * hz) % 2 === 0;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
