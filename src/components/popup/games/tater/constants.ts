// ─── Tater Tales — geometry, physics and palette ─────────────────────────────
//
// The shaft Elmer climbs is a FIXED 256 logical pixels wide on every device,
// with a 16px wall drawn outside it on each side (VIEW_W).
// That is not a rendering choice, it is a rules choice: a blast at 45 degrees
// crosses the shaft and comes off the far wall, so a wider shaft on a tablet
// would be a different game with a different set of reachable platforms. The
// VIEW height flexes — a taller phone simply sees further up the shaft.
//
// Same arrangement as Let's Do Shots! and Tiki Wars, and deliberately separate
// from arcade.ts, which is pinned to the 224x288 the two string-art games share.

/** Logical width of the shaft. Every measurement below is in these units. */
export const W = 256;

/**
 * The walls either side of the shaft, Ice Climbers style. Drawn OUTSIDE W, so
 * the physics (which bounces at 0 and W) is untouched by them.
 */
export const WALL_W = 16;

/** Logical width of the whole screen: shaft plus both walls. */
export const VIEW_W = W + WALL_W * 2;

/** How much of the shaft is on screen at once. */
export const H_MIN = 480;
export const H_MAX = 720;
export const H_REF = 600;

export function heightFor(viewportW: number, viewportH: number): number {
  if (viewportW <= 0 || viewportH <= 0) return H_REF;
  return Math.round(Math.min(H_MAX, Math.max(H_MIN, (viewportH / viewportW) * VIEW_W)));
}

/**
 * Device pixels per logical pixel.
 *
 * 3, because the stage tiles are pixel art drawn at exactly three art pixels
 * per logical pixel — a 16px shelf block is 48 pixels of art — so at 3 they
 * land on the buffer one to one. scripts/tater-art.mjs writes every sprite at
 * this resolution, so the two must change together.
 */
export const PIXEL_SCALE = 3;

// ─── The climber ─────────────────────────────────────────────────────────────

/**
 * Elmer's collision box. He is drawn taller than this — Mixey rides under his
 * arm and the soda plume trails well past his feet — but only the bottle
 * collides, so a blast is never eaten by a jet trail clipping a shelf.
 */
export const ELMER_W = 16;
export const ELMER_H = 32;

// ─── The shaft ───────────────────────────────────────────────────────────────

/**
 * Vertical distance between platform rows.
 *
 * The single most load-bearing number in the game: everything about how a blast
 * feels is this measured against V_MAX. At 62 a full-power vertical blast
 * clears just under three rows, which is what makes a perfect shot feel like a
 * real gain and a mistimed one still land you somewhere.
 */
export const ROW_GAP = 62;

/** Platform thickness. Thick enough to read as a shelf, thin enough to fly past. */
export const PLATFORM_H = 9;

/**
 * The three platform sizes, matching the three cells on each row of the art
 * sheet.
 *
 * Generous, and measured rather than chosen. The player does not steer this
 * blast — they stop a sweeping arrow and then a sweeping gauge, and the error
 * in a human tap is about 50ms on each. At the sweep rates below that is
 * roughly a tenth of a radian of angle and a sixteenth of the gauge, which
 * moves the landing point about fifty pixels. A shelf narrower than that is not
 * difficulty, it is a coin toss — and the first cut of this game, with a
 * 34px "small", was exactly that: a bot playing perfectly landed one blast in
 * fifteen and never got above row four.
 */
export const PLATFORM_W = { small: 44, medium: 74, large: 110 } as const;
export type PlatformSize = keyof typeof PLATFORM_W;

/** Nothing generates closer than this to a wall, so a landing is never half off-screen. */
export const WALL_MARGIN = 6;

// ─── Physics ─────────────────────────────────────────────────────────────────
//
// Tuned against ROW_GAP above, not chosen for their own sake. The comments say
// what each one buys, because changing any of them silently changes which
// platforms are reachable — and __tests__/tater.test.ts asserts reachability
// against exactly these numbers.

/** Down is positive. */
export const GRAVITY = 900;

/**
 * The blast, floor and ceiling.
 *
 * V_MIN straight up rises 18px — less than a third of a row, which is the
 * "wimpy blast barely taking them" the design asks for and is survivable
 * rather than fatal, because falling never kills.
 *
 * V_MAX straight up rises 174px, a shade under three rows. At 45 degrees it
 * rises 87px and travels 348 across, so it crosses the 256 shaft and comes back
 * off the far wall — the bank shot is the game's skill ceiling.
 */
