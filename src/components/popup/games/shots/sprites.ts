// ─── Let's Do Shots! — art at runtime ────────────────────────────────────────
//
// Two things live here, and the game deliberately cannot tell them apart:
//
//   1. Where every PNG is, and how to get it on screen crisply.
//   2. A CODE-DRAWN stand-in for each one.
//
// A bottle whose art has not downloaded yet is drawn as a bottle, not as a
// coloured square and not as nothing. That is what lets the board come up
// instantly on a phone at a bar with three bars of signal: the stage is
// playable from the first frame and the painted bottles fade in underneath as
// they arrive. It is also what let the whole game be built and balanced before
// a single sprite existed.
//
// Images are PRE-SCALED into the handful of sizes the game actually draws, then
// blitted 1:1. Resampling a 200px source down to a 30px tile sixty times a
// second, for fifty-six tiles, is enormous waste for a picture that never
// changes — and with smoothing off it drops rows and turns the label to mush.
// Each size is resampled once, with smoothing on, and cached.

import { BOTTLES, type BottleId, type CellKind } from "./bottles";
import { C } from "./constants";

const ART_BASE = "/popup/art/shots";

// ─── Loading ─────────────────────────────────────────────────────────────────

type Status = "idle" | "loading" | "ready" | "failed";

const images = new Map<string, HTMLImageElement>();
const status = new Map<string, Status>();

/**
 * The image for a url, requesting it the first time it is asked for.
 *
 * Returns null until it arrives, and null forever if it 404s — every caller
 * has a stand-in ready for exactly that, so a missing file costs a nicer
 * picture and never a broken screen.
 */
export function getImage(url: string): HTMLImageElement | null {
  const state = status.get(url);
  if (state === "ready") return images.get(url) ?? null;
  if (state === "loading" || state === "failed") return null;
  if (typeof window === "undefined") return null;

  status.set(url, "loading");
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    images.set(url, img);
    status.set(url, "ready");
  };
  img.onerror = () => status.set(url, "failed");
  img.src = url;
  return null;
}

/** Start a download now, for art the next screen is about to need. */
export function prefetch(urls: string[]): void {
  for (const u of urls) getImage(u);
}

export function bottleUrl(kind: BottleId): string {
  return `${ART_BASE}/bottle-${kind}.png`;
}

/**
 * The coffee cup and the bar back have no artwork yet, so both are drawn in
 * code below. The urls are wired up anyway: drop `powerup-coffee.png` or
 * `barback.png` into the folder and they take over on the next load, with no
 * code change. See the notes at the bottom of docs/lets-do-shots.md.
 */
export function coffeeUrl(): string {
  return `${ART_BASE}/powerup-coffee.png`;
}

/**
 * His run cycle, laid out left to right as one strip.
 *
 * Nine frames of running AND throwing: the bottles leaving his hand are drawn
 * into the artwork, so the game plays the sheet and adds nothing of its own.
 * Must match BARBACK_FRAMES in scripts/shots-art.mjs, which warns if the
 * delivered sheet cuts into a different number.
 */
export function barbackUrl(): string {
  return `${ART_BASE}/barback.png`;
}
export const BARBACK_FRAMES = 9;

/**
 * How much of a frame he actually is, and where his feet are in it.
 *
 * The frame is over twice his height because the bottles he throws climb most
 * of the way up it. Sizing him by the frame would therefore draw him at half
 * the height asked for, so the caller passes the height it wants HIM to be and
 * these two turn that into the frame's box.
 */
const BARBACK_BODY = 0.46;
const BARBACK_FEET = 0.94;

/** One of a guest's three panels. */
export function guestUrl(slug: string, panel: "order" | "mad" | "happy"): string {
  return `${ART_BASE}/${slug}-${panel}.png`;
}

/** The bartender's two lines, lettered into the artwork already. */
export function bartenderUrl(which: "ask" | "go"): string {
  return `${ART_BASE}/bartender-${which}.png`;
}

/**
 * How the bartender is taking it.
 *
 * He stands above the board for the whole stage, and he is the game's only
 * continuous feedback that is not a number: a flinch when a swipe breaks
 * nothing, a grin when it does, both arms up for the guest's own shot.
 */
export const MOODS = ["concentrating", "scared", "happy", "celebrating"] as const;
export type Mood = (typeof MOODS)[number];

export function moodUrl(mood: Mood): string {
  return `${ART_BASE}/bartender-${mood}.png`;
}

