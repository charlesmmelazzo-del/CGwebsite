// ─── Tiki Wars — sprites ─────────────────────────────────────────────────────
//
// Two things live here, and the point of the file is that the game cannot tell
// them apart:
//
//   1. A MANIFEST of every Phase 1 asset from docs/tiki-wars-sprites.md.
//   2. A code-drawn PLACEHOLDER for each one.
//
// Drop a real PNG at public/popup/art/tiki/<file> and it replaces its
// placeholder the next time the page loads. No code change, no registration.
// That is what lets the game be built, played and tuned before any art exists,
// and lets art arrive in any order without a rework.
//
// The placeholders are deliberately more than coloured boxes. A blocker has to
// read as heavier than a grunt at 20 pixels tall or the game cannot be balanced
// honestly, and a boss has to be legible enough to fight. They follow the same
// silhouette rules the real art is specced against.
//
// Real images are pre-scaled into discrete depth buckets rather than resampled
// per frame — same reasoning as ingredientImages.ts. Resampling a 1024px source
// down to 20px sixty times a second, for twenty enemies, is enormous waste for
// a picture that never changes, and with smoothing off it produces dropped-row
// mush. Each bucket is resampled ONCE with smoothing on, then blitted 1:1.

import { C } from "./constants";

// ─── Manifest ────────────────────────────────────────────────────────────────

/**
 * A character's whole sheet: one transparent PNG, laid out as a uniform grid.
 *
 * Rows are animations, columns are frames. Cell size is derived from the image
 * — width/cols by height/rows — so the sheet can be authored at any resolution
 * and only the GRID has to be agreed in advance.
 *
 * Sheets are the preferred format, and not only because they are easier to
 * draw. A uniform grid structurally solves the registration problem that loose
 * frames have: every frame is forced to share a cell size and a centre, so a
 * walk cycle physically cannot drift or resize between frames the way separate
 * files silently do.
 */
export interface SheetDef {
  /** Filename under /popup/art/tiki/, without extension. */
  file: string;
  cols: number;
  rows: number;
}

// ─── The cast ────────────────────────────────────────────────────────────────
//
// Enemy art is systematic, so the manifest is DERIVED from these three lists
// rather than written out by hand. Adding a new enemy is one string here plus
// the PNG — not six near-identical manifest entries to keep in step.

/** Soldiers: 4 frames, walk only. One shot each. */
export const SOLDIERS = ["lime", "kiwi", "lemon", "orange", "cherry", "sugarcube"] as const;

/** Blockers: 5 frames — walk x4, then hit. */
export const BLOCKERS = [
  "sugarcane", "worm", "mezcal", "cinnamon", "coconut", "grapefruit", "candycane",
  "milk", "beercan", "coconutcream", "gingerbeer", "cherry", "almond", "blender",
] as const;

/**
 * The hero, one 8-frame sheet PER WEAPON.
 *
 * Walk x4, Hit x2, Celebration, Sad. A whole sheet per gun rather than a body
 * plus arm overlays — nothing needs aligning, and the previous body had pistols
 * painted into it, so overlaying a shotgun put him on screen holding both.
 */
export const GUN_ART = ["pistols", "shotgun", "uzi", "flame", "laser"] as const;
export type GunArt = (typeof GUN_ART)[number];

/** Where each animation starts in the 8-frame strip. */
export const PLAYER_POSE = { walk: 0, hit: 4, cheer: 6, sad: 7 } as const;

/** Bosses: 5 frames — walk x2, attack x2, then hit. */
export const BOSSES = ["baby", "knight", "santa", "king"] as const;

export type SoldierName = (typeof SOLDIERS)[number];
export type BlockerName = (typeof BLOCKERS)[number];
export type BossName = (typeof BOSSES)[number];

export interface SheetDef {
  /** Filename under /popup/art/tiki/, without extension. */
  file: string;
  cols: number;
  rows: number;
}

/** Every character sheet, built from the rosters above. */
export const SHEETS: Record<string, SheetDef> = {
  // The helper shares the hero's 8-frame layout; only its walk is used.
  helper: { file: "helper", cols: 8, rows: 1 },
  ...Object.fromEntries(GUN_ART.map((g) => [
    `player-${g}`, { file: `player-${g}`, cols: 8, rows: 1 },
  ])),
  ...Object.fromEntries(SOLDIERS.map((n) => [n, { file: n, cols: 4, rows: 1 }])),
  // blk-/boss- prefixes keep the two cherries apart: there is a cherry SOLDIER
  // and a cherry BLOCKER, and they are different characters.
  ...Object.fromEntries(BLOCKERS.map((n) => [`blk-${n}`, { file: `blk-${n}`, cols: 5, rows: 1 }])),
  ...Object.fromEntries(BOSSES.map((n) => [`boss-${n}`, { file: `boss-${n}`, cols: 5, rows: 1 }])),
  // Six frames, and the only effect big enough on screen to need that many.
  "fx-flame": { file: "fx-flame", cols: 6, rows: 1 },
  "fx-bullet": { file: "fx-bullet", cols: 2, rows: 1 },
  "fx-laser": { file: "fx-laser", cols: 2, rows: 1 },
  "fx-muzzle": { file: "fx-muzzle", cols: 4, rows: 1 },
  "fx-impact": { file: "fx-impact", cols: 4, rows: 1 },
};

export type SheetName = string;

export interface SpriteMeta {
  /** Frames in the cycle. */
  frames: number;
  /** Height at closest approach, in logical pixels. The detail budget. */
  onScreen: number;
  sheet?: {
    name: SheetName;
    row: number;
    /**
     * Column this animation STARTS at. Defaults to 0.
     *
     * Frames run rightward from here, which lets one row carry several
     * animations back to back — walk, then attack, then hit — so a whole
     * character is a single strip with no second row to line up.
     */
    col?: number;
  };
  /** Fallback: loose files, suffixed -1, -2, … when frames > 1. */
  file?: string;
}

