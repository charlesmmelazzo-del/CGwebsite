// ─── Composited characters ───────────────────────────────────────────────────
//
// The bartender and the bar guest, assembled from separate parts so one set of
// drawings covers every pose and every mood.
//
// Two problems this solves, both of which come from the art being drawn by hand
// rather than exported from a rig:
//
//   1. THE PARTS ARE ON DIFFERENT CANVASES. The bartender's arms are 1619x971,
//      his torso and legs 1122x1402, his head and shaker 1254x1254. Overlaying
//      them raw would scatter them. So every part is TRIMMED to its own content
//      bounds on load, and the character is then built from those trimmed boxes
//      using proportions below — which also means a redraw at a different
//      canvas size needs no code change.
//
//   2. THE GAME'S BUFFER IS SMALL. A character drawn at 1254px lands on screen
//      about 50px tall. Each part is therefore resampled once per size into an
//      offscreen canvas (smoothing ON, which is what we want for a downscale)
//      and then blitted 1:1 with smoothing off, which is what we want for the
//      draw.
//
// Nothing here blocks on a load. Until a part arrives the caller's fallback
// draws instead — a frame loop that waits on a fetch is a frozen game.

import { PIXEL_SCALE } from "./arcade";

export type Mood = "happy" | "worried" | "sad";
export type Pose = "idle" | "shake" | "serve";

type PartName = "torso" | "arms" | "legs" | "shaker" | "head-happy" | "head-worried" | "head-sad";

const BARTENDER_PARTS: PartName[] = [
  "torso",
  "arms",
  "legs",
  "shaker",
  "head-happy",
  "head-worried",
  "head-sad",
];
const GUEST_PARTS: PartName[] = ["torso", "arms", "legs", "head-happy", "head-worried", "head-sad"];

export type CharacterName = "bartender" | "guest";

interface Trimmed {
  canvas: HTMLCanvasElement;
  /** Content size, after the transparent margin is cut away. */
  w: number;
  h: number;
}

const trimmed = new Map<string, Trimmed>();
const scaled = new Map<string, HTMLCanvasElement>();
let warmed = false;

/**
 * Cut the transparent margin off a loaded part.
 *
 * Every part is drawn centred in a big square with a lot of empty space, and
 * how much empty space differs per file. Trimming is what makes the parts
 * comparable — after this, "the head is 40 units tall" means the head, not the
 * head plus whatever padding it happened to be exported with.
 */
function trim(img: HTMLImageElement): Trimmed | null {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);

  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  let top = c.height,
    left = c.width,
    right = -1,
    bottom = -1;

  // Anything below 8/255 is a stray anti-aliased pixel, not content.
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 8) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (right < 0) return null;

  const w = right - left + 1;
  const h = bottom - top + 1;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")?.drawImage(c, left, top, w, h, 0, 0, w, h);
  return { canvas: out, w, h };
}

/** Start loading every part. Safe to call repeatedly. */
export function warmCharacterArt(): void {
  if (warmed || typeof window === "undefined") return;
  warmed = true;

  const load = (who: CharacterName, part: PartName) => {
    const img = new window.Image();
    img.decoding = "async";
    img.src = `/popup/art/${who}/${part}.png`;
    img.onload = () => {
      const t = trim(img);
      if (t) trimmed.set(`${who}/${part}`, t);
    };
  };

  for (const p of BARTENDER_PARTS) load("bartender", p);
  for (const p of GUEST_PARTS) load("guest", p);
}

/**
 * A part resampled so its height is `h` GAME pixels, or null if not ready.
 *
 * The canvas it returns is h * PIXEL_SCALE tall — resampled at the density the
 * buffer actually has, then drawn back down to `h` logical units by the caller.
 * Resampling at logical size instead would throw away exactly the detail this
 * whole change exists to keep.
 */
