// ─── Tiki Wars — stages ──────────────────────────────────────────────────────
//
// A stage's LOOK, kept apart from its rules.
//
// Everything that made the game a beach — the sky, the skyline, the ground
// underfoot, the palms going past — used to be named directly in the renderer,
// so "which stage is this" and "what does this stage look like" were the same
// question and neither could change without the other. Pulling it out here
// means a new stage is a block of data: four filenames and a colour or two.
//
// The order matches the BOSSES roster in tikiCore.ts, because the two are the
// same journey told twice — the Knight guards the desert, Santa the winter, the
// King his own castle. See docs/tiki-wars-sprites.md.

import { C } from "./constants";
import type { SpriteKey } from "./sprites";

export type ThemeName = "beach" | "desert" | "winter" | "castle";

/** One piece of roadside dressing, fixed to the field so it streams past. */
export interface SceneryPiece {
  key: SpriteKey;
  /** Across the road, in the same -1..+1 the actors use. Past 1 is off-road. */
  nx: number;
  /** Where in the cycle it starts, 0..1, so the props do not arrive together. */
  phase: number;
  /** On-screen height at closest approach, in logical px. */
  h: number;
}

export interface Theme {
  name: ThemeName;
  /** Full-bleed backdrop, pinned to the horizon and running off the top. */
  sky: SpriteKey;
  /** The skyline that sits ON the horizon line. Transparent above. */
  horizon: SpriteKey;
  /** Tiled underfoot, in bands that open out toward the camera. */
  ground: SpriteKey;
  scenery: SceneryPiece[];
  /**
   * Colours used when the art has not loaded — first frames, and a stage whose
   * PNGs are not in the build yet. Every stage stays PLAYABLE without its art,
   * which is the rule the whole sprite system is built on.
   */
  fallback: {
    skyHigh: string;
    skyLow: string;
    /** The flat ground fill under the texture, and its perspective rungs. */
    ground: string;
    groundDark: string;
    /** The band along the horizon: sea, haze, or the foot of a wall. */
    far: string;
  };
}

/**
 * How much of the skyline hangs BELOW the horizon line.
 *
 * The art is drawn at its own aspect rather than a fixed height — a desert
 * mesa strip is a fifth the height of the castle on its crag, and forcing both
 * into one box either squashed the castle or stretched the mesas across the
 * sky. Anchoring instead means each one meets the ground where it should.
 */
export const HORIZON_SINK = 0.18;

export const THEMES: Record<ThemeName, Theme> = {
  beach: {
    name: "beach",
    sky: "bg-beach-sky",
    horizon: "bg-beach-horizon",
    ground: "tex-sand",
    scenery: [
      { key: "prop-palm", nx: -1.55, phase: 0.0, h: 150 },
      { key: "prop-beachgoer-1", nx: 1.72, phase: 0.17, h: 96 },
      { key: "prop-palm", nx: 1.62, phase: 0.34, h: 150 },
      { key: "prop-beachgoer-2", nx: -1.85, phase: 0.5, h: 96 },
      { key: "prop-palm", nx: -1.8, phase: 0.66, h: 150 },
      { key: "prop-palm", nx: 1.45, phase: 0.83, h: 150 },
    ],
    fallback: {
      skyHigh: C.skyHigh, skyLow: C.skyLow,
      ground: C.sand, groundDark: C.sandDark, far: C.sea,
    },
  },

  desert: {
    name: "desert",
    sky: "bg-desert-sky",
    horizon: "bg-desert-horizon",
    ground: "tex-desert",
    // Sparser than the beach on purpose: emptiness is what a desert has, and
    // the coyote only shows up once a lap so it reads as an event.
    scenery: [
      { key: "prop-cactus-1", nx: -1.6, phase: 0.0, h: 140 },
      { key: "prop-cactus-2", nx: 1.68, phase: 0.28, h: 104 },
      { key: "prop-coyote", nx: -1.9, phase: 0.5, h: 88 },
      { key: "prop-cactus-1", nx: 1.5, phase: 0.72, h: 140 },
      { key: "prop-cactus-2", nx: -1.72, phase: 0.86, h: 104 },
    ],
    fallback: {
      skyHigh: "#5A2E6E", skyLow: "#FF9E3D",
      ground: "#D98A44", groundDark: "#A85F2C", far: "#7A4A6B",
    },
  },

  winter: {
    name: "winter",
    sky: "bg-winter-sky",
    horizon: "bg-winter-horizon",
    ground: "tex-snow",
    scenery: [
      { key: "prop-pine", nx: -1.58, phase: 0.0, h: 152 },
      { key: "prop-elf", nx: 1.74, phase: 0.22, h: 84 },
      { key: "prop-pine", nx: 1.6, phase: 0.42, h: 152 },
      { key: "prop-yeti", nx: -1.92, phase: 0.6, h: 116 },
      { key: "prop-pine", nx: -1.8, phase: 0.78, h: 152 },
      { key: "prop-pine", nx: 1.48, phase: 0.92, h: 152 },
    ],
    fallback: {
      skyHigh: "#93A9BE", skyLow: "#DCE6EF",
      ground: "#EAF1F7", groundDark: "#A9BECE", far: "#8FA4B8",
    },
  },

  castle: {
    name: "castle",
    sky: "bg-castle-sky",
    horizon: "bg-castle-horizon",
    ground: "tex-castle-ground",
    scenery: [
      { key: "prop-battle-fence", nx: -1.62, phase: 0.0, h: 92 },
      { key: "prop-battle-fence", nx: 1.66, phase: 0.25, h: 92 },
      { key: "prop-battle-fence", nx: -1.78, phase: 0.5, h: 92 },
      { key: "prop-battle-fence", nx: 1.52, phase: 0.75, h: 92 },
    ],
    fallback: {
      skyHigh: "#0B0A22", skyLow: "#2E2450",
      ground: "#4A4653", groundDark: "#2E2B36", far: "#161230",
    },
  },
};

/** The running order, and the one place it is written down. */
export const THEME_ORDER: ThemeName[] = ["beach", "desert", "winter", "castle"];

/**
 * Which stage looks like what.
 *
 * Cycles, exactly as the boss roster does, so a guest who keeps going walks the
 * whole journey again rather than being parked on the last backdrop forever.
 */
export function themeFor(stage: number): Theme {
  const i = (Math.max(1, Math.floor(stage)) - 1) % THEME_ORDER.length;
  return THEMES[THEME_ORDER[i]];
}

/** Everything a theme draws, for prefetching a stage before it starts. */
export function themeArt(theme: Theme): SpriteKey[] {
  const keys: SpriteKey[] = [theme.sky, theme.horizon, theme.ground];
  for (const p of theme.scenery) if (!keys.includes(p.key)) keys.push(p.key);
  return keys;
}