export type SpriteKey =
  | "player-turn" | "player-turn-shades"
  | "helper-walk"
  | "prop-palm" | "prop-beachgoer-1" | "prop-beachgoer-2"
  | "prop-cactus-1" | "prop-cactus-2" | "prop-coyote"
  | "prop-pine" | "prop-elf" | "prop-yeti"
  | "prop-battle-fence"
  | "bg-beach-sky" | "bg-beach-horizon" | "tex-sand"
  | "bg-desert-sky" | "bg-desert-horizon" | "tex-desert"
  | "bg-winter-sky" | "bg-winter-horizon" | "tex-snow"
  | "bg-castle-sky" | "bg-castle-horizon" | "tex-castle-ground"
  | "shopkeeper-scotch" | "shopkeeper-scotch-happy" | "shop-booth"
  | "logo-tiki-wars" | "intro-1" | "intro-2" | "intro-3" | "intro-4"
  | "ending-blimp"
  | "fx-bullet" | "fx-laser" | "fx-muzzle" | "fx-impact" | "fx-flame"
  | "icon-armor" | "icon-bomb" | "icon-clover" | "icon-money" | "icon-rum"
  | "icon-poison" | "icon-black-cat" | "icon-pistol" | "icon-shotgun"
  | "icon-uzi" | "icon-flame" | "icon-laser"
  | `player-${GunArt}-walk` | `player-${GunArt}-hit`
  | `player-${GunArt}-cheer` | `player-${GunArt}-sad`
  | `${SoldierName}-walk`
  | `blk-${BlockerName}-walk` | `blk-${BlockerName}-hit`
  | `boss-${BossName}-walk` | `boss-${BossName}-attack` | `boss-${BossName}-hit`;

// On-screen heights at closest approach.
//
// Scaled up together with the camera drop — the point of moving the player
// toward the bottom edge is that things get BIG before they reach him, so these
// have to grow in step or the field just looks emptier.
export const PLAYER_H = 114;
export const SOLDIER_H = 80;
export const BLOCKER_H = 140;
export const BOSS_H = 226;
/**
 * The helper, at the depth its ring sits at rather than at the player's feet.
 *
 * Bigger than it looks: a helper is drawn at the size ITS OWN depth calls for
 * now that the squad floats up-field of the hero, and the ring's centre scales
 * a sprite to about four fifths. 104 there is the 84 it used to be drawn at
 * flat, so the squad kept the size it was tuned to look right at.
 */
export const HELPER_H = 104;

// ─── Muzzles ─────────────────────────────────────────────────────────────────
//
// Where each weapon actually ENDS, so the flash comes out of the barrel.
//
// It used to be a flat twelve pixels either side of the hero's middle, and at
// twelve pixels the flash goes off inside the bottle: he holds his pistols
// akimbo at arm's length, which is nearer thirty. The shotgun and the laser he
// holds in ONE hand, up and out to his right, so a flash on both sides was
// half of it firing out of his empty hand.
//
// Both numbers are fractions of the sprite's drawn HEIGHT, not of its width.
// The cell around a character is only as wide as its widest pose needs — a
// shotgun sheet is wider than a pistol sheet — so a fraction of the width would
// mean something different on every sheet. Height is the one dimension the game
// actually sets.
//
//   x  from the feet, positive to the hero's right
//   y  up from the ground line
//
// Measured off the imported sheets: the outermost opaque pixel in the band
// where the arms are, and the top of the artwork above it. Re-measure them if
// the character is redrawn — scripts/tiki-art.mjs registers every frame on the
// feet, so these hold across a re-import of the same art.
export interface Muzzle { x: number; y: number }

export const MUZZLES: Record<GunArt, Muzzle[]> = {
  pistols: [{ x: -0.274, y: 0.608 }, { x: 0.243, y: 0.646 }],
  uzi: [{ x: -0.255, y: 0.632 }, { x: 0.248, y: 0.635 }],
  // One barrel, right hand, held high.
  shotgun: [{ x: 0.311, y: 0.736 }],
  laser: [{ x: 0.314, y: 0.674 }],
  // The flamethrower's nozzle is in his LEFT hand, low.
  flame: [{ x: -0.252, y: 0.535 }],
};

/**
 * The muzzle a round on this side comes out of.
 *
 * A one-barrelled gun has one answer whichever side the rules picked, which is
 * the point: the shotgun alternates `side` so its pellets do not stack, and all
 * three still leave the same barrel.
 */
export function muzzleFor(gun: GunArt, side: -1 | 1): Muzzle {
  const list = MUZZLES[gun];
  if (list.length === 1) return list[0];
  return side < 0 ? list[0] : list[1];
}

