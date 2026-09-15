// ─── Behind the Stick — art at runtime ───────────────────────────────────────
//
// Same contract as every other game here: nothing waits on a download. Each
// draw returns false until its image has arrived and the caller draws a
// code-drawn stand-in, so a phone on bar wifi plays from the first frame.
//
// Two sources:
//   * art the game already had — ingredient bottles, the shaker, the mixing
//     glass, finished drinks, a Let's Do Shots bottle — used as-is;
//   * the landscape rebuild's own sheets, cut into /popup/art/stick2/. Only the
//     names listed in STICK2_READY are fetched, so art that hasn't been drawn
//     yet never shows up as a wall of 404s. Add a name when its file lands.
//
// Images are resampled ONCE per device-pixel size with smoothing on, then
// blitted 1:1 — a per-frame downscale of a 1254px bottle is both slow and mush.

export const STICK2_READY: readonly string[] = [];

const stick2 = (name: string) => `/popup/art/stick2/${name}.png`;

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
  stick2,
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
    ...STICK2_READY.map(stick2),
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

/** True once a stick2 name is both listed and loaded. */
export function hasStick2(name: string): boolean {
  return STICK2_READY.includes(name) && sources.has(stick2(name));
}

function source(url: string): HTMLImageElement | null {
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
