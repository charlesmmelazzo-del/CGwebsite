// ─── Gather phase — rules ────────────────────────────────────────────────────
//
// Before a drink can be built it has to be picked off the shelf. The bartender
// runs along the bottom of the screen and jumps for the ingredients floating
// above him; the recipe sits along the bottom edge, ticking off as he collects.
//
// The one rule that shapes everything else: THE PLAYER CANNOT DIE HERE. Wrong
// grabs cost points and nothing more, and the phase does not end until every
// ingredient on the recipe is in hand. It's a warm-up that sets up the round,
// not a second thing to fail — failure belongs to the rhythm phase.
//
// No React, no canvas. The component draws what this decides. See
// __tests__/gather.test.ts, which steps `update` directly, because a hidden
// browser tab gives requestAnimationFrame zero frames and watching the canvas
// proves nothing.

import { GAME_W } from "./arcade";
import type { IngredientKey } from "./cocktails";
import { ingredientsInUse } from "./cocktails";

// ─── Tuning ──────────────────────────────────────────────────────────────────

export const GROUND_Y = 250;
/** Bartender's box, in game pixels. */
export const PLAYER_W = 18;
export const PLAYER_H = 26;

export const RUN_SPEED = 78;
export const GRAVITY = 900;
/**
 * Chosen so a single jump apex clears the top shelf: apex = v^2 / 2g, which at
 * 390 and 900 is ~84px. The top row sits 105px above the ground, and the
 * player is 26 tall, so his head reaches it with a little to spare.
 */
export const JUMP_V = 390;

export const SHELF_ROWS = [GROUND_Y - 105, GROUND_Y - 74, GROUND_Y - 45];
export const ITEM_SIZE = 16;
export const PER_ROW = 5;

export const PTS_RIGHT = 120;
export const PTS_WRONG = -60;
/** How long a grab's feedback stays on screen, in seconds. */
export const FLASH_SECONDS = 0.9;
/**
 * Dead time after any grab, in seconds.
 *
 * Without it, jumping for the top shelf punishes you on the way down: the fall
 * passes through both lower rows and clips whatever happens to be under you,
 * so a single correct grab could cost more than it paid. Reaching high has to
 * be worth doing.
 */
export const GRAB_COOLDOWN = 0.35;

export interface GatherItem {
  key: IngredientKey;
  x: number;
  y: number;
  taken: boolean;
  /** Phase offset so the shelf doesn't bob in unison. */
  bob: number;
}

export interface GatherState {
  t: number;
  /** Centre x and feet y. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  facing: 1 | -1;
  items: GatherItem[];
  needed: IngredientKey[];
  collected: IngredientKey[];
  score: number;
  flash: { key: IngredientKey; good: boolean; t: number } | null;
  /** Counts down after a grab; nothing can be picked up while it runs. */
  grabCooldown: number;
  /** True once every needed ingredient is in hand. */
  done: boolean;
}

export interface GatherInput {
  left: boolean;
  right: boolean;
  jump: boolean;
}

/**
 * Lay the shelves out.
 *
 * Every ingredient the book uses appears, so the player has to actually read
 * the recipe rather than grabbing whatever is nearest. Needed ingredients are
 * scattered through the rows rather than grouped, so no round is a walk along
 * one shelf.
 */
export function freshGatherState(
  needed: IngredientKey[],
  rand: () => number = Math.random
): GatherState {
  const pool = ingredientsInUse();
  // Shuffle so the same ingredient isn't always in the same place.
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const items: GatherItem[] = shuffled.map((key, i) => {
    const row = Math.floor(i / PER_ROW) % SHELF_ROWS.length;
    const col = i % PER_ROW;
    const lane = GAME_W / PER_ROW;
    return {
      key,
      // Centred in its lane, nudged so rows don't line up in columns.
      x: col * lane + lane / 2 + (row % 2 === 0 ? 0 : lane * 0.25),
      y: SHELF_ROWS[row],
      taken: false,
      bob: rand() * Math.PI * 2,
    };
  });

  return {
    t: 0,
    x: GAME_W / 2,
    y: GROUND_Y,
    vx: 0,
    vy: 0,
    onGround: true,
    facing: 1,
    items,
    needed: [...needed],
    collected: [],
    score: 0,
    flash: null,
    grabCooldown: 0,
    done: false,
  };
}

function overlaps(st: GatherState, item: GatherItem): boolean {
  const px = st.x - PLAYER_W / 2;
  const py = st.y - PLAYER_H;
  const ix = item.x - ITEM_SIZE / 2;
  const iy = item.y - ITEM_SIZE / 2;
  return (
    px < ix + ITEM_SIZE && px + PLAYER_W > ix && py < iy + ITEM_SIZE && py + PLAYER_H > iy
  );
}

/** Ingredients still to find. */
export function remaining(st: GatherState): IngredientKey[] {
  return st.needed.filter((k) => !st.collected.includes(k));
}

/**
 * Advance one frame. `dt` in seconds.
 *
 * Returns nothing — the state is mutated in place, matching the other cores so
 * a frame loop never allocates.
 */
export function updateGather(st: GatherState, dt: number, input: GatherInput): void {
  st.t += dt;

  if (st.flash) {
    st.flash.t -= dt;
    if (st.flash.t <= 0) st.flash = null;
  }
  if (st.grabCooldown > 0) st.grabCooldown -= dt;

  // ── Run ───────────────────────────────────────────────────────────────────
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  st.vx = dir * RUN_SPEED;
  if (dir !== 0) st.facing = dir > 0 ? 1 : -1;
  st.x += st.vx * dt;

  // The bar has walls. Running off the edge would take him behind the shelves.
  const half = PLAYER_W / 2;
  if (st.x < half) st.x = half;
  if (st.x > GAME_W - half) st.x = GAME_W - half;

  // ── Jump ──────────────────────────────────────────────────────────────────
  if (input.jump && st.onGround) {
    st.vy = -JUMP_V;
    st.onGround = false;
  }
  st.vy += GRAVITY * dt;
  st.y += st.vy * dt;
  if (st.y >= GROUND_Y) {
    st.y = GROUND_Y;
    st.vy = 0;
    st.onGround = true;
  }

  // ── Grabs ─────────────────────────────────────────────────────────────────
  // Once the recipe is complete nothing more can be picked up, so a player
  // wandering back to the shelves can't bleed points after finishing.
  if (st.done || st.grabCooldown > 0) return;

  for (const item of st.items) {
    if (item.taken || !overlaps(st, item)) continue;

    const wanted = st.needed.includes(item.key) && !st.collected.includes(item.key);
    item.taken = true;

    if (wanted) {
      st.collected.push(item.key);
      st.score += PTS_RIGHT;
      st.flash = { key: item.key, good: true, t: FLASH_SECONDS };
    } else {
      // Costs points, never a life. Score is floored so a run of mistakes
      // can't push the round negative before it has properly started.
      st.score = Math.max(0, st.score + PTS_WRONG);
      st.flash = { key: item.key, good: false, t: FLASH_SECONDS };
    }
    st.grabCooldown = GRAB_COOLDOWN;
    // One pickup per frame, so passing through two shelves at once can never
    // take both.
    break;
  }

  if (remaining(st).length === 0) st.done = true;
}