export const SPRITES: Record<SpriteKey, SpriteMeta> = {
  // The turn-to-camera poses are single images and stay loose files.
  "player-turn": { file: "player-turn", frames: 1, onScreen: PLAYER_H },
  "player-turn-shades": { file: "player-turn-shades", frames: 1, onScreen: PLAYER_H },
  "helper-walk": { sheet: { name: "helper", row: 0 }, frames: 4, onScreen: HELPER_H },

  // Scenery — one image each with nothing to animate, so a sheet would only add
  // a layout to get wrong.
  //
  // Grouped by the stage that uses them; stages.ts is what decides which set is
  // on screen. A backdrop or a tiling texture is never drawn as a figure
  // standing on the ground, so onScreen means nothing for those and is 0.
  "prop-palm": { file: "prop-palm", frames: 1, onScreen: 150 },
  "prop-beachgoer-1": { file: "prop-beachgoer-1", frames: 1, onScreen: 120 },
  "prop-beachgoer-2": { file: "prop-beachgoer-2", frames: 1, onScreen: 120 },
  "prop-cactus-1": { file: "prop-cactus-1", frames: 1, onScreen: 140 },
  "prop-cactus-2": { file: "prop-cactus-2", frames: 1, onScreen: 110 },
  "prop-coyote": { file: "prop-coyote", frames: 1, onScreen: 90 },
  "prop-pine": { file: "prop-pine", frames: 1, onScreen: 152 },
  "prop-elf": { file: "prop-elf", frames: 1, onScreen: 90 },
  "prop-yeti": { file: "prop-yeti", frames: 1, onScreen: 120 },
  "prop-battle-fence": { file: "prop-battle-fence", frames: 1, onScreen: 100 },
  "bg-beach-sky": { file: "bg-beach-sky", frames: 1, onScreen: 0 },
  "bg-beach-horizon": { file: "bg-beach-horizon", frames: 1, onScreen: 0 },
  "tex-sand": { file: "tex-sand", frames: 1, onScreen: 0 },
  "bg-desert-sky": { file: "bg-desert-sky", frames: 1, onScreen: 0 },
  "bg-desert-horizon": { file: "bg-desert-horizon", frames: 1, onScreen: 0 },
  "tex-desert": { file: "tex-desert", frames: 1, onScreen: 0 },
  "bg-winter-sky": { file: "bg-winter-sky", frames: 1, onScreen: 0 },
  "bg-winter-horizon": { file: "bg-winter-horizon", frames: 1, onScreen: 0 },
  "tex-snow": { file: "tex-snow", frames: 1, onScreen: 0 },
  "bg-castle-sky": { file: "bg-castle-sky", frames: 1, onScreen: 0 },
  "bg-castle-horizon": { file: "bg-castle-horizon", frames: 1, onScreen: 0 },
  "tex-castle-ground": { file: "tex-castle-ground", frames: 1, onScreen: 0 },
  "shopkeeper-scotch": { file: "shopkeeper-scotch", frames: 1, onScreen: 180 },
  "shopkeeper-scotch-happy": { file: "shopkeeper-scotch-happy", frames: 1, onScreen: 180 },
  "shop-booth": { file: "shop-booth", frames: 1, onScreen: 0 },

  // Story art: drawn letterboxed at whatever the screen allows, never planted
  // on the ground like a figure, so onScreen means nothing for these.
  "logo-tiki-wars": { file: "logo-tiki-wars", frames: 1, onScreen: 0 },
  "intro-1": { file: "intro-1", frames: 1, onScreen: 0 },
  "intro-2": { file: "intro-2", frames: 1, onScreen: 0 },
  "intro-3": { file: "intro-3", frames: 1, onScreen: 0 },
  "intro-4": { file: "intro-4", frames: 1, onScreen: 0 },
  "ending-blimp": { file: "ending-blimp", frames: 1, onScreen: 0 },

  // Effects. Delivered pointing right and rotated on import, so these are all
  // drawn pointing up the field with no transform at the draw call.
  // The jet is drawn stretched from the nozzle to the end of the weapon's
  // range, so onScreen is only the resolution it is asked for — see FLAME_H in
  // TikiWars.tsx for the height it actually reaches.
  "fx-flame": { sheet: { name: "fx-flame", row: 0 }, frames: 6, onScreen: 200 },
  "fx-bullet": { sheet: { name: "fx-bullet", row: 0 }, frames: 2, onScreen: 26 },
  "fx-laser": { sheet: { name: "fx-laser", row: 0 }, frames: 2, onScreen: 34 },
  "fx-muzzle": { sheet: { name: "fx-muzzle", row: 0 }, frames: 4, onScreen: 26 },
  "fx-impact": { sheet: { name: "fx-impact", row: 0 }, frames: 4, onScreen: 24 },

  // Icons. Read at roughly 30 logical px, so they live or die on silhouette.
  ...Object.fromEntries((
    ["armor", "bomb", "clover", "money", "rum", "poison", "black-cat",
     "pistol", "shotgun", "uzi", "flame", "laser"] as const
  ).map((n) => [`icon-${n}`, { file: `icon-${n}`, frames: 1, onScreen: 30 }])),

  ...Object.fromEntries(GUN_ART.flatMap((g) => [
    [`player-${g}-walk`, { sheet: { name: `player-${g}`, row: 0, col: PLAYER_POSE.walk }, frames: 4, onScreen: PLAYER_H }],
    [`player-${g}-hit`, { sheet: { name: `player-${g}`, row: 0, col: PLAYER_POSE.hit }, frames: 2, onScreen: PLAYER_H }],
    [`player-${g}-cheer`, { sheet: { name: `player-${g}`, row: 0, col: PLAYER_POSE.cheer }, frames: 1, onScreen: PLAYER_H }],
    [`player-${g}-sad`, { sheet: { name: `player-${g}`, row: 0, col: PLAYER_POSE.sad }, frames: 1, onScreen: PLAYER_H }],
  ])),

  ...Object.fromEntries(SOLDIERS.map((n) => [
    `${n}-walk`, { sheet: { name: n, row: 0 }, frames: 4, onScreen: SOLDIER_H },
  ])),
  ...Object.fromEntries(BLOCKERS.flatMap((n) => [
    [`blk-${n}-walk`, { sheet: { name: `blk-${n}`, row: 0 }, frames: 4, onScreen: BLOCKER_H }],
    [`blk-${n}-hit`, { sheet: { name: `blk-${n}`, row: 0, col: 4 }, frames: 1, onScreen: BLOCKER_H }],
  ])),
  ...Object.fromEntries(BOSSES.flatMap((n) => [
    [`boss-${n}-walk`, { sheet: { name: `boss-${n}`, row: 0 }, frames: 2, onScreen: BOSS_H }],
    [`boss-${n}-attack`, { sheet: { name: `boss-${n}`, row: 0, col: 2 }, frames: 2, onScreen: BOSS_H }],
    [`boss-${n}-hit`, { sheet: { name: `boss-${n}`, row: 0, col: 4 }, frames: 1, onScreen: BOSS_H }],
  ])),
} as Record<SpriteKey, SpriteMeta>;

const ART_BASE = "/popup/art/tiki";

export function sheetUrl(name: SheetName): string {
  return `${ART_BASE}/${SHEETS[name].file}.png`;
}

/** Loose-file URL. frames > 1 are numbered from 1; a single frame has no suffix. */
export function spriteUrl(key: SpriteKey, frame: number): string | null {
  const m: SpriteMeta = SPRITES[key];
  if (!m.file) return null;
  return m.frames > 1 ? `${ART_BASE}/${m.file}-${frame + 1}.png` : `${ART_BASE}/${m.file}.png`;
}

// ─── Real-art loading ────────────────────────────────────────────────────────

const loaded = new Map<string, HTMLImageElement>();
/** Keys that 404'd. Tried once, then left to the placeholder forever. */
const missing = new Set<string>();
const buckets = new Map<string, HTMLCanvasElement>();

/**
 * Try to load every manifest entry.
 *
 * Failures are expected and silent — a missing file is the normal state until
 * the artwork exists, not an error worth surfacing to someone playing a game.
 */
/**
 * Warm up only what the guest is certain to see immediately.
 *
 * Everything else is fetched ON FIRST USE, from resolve(). The full cast is
 * about 10MB — 14 blockers and 4 bosses, most of which a given run never meets
 * — and pulling all of it up front on a phone at a bar would stall the start of
 * the game to download art for a stage nobody has reached. A sprite that has
 * not arrived yet falls back to its placeholder for a frame or two, which is
 * the same path used when art does not exist at all.
 */
