// ─── Behind the Stick — art at runtime ───────────────────────────────────────
//
// The painted sprites, cut from the owner's sheets into /popup/art/stick/.
//
// Same contract as the other games: nothing waits on a download. Every draw
// returns false until its image has arrived, and the caller draws its
// code-drawn stand-in instead, so a phone on bar wifi gets a playable game on
// the first frame and the art fades in as it lands.
//
// Images are resampled ONCE per size into an offscreen canvas, with smoothing
// on, and then blitted 1:1 with smoothing off — the same reason as
// ingredientImages.ts: a per-frame downscale with smoothing off drops rows and
// turns a face to mush.

import { PIXEL_SCALE } from "./arcade";

const ART_BASE = "/popup/art/stick";

export const STICK_ART = [
  // Backgrounds, already at the buffer's 448x576
  "bg-backbar",
  "bg-tank",
  "bg-card",
  // The bartender. Every pose shares one canvas, so they swap without jumping.
  "bartender-happy",
  "bartender-worried",
  "bartender-panic",
  "bartender-over",
  "bartender-shake-up",
  "bartender-shake-down",
  "bartender-serve",
  "bartender-stir",
  // The guest at the serve, facing left
  "guest-wait",
  "guest-happy",
  "guest-angry",
  // Shake and stir
  "shaker-1",
  "shaker-2",
  "mixing-glass",
  "bar-spoon",
  "swirl-1",
  "swirl-2",
  "swirl-3",
  // The rail
  "rail-strip",
  "pour-window",
  "bar-front",
  "splash-1",
  "splash-2",
  "splash-3",
  "sparkle",
  // Bubble Buster
  "bubble",
  "bubble-pop-1",
  "bubble-pop-2",
  "bubble-pop-3",
  // HUD and set dressing
  "life",
  "life-lost",
  "neon-on",
  "neon-off",
  // Words
  "banner-order-up",
  "banner-shake-it",
  "banner-stir-it",
  "banner-nice-one",
  "banner-too-slow",
  "banner-game-over",
  "banner-round",
  "pop-perfect",
  "pop-good",
  "pop-miss",
  "pop-oops",
  // The finished drinks, one per cocktail key
  "drink-tommys-margarita",
  "drink-gimlet",
  "drink-margarita",
  "drink-manhattan",
  "drink-old-fashioned",
  "drink-whiskey-sour",
  "drink-negroni",
  "drink-martini",
  "drink-last-word",
  "drink-sazerac",
  "drink-corpse-reviver",
  "drink-daiquiri",
  "drink-mai-tai",
  "drink-saturn",
] as const;

export type StickArtName = (typeof STICK_ART)[number];

/** Deck controls are <img> tags, not canvas draws, so they only need a url. */
export const DECK_ART = {
  shake: `${ART_BASE}/btn-shake.png`,
  shakePressed: `${ART_BASE}/btn-shake-pressed.png`,
  dialTrack: `${ART_BASE}/dial-track.png`,
  dialKnob: `${ART_BASE}/dial-knob.png`,
} as const;

export function artUrl(name: string): string {
  return `${ART_BASE}/${name}.png`;
}

/** The drink sprite for a cocktail, if one was drawn for it. */
export function drinkArt(cocktailKey: string): StickArtName | null {
  const name = `drink-${cocktailKey}`;
  return (STICK_ART as readonly string[]).includes(name) ? (name as StickArtName) : null;
}

// ─── Loading ─────────────────────────────────────────────────────────────────

const sources = new Map<string, HTMLImageElement>();
const scaled = new Map<string, HTMLCanvasElement>();
let warmed = false;

/** Start every download. Safe to call repeatedly; only the first does work. */
export function warmStickArt(): void {
  if (warmed || typeof window === "undefined") return;
  warmed = true;
  for (const name of STICK_ART) {
    const img = new window.Image();
    img.decoding = "async";
    img.onload = () => sources.set(name, img);
    img.src = artUrl(name);
  }
  // The deck art is shown by the browser, but fetching it now means the shake
  // button is already there the moment the shake starts.
  for (const url of Object.values(DECK_ART)) {
    const img = new window.Image();
    img.src = url;
  }
}