export const V_MIN = 180;
export const V_MAX = 560;

/** Terminal speed, so a long fall from the top of the shaft stays readable. */
export const MAX_FALL = 620;

/** How much speed survives a wall. Under half and banking is not worth aiming for. */
export const WALL_BOUNCE = 0.62;

/**
 * How much of a landing's speed survives when it comes down too hard to stick.
 *
 * Only ever applied to the TOP of a shelf: shelves are one-way. See the note on
 * `collide` in taterCore.ts for why the undersides had to go.
 */
export const PLATFORM_BOUNCE = 0.3;

/**
 * Land, or bounce.
 *
 * Coming down on a shelf faster than this bounces once instead of sticking.
 * Without it a full-power drop from three rows up stopped dead the instant it
 * touched wood, which reads as the game grabbing you.
 */
export const LAND_SPEED = 340;

/**
 * Sliding friction along the top of a platform, in px/s².
 *
 * High, and it has to be. Stopping distance is v^2/2f, so at the 520 this
 * started at, a landing carrying 300px/s of sideways speed slid 86 pixels —
 * further than a medium shelf is wide. Every good shot skated straight off the
 * far end of the shelf it had just earned. At 1400 that same landing slides 32
 * and stops, while a really fast one still slides off, which is the risk that
 * makes a full-power blast a decision.
 */
export const SLIDE_FRICTION = 1400;

/** Below this the slide is over and Elmer is standing. */
export const REST_SPEED = 12;

// ─── Aiming ──────────────────────────────────────────────────────────────────

/**
 * How far either side of straight up the arrow sweeps, in radians.
 *
 * Just under 80 degrees. Not 90: a blast fired flat cannot gain height at all,
 * and an arrow that visibly passes through horizontal invites the player to try
 * it. The arc stops where the shot stops being a climb.
 */
export const AIM_MAX = 1.38;

/**
 * Seconds for one full sweep, left limit to right limit and back.
 *
 * The arrow crosses 2 * AIM_MAX twice in this, so at 2.4 it moves about 2.3
 * radians a second and a 50ms tap costs a tenth of a radian. Faster than this
 * and the aim stops being a decision — it was 1.7, and at that rate the same
 * thumb was worth a sixth of a radian, which at full power is most of a shelf.
 */
export const AIM_PERIOD = 2.4;

/**
 * Seconds for the carbonation gauge to fill and empty once.
 *
 * The gauge is a TRIANGLE wave, not a sine: it climbs at a constant rate, so
 * the player can learn where to tap. A sine crawls at the top and races
 * through the middle, which means the same tap timing gives a different power
 * depending on where in the sweep it lands — that is not difficulty, it is
 * noise.
 */
export const POWER_PERIOD = 1.6;

// ─── Fizz ────────────────────────────────────────────────────────────────────
//
// Mixey is a can of cola, and a can of cola runs out. This is what ends a run —
// falling never does, per the design, so something has to, or nothing is ever
// posted to the high score board.
//
// It is also what makes the mixers on the shelves worth going after: they are
// not only points, they are the fuel. A player who climbs cleanly is nearly
// self-sustaining on the new-height refund alone; one who keeps falling back
// down the shaft is burning fizz on ground already paid for.

export const FIZZ_START = 12;
export const FIZZ_MAX = 15;
/** Every blast costs one, whatever it achieves. */
export const FIZZ_PER_BLAST = 1;
/**
 * Per row of NEW height, not per landing.
 *
 * A blast that gains three rows hands back three. This is the lever that makes
 * the game about climbing rather than about shuffling: a big clean shot pays
 * for itself and then some, while creeping up a row at a time is break-even
 * and falling back down the shaft is pure loss. Capped by FIZZ_REFUND_MAX
 * below, so a single lucky bank shot up five rows cannot refill the can.
 */
export const FIZZ_PER_NEW_ROW = 1;
/** The most one landing can hand back, however far it climbed. */
export const FIZZ_REFUND_MAX = 3;
/** Picking a mixer up off a shelf. */
export const FIZZ_PER_MIXER = 3;

// ─── Scoring ─────────────────────────────────────────────────────────────────

/** Per row of the shaft, counted at the highest row ever reached. */
export const SCORE_PER_ROW = 100;
/** First time a zone's floor is crossed — the sky, the moon, and so on. A big moment. */
export const SCORE_NEW_ZONE = 2000;
/** And a refill to go with it. */
export const FIZZ_PER_ZONE = 5;