/** The marquee, for the front page. */
export function logoUrl(): string {
  return `${ART_BASE}/logo.png`;
}

/**
 * The bartender behind the bar, standing on `groundY`, `h` tall.
 *
 * All four moods are cut from one shared frame at import time, so they are the
 * same size and register with each other — he changes expression without
 * changing size or shifting sideways. See scripts/shots-art.mjs.
 */
export function drawMood(
  ctx: CanvasRenderingContext2D,
  mood: Mood,
  cx: number,
  groundY: number,
  h: number
): void {
  const art = scaledTo(moodUrl(mood), Math.round(h));
  if (art) {
    ctx.drawImage(art, Math.round(cx - art.width / 2), Math.round(groundY - art.height));
    return;
  }
  drawMoodShape(ctx, mood, cx, groundY, Math.round(h));
}

/**
 * The stand-in bartender: a bust, with the expression carried by the eyebrows
 * and the mouth alone.
 *
 * Those two are enough at this size, and they are the two the real art changes
 * most — so the fallback reads as the same character in the same mood rather
 * than as a different placeholder for each.
 */
function drawMoodShape(
  ctx: CanvasRenderingContext2D,
  mood: Mood,
  cx: number,
  groundY: number,
  h: number
): void {
  const w = Math.round(h * 0.62);
  const left = Math.round(cx - w / 2);
  const top = groundY - h;
  const headH = Math.round(h * 0.44);
  const headW = Math.round(w * 0.62);
  const hx = Math.round(cx - headW / 2);

  // Shirt
  ctx.fillStyle = C.black;
  ctx.fillRect(left - 1, top + headH - 1, w + 2, h - headH + 2);
  ctx.fillStyle = "#232C55";
  ctx.fillRect(left, top + headH, w, h - headH);

  // Head
  ctx.fillStyle = C.black;
  ctx.fillRect(hx - 1, top - 1, headW + 2, headH + 2);
  ctx.fillStyle = "#F0C89A";
  ctx.fillRect(hx, top, headW, headH);
  ctx.fillStyle = "#7A4A22";
  ctx.fillRect(hx, top, headW, Math.max(2, Math.round(headH * 0.22)));

  const eyeY = top + Math.round(headH * 0.42);
  const eyeW = Math.max(2, Math.round(headW * 0.16));
  const lx = hx + Math.round(headW * 0.2);
  const rx = hx + headW - Math.round(headW * 0.2) - eyeW;
  ctx.fillStyle = C.black;
  ctx.fillRect(lx, eyeY, eyeW, eyeW);
  ctx.fillRect(rx, eyeY, eyeW, eyeW);

  // Brows carry most of it: down and in for concentrating, high for scared.
  const browY = mood === "scared" ? eyeY - eyeW * 2 : eyeY - eyeW - 1;
  const tilt = mood === "concentrating" ? 1 : 0;
  ctx.fillRect(lx, browY + tilt, eyeW + 1, 1);
  ctx.fillRect(rx - 1, browY + tilt, eyeW + 1, 1);

  // Mouth
  const mouthY = top + Math.round(headH * 0.72);
  const mw = Math.round(headW * 0.4);
  const mx = Math.round(cx - mw / 2);
  ctx.fillStyle = mood === "concentrating" ? C.black : "#7A1520";
  const mh = mood === "celebrating" ? Math.max(3, eyeW * 2) : mood === "happy" ? 2 : mood === "scared" ? Math.max(2, eyeW) : 1;
  ctx.fillRect(mx, mouthY, mw, mh);

  // A raised bottle when there is something to celebrate.
  if (mood === "celebrating") {
    ctx.fillStyle = C.black;
    ctx.fillRect(left - Math.round(w * 0.18), top - Math.round(h * 0.1), Math.max(3, Math.round(w * 0.16)), Math.round(h * 0.3));
    ctx.fillStyle = "#C46A18";
    ctx.fillRect(left - Math.round(w * 0.18) + 1, top - Math.round(h * 0.1) + 1, Math.max(1, Math.round(w * 0.16) - 2), Math.round(h * 0.3) - 2);
  }
}

// ─── Pre-scaling ─────────────────────────────────────────────────────────────

const scaled = new Map<string, HTMLCanvasElement>();

/**
 * A copy of `url` boxed to `h` pixels tall, resampled once and kept.
 *
 * Keyed on url AND height, because the same bottle is drawn at three sizes —
 * board tile, HUD counter, recipe strip — and re-deriving any of them per frame
 * would give back everything this cache is here to save.
 */