function partAt(who: CharacterName, part: PartName, h: number): HTMLCanvasElement | null {
  const key = `${who}/${part}@${Math.round(h)}`;
  const hit = scaled.get(key);
  if (hit) return hit;

  const src = trimmed.get(`${who}/${part}`);
  if (!src) return null;

  const height = Math.max(1, Math.round(h * PIXEL_SCALE));
  const width = Math.max(1, Math.round((src.w / src.h) * height));
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src.canvas, 0, 0, width, height);

  scaled.set(key, c);
  return c;
}

/** True once every part needed to draw this character has loaded. */
export function characterReady(who: CharacterName): boolean {
  const parts = who === "bartender" ? BARTENDER_PARTS : GUEST_PARTS;
  return parts.every((p) => trimmed.has(`${who}/${p}`));
}

/**
 * Proportions, as fractions of the character's total height.
 *
 * Hand-set rather than measured, because the parts were drawn to overlap: the
 * torso includes shoulders the head sits into, and the legs include hips the
 * torso sits over. Stacking the trimmed boxes edge to edge would leave a
 * floating head and a gap at the waist.
 */
const PROPORTIONS = {
  headH: 0.42,
  torsoH: 0.4,
  legsH: 0.3,
  /** How far the head sinks into the torso, as a fraction of head height. */
  headOverlap: 0.14,
  /** How far the torso sits over the legs, as a fraction of torso height. */
  torsoOverlap: 0.2,
  armsH: 0.26,
};

/**
 * Draw a character with its feet at (cx, baseY) and standing `height` tall.
 *
 * Returns false when the art isn't loaded, so a caller can fall back to its
 * pixel sprite rather than drawing nothing.
 */
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  who: CharacterName,
  cx: number,
  baseY: number,
  height: number,
  opts: { mood?: Mood; pose?: Pose; facing?: 1 | -1; shakeLift?: number } = {}
): boolean {
  const { mood = "happy", pose = "idle", facing = 1, shakeLift = 0 } = opts;
  if (!characterReady(who)) return false;

  const P = PROPORTIONS;
  const legs = partAt(who, "legs", height * P.legsH);
  const torso = partAt(who, "torso", height * P.torsoH);
  const head = partAt(who, `head-${mood}` as PartName, height * P.headH);
  const arms = partAt(who, "arms", height * P.armsH);
  if (!legs || !torso || !head) return false;

  ctx.save();
  if (facing === -1) {
    ctx.translate(cx, 0);
    ctx.scale(-1, 1);
    ctx.translate(-cx, 0);
  }

  // Draw at LOGICAL size: the source is PIXEL_SCALE times denser, and the
  // context carries the matching transform, so this lands 1:1 on device pixels.
  const put = (c: HTMLCanvasElement, centreX: number, topY: number) => {
    const w = c.width / PIXEL_SCALE;
    const h2 = c.height / PIXEL_SCALE;
    ctx.drawImage(c, centreX - w / 2, topY, w, h2);
  };

  // Bottom up, so each part covers the seam of the one below it.
  const legsTop = baseY - legs.height / PIXEL_SCALE;
  put(legs, cx, legsTop);

  const torsoTop = legsTop - (torso.height / PIXEL_SCALE) * (1 - P.torsoOverlap);
  put(torso, cx, torsoTop);

  // Arms belong in front of the torso, and go overhead for a shake.
  if (arms) {
    const armsTop =
      pose === "shake"
        ? torsoTop - (arms.height / PIXEL_SCALE) * (0.62 + shakeLift * 0.1)
        : torsoTop + (torso.height / PIXEL_SCALE) * 0.06;
    put(arms, cx, armsTop);
  }

  const headTop = torsoTop - (head.height / PIXEL_SCALE) * (1 - P.headOverlap);
  put(head, cx, headTop);

  // The tin, held above the raised hands.
  if (who === "bartender" && pose === "shake") {
    const tin = partAt("bartender", "shaker", height * 0.3);
    if (tin) put(tin, cx, headTop - (tin.height / PIXEL_SCALE) * (0.78 + shakeLift * 0.12));
  }

  ctx.restore();
  return true;
}