export function loadTikiArt(): void {
  if (typeof window === "undefined") return;

  // ── Now: anything that can appear with NO warning ────────────────────────
  //
  // The rule is about how much notice a sprite gives. A blocker walks in from
  // the horizon, so it has seconds to arrive over the wire and the placeholder
  // is never seen. A HELPER appears the instant a gate is taken, and the hero
  // SWAPS WEAPON in the same instant — so a sheet that is still downloading
  // shows a code-drawn stand-in for a beat and then pops. That glitch is what
  // this list exists to prevent.
  tryLoad(sheetUrl("player-pistols"));
  tryLoad(sheetUrl("helper"));
  // Fired from the first frame, so never lazy.
  for (const fx of ["fx-bullet", "fx-muzzle"]) tryLoad(sheetUrl(fx));
  for (const key of ["player-turn", "player-turn-shades"] as SpriteKey[]) {
    const url = spriteUrl(key, 0);
    if (url) tryLoad(url);
  }
  // Soldiers fill the screen from the first wave, and are the smallest sheets.
  for (const n of SOLDIERS) tryLoad(sheetUrl(n));

  // ── Shortly: the other weapons ───────────────────────────────────────────
  //
  // A gun gate can arrive about eleven seconds in, so these have time — but
  // not if they are left until the swap itself. Fetched a moment later so they
  // queue behind the sprites needed to draw the first frame rather than
  // competing with them.
  window.setTimeout(() => {
    for (const g of GUN_ART) if (g !== "pistols") tryLoad(sheetUrl(`player-${g}`));
    // The flame jet goes with the flamethrower, and it is on screen CONTINUOUSLY
    // while that gun is held rather than for a few frames per shot — so a sheet
    // that arrives late means seconds of the code-drawn cone and then a swap in
    // the middle of a fight.
    tryLoad(sheetUrl("fx-flame"));
    // The laser bolt, for the same reason as its weapon.
    tryLoad(sheetUrl("fx-laser"));
  }, 1200);
}

/**
 * Fetch a sheet ahead of when it is drawn.
 *
 * For things whose arrival is KNOWN in advance — the boss of the stage being
 * played, the handful of blockers that stage will use. Lazy loading is right
 * for the rest of the cast, but not for something the game already knows is
 * coming: it turns up as a placeholder and pops into itself a second later.
 */
export function prefetchSheet(name: string): void {
  if (typeof window === "undefined") return;
  if (!SHEETS[name]) return;
  tryLoad(sheetUrl(name));
}

/**
 * Fetch a loose-file sprite ahead of when it is drawn.
 *
 * Same reasoning as prefetchSheet, for the things that are not sheets: a whole
 * stage's backdrop, skyline, ground texture and props are known the moment the
 * previous stage is cleared, and they are the LARGEST files in the game. Left
 * to load lazily the guest gets a flat gradient for the first second of a new
 * stage and then the real sky snaps in underneath the fight.
 */
export function prefetchSprite(key: SpriteKey): void {
  if (typeof window === "undefined") return;
  const m: SpriteMeta = SPRITES[key];
  if (m.sheet) { prefetchSheet(m.sheet.name); return; }
  const url = spriteUrl(key, 0);
  if (url) tryLoad(url);
}

/**
 * Has this sprite's REAL art arrived?
 *
 * Almost nothing needs to ask — drawSprite falls back to a placeholder on its
 * own, and that is the point of the system. The exception is an effect with a
 * code-drawn version that is not a stand-in but a genuinely different drawing:
 * the flame cone is a shape the canvas can make convincingly, and it has to be
 * turned OFF rather than drawn underneath once the sheet is there.
 */
export function hasArt(key: SpriteKey): boolean {
  const m: SpriteMeta = SPRITES[key];
  if (m.sheet) {
    const url = sheetUrl(m.sheet.name);
    tryLoad(url);
    const img = loaded.get(url);
    if (img && img.width) return true;
  }
  const url = spriteUrl(key, 0);
  if (!url || missing.has(url)) return false;
  tryLoad(url);
  const img = loaded.get(url);
  return Boolean(img && img.width);
}

function tryLoad(url: string): void {
  if (loaded.has(url) || missing.has(url)) return;
  const img = new Image();
  img.onload = () => loaded.set(url, img);
  img.onerror = () => missing.add(url);
  img.src = url;
}

/** Bucket heights, in logical px. Enough steps that scaling is invisible. */
function bucketFor(h: number): number {
  if (h <= 8) return 8;
  if (h <= 96) return Math.ceil(h / 4) * 4;
  return Math.ceil(h / 8) * 8;
}

/**
 * A pre-scaled cell, ready to blit 1:1.
 *
 * `src` is the region of the source image to take. For a loose file that is the
 * whole image; for a sheet it is one cell of the grid.
 */
function scaledCell(
  url: string,
  src: { x: number; y: number; w: number; h: number } | null,
  targetH: number,
  pixelScale: number
): HTMLCanvasElement | null {
  const img = loaded.get(url);
  if (!img || !img.width) return null;

  const region = src ?? { x: 0, y: 0, w: img.width, h: img.height };
  if (region.w <= 0 || region.h <= 0) return null;

  const bh = bucketFor(targetH);
  const cacheKey = `${url}@${region.x},${region.y},${region.w},${region.h}@${bh}@${pixelScale}`;
  const hit = buckets.get(cacheKey);
  if (hit) return hit;

  const dh = Math.max(1, Math.round(bh * pixelScale));
  const dw = Math.max(1, Math.round((region.w / region.h) * dh));
  const cv = document.createElement("canvas");
  cv.width = dw;
  cv.height = dh;
  const c = cv.getContext("2d");
  if (!c) return null;
  // Smoothing ON for the one-time downsample; the blit that follows is 1:1.
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";
  c.drawImage(img, region.x, region.y, region.w, region.h, 0, 0, dw, dh);
  buckets.set(cacheKey, cv);
  return cv;
}

/**
 * Resolve one frame to a pre-scaled cell.
 *
 * Sheet first, loose file second, null (so the caller draws its placeholder)
 * last. That order is what lets art land as a sheet, as loose frames, or in any
 * mixture of the two, without a code change.
 */
function resolve(
  key: SpriteKey,
  frame: number,
  targetH: number,
  pixelScale: number
): HTMLCanvasElement | null {
  const m: SpriteMeta = SPRITES[key];

  if (m.sheet) {
    const def = SHEETS[m.sheet.name];
    const url = sheetUrl(m.sheet.name);
    // Ask for it the first time it is actually needed. tryLoad is idempotent,
    // so this is a no-op on every frame after the first.
    tryLoad(url);
    const img = loaded.get(url);
    if (img && img.width) {
      const cw = img.width / def.cols;
      const ch = img.height / def.rows;
      const col = (m.sheet.col ?? 0) + frame;
      if (col < def.cols && m.sheet.row < def.rows) {
        return scaledCell(
          url,
          { x: col * cw, y: m.sheet.row * ch, w: cw, h: ch },
          targetH,
          pixelScale
        );
      }
    }
  }

  const url = spriteUrl(key, frame);
  if (!url || missing.has(url)) return null;
  tryLoad(url);
  return scaledCell(url, null, targetH, pixelScale);
}

