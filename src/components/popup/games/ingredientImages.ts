// ─── Ingredient artwork ──────────────────────────────────────────────────────
//
// The owner's pixel-art bottles, loaded once and kept at the handful of sizes
// the game actually draws them at.
//
// Why pre-scale instead of letting the canvas do it every frame: the source art
// is 1254px square and the game draws it at 22. Scaling that far down per frame,
// for fifteen bubbles at 60fps, is a lot of work for a picture that never
// changes — and with imageSmoothingEnabled off (which the rest of the game
// needs) the result is a mess of dropped rows. Each sprite is resampled ONCE
// into a small offscreen canvas with smoothing ON, and the game then blits that
// at 1:1 with smoothing off, which stays crisp.
//
// Anything without artwork falls back to the string-art sprite in
// ingredients.ts, so a missing file is a slightly plainer bottle rather than a
// hole. sugar and honey have no artwork today.

const AVAILABLE_KEYS = [
  "absinthe",
  "aperitivo",
  "bitters",
  "egg",
  "genepy",
  "gin",
  "ice",
  "lemon",
  "lime",
  "liqueur",
  "rum",
  "tequila",
  "vermouth",
  "whiskey",
] as const;

const AVAILABLE = new Set<string>(AVAILABLE_KEYS);

export function hasArtwork(key: string): boolean {
  return AVAILABLE.has(key);
}

export function artworkUrl(key: string): string | null {
  return AVAILABLE.has(key) ? `/popup/art/ingredients/${key}.png` : null;
}

/** Loaded sources, keyed by ingredient. */
const sources = new Map<string, HTMLImageElement>();
/** Resampled copies, keyed "ingredient@height". */
const scaled = new Map<string, HTMLCanvasElement>();

let warmed = false;

/**
 * Start loading every sprite. Safe to call repeatedly; only the first does work.
 *
 * Nothing waits on this — the game draws its fallback until an image arrives,
 * because a frame loop that blocks on a network fetch is a frozen game.
 */
export function warmIngredientArt(): void {
  if (warmed || typeof window === "undefined") return;
  warmed = true;
  for (const key of AVAILABLE_KEYS) {
    const img = new window.Image();
    img.decoding = "async";
    img.src = `/popup/art/ingredients/${key}.png`;
    img.onload = () => sources.set(key, img);
  }
}

/**
 * A sprite resampled to `height` px, or null if it isn't ready.
 *
 * Aspect is preserved and the art is trimmed of nothing — the source images are
 * square with the bottle centred, so the transparent margin is part of the
 * spacing the artist drew.
 */
export function ingredientArt(key: string, height: number): HTMLCanvasElement | null {
  const h = Math.max(1, Math.round(height));
  const cacheKey = `${key}@${h}`;
  const cached = scaled.get(cacheKey);
  if (cached) return cached;

  const src = sources.get(key);
  if (!src || !src.complete || src.naturalWidth === 0) return null;

  const w = Math.max(1, Math.round((src.naturalWidth / src.naturalHeight) * h));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;

  // Smoothing ON for the one-off downscale: this is where we WANT the averaging,
  // so a 1254px bottle becomes a clean 22px one instead of whichever rows
  // happened to survive nearest-neighbour.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);

  scaled.set(cacheKey, c);
  return c;
}