// ─── Holding ─────────────────────────────────────────────────────────────────

/** Full fills of the gauge a hold survives. Past this, the can explodes. */
export const OVERSHAKE_CYCLES = 3;
/** How many rows an explosion knocks Elmer down. */
export const KNOCKDOWN_ROWS = 3;
/** Handing a mixer to a dusty bottle so it can finally be a drink. */
export const SCORE_MATCH = 1000;
/** Picking a mixer up. */
export const SCORE_MIXER = 250;
/** Landing on Allie's shelf, before Tater turns up and takes her away again. */
export const SCORE_ALLIE = 2500;
/** Spraying Tater off the top of a world. Times the lap number. */
export const SCORE_SHOWDOWN = 1500;
/** Lap one's summit: knocking Tater off his top shelf and getting Allie back. */
export const SCORE_RESCUE = 5000;
/** Every later summit frees a rare bottle; worth this times the lap number. */
export const SCORE_SUMMIT_PER_LAP = 2500;

// ─── Laps ────────────────────────────────────────────────────────────────────
//
// The climb has a top. Reaching it plays the finale and starts the next lap
// from the bottom shelf with the score carried — and every lap is harder.

/** How far along "harder" a lap is: 0 on lap one, 1 by lap five and after. */
export function lapDifficulty(lap: number): number {
  return Math.min(1, Math.max(0, (lap - 1) / 4));
}

/** The arrow sweeps faster each lap. */
export function aimPeriodFor(lap: number): number {
  return AIM_PERIOD - lapDifficulty(lap) * 0.8;
}

/** And so does the carbonation gauge. */
export function powerPeriodFor(lap: number): number {
  return POWER_PERIOD - lapDifficulty(lap) * 0.55;
}

// ─── Layout ──────────────────────────────────────────────────────────────────

/**
 * Where the camera holds Elmer, as a fraction of the view height.
 *
 * Low, because this is a climbing game: the player needs to see what is ABOVE
 * them to aim at it, and almost never needs to see what is below. At 0.5 half
 * the screen was spent on shelves already cleared.
 */
export const CAMERA_ANCHOR = 0.68;

/** How fast the camera closes on its target, per second. */
export const CAMERA_LERP = 6;

/** The HUD strip along the top: score, height, lap, fizz. */
export const HUD_H = 30;

/**
 * The top-right corner GameShell floats its EXIT button over, in logical px.
 *
 * A full-bleed game draws its own everything, so the only way out is the
 * button the cabinet puts on top — a 44px target, which on a 375-wide phone is
 * about this much of a 256-wide field. Nothing the HUD draws may go here.
 */
export const EXIT_CLEARANCE_W = 62;
export const EXIT_CLEARANCE_H = 38;

// ─── Palette ─────────────────────────────────────────────────────────────────
//
// Early-80s arcade: flat, saturated interface colours over dark stages.

export const T = {
  black: "#0A0710",
  ink: "#140F1E",
  shadow: "rgba(0,0,0,0.5)",

  white: "#FFFFFF",
  bone: "#EFE3CB",
  dim: "#9A8FA8",

  /** Interface accent. Cola-can red, so the gauge and the can agree. */
  hot: "#F03A2E",
  hotDark: "#8A1108",
  brass: "#FFC02E",
  brassDark: "#8A5E00",
  good: "#5BE07A",
  cyan: "#54D8E0",

  /** Elmer: a bonded bourbon, amber glass and a cream label. */
  bourbon: "#C4761E",
  bourbonLit: "#F0A845",
  bourbonDark: "#6E3A08",
  label: "#EFE3CB",
  labelShade: "#C0AE90",

  /** Mixey: cola red and aluminium. */
  cola: "#D8281C",
  colaLit: "#FF6A54",
  colaDark: "#7A0C06",
  metal: "#C8CCD8",
  metalLit: "#F2F4FA",
  metalDark: "#6A7080",

  /** Allie: rare bourbon, deep glass, wax top. */
  allie: "#8E2A4A",
  allieLit: "#D8608A",
  allieDark: "#4A0E24",

  /** Mr. Tater: a potato in a bourbon tee. */
  tater: "#A87042",
  taterLit: "#D8A068",
  taterDark: "#5E3A16",
} as const;