/**
 * The raw loaded image for a single-frame sprite.
 *
 * For backdrops and the tiling sand, which are drawn stretched or repeated
 * rather than as a figure standing on the ground — the depth-bucket path would
 * be wrong for both.
 */
export function getImage(key: SpriteKey): HTMLImageElement | null {
  const m: SpriteMeta = SPRITES[key];
  const url = m.file ? spriteUrl(key, 0) : null;
  if (!url || missing.has(url)) return null;
  tryLoad(url);
  const img = loaded.get(url);
  return img && img.width ? img : null;
}

// ─── Drawing ─────────────────────────────────────────────────────────────────

export interface DrawOpts {
  /** Logical height to draw at. */
  h: number;
  /** Buffer density, so a downsample lands 1:1 on device pixels. */
  pixelScale: number;
  /** 0..1, drawn as a white flash over the sprite. */
  flash?: number;
  /** 0..1, drawn as an orange burn tint. */
  burn?: number;
}

/**
 * Draw a sprite with its feet at (cx, groundY).
 *
 * Real art if it has loaded, placeholder otherwise — the caller never knows.
 */
/**
 * Scratch buffer for tinted sprites.
 *
 * A flash or a burn CANNOT be painted straight onto the main canvas with
 * source-atop: that composites against everything already drawn, and the sky
 * and sand are fully opaque, so the tint comes out as a rectangular slab across
 * the background instead of a glow on the character. Drawing the sprite alone
 * into a transparent buffer first gives source-atop the silhouette it needs.
 *
 * Only allocated for sprites that are actually flashing or burning, which is a
 * small fraction of a frame.
 */
let scratch: HTMLCanvasElement | null = null;

function scratchCtx(size: number): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!scratch) scratch = document.createElement("canvas");
  if (scratch.width !== size || scratch.height !== size) {
    scratch.width = size;
    scratch.height = size;
  }
  const c = scratch.getContext("2d");
  if (!c) return null;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, size, size);
  c.imageSmoothingEnabled = false;
  return c;
}

/** Draw the artwork (or its placeholder) with feet at the current origin. */
function paint(
  ctx: CanvasRenderingContext2D,
  key: SpriteKey,
  frame: number,
  h: number,
  pixelScale: number
): void {
  const art = resolve(key, frame, h, pixelScale);
  if (art) {
    ctx.save();
    ctx.scale(1 / pixelScale, 1 / pixelScale);
    // Centred on the cell it was cut from, which is the point the frame is
    // registered on — scripts/tiki-art.mjs puts the character's FEET there.
    //
    // The offset is measured off the art's OWN width. It used to be computed
    // from the height being asked for, which is not the height that gets drawn:
    // the cell is resampled into one of a set of depth buckets and then blitted
    // at that bucket's size, a few pixels off the request. The mismatch showed
    // as the sprite sitting a pixel or two beside its own feet, and it changed
    // as an enemy walked between buckets, so a character wobbled while
    // approaching.
    ctx.drawImage(art, -Math.round(art.width / 2), -art.height);
    ctx.restore();
  } else {
    (PLACEHOLDERS[key] ?? ((c, hh, f) => genericFoe(hh, f, c)))(ctx, h, frame);
  }
}

export interface DrawOpts {
  /** Logical height to draw at. */
  h: number;
  /** Buffer density, so a downsample lands 1:1 on device pixels. */
  pixelScale: number;
  /** 0..1, drawn as a white flash over the sprite. */
  flash?: number;
  /** 0..1, drawn as an orange burn tint over the sprite. */
  burn?: number;
}

/**
 * Draw a sprite with its feet at (cx, groundY).
 *
 * Real art if it has loaded, placeholder otherwise — the caller never knows.
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  key: SpriteKey,
  frame: number,
  cx: number,
  groundY: number,
  opts: DrawOpts
): void {
  const meta = SPRITES[key];
  const f = ((frame % meta.frames) + meta.frames) % meta.frames;
  const flash = opts.flash ?? 0;
  const burn = opts.burn ?? 0;

  if (flash <= 0 && burn <= 0) {
    ctx.save();
    ctx.translate(cx, groundY);
    paint(ctx, key, f, opts.h, opts.pixelScale);
    ctx.restore();
    return;
  }

  // Tinted path: sprite alone into a transparent buffer, tint it there, blit.
  const box = Math.ceil(opts.h * 2);
  const size = Math.ceil(box * opts.pixelScale);
  const sctx = scratchCtx(size);
  if (!sctx) {
    ctx.save();
    ctx.translate(cx, groundY);
    paint(ctx, key, f, opts.h, opts.pixelScale);
    ctx.restore();
    return;
  }

  sctx.setTransform(opts.pixelScale, 0, 0, opts.pixelScale, 0, 0);
  // Feet placed so the sprite sits comfortably inside the square.
  const originX = box / 2;
  const originY = box * 0.8;
  sctx.translate(originX, originY);
  paint(sctx, key, f, opts.h, opts.pixelScale);

  sctx.globalCompositeOperation = "source-atop";
  if (burn > 0) {
    sctx.globalAlpha = Math.min(0.65, burn * 0.65);
    sctx.fillStyle = C.flame;
    sctx.fillRect(-originX, -originY, box, box);
  }
  if (flash > 0) {
    sctx.globalAlpha = Math.min(1, flash);
    sctx.fillStyle = "#FFFFFF";
    sctx.fillRect(-originX, -originY, box, box);
  }
  sctx.globalAlpha = 1;
  sctx.globalCompositeOperation = "source-over";

  ctx.save();
  ctx.translate(cx, groundY);
  ctx.scale(1 / opts.pixelScale, 1 / opts.pixelScale);
  ctx.drawImage(scratch!, -originX * opts.pixelScale, -originY * opts.pixelScale);
  ctx.restore();
}

// ─── Placeholder drawing helpers ─────────────────────────────────────────────
//
// Everything below draws in a local space with the feet at (0,0), growing
// upward into negative y. Sizes are expressed as fractions of `h` so a sprite
// is identical at every depth.

function ro(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Fill + heavy outline — the one stylistic thing the placeholders share with the real art. */
function ink(ctx: CanvasRenderingContext2D, fill: string, h: number, weight = 0.035) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = Math.max(0.7, h * weight);
  ctx.strokeStyle = C.outline;
  ctx.stroke();
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
}

/** Legs that swing with the walk cycle. phase 0..1. */
function legs(ctx: CanvasRenderingContext2D, h: number, w: number, phase: number, color: string) {
  const swing = Math.sin(phase * Math.PI * 2) * w * 0.35;
  const legH = h * 0.22;
  for (const s of [-1, 1]) {
    const dx = s * w * 0.22 + (s > 0 ? swing : -swing);
    ro(ctx, dx - w * 0.11, -legH, w * 0.22, legH, w * 0.08);
    ink(ctx, color, h);
  }
}

