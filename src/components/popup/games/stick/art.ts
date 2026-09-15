// ─── Behind the Stick — art at runtime ───────────────────────────────────────
//
// Same contract as every other game here: nothing waits on a download. Each
// draw returns false until its image has arrived and the caller draws a
// code-drawn stand-in, so a phone on bar wifi plays from the first frame.
//
// Two sources:
//   * art the game already had — ingredient bottles, the shaker, the mixing
//     glass, finished drinks, the bartender and guest, a Let's Do Shots bottle —
//     used as-is;
//   * the landscape rebuild's own sheets (sliced from the owner's v2 grids),
//     in /popup/art/stick2/ — ART.v2(name).
//
// Images are resampled ONCE per device-pixel size with smoothing on, then
// blitted 1:1 — a per-frame downscale of a 1254px bottle is both slow and mush.

/** Every v2 sprite, by name. Backgrounds are JPEGs; everything else keyed PNG. */
const V2_PNG = [
  "beer-bottle", "beer-stream", "bomb-1", "bomb-2", "boom-1", "boom-2", "boom-3", "boom-4",
  "btn-0-press", "btn-0", "btn-1-press", "btn-1", "btn-2-press", "btn-2", "btn-3-press", "btn-3",
  "bucket", "can", "champ-bottle", "champ-pop", "check", "cork", "cross", "flame-1", "flame-2",
  "glass-broken", "grab-1", "grab-2", "grab-3", "guest-1-bonk", "guest-1", "guest-2-bonk",
  "guest-2", "guest-3-bonk", "guest-3", "guest-4-bonk", "guest-4", "heart-broken", "heart",
  "ice-chips", "icon-party", "jug", "knocked-out", "lime", "nameplate", "napkin", "pass-1",
  "pass-2", "phone-landscape", "phone-portrait", "phone", "pint", "pop-burst", "salt", "shatter-1",
  "shatter-2", "shot-bottle", "shot-glass", "shot-stream", "snowflake", "speed-lines", "spill-1",
  "spill-2", "spinner", "splat", "spray-1", "spray-2", "star", "stink-1", "stink-2", "sweat",
  "thermometer", "thumb-l", "thumb-r", "ticket", "timer-frame", "tin-1", "trophy", "vodka",
  "w-86d", "w-boom", "w-build-it", "w-everybodys-out", "w-fail", "w-gimme-a-beer", "w-grab",
  "w-last-one-standing", "w-lets-do-shots", "w-order-up", "w-party-mode", "w-pass-phone",
  "w-pop-it", "w-rotate-phone", "w-shake-it", "w-stir-it", "w-success", "w-up-next", "w-your-turn",
  "w-youre-out", "walkout",
] as const;
const V2_JPG = [
  "bg-beer", "bg-champagne", "bg-highway", "bg-main", "bg-shots", "panel-side",
] as const;

export type V2Name = (typeof V2_PNG)[number] | (typeof V2_JPG)[number];

const JPG = new Set<string>(V2_JPG);
const v2 = (name: V2Name) => `/popup/art/stick2/${name}.${JPG.has(name) ? "jpg" : "png"}`;

export const ART = {
  ingredient: (key: string) => `/popup/art/ingredients/${key}.png`,
  drink: (key: string) => `/popup/art/stick/drink-${key}.png`,
  shaker1: "/popup/art/stick/shaker-1.png",
  shaker2: "/popup/art/stick/shaker-2.png",
  mixingGlass: "/popup/art/stick/mixing-glass.png",
  barSpoon: "/popup/art/stick/bar-spoon.png",
  life: "/popup/art/stick/life.png",
  lifeLost: "/popup/art/stick/life-lost.png",
  shotsBottle: "/popup/art/shots/bottle-tequila.png",
  bartender: (pose: "happy" | "worried" | "panic" | "shake-up" | "shake-down" | "stir" | "serve") =>
    `/popup/art/stick/bartender-${pose}.png`,
  guest: (mood: "happy" | "angry" | "wait") => `/popup/art/stick/guest-${mood}.png`,
  v2,
} as const;

const INGREDIENT_KEYS = [
  "absinthe", "aperitivo", "bitters", "egg", "genepy", "gin", "ice", "lemon",
  "lime", "liqueur", "rum", "sugar", "tequila", "vermouth", "whiskey",
];
const DRINK_KEYS = [
  "tommys-margarita", "gimlet", "margarita", "manhattan", "old-fashioned", "whiskey-sour",
  "negroni", "martini", "last-word", "sazerac", "corpse-reviver", "daiquiri", "mai-tai", "saturn",
];

function allUrls(): string[] {
  return [
    ...INGREDIENT_KEYS.map(ART.ingredient),
    ...DRINK_KEYS.map(ART.drink),
    ART.shaker1, ART.shaker2, ART.mixingGlass, ART.barSpoon, ART.life, ART.lifeLost,
    ART.shotsBottle,
    ...(["happy", "worried", "panic", "shake-up", "shake-down", "stir", "serve"] as const).map(ART.bartender),
    ...(["happy", "angry", "wait"] as const).map(ART.guest),
    ...[...V2_PNG, ...V2_JPG].map(v2),
  ];
}