function scaledTo(url: string, h: number): HTMLCanvasElement | null {
  const key = `${url}@${h}`;
  const hit = scaled.get(key);
  if (hit) return hit;

  const img = getImage(url);
  if (!img || !img.naturalWidth) return null;

  const w = Math.max(1, Math.round((img.naturalWidth / img.naturalHeight) * h));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // Smoothing ON for this one pass: a filtered reduction of pixel art lands
  // back on clean blocks, where nearest-neighbour at a fractional ratio drops
  // whole rows out of them.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  scaled.set(key, canvas);
  return canvas;
}

// ─── Bottles ─────────────────────────────────────────────────────────────────

/**
 * Draw a bottle centred in a box, as large as fits.
 *
 * `alpha` and `scale` are for the break: a bottle grows and fades as it
 * shatters, and doing that here rather than in the caller keeps the fallback
 * and the artwork behaving identically.
 */
export function drawBottle(
  ctx: CanvasRenderingContext2D,
  kind: CellKind,
  cx: number,
  cy: number,
  boxH: number,
  opts: { alpha?: number; scale?: number } = {}
): void {
  const alpha = opts.alpha ?? 1;
  const scale = opts.scale ?? 1;
  if (alpha <= 0.01) return;

  const h = Math.round(boxH * scale);
  const url = kind === "coffee" ? coffeeUrl() : bottleUrl(kind);
  const art = scaledTo(url, h);

  ctx.save();
  ctx.globalAlpha = alpha;
  if (art) {
    ctx.drawImage(art, Math.round(cx - art.width / 2), Math.round(cy - art.height / 2));
  } else if (kind === "coffee") {
    drawCoffeeShape(ctx, cx, cy, h);
  } else {
    drawBottleShape(ctx, kind, cx, cy, h);
  }
  ctx.restore();
}

/**
 * The stand-in bottle: neck, shoulder, body, label.
 *
 * More than a coloured box on purpose. The player's real task is telling ten
 * spirits apart at thirty pixels, and if the fallback did not have the same
 * silhouette and the same label block as the artwork, the game would be a
 * measurably different — and easier — game for the first two seconds.
 */
function drawBottleShape(
  ctx: CanvasRenderingContext2D,
  kind: BottleId,
  cx: number,
  cy: number,
  h: number
): void {
  const def = BOTTLES[kind];
  const w = Math.round(h * 0.62);
  const x = Math.round(cx - w / 2);
  const y = Math.round(cy - h / 2);
  const neckW = Math.round(w * 0.34);
  const neckH = Math.round(h * 0.24);
  const bodyY = y + neckH;
  const bodyH = h - neckH;

  ctx.fillStyle = C.black;
  ctx.fillRect(x - 1, bodyY - 1, w + 2, bodyH + 2);
  ctx.fillRect(Math.round(cx - neckW / 2) - 1, y - 1, neckW + 2, neckH + 2);

  ctx.fillStyle = def.color;
  ctx.fillRect(x, bodyY, w, bodyH);
  ctx.fillRect(Math.round(cx - neckW / 2), y, neckW, neckH);

  // Cap and the shaded side, so the shape reads as glass rather than a slab.
  ctx.fillStyle = def.shade;
  ctx.fillRect(Math.round(cx - neckW / 2), y, neckW, Math.round(neckH * 0.35));
  ctx.fillRect(x + w - Math.max(2, Math.round(w * 0.16)), bodyY, Math.max(2, Math.round(w * 0.16)), bodyH);

  // Label: the block the eye actually uses to tell two dark spirits apart.
  const lw = Math.round(w * 0.78), lh = Math.round(bodyH * 0.34);
  const lx = Math.round(cx - lw / 2), ly = Math.round(bodyY + bodyH * 0.3);
  ctx.fillStyle = C.bone;
  ctx.fillRect(lx, ly, lw, lh);
  ctx.fillStyle = def.shade;
  ctx.fillRect(lx + 1, ly + 1, lw - 2, lh - 2);
}