function shadowBlob(ctx: CanvasRenderingContext2D, w: number) {
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.5, w * 0.16, 0, 0, Math.PI * 2);
  ctx.fillStyle = C.shadow;
  ctx.fill();
}

// ─── Placeholders ────────────────────────────────────────────────────────────

type Placeholder = (ctx: CanvasRenderingContext2D, h: number, frame: number) => void;

/** The hero, from behind: bottle body, arms out, guns forward. */
function drawPlayerBack(ctx: CanvasRenderingContext2D, h: number, frame: number) {
  const w = h * 0.42;
  shadowBlob(ctx, w);
  legs(ctx, h, w, frame / 4, C.rumGlass);

  const bodyH = h * 0.52;
  const bodyY = -h * 0.22 - bodyH;
  ro(ctx, -w * 0.32, bodyY, w * 0.64, bodyH, w * 0.16);
  ink(ctx, C.rumGlass, h);

  // Label — the one flash of colour that identifies him at distance.
  ro(ctx, -w * 0.26, bodyY + bodyH * 0.34, w * 0.52, bodyH * 0.38, w * 0.05);
  ink(ctx, C.rumLabel, h, 0.02);

  // Neck and cap.
  const neckY = bodyY - h * 0.12;
  ro(ctx, -w * 0.14, neckY, w * 0.28, h * 0.13, w * 0.05);
  ink(ctx, C.rumGlass, h);
  ro(ctx, -w * 0.18, neckY - h * 0.07, w * 0.36, h * 0.08, w * 0.04);
  ink(ctx, C.rumLabel, h);

  // Arms forward, guns at the ends. Slight alternate with the stride.
  const bob = Math.sin((frame / 4) * Math.PI * 2) * h * 0.012;
  for (const s of [-1, 1]) {
    ro(ctx, s * w * 0.3 - w * 0.1, bodyY + bodyH * 0.16 + (s > 0 ? bob : -bob), w * 0.2, bodyH * 0.5, w * 0.08);
    ink(ctx, C.rumGlass, h);
    ro(ctx, s * w * 0.34 - w * 0.07, bodyY + bodyH * 0.08 + (s > 0 ? bob : -bob), w * 0.14, bodyH * 0.2, w * 0.03);
    ink(ctx, "#3A3A44", h, 0.02);
  }
}

/** The hero turned to camera — quips and the boss-kill beat. */
function drawPlayerTurn(shades: boolean): Placeholder {
  return (ctx, h) => {
    const w = h * 0.42;
    shadowBlob(ctx, w);
    legs(ctx, h, w, 0, C.rumGlass);

    const bodyH = h * 0.52;
    const bodyY = -h * 0.22 - bodyH;
    ro(ctx, -w * 0.34, bodyY, w * 0.68, bodyH, w * 0.16);
    ink(ctx, C.rumGlass, h);
    ro(ctx, -w * 0.28, bodyY + bodyH * 0.34, w * 0.56, bodyH * 0.38, w * 0.05);
    ink(ctx, C.rumLabel, h, 0.02);

    const neckY = bodyY - h * 0.12;
    ro(ctx, -w * 0.15, neckY, w * 0.3, h * 0.13, w * 0.05);
    ink(ctx, C.rumGlass, h);
    ro(ctx, -w * 0.19, neckY - h * 0.07, w * 0.38, h * 0.08, w * 0.04);
    ink(ctx, C.rumLabel, h);

    // Face on the shoulder of the bottle, so he reads as looking at you.
    const fy = bodyY + bodyH * 0.16;
    if (shades) {
      ro(ctx, -w * 0.24, fy - h * 0.02, w * 0.48, h * 0.055, w * 0.02);
      ink(ctx, "#101014", h, 0.02);
    } else {
      for (const s of [-1, 1]) {
        circle(ctx, s * w * 0.13, fy, h * 0.026);
        ink(ctx, "#FFFFFF", h, 0.018);
        circle(ctx, s * w * 0.13, fy, h * 0.012);
        ctx.fillStyle = C.outline;
        ctx.fill();
      }
    }
    // Grin.
    ctx.beginPath();
    ctx.arc(0, fy + h * 0.045, h * 0.038, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.lineWidth = Math.max(0.7, h * 0.022);
    ctx.strokeStyle = C.outline;
    ctx.stroke();
  };
}

function drawHelper(ctx: CanvasRenderingContext2D, h: number, frame: number) {
  const w = h * 0.38;
  shadowBlob(ctx, w);
  legs(ctx, h, w, frame / 2, C.rumGlass);
  const bodyH = h * 0.55;
  const bodyY = -h * 0.22 - bodyH;
  ro(ctx, -w * 0.28, bodyY, w * 0.56, bodyH, w * 0.14);
  ink(ctx, C.rumGlass, h);
  ro(ctx, -w * 0.22, bodyY + bodyH * 0.38, w * 0.44, bodyH * 0.3, w * 0.04);
  ink(ctx, C.rumGreen, h, 0.02);
  ro(ctx, -w * 0.13, bodyY - h * 0.1, w * 0.26, h * 0.11, w * 0.04);
  ink(ctx, C.rumGlass, h);
  // One gun, forward.
  ro(ctx, w * 0.22, bodyY + bodyH * 0.2, w * 0.16, bodyH * 0.34, w * 0.05);
  ink(ctx, "#3A3A44", h, 0.02);
}

/**
 * The citrus grunts.
 *
 * All four share a silhouette on purpose: round body, helmet, stubby limbs.
 * The guest has a fraction of a second to read "one shot, can be dodged", and
 * that read has to be the same whichever fruit it is.
 */
function drawGrunt(body: string, detail: string, lean = 0): Placeholder {
  return (ctx, h, frame) => {
    const w = h * 0.62;
    shadowBlob(ctx, w * 0.8);
    ctx.save();
    if (lean) ctx.rotate(lean);
    legs(ctx, h, w * 0.7, frame / 2, detail);

    const r = w * 0.38;
    const cy = -h * 0.2 - r;
    circle(ctx, 0, cy, r);
    ink(ctx, body, h);

    // Arms.
    const swing = Math.sin((frame / 2) * Math.PI * 2) * h * 0.02;
    for (const s of [-1, 1]) {
      ro(ctx, s * r * 0.95 - w * 0.07, cy - h * 0.02 + (s > 0 ? swing : -swing), w * 0.14, h * 0.16, w * 0.06);
      ink(ctx, detail, h);
    }

    // Helmet — the thing that says "soldier" at 12 pixels.
    ctx.beginPath();
    ctx.arc(0, cy - r * 0.12, r * 0.92, Math.PI, 0);
    ctx.closePath();
    ink(ctx, "#5E6B3A", h);

    // Scowl.
    for (const s of [-1, 1]) {
      circle(ctx, s * r * 0.32, cy + r * 0.12, h * 0.022);
      ctx.fillStyle = C.outline;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, cy + r * 0.52);
    ctx.lineTo(r * 0.3, cy + r * 0.52);
    ctx.lineWidth = Math.max(0.7, h * 0.025);
    ctx.strokeStyle = C.outline;
    ctx.stroke();
    ctx.restore();
  };
}

/** The blocker. Must read as a WALL — wider, taller, weapon up. */
function drawSugarcane(ctx: CanvasRenderingContext2D, h: number, frame: number) {
  const w = h * 0.5;
  shadowBlob(ctx, w);
  legs(ctx, h, w * 1.1, frame / 4, C.caneDark);

  const bodyH = h * 0.6;
  const bodyY = -h * 0.2 - bodyH;
  ro(ctx, -w * 0.4, bodyY, w * 0.8, bodyH, w * 0.1);
  ink(ctx, C.cane, h, 0.03);

  // Cane segments.
  ctx.lineWidth = Math.max(0.6, h * 0.016);
  ctx.strokeStyle = C.caneDark;
  for (let i = 1; i < 5; i++) {
    const y = bodyY + (bodyH / 5) * i;
    ctx.beginPath();
    ctx.moveTo(-w * 0.4, y);
    ctx.lineTo(w * 0.4, y);
    ctx.stroke();
  }

  // Raised arms — reads as "coming for you" even tiny.
  const swing = Math.sin((frame / 4) * Math.PI * 2) * h * 0.03;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * w * 0.42, bodyY + bodyH * 0.22 + (s > 0 ? swing : -swing));
    ctx.rotate(s * -0.5);
    ro(ctx, -w * 0.1, -bodyH * 0.4, w * 0.2, bodyH * 0.44, w * 0.07);
    ink(ctx, C.caneDark, h, 0.03);
    ctx.restore();
  }

  // Fronds.
  for (const a of [-0.85, -0.3, 0.3, 0.85]) {
    ctx.save();
    ctx.translate(0, bodyY);
    ctx.rotate(a);
    ro(ctx, -w * 0.05, -h * 0.2, w * 0.1, h * 0.2, w * 0.04);
    ink(ctx, C.pineappleLeaf, h, 0.03);
    ctx.restore();
  }

  // Blunt-toothed snarl.
  const fy = bodyY + bodyH * 0.3;
  ro(ctx, -w * 0.2, fy, w * 0.4, h * 0.05, w * 0.02);
  ink(ctx, "#2A2018", h, 0.02);
  for (const s of [-1, 0, 1]) {
    ro(ctx, s * w * 0.11 - w * 0.035, fy, w * 0.07, h * 0.025, 0);
    ctx.fillStyle = C.bone;
    ctx.fill();
  }
}