function source(name: StickArtName): HTMLImageElement | null {
  const img = sources.get(name);
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

export function artReady(name: StickArtName): boolean {
  return source(name) !== null;
}

/** Natural aspect (width / height), or null until loaded. */
export function artAspect(name: StickArtName): number | null {
  const img = source(name);
  return img ? img.naturalWidth / img.naturalHeight : null;
}

/** Natural height in GAME pixels — the sheets were cut at device density. */
export function artGameHeight(name: StickArtName): number | null {
  const img = source(name);
  return img ? img.naturalHeight / PIXEL_SCALE : null;
}

function resampled(name: StickArtName, dw: number, dh: number): HTMLCanvasElement | null {
  const key = `${name}@${dw}x${dh}`;
  const hit = scaled.get(key);
  if (hit) return hit;
  const img = source(name);
  if (!img) return null;

  // Animated scales (a sparkle growing, a splash) would otherwise fill this
  // without bound. Rebuilding a few copies now and then is cheap.
  if (scaled.size > 300) scaled.clear();

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

// ─── Drawing ─────────────────────────────────────────────────────────────────

/**
 * Draw into a game-space box. Snapped to the device grid so the 1:1 blit
 * really is 1:1 and never lands on a half pixel.
 */
export function drawArt(
  ctx: CanvasRenderingContext2D,
  name: StickArtName,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha = 1
): boolean {
  const dx = Math.round(x * PIXEL_SCALE);
  const dy = Math.round(y * PIXEL_SCALE);
  const dw = Math.max(1, Math.round(w * PIXEL_SCALE));
  const dh = Math.max(1, Math.round(h * PIXEL_SCALE));
  const c = resampled(name, dw, dh);
  if (!c) return false;
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.drawImage(c, dx / PIXEL_SCALE, dy / PIXEL_SCALE, dw / PIXEL_SCALE, dh / PIXEL_SCALE);
  if (alpha < 1) ctx.globalAlpha = 1;
  return true;
}

/** Draw at a height, keeping aspect, with its bottom edge centred on (cx, bottom). */
export function drawArtStanding(
  ctx: CanvasRenderingContext2D,
  name: StickArtName,
  cx: number,
  bottom: number,
  h: number,
  alpha = 1
): boolean {
  const a = artAspect(name);
  if (a === null) return false;
  const w = h * a;
  return drawArt(ctx, name, cx - w / 2, bottom - h, w, h, alpha);
}

/** Draw at a width, keeping aspect, centred on (cx, cy). */
export function drawArtCentred(
  ctx: CanvasRenderingContext2D,
  name: StickArtName,
  cx: number,
  cy: number,
  w: number,
  alpha = 1
): boolean {
  const a = artAspect(name);
  if (a === null) return false;
  const h = w / a;
  return drawArt(ctx, name, cx - w / 2, cy - h / 2, w, h, alpha);
}

/**
 * A strip wider than its art: end caps scaled to the height, and the middle
 * CROPPED from the centre of the source rather than stretched, so a riveted
 * rail or a mat's dot pattern keeps its proportions at any width.
 */
export function drawArtStrip(
  ctx: CanvasRenderingContext2D,
  name: StickArtName,
  x: number,
  y: number,
  w: number,
  h: number,
  /** Cap width as a fraction of the source height. */
  capOfHeight: number
): boolean {
  const img = source(name);
  if (!img) return false;
  const k = h / img.naturalHeight;
  const capSrc = Math.round(img.naturalHeight * capOfHeight);
  const capDst = capSrc * k;
  const midDst = Math.max(0, w - capDst * 2);
  const midSrc = Math.min(img.naturalWidth - capSrc * 2, midDst / k);
  const midSx = (img.naturalWidth - midSrc) / 2;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, capSrc, img.naturalHeight, x, y, capDst, h);
  ctx.drawImage(img, midSx, 0, midSrc, img.naturalHeight, x + capDst, y, midDst, h);
  ctx.drawImage(
    img,
    img.naturalWidth - capSrc,
    0,
    capSrc,
    img.naturalHeight,
    x + w - capDst,
    y,
    capDst,
    h
  );
  ctx.restore();
  return true;
}

/**
 * A frame at any size: corners kept square at `corner` game pixels, edges
 * stretched along their length only. For the pour window, which is drawn far
 * narrower than the wide frame it was painted as.
 */
export function drawArtFrame(
  ctx: CanvasRenderingContext2D,
  name: StickArtName,
  x: number,
  y: number,
  w: number,
  h: number,
  /** Corner size as a fraction of the source height. */
  cornerOfHeight: number,
  corner: number
): boolean {
  const img = source(name);
  if (!img) return false;
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const c = Math.round(H * cornerOfHeight);
  const sx = [0, c, W - c];
  const sw = [c, W - c * 2, c];
  const sy = [0, c, H - c];
  const sh = [c, H - c * 2, c];
  const dx = [x, x + corner, x + w - corner];
  const dw = [corner, w - corner * 2, corner];
  const dy = [y, y + corner, y + h - corner];
  const dh = [corner, h - corner * 2, corner];

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  for (let r = 0; r < 3; r++) {
    for (let q = 0; q < 3; q++) {
      if (r === 1 && q === 1) continue; // the frame is empty in the middle
      if (dw[q] <= 0 || dh[r] <= 0) continue;
      ctx.drawImage(img, sx[q], sy[r], sw[q], sh[r], dx[q], dy[r], dw[q], dh[r]);
    }
  }
  ctx.restore();
  return true;
}