/** The stand-in coffee cup: mug, handle, and a curl of steam. */
function drawCoffeeShape(ctx: CanvasRenderingContext2D, cx: number, cy: number, h: number): void {
  const w = Math.round(h * 0.72);
  const cupH = Math.round(h * 0.52);
  const x = Math.round(cx - w / 2);
  const y = Math.round(cy - cupH / 2 + h * 0.1);

  ctx.fillStyle = C.black;
  ctx.fillRect(x - 1, y - 1, w + 2, cupH + 2);
  ctx.fillStyle = C.bone;
  ctx.fillRect(x, y, w, cupH);
  ctx.fillStyle = "#6B3A16";
  ctx.fillRect(x + 2, y + 2, w - 4, Math.max(2, Math.round(cupH * 0.22)));
  ctx.fillStyle = "#C8C0A8";
  ctx.fillRect(x, y + cupH - Math.round(cupH * 0.2), w, Math.round(cupH * 0.2));

  // Handle
  const hx = x + w, hy = y + Math.round(cupH * 0.3), hh = Math.round(cupH * 0.4);
  ctx.fillStyle = C.black;
  ctx.fillRect(hx, hy - 1, 4, hh + 2);
  ctx.fillStyle = C.bone;
  ctx.fillRect(hx, hy, 3, hh);
  ctx.fillStyle = C.black;
  ctx.fillRect(hx, hy + 2, 1, hh - 4);

  // Steam — two ticks, offset, so it reads as rising rather than as antennae.
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillRect(Math.round(cx - w * 0.2), y - Math.round(h * 0.22), 2, Math.round(h * 0.14));
  ctx.fillRect(Math.round(cx + w * 0.08), y - Math.round(h * 0.28), 2, Math.round(h * 0.18));
}

// ─── The bar back ────────────────────────────────────────────────────────────

/**
 * The runner who restocks the top of the board.
 *
 * Drawn in code until his sheet arrives. He is pure theatre — the game does not
 * wait for him and nothing about a stage depends on where he is — so a
 * placeholder here costs a nicer picture and nothing else.
 */
export function drawBarBack(
  ctx: CanvasRenderingContext2D,
  cx: number,
  groundY: number,
  bodyH: number,
  frame: number
): void {
  const sheet = getImage(barbackUrl());
  if (sheet && sheet.naturalWidth) {
    const cw = sheet.naturalWidth / BARBACK_FRAMES;
    const frameH = bodyH / BARBACK_BODY;
    const frameW = (cw / sheet.naturalHeight) * frameH;
    const top = groundY - BARBACK_FEET * frameH;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      sheet,
      Math.floor((frame % BARBACK_FRAMES) * cw), 0, Math.floor(cw), sheet.naturalHeight,
      Math.round(cx - frameW / 2), Math.round(top), Math.round(frameW), Math.round(frameH)
    );
    ctx.imageSmoothingEnabled = false;
    return;
  }

  const bob = frame % 2 === 0 ? 0 : 1;
  const w = Math.round(bodyH * 0.42);
  const left = Math.round(cx - w / 2);
  const top = Math.round(groundY - bodyH + bob);

  // Head, apron, arms, and legs that swap on the beat. At this size the walk is
  // carried entirely by the legs and the bob; anything more is invisible.
  ctx.fillStyle = "#F0C89A";
  ctx.fillRect(left + Math.round(w * 0.25), top, Math.round(w * 0.5), Math.round(bodyH * 0.24));
  ctx.fillStyle = C.black;
  ctx.fillRect(left + Math.round(w * 0.25), top, Math.round(w * 0.5), Math.round(bodyH * 0.08));
  ctx.fillStyle = "#1B2A46";
  ctx.fillRect(left, top + Math.round(bodyH * 0.24), w, Math.round(bodyH * 0.42));
  // A narrow apron, not a white slab: at thirty pixels tall a wide light panel
  // swallows the whole figure and he stops reading as a person.
  ctx.fillStyle = C.bone;
  ctx.fillRect(left + Math.round(w * 0.28), top + Math.round(bodyH * 0.38), Math.round(w * 0.44), Math.round(bodyH * 0.26));
  ctx.fillStyle = "#F0C89A";
  const armY = top + Math.round(bodyH * 0.24);
  ctx.fillRect(left - 2, armY - Math.round(bodyH * 0.08) * (bob ? 1 : 0), 3, Math.round(bodyH * 0.3));
  ctx.fillRect(left + w - 1, armY - Math.round(bodyH * 0.08) * (bob ? 0 : 1), 3, Math.round(bodyH * 0.3));
  ctx.fillStyle = "#101828";
  const legY = top + Math.round(bodyH * 0.66);
  const legH = bodyH - Math.round(bodyH * 0.66) - bob;
  ctx.fillRect(left + (bob ? 0 : 2), legY, Math.round(w * 0.34), legH);
  ctx.fillRect(left + w - Math.round(w * 0.34) - (bob ? 2 : 0), legY, Math.round(w * 0.34), legH);
}