/** Baby Pineapple. Crown, club, and enough bulk to feel like a wall. */
function drawBabyPineapple(ctx: CanvasRenderingContext2D, h: number, frame: number) {
  const w = h * 0.66;
  shadowBlob(ctx, w);
  const waddle = Math.sin((frame / 2) * Math.PI * 2) * 0.06;
  ctx.save();
  ctx.rotate(waddle);
  legs(ctx, h, w * 0.8, frame / 2, C.pineapple);

  const bodyH = h * 0.5;
  const bodyY = -h * 0.2 - bodyH;
  ro(ctx, -w * 0.36, bodyY, w * 0.72, bodyH, w * 0.22);
  ink(ctx, C.pineapple, h, 0.028);

  // Cross-hatch skin.
  ctx.lineWidth = Math.max(0.5, h * 0.008);
  ctx.strokeStyle = "#C4860F";
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(-w * 0.36, bodyY + bodyH * 0.5 + i * bodyH * 0.16);
    ctx.lineTo(w * 0.36, bodyY + bodyH * 0.5 + i * bodyH * 0.16 - bodyH * 0.2);
    ctx.stroke();
  }

  // Diaper.
  ro(ctx, -w * 0.34, bodyY + bodyH * 0.74, w * 0.68, bodyH * 0.3, w * 0.08);
  ink(ctx, "#F2F2EA", h, 0.022);

  // Leaves + crown.
  for (const a of [-0.6, -0.2, 0.2, 0.6]) {
    ctx.save();
    ctx.translate(0, bodyY + h * 0.01);
    ctx.rotate(a);
    ro(ctx, -w * 0.05, -h * 0.16, w * 0.1, h * 0.17, w * 0.04);
    ink(ctx, C.pineappleLeaf, h, 0.028);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.moveTo(-w * 0.2, bodyY - h * 0.04);
  ctx.lineTo(-w * 0.14, bodyY - h * 0.14);
  ctx.lineTo(-w * 0.05, bodyY - h * 0.06);
  ctx.lineTo(w * 0.05, bodyY - h * 0.15);
  ctx.lineTo(w * 0.14, bodyY - h * 0.05);
  ctx.lineTo(w * 0.2, bodyY - h * 0.13);
  ctx.lineTo(w * 0.2, bodyY - h * 0.01);
  ctx.closePath();
  ink(ctx, "#FFD54A", h, 0.022);

  // Furious face.
  const fy = bodyY + bodyH * 0.34;
  for (const s of [-1, 1]) {
    circle(ctx, s * w * 0.15, fy, h * 0.03);
    ink(ctx, "#FFFFFF", h, 0.018);
    circle(ctx, s * w * 0.15, fy + h * 0.006, h * 0.014);
    ctx.fillStyle = C.outline;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * w * 0.05, fy - h * 0.05);
    ctx.lineTo(s * w * 0.26, fy - h * 0.02);
    ctx.lineWidth = Math.max(0.8, h * 0.018);
    ctx.strokeStyle = C.outline;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, fy + h * 0.09, h * 0.045, 1.15 * Math.PI, 1.85 * Math.PI);
  ctx.lineWidth = Math.max(0.8, h * 0.02);
  ctx.strokeStyle = C.outline;
  ctx.stroke();

  // Club, dragged at his side.
  ctx.save();
  ctx.translate(w * 0.46, bodyY + bodyH * 0.5);
  ctx.rotate(0.5 + waddle);
  ro(ctx, -w * 0.06, -h * 0.02, w * 0.12, h * 0.3, w * 0.04);
  ink(ctx, "#8A5A2A", h, 0.026);
  circle(ctx, 0, h * 0.3, w * 0.14);
  ink(ctx, "#7A4A20", h, 0.026);
  ctx.restore();
  ctx.restore();
}