const sources = new Map<string, HTMLImageElement>();
const scaled = new Map<string, HTMLCanvasElement>();
let warmed = false;

export function warmArt(): void {
  if (warmed || typeof window === "undefined") return;
  warmed = true;
  for (const url of allUrls()) {
    const img = new window.Image();
    img.decoding = "async";
    img.onload = () => sources.set(url, img);
    img.src = url;
  }
}

/** The loaded image itself, for draws that crop or slice it. */
export function source(url: string): HTMLImageElement | null {
  const img = sources.get(url);
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

export function aspect(url: string): number | null {
  const img = source(url);
  return img ? img.naturalWidth / img.naturalHeight : null;
}

function resampled(url: string, dw: number, dh: number): HTMLCanvasElement | null {
  const key = `${url}@${dw}x${dh}`;
  const hit = scaled.get(key);
  if (hit) return hit;
  const img = source(url);
  if (!img) return null;
  // Animated sizes would otherwise grow this without bound.
  if (scaled.size > 400) scaled.clear();
  const c = document.createElement("canvas");
  c.width = dw;
  c.height = dh;
  const cx = c.getContext("2d");
  if (!cx) return null;
  cx.imageSmoothingEnabled = true;
  cx.imageSmoothingQuality = "high";
  cx.drawImage(img, 0, 0, dw, dh);
  scaled.set(key, c);
  return c;
}

/**
 * Draw into a logical box. `s` is device pixels per logical unit; sizes are
 * snapped to whole device pixels, and anything animating is bucketed so a
 * growing sprite doesn't resample every frame.
 */
export function drawImg(
  ctx: CanvasRenderingContext2D,
  s: number,
  url: string,
  x: number,
  y: number,
  w: number,
  h: number
): boolean {
  const dw = Math.max(1, Math.round((w * s) / 2) * 2);
  const dh = Math.max(1, Math.round((h * s) / 2) * 2);
  const c = resampled(url, dw, dh);
  if (!c) return false;
  ctx.drawImage(c, x, y, dw / s, dh / s);
  return true;
}

/** Draw at a height keeping aspect, centred on (cx, cy). */
export function drawImgCentred(
  ctx: CanvasRenderingContext2D,
  s: number,
  url: string,
  cx: number,
  cy: number,
  h: number
): boolean {
  const a = aspect(url);
  if (a === null) return false;
  const w = h * a;
  return drawImg(ctx, s, url, cx - w / 2, cy - h / 2, w, h);
}

/**
 * Fill a box with a background, scaled to cover it and centred — except that
 * the source row `anchorSrc` (as a fraction of the image height) is pinned to
 * logical y `anchorY`, so a painted bar top lines up with the one the game
 * plays on. Pass no anchor to centre vertically.
 */
export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  s: number,
  url: string,
  x: number,
  y: number,
  w: number,
  h: number,
  anchorSrc?: number,
  anchorY?: number
): boolean {
  const img = source(url);
  if (!img) return false;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  let k = Math.max(w / iw, h / ih);
  let oy: number;
  if (anchorSrc !== undefined && anchorY !== undefined) {
    const srcY = anchorSrc * ih;
    const dstY = anchorY - y;
    k = Math.max(k, dstY / srcY, (h - dstY) / (ih - srcY));
    oy = dstY - srcY * k;
  } else {
    oy = (h - ih * k) / 2;
  }
  const ox = (w - iw * k) / 2;
  const dw = Math.max(1, Math.round(iw * k * s));
  const dh = Math.max(1, Math.round(ih * k * s));
  const c = resampled(url, dw, dh);
  if (!c) return false;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(c, x + ox, y + oy, dw / s, dh / s);
  ctx.restore();
  return true;
}

/**
 * A horizontal frame at any width: end caps kept at their painted shape
 * (as wide as the frame is tall), the middle stretched along its length.
 */
export function drawThreeSlice(
  ctx: CanvasRenderingContext2D,
  url: string,
  x: number,
  y: number,
  w: number,
  h: number
): boolean {
  const img = source(url);
  if (!img) return false;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const capSrc = Math.min(iw / 2 - 1, ih * 0.9);
  const capDst = Math.min(w / 2, (capSrc * h) / ih);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, 0, 0, capSrc, ih, x, y, capDst, h);
  ctx.drawImage(img, capSrc, 0, iw - capSrc * 2, ih, x + capDst, y, w - capDst * 2, h);
  ctx.drawImage(img, iw - capSrc, 0, capSrc, ih, x + w - capDst, y, capDst, h);
  ctx.restore();
  return true;
}

/** Draw at a width keeping aspect, centred on (cx, cy). For the word banners. */
export function drawImgWide(
  ctx: CanvasRenderingContext2D,
  s: number,
  url: string,
  cx: number,
  cy: number,
  w: number
): boolean {
  const a = aspect(url);
  if (a === null) return false;
  const h = w / a;
  return drawImg(ctx, s, url, cx - w / 2, cy - h / 2, w, h);
}