function drawPalm(ctx: CanvasRenderingContext2D, h: number) {
  const w = h * 0.5;
  ctx.beginPath();
  ctx.moveTo(-w * 0.07, 0);
  ctx.quadraticCurveTo(w * 0.05, -h * 0.5, w * 0.16, -h * 0.78);
  ctx.lineTo(w * 0.3, -h * 0.76);
  ctx.quadraticCurveTo(w * 0.16, -h * 0.48, w * 0.09, 0);
  ctx.closePath();
  ink(ctx, "#8A6438", h, 0.02);
  for (const a of [-1.15, -0.55, 0, 0.55, 1.15]) {
    ctx.save();
    ctx.translate(w * 0.22, -h * 0.78);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.13, w * 0.11, h * 0.15, 0, 0, Math.PI * 2);
    ink(ctx, a === 0 ? "#2FA84A" : "#25913E", h, 0.018);
    ctx.restore();
  }
  circle(ctx, w * 0.22, -h * 0.74, w * 0.07);
  ink(ctx, "#6B4A28", h, 0.018);
}

function drawShopkeeper(ctx: CanvasRenderingContext2D, h: number) {
  const w = h * 0.62;
  // Squat amber bottle, upper body only — he's framed by the booth window.
  ro(ctx, -w * 0.34, -h * 0.62, w * 0.68, h * 0.62, w * 0.14);
  ink(ctx, "#C67A22", h, 0.024);
  ro(ctx, -w * 0.26, -h * 0.42, w * 0.52, h * 0.24, w * 0.04);
  ink(ctx, C.bone, h, 0.018);
  // Neck + flat cap.
  ro(ctx, -w * 0.14, -h * 0.76, w * 0.28, h * 0.15, w * 0.05);
  ink(ctx, "#C67A22", h, 0.024);
  ro(ctx, -w * 0.2, -h * 0.86, w * 0.4, h * 0.1, w * 0.04);
  ink(ctx, "#3E5A3A", h, 0.024);
  // Tartan band.
  ro(ctx, -w * 0.15, -h * 0.68, w * 0.3, h * 0.06, 0);
  ink(ctx, "#8A2B2B", h, 0.016);
  // Knowing look.
  for (const s of [-1, 1]) {
    circle(ctx, s * w * 0.1, -h * 0.7, h * 0.02);
    ctx.fillStyle = C.outline;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * w * 0.03, -h * 0.745);
    ctx.lineTo(s * w * 0.17, -h * 0.735);
    ctx.lineWidth = Math.max(0.7, h * 0.014);
    ctx.strokeStyle = C.outline;
    ctx.stroke();
  }
}

/**
 * Stand-in for anything without hand-drawn placeholder art.
 *
 * There are now 46 sprite keys and writing a bespoke placeholder for each would
 * be a lot of code for pictures nobody will ever see once the art lands. What a
 * placeholder actually has to do is hold the right SPACE and read as the right
 * TIER, so this draws a bulk-appropriate blob: the guest can still tell a
 * blocker from a grunt while the real sheet is downloading.
 */
function genericFoe(h: number, frame: number, ctx: CanvasRenderingContext2D) {
  const w = h * 0.6;
  shadowBlob(ctx, w * 0.85);
  legs(ctx, h, w * 0.75, frame / 2, "#5A5A66");
  const r = w * 0.42;
  const cy = -h * 0.24 - r;
  circle(ctx, 0, cy, r);
  ink(ctx, "#7A7A88", h);
  for (const s2 of [-1, 1]) {
    circle(ctx, s2 * r * 0.34, cy - h * 0.02, h * 0.028);
    ink(ctx, "#FFFFFF", h, 0.02);
  }
  ctx.beginPath();
  ctx.moveTo(-r * 0.34, cy + r * 0.5);
  ctx.lineTo(r * 0.34, cy + r * 0.5);
  ctx.lineWidth = Math.max(0.7, h * 0.025);
  ctx.strokeStyle = C.outline;
  ctx.stroke();
}

/**
 * Stand-in for an icon.
 *
 * Icons must NOT fall through to the generic enemy blob — an armour pickup
 * drawn as a grey foe is worse than an obvious blank. A plain rounded tile
 * reads as "an icon that has not arrived".
 */
function genericIcon(ctx: CanvasRenderingContext2D, h: number) {
  ro(ctx, -h * 0.4, -h * 0.8, h * 0.8, h * 0.8, h * 0.14);
  ink(ctx, "#5A5A66", h, 0.05);
}

const PLACEHOLDERS: Partial<Record<SpriteKey, Placeholder>> = {
  ...Object.fromEntries((
    ["armor", "bomb", "clover", "money", "rum", "poison", "black-cat",
     "pistol", "shotgun", "uzi", "flame", "laser"] as const
  ).map((n) => [`icon-${n}`, (c: CanvasRenderingContext2D, hh: number) => genericIcon(c, hh)])),
  "lime-walk": drawGrunt(C.lime, "#6FA81E"),
  "lemon-walk": drawGrunt(C.lemon, "#C9B31E"),
  "orange-walk": drawGrunt(C.orange, "#C96A12"),
  "cherry-walk": drawGrunt("#E0243C", "#8A1020"),
  "sugarcube-walk": drawGrunt("#F2F2EA", "#B9B9AE"),
  // The kiwi leans forward — the one grunt whose speed you can read on approach.
  "kiwi-walk": drawGrunt(C.kiwi, C.kiwiSkin, -0.12),
  "blk-sugarcane-walk": drawSugarcane,
  "boss-baby-walk": drawBabyPineapple,
  "player-turn": drawPlayerTurn(false),
  ...Object.fromEntries(GUN_ART.flatMap((g) => [
    [`player-${g}-walk`, drawPlayerBack],
    [`player-${g}-hit`, (c: CanvasRenderingContext2D, h: number) => drawPlayerBack(c, h, 0)],
    [`player-${g}-cheer`, drawPlayerTurn(false)],
    [`player-${g}-sad`, drawPlayerTurn(false)],
  ])),
  "player-turn-shades": drawPlayerTurn(true),
  "helper-walk": drawHelper,


  "prop-palm": drawPalm,
  "shopkeeper-scotch": drawShopkeeper,
  "shopkeeper-scotch-happy": drawShopkeeper,
};
