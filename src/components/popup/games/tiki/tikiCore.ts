// ─── Tiki Wars — rules ───────────────────────────────────────────────────────
//
// No React, no canvas. Waves, guns, gates, damage, the shop economy and the
// difficulty curve all live here so they can be stepped directly in a test — a
// hidden browser tab stops calling requestAnimationFrame entirely, so watching
// the canvas is not a way to check any of this.
//
// Positions are stored in FIELD units, not pixels:
//   z   1 at the horizon, 0 at the player's feet
//   nx  -1..+1 across the road, so "directly in front of me" is true at every
//       distance. constants.ts turns both into screen coordinates.
//
// See docs/tiki-wars.md.

// ─── Tunables ────────────────────────────────────────────────────────────────

export const MAX_HEALTH = 100;
export const MAX_ARMOR = 10;
export const MAX_BOMBS = 3;
/**
 * Most helpers a hero may have at once.
 *
 * Three. Six was reachable in a single run and it showed: a full rank plus a
 * decent gun cleared the road faster than the wave could arrive, and the game
 * stopped asking anything. Three is a visible squad without being an answer to
 * the whole stage.
 */
export const MAX_HELPERS = 3;

// ─── The helper cluster ──────────────────────────────────────────────────────
//
// A helper used to be a POSITION rather than a THING. Three slots were computed
// from the hero's nx every frame — hero minus spacing, hero plus spacing, and
// so on — and whatever was standing in slot two was drawn there and fired from
// there. Two things followed from that, and both were visible:
//
//   * The squad was welded to the hero. It could not lean, lag, spread or
//     settle, because there was nothing there to have momentum.
//   * A slot that would have fallen off the side of the screen was MIRRORED to
//     the other side. Walk to the right kerb and the helper on your right
//     stopped existing and an identical one appeared on your left, mid-burst,
//     shooting up the far lane. Nothing moved between the two places. It was a
//     teleport, and it happened exactly when the guest was concentrating.
//
// So a helper is a body now: a position, a velocity, and a place on a ring
// around the hero that it would LIKE to be. A spring pulls it toward that
// place, drag settles it, the hero's own movement shoves it, its neighbours
// keep it at arm's length, and the kerb stops it. Nothing is ever assigned a
// position, so nothing can jump: when the hero pins himself to the kerb the
// ring TURNS, and the squad swings around him and re-forms on the open side.

/**
 * How far out a helper may sit.
 *
 * Short of the screen edge, and it can be wider than the hero's own limit
 * because a helper is a much smaller sprite — measured from the imported sheet,
 * a helper reaches about 23 logical px either side of its feet against the
 * hero's 36.
 */
export const HELPER_NX_LIMIT = 0.86;

/**
 * The ring the squad floats on: how far across the road, and how far up it.
 *
 * The depth radius is small next to the lateral one because depth is expensive
 * on screen — the perspective divide turns a tenth of z into most of the height
 * of the hero, so a ring that is round in field units is enormously tall in
 * pixels. These two numbers are what make the cluster read as a group standing
 * AROUND him rather than a queue in front of him.
 */
export const HELPER_RING_NX = 0.44;
export const HELPER_RING_Z = 0.042;

/**
 * Depth of the ring's centre.
 *
 * Far enough up-field that the whole ring stays in front of the hero. It cannot
 * go behind him: z is 0 at his feet and the projection has no meaning below
 * that — a negative depth puts a helper under the bottom edge of the screen at
 * twice the size of everything else.
 */
export const HELPER_RING_Z0 = 0.062;

/**
 * Where each helper sits on the ring, by squad size.
 *
 * Angles, with 0 to the hero's right, a quarter turn up-field, half a turn to
 * his left. Two flank him; the third takes the point. Nobody is placed at
 * three-quarters — that is the spot between the hero and the camera, and a
 * helper there is drawn on top of him.
 */
const RING: number[][] = [[], [0], [0, Math.PI], [0, Math.PI, Math.PI / 2]];

function ringAngles(n: number): number[] {
  if (n <= 0) return [];
  if (n < RING.length) return RING[n];
  // More than the ladder can hand out. Spread them evenly rather than fail:
  // the tests push the count past the cap to measure firepower.
  return Array.from({ length: n }, (_, i) => (i / n) * Math.PI * 2);
}

/**
 * How far the ring turns when the hero is pinned to a kerb, in radians.
 *
 * This is the whole answer to the teleport. Rather than reflecting a helper
 * that has run out of road, the FORMATION rotates away from the wall, so the
 * place the outside helper is heading for slides up-field and around to the
 * open side. He walks the arc, because he is following a spring rather than
 * being assigned a slot.
 *
 * A little over a quarter turn. Less and the outside place is still off the
 * road at full lock; much more and the squad spins in a way nothing physical
 * would.
 */
export const HELPER_SWING = 1.9;

/**
 * How far the ring's centre is shoved off the kerb, in nx.
 *
 * Turning the ring is not enough on its own. A ring is symmetric: rotate it as
 * far as you like and there is still somebody on the wall side, and with the
 * hero parked against the kerb that somebody has nowhere to stand but on top of
 * him. So the whole cluster also slides INBOARD as he leans, which is what a
 * crowd of people pressed against a wall would actually do.
 */
export const HELPER_LEAN_SHIFT = 0.32;

/** Spring pulling a helper to its place, and the drag that settles it. */
const HELPER_PULL = 55;
const HELPER_DRAG = 12;

/**
 * How much of the hero's own movement is left for the springs to catch up on.
 *
 * The squad's places are measured FROM the hero, so without this they would
 * track him perfectly rigidly — he can cross the road in a third of a second
 * and a rigidly-attached cluster looks welded on. Holding a little over half of
 * each step back makes them swing out behind a dash and gather in again, which
 * is the whole "floating around him" of it. Simulating them in absolute
 * position instead would be the same thing with no upper bound on the lag, and
 * they would simply be left behind.
 */
const HELPER_LAG = 0.58;

/**
 * Personal space, in nx, and how hard it is defended.
 *
 * Applied between helpers and between a helper and the hero. Springs alone let
 * two of them settle in the same place while the ring is turning, which is the
 * overlapping-blob look the slots had at the kerb.
 */
const HELPER_SPACE = 0.3;
const HELPER_SHOVE = 26;

/**
 * Depth counted in units of the lateral radius.
 *
 * Distances between helpers have to be measured in some shared unit or the
 * separation rule is nonsense: a tenth of z and a tenth of nx are nowhere near
 * the same distance on screen.
 */
const Z_TO_NX = HELPER_RING_NX / HELPER_RING_Z;

/**
 * Damage of one helper's round, against a pistol round's 1.
 *
 * A fifth. Helpers carry the base pistol whatever the hero is holding, and they
 * are meant to widen his fire rather than multiply it — a rank of six roughly
 * doubles his output, which is worth taking without ending the difficulty
 * curve.
 */
export const HELPER_DAMAGE = 0.2;

/** One of the bottles flanking the hero. */
export interface Helper {
  /** Position across the road, RELATIVE to the hero. */
  dnx: number;
  /** Depth. Absolute, because the hero is always at 0. */
  z: number;
  vnx: number;
  vz: number;
  /** Its own phase, so the cluster breathes out of step with itself. */
  phase: number;
}

/**
 * Where the squad would like to be, relative to the hero.
 *
 * Shared by the rules and the renderer, and by nothing else: these are targets,
 * not positions. Where a helper actually IS lives in state.helperUnits, which
 * is what both fires and is drawn.
 */
export function helperTargets(
  playerNx: number,
  units: Helper[],
  t: number
): { dnx: number; z: number }[] {
  const angles = ringAngles(units.length);
  // Turn the ring away from whichever kerb the hero is leaning on. Squared, so
  // the formation is undisturbed through the middle of the road and only swings
  // when he is genuinely running out of room.
  const lean = playerNx / PLAYER_NX_LIMIT;
  const pinned = Math.sign(lean) * Math.min(1, lean * lean);
  const swing = HELPER_SWING * pinned;
  const shift = -HELPER_LEAN_SHIFT * pinned;

  return angles.map((base, i) => {
    const u = units[i];
    // A slow wander so the cluster never looks welded into a diagram. Each
    // helper carries its own phase, so they drift out of step with each other.
    const a = base + swing + Math.sin(t * 0.8 + u.phase) * 0.2;
    const r = 1 + Math.sin(t * 0.62 + u.phase * 1.7) * 0.07;
    return {
      dnx: shift + HELPER_RING_NX * r * Math.cos(a),
      z: HELPER_RING_Z0 + HELPER_RING_Z * r * Math.sin(a),
    };
  });
}

/** Keep the bodies in step with the count the ladder has handed out. */
function syncHelpers(st: State): void {
  while (st.helperUnits.length > st.helpers) st.helperUnits.pop();
  while (st.helperUnits.length < st.helpers) {
    // A new one arrives AT the hero and is pushed out to its place by the
    // spring, which reads as it running up and falling in beside him. Dropping
    // it straight into formation made a helper wink into existence.
    st.helperUnits.push({
      dnx: 0, z: 0.01, vnx: 0, vz: 0, phase: st.rng() * Math.PI * 2,
    });
  }
}

/**
 * Move the squad.
 *
 * `heroStep` is how far the hero moved this frame: the places are measured from
 * him, so his movement is what shoves them.
 */
function stepHelpers(st: State, dt: number, heroStep: number): void {
  syncHelpers(st);
  const units = st.helperUnits;
  if (units.length === 0) return;

  const targets = helperTargets(st.playerNx, units, st.t);

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const want = targets[i];

    // The hero's step, minus what the helper keeps up with by itself.
    u.dnx -= heroStep * HELPER_LAG;

    let ax = (want.dnx - u.dnx) * HELPER_PULL - u.vnx * HELPER_DRAG;
    let az = (want.z - u.z) * HELPER_PULL - u.vz * HELPER_DRAG;

    // Elbow room. Measured in one shared unit so a helper directly up-field is
    // as far away as one the same distance to the side.
    const shove = (dx: number, dz: number) => {
      const zz = dz * Z_TO_NX;
      const d = Math.hypot(dx, zz);
      if (d >= HELPER_SPACE) return;
      // Two bodies in exactly the same place have no direction to separate in;
      // push sideways rather than dividing by zero.
      const k = (HELPER_SPACE - d) * HELPER_SHOVE;
      if (d < 1e-4) { ax += k; return; }
      ax += (dx / d) * k;
      az += (zz / d) * k / Z_TO_NX;
    };
    // The hero sits at the origin of this space: relative nx 0, depth 0.
    shove(u.dnx, u.z);
    for (let j = 0; j < units.length; j++) {
      if (j === i) continue;
      shove(u.dnx - units[j].dnx, u.z - units[j].z);
    }

    u.vnx += ax * dt;
    u.vz += az * dt;
    u.dnx += u.vnx * dt;
    u.z += u.vz * dt;

    // The kerb. A wall, not a slot: it stops the body where it is instead of
    // moving it somewhere else, and the ring has already turned to take the
    // squad away from it.
    const nx = st.playerNx + u.dnx;
    if (nx > HELPER_NX_LIMIT) { u.dnx = HELPER_NX_LIMIT - st.playerNx; if (u.vnx > 0) u.vnx = 0; }
    if (nx < -HELPER_NX_LIMIT) { u.dnx = -HELPER_NX_LIMIT - st.playerNx; if (u.vnx < 0) u.vnx = 0; }
    // Depth is fenced for the same reason: the projection has no meaning behind
    // the hero, and a helper too far up the field is a stranger, not a squad.
    if (u.z < 0.008) { u.z = 0.008; if (u.vz < 0) u.vz = 0; }
    if (u.z > 0.16) { u.z = 0.16; if (u.vz > 0) u.vz = 0; }
  }
}

/** Where a helper actually is, in field coordinates. */
export function helperAt(st: State, u: Helper): { nx: number; z: number } {
  return { nx: st.playerNx + u.dnx, z: u.z };
}

/**
 * How far the hero may lean into the road.
 *
 * Measured from the art rather than chosen: on the imported sheets his walk
 * poses reach 36 logical px right of his feet (the shotgun barrel) and 31 px
 * left, and the celebration and hit poses throw an arm out to 43. The road is
 * 126 px either side of centre on a 270 px screen, so 0.75 is the furthest out
 * he can stand with the WHOLE of him still on the display. At 0.81 the gun in
 * his outside hand was sliced off by the edge of the screen every time the
 * guest hugged the kerb — which is most of the time, because that is where you
 * go to refuse a gate.
 */
export const PLAYER_NX_LIMIT = 0.75;

export const PLAYER_SPEED = 2.6;          // keyboard only: nx per second

/**
 * How hard the character is pinned to the thumb, per second.
 *
 * High on purpose. This is effectively direct tracking with one frame of
 * smoothing — anything gentler reintroduces the towed, drifty feel that made
 * dodging unreliable.
 */
export const FOLLOW_RATE = 34;

/**
 * How much road one full thumb travel covers, in nx.
 *
 * This is the GAIN, and it is what makes the character feel fast or slow across
 * the road — not the follow rate. Lowering it means the same thumb movement
 * covers less ground, which reads as more controlled without introducing any
 * lag at all. Lowering FOLLOW_RATE instead would just bring back the drift.
 */
export const DRAG_RANGE = 0.88;

/**
 * Ceiling on how fast the character can cross the road, in nx per second.
 *
 * Generous enough that ordinary steering never touches it — it only bites on a
 * violent flick, which would otherwise teleport the character from edge to edge
 * in a single frame. Capping the speed rather than softening the follow keeps
 * normal movement exactly as responsive as it was.
 *
 * Set this too low and the cap becomes the dominant constraint instead of an
 * edge case, which is just the old towed feel wearing a different hat. At 2.9
 * it took a third of a second to cross the road and the character visibly
 * lagged the thumb again.
 */
export const MAX_TRAVERSE = 7.5;
export const CONTACT_Z = 0.045;           // where an enemy is "on top of" you
export const CONTACT_NX = 0.30;           // how wide a body is, in nx

/**
 * How far a TRACKING enemy may follow the player across the road.
 *
 * Sized to each one's sprite, because they are drawn at wildly different
 * widths. A boss is around 190 logical px across on a 270px screen — nearly
 * three-quarters of it — so following the guest out to the edge hung a third
 * of the boss off the side of the display. Grunts do not track, so they are
 * not here.
 *
 * Both figures come from measuring the WIDEST of them on the imported sheets,
 * from the feet each frame is registered on, rather than from a guess: the
 * broadest boss walk pose reaches 92 logical px to one side of its feet, and
 * the broadest blocker 58. The road is 126px either side of centre and the
 * screen is 135, so what fits is (135 - reach) / 126.
 *
 * The blocker figure used to be 0.74, which is what a blocker would need to
 * follow the guest almost to the kerb — and at 0.74 the widest of them, the
 * blender and the milk carton, were being sliced down one side by the edge of
 * the screen while they walked.
 */
export const TRACK_LIMIT: Record<string, number> = { blocker: 0.61, boss: 0.30 };

/**
 * Contact half-width, by tier.
 *
 * A boss reaches much further than an ordinary body simply because it IS much
 * bigger. It also has to: capping how far it can follow the guest would
 * otherwise make hugging the kerb a place a boss could never touch you, which
 * turns the one enemy that must be killed into one that can be ignored.
 */
export function contactNx(tier: EnemyTier): number {
  return tier === "boss" ? 0.55 : CONTACT_NX;
}
export const CONTACT_DAMAGE = 18;

export const STAGE_SECONDS = 64;          // spawning time before the boss shows
export const GATE_EVERY = 14;

/**
 * How fast a gate closes on the player, in z per second.
 *
 * Faster than anything walking, deliberately. Slowing it to the world's pace
 * reads better physically — it is scenery, after all — but it then spends ten
 * seconds of every cycle on screen and gets overtaken by every enemy on the
 * field. Outrunning them means the only thing that has to be cleared is the
 * road AHEAD of it, which is one short quiet window rather than a permanent
 * hole in the wave.
 */
export const GATE_SPEED = 0.30;

/**
 * Gate speed at a given stage.
 *
 * SCALES, because a fixed figure stops working: enemies speed up with depth and
 * by about stage 20 they were outrunning a 0.30 gate, at which point the whole
 * wave overtakes it and the clear road it was given closes up behind it. Held a
 * comfortable margin above the fastest thing walking.
 */
export function gateSpeed(stage: number): number {
  return Math.max(GATE_SPEED, enemySpeed(stage) * 1.35);
}


export const PTS_GRUNT = 10;
export const PTS_BLOCKER = 50;
export const PTS_BOSS = 500;
export const PTS_STAGE = 100;

/**
 * What an enemy costs you for walking past unkilled.
 *
 * Without this, dodging is strictly free: side-step everything, never fire, and
 * survive indefinitely at no cost. The penalty makes position a trade rather
 * than an escape — you can still dodge what you cannot kill, but it is never
 * the cheap option.
 *
 * Deliberately HALF the kill value rather than equal to it. At depth the wave
 * outgrows any gun, so a symmetric penalty would make simply surviving a deep
 * stage net-negative and punish the guest for getting good. Half keeps dodging
 * clearly worse than killing without turning late stages into a bleed.
 */
export const PTS_MISS_GRUNT = 5;
export const PTS_MISS_BLOCKER = 25;

/** Depth at which an enemy counts as having got past you. */
export const MISS_Z = -0.02;

/** Mirrors the DB cap in scores.ts. Clamped, never rejected. */
export const MAX_SCORE = 10_000_000;

export type GunKind = "pistol" | "shotgun" | "uzi" | "flame" | "laser";

export const GUNS: Record<GunKind, {
  /** Shots per second. */
  rate: number;
  /** Damage per bullet, or per second for the flamethrower. */
  damage: number;
  /** Bullets per shot. */
  count: number;
  /** Half-angle of the spray, in nx per unit z. */
  spread: number;
  /** Flamethrower only: how far up the field the stream reaches. */
  range: number;
}> = {
  pistol: { rate: 5.5, damage: 1, count: 1, spread: 0, range: 1 },
  // Every upgrade is tuned to sit HALFWAY between where it used to be and the
  // pistol. They were two to three times the base gun, which made the first
  // gun gate the moment a run stopped being a game — and made the pistol feel
  // like a punishment rather than a starting point.
  shotgun: { rate: 2.5, damage: 1, count: 3, spread: 0.42, range: 1 },
  uzi: { rate: 9.2, damage: 1, count: 1, spread: 0.04, range: 1 },
  // Damage is per second and applies to everything inside the cone at once,
  // plus a burn that keeps ticking after the stream moves off. Devastating up
  // close, useless at any distance — the panic button, not an upgrade.
  flame: { rate: 0, damage: 7.2, count: 0, spread: 0.55, range: 0.34 },
  // The answer to a wall of blockers rather than to a crowd: each shot goes
  // straight THROUGH what it hits.
  //
  // Deliberately slow. At six rounds a second it was eighteen damage a second
  // AND piercing — over three times the pistol against a single target and
  // far more against a column, which made every other gun pointless. The
  // piercing is the weapon; the rate of fire is what it pays for it.
  laser: { rate: 2.1, damage: 3, count: 1, spread: 0, range: 1 },
};

/** Guns whose rounds are not consumed by the first thing they hit. */
export const PIERCING: Partial<Record<GunKind, boolean>> = { laser: true };

export const BURN_DPS = 3.5;
export const BURN_SECONDS = 2.6;

/**
 * Every enemy the game can put on the field.
 *
 * `kind` is the sprite roster name; `tier` is what the rules care about. The
 * renderer turns a kind into a sheet name, so adding an enemy is one entry in
 * one of these lists plus the PNG.
 */
export const GRUNTS = ["lime", "kiwi", "lemon", "orange", "cherry", "sugarcube"] as const;

/**
 * Blockers. ALL of them can appear on ANY stage, for now.
 *
 * The design has stage-native blockers (sugar cane on the beach, cinnamon in
 * the winter) with a wildcard pool on top. Only the beach exists yet, so
 * confining each blocker to its unbuilt stage would leave thirteen of the
 * fourteen drawn and never seen. Treating the whole roster as wildcards uses
 * every one of them today and gives the waves real variety; the stage
 * weighting comes back when the stages themselves do.
 */
export const BLOCKERS = [
  "sugarcane", "worm", "mezcal", "cinnamon", "coconut", "grapefruit", "candycane",
  "milk", "beercan", "coconutcream", "gingerbeer", "cherry", "almond", "blender",
] as const;

/** Bosses, in the order a run meets them. */
export const BOSSES = ["baby", "knight", "santa", "king"] as const;

export type GruntName = (typeof GRUNTS)[number];
export type BlockerName = (typeof BLOCKERS)[number];
export type BossName = (typeof BOSSES)[number];
export type EnemyTier = "grunt" | "blocker" | "boss";

export function isGrunt(k: string): boolean {
  return (GRUNTS as readonly string[]).includes(k);
}

export function isBlocker(k: string): boolean {
  return (BLOCKERS as readonly string[]).includes(k);
}

/** The blender is the elite of the pool: tougher and worth more. */
export const ELITE_BLOCKER: BlockerName = "blender";

/**
 * Which boss guards which stage.
 *
 * Cycles through all four rather than repeating the beach boss forever, so a
 * guest who keeps going meets every one of them. Once the real stages exist
 * this becomes a property of the stage instead.
 */
/** How many different blockers one stage draws on. */
export const BLOCKERS_PER_STAGE = 4;

/** Pick this stage's blocker cast. Deterministic given the run's rng. */
export function pickStageBlockers(rng: () => number): BlockerName[] {
  const pool = [...BLOCKERS];
  const out: BlockerName[] = [];
  for (let i = 0; i < BLOCKERS_PER_STAGE && pool.length; i++) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}

export function bossFor(stage: number): BossName {
  return BOSSES[(stage - 1) % BOSSES.length];
}

/**
 * The King is the end of the story, so beating him plays the blimp escape.
 *
 * Bosses cycle, so this comes round again — which is the intended shape: the
 * King gets away, and the next loop is harder. Once the real stages exist this
 * belongs to the Castle rather than to a boss name.
 */
export function isFinaleBoss(stage: number): boolean {
  return bossFor(stage) === "king";
}

/**
 * Grunt health.
 *
 * These used to die in exactly one shot, on the reasoning that the guest needs
 * an unconditional read of "shoot through it" or "dodge round it". That held,
 * but it cost the shooting all of its weight — a one-shot enemy gives no
 * feedback at all, it simply stops existing, and firing felt like sweeping
 * rather than fighting.
 *
 * A few hits restores the weight. The read is preserved by FEEDBACK instead of
 * by health: every hit flashes the target white and staggers it visibly, so
 * "this is dying" is legible without counting shots. All six soldiers still
 * share one health value — variety between them stays colour, silhouette and
 * speed, so a cherry never secretly takes longer than a lime.
 *
 * Deliberately meaty. FEWER, TOUGHER enemies read better than a swarm of
 * one-shot ones: you can see a burst landing, and pouring rounds into something
 * until it drops is the feeling the gun is there for. The adaptive pressure
 * loop is what stops that leaving the field empty — the base numbers are tuned
 * for someone who is struggling, and the loop adds enemies for anyone who is
 * not.
 */
export function gruntHp(stage: number): number {
  return 3 + Math.floor((stage - 1) / 8);
}

/**
 * How long a hit takes an enemy off its stride.
 *
 * The whole point of the change above: a bullet has to visibly DO something on
 * impact, not just decrement a number. The target stalls for a moment and gets
 * pushed back up the field, which is what makes a hit feel like a hit.
 */
export const STAGGER_SECONDS = 0.12;
/** Fraction of normal walking speed while staggered. */
export const STAGGER_SPEED = 0.15;

/**
 * A boss is only SLOWED by a hit, never stopped.
 *
 * Sharing the ordinary stagger meant a fast gun pinned one in place: every
 * round refreshed the stall before the last had run out, so a boss under
 * sustained uzi fire never advanced at all. It stopped being a fight and became
 * a stationary target that happened to have a lot of health.
 */
export const BOSS_STAGGER_SPEED = 0.7;
/** How far back up the field a hit shoves an enemy. */
export const STAGGER_KNOCKBACK = 0.012;

/**
 * Share of that knockback a boss takes.
 *
 * Almost none, and this — not the stagger — was what really pinned them. An uzi
 * lands thirteen rounds a second, each shoving 0.012 back up the field: 0.156 a
 * second against a boss that only walks forward at 0.087. It was being pushed
 * BACKWARDS faster than it could advance, so sustained fire held it at the
 * horizon indefinitely. Small arms should not visibly move something that size.
 */
export const BOSS_KNOCKBACK_SCALE = 0.15;

/**
 * Per-soldier walking speed.
 *
 * The ONLY thing that varies between soldiers, along with how they look. Health
 * is deliberately identical across all six — speed is visible on the approach
 * and health is not, so a cherry that secretly took longer than a lime would
 * read as the game cheating.
 */
const GRUNT_SPEED: Record<GruntName, number> = {
  lime: 1, kiwi: 1.32, lemon: 0.94, orange: 0.88, cherry: 1.18, sugarcube: 0.8,
};

export interface Enemy {
  id: number;
  /** Roster name — the renderer maps this to a sprite sheet. */
  kind: string;
  tier: EnemyTier;
  z: number;
  nx: number;
  hp: number;
  maxHp: number;
  speed: number;
  /** Seconds of burn left, from the flamethrower. */
  burn: number;
  /** Counts down after a hit, for the white flash. */
  flash: number;
  /** Counts down after a hit; the enemy is stalled while it runs. */
  stagger: number;
  /** Blockers steer toward the player; grunts walk straight. */
  tracks: boolean;
  /**
   * How far off the player's exact position this one aims, in nx.
   *
   * Every blocker steering at the same point converges them onto one x and they
   * arrive as a single-file queue, which throws away the spread the wave was
   * spawned with. A small personal offset keeps them closing on the guest as a
   * GROUP that still occupies width.
   */
  aim: number;
  dying: number;
  /** Bosses only: counts down while the attack frames are showing. */
  attacking: number;
}

export interface Bullet {
  z: number;
  nx: number;
  vnx: number;
  damage: number;
  /** Which gun it left. Purely so the renderer can start it at that muzzle. */
  side: -1 | 1;
  /**
   * Fired by a helper rather than by the hero.
   *
   * The renderer starts a round at the muzzle of the gun that fired it, and a
   * helper's gun is neither in the hero's hand nor at his scale.
   */
  fromHelper?: boolean;
  /** Carries on through what it hits, instead of stopping at the first. */
  pierce?: boolean;
  /**
   * Set once this round has been counted against a gate panel.
   *
   * The cure check runs every frame, and a bullet stays within tolerance of a
   * panel for several frames — without this, one round cured a gate four or
   * five times over and a panel walked its whole ladder off a single shot.
   */
  spentOnGate?: boolean;
}

export type GateEffect =
  | { kind: "helpers"; n: number }
  | { kind: "gun"; gun: GunKind }
  | { kind: "bomb" }
  | { kind: "money"; n: number }
  | { kind: "health"; n: number };

/**
 * A gate outcome is a RUNG on a ladder, not a fixed card.
 *
 * Shooting a panel walks it up its own ladder ONE rung at a time — a -3 RUM
 * becomes -2, then -1, then nothing, and only then starts paying out. That is
 * what makes curing feel like work rather than a coin flip: the number visibly
 * climbs, and the guest chooses how many rounds it is worth.
 */
export type GateFamily = "helpers" | "money" | "gun" | "health";

export interface Rung {
  /** null is the neutral rung — the gate simply does nothing. */
  effect: GateEffect | null;
  label: string;
  tone: "bad" | "neutral" | "good";
  /** Sprite key for the panel's icon, drawn above the label. */
  icon: string;
}

/**
 * Every ladder passes through neutral in the middle, so a negative can always
 * be walked to harmless first, and only then into a real reward.
 */
export const LADDERS: Record<GateFamily, Rung[]> = {
  // Tops out at +2, so no single gate hands over a full squad — a rank of
  // three has to be built across two of them.
  helpers: [
    { effect: { kind: "helpers", n: -2 }, label: "-2 RUM", tone: "bad", icon: "icon-rum" },
    { effect: { kind: "helpers", n: -1 }, label: "-1 RUM", tone: "bad", icon: "icon-rum" },
    { effect: null, label: "NOTHING", tone: "neutral", icon: "icon-black-cat" },
    { effect: { kind: "helpers", n: 1 }, label: "+1 RUM", tone: "good", icon: "icon-rum" },
    { effect: { kind: "helpers", n: 2 }, label: "+2 RUM", tone: "good", icon: "icon-rum" },
  ],
  money: [
    { effect: { kind: "money", n: -5 }, label: "-$5", tone: "bad", icon: "icon-money" },
    { effect: null, label: "NOTHING", tone: "neutral", icon: "icon-black-cat" },
    { effect: { kind: "money", n: 5 }, label: "+$5", tone: "good", icon: "icon-money" },
    { effect: { kind: "money", n: 8 }, label: "+$8", tone: "good", icon: "icon-money" },
  ],
  gun: [
    { effect: { kind: "gun", gun: "pistol" }, label: "PISTOL", tone: "bad", icon: "icon-pistol" },
    { effect: null, label: "NOTHING", tone: "neutral", icon: "icon-black-cat" },
    { effect: { kind: "gun", gun: "shotgun" }, label: "SHOTGUN", tone: "good", icon: "icon-shotgun" },
    { effect: { kind: "gun", gun: "uzi" }, label: "UZI", tone: "good", icon: "icon-uzi" },
    { effect: { kind: "gun", gun: "flame" }, label: "FLAME", tone: "good", icon: "icon-flame" },
    { effect: { kind: "gun", gun: "laser" }, label: "LASER", tone: "good", icon: "icon-laser" },
  ],
  health: [
    { effect: { kind: "health", n: -20 }, label: "POISON", tone: "bad", icon: "icon-poison" },
    { effect: null, label: "NOTHING", tone: "neutral", icon: "icon-black-cat" },
    { effect: { kind: "health", n: 18 }, label: "+HEALTH", tone: "good", icon: "icon-rum" },
    { effect: { kind: "bomb" }, label: "BOMB", tone: "good", icon: "icon-bomb" },
  ],
};

export interface GateOption {
  family: GateFamily;
  /** Index into the family's ladder. */
  tier: number;
  /** Rounds landed since the last rung. Resets on every step up. */
  cure: number;
}

export function rungOf(o: GateOption): Rung {
  const l = LADDERS[o.family];
  return l[Math.max(0, Math.min(l.length - 1, o.tier))];
}

export function isGoodOption(o: GateOption): boolean {
  return rungOf(o).tone === "good";
}

/** True once a panel is as good as its ladder goes. */
export function isMaxedOption(o: GateOption): boolean {
  return o.tier >= LADDERS[o.family].length - 1;
}

export interface Gate {
  z: number;
  left: GateOption;
  right: GateOption;
  taken: boolean;
  /** Set for a moment when a panel steps up, so the renderer can flash it. */
  flipped: number;
}

/**
 * How far across the road a gate panel actually reaches, as a fraction.
 *
 * Deliberately NOT the full width. Panels used to span the whole road, so a
 * gate was compulsory — and when depth decay puts a negative on BOTH sides,
 * being forced to eat one is a punishment with no play in it. The outer edges
 * are now open: you can refuse a gate entirely, but only by committing to the
 * very edge of the road, which usually means giving up position on whatever
 * else is coming.
 */
export const GATE_REACH = 0.72;

/**
 * Gap between the two panels, as a fraction of the road's half-width.
 *
 * The panels used to meet at the centre line, which read as one wide sign
 * rather than a choice between two — and at distance the labels ran together.
 * Splitting them apart makes the decision legible from further away, which is
 * the only distance at which there is still time to act on it.
 */
export const GATE_GAP = 0.14;

/**
 * Rounds needed to move a panel up ONE rung.
 *
 * The cost is per STEP, not per gate, so dragging a -3 all the way to a payout
 * is a real investment — fifteen rounds not spent on the things walking at you.
 * Curing a -1 to harmless is cheap; turning it into a reward is a decision.
 */
export const GATE_CURE_HITS = 5;

/** Floating score text — the only feedback the guest gets on a miss. */
export interface Pop {
  nx: number;
  z: number;
  text: string;
  good: boolean;
  life: number;
}

export interface Bark {
  text: string;
  life: number;
  kind: "pickup" | "boss";
  /**
   * Which way the gate went, so the hero can pull the right face.
   *
   * The art carries a celebration pose and a sad pose, and this is what picks
   * between them — the quip pool and the pose have to agree, or he grins while
   * saying "NOOOOO".
   */
  tone?: "good" | "bad";
}

export type Phase = "play" | "boss" | "bosskill" | "cleared" | "over";

export interface State {
  phase: Phase;
  /** Stage within this run. Starts at the Go Again difficulty floor. */
  stage: number;
  t: number;
  stageT: number;

  playerNx: number;
  /**
   * Keyboard steering only: -1, 0 or 1, integrated into playerNx over time.
   * Touch does NOT use this — see targetNx.
   */
  drag: number;

  /**
   * Where the thumb wants the player to be, or null when nothing is held.
   *
   * Touch steering is POSITIONAL, not a direction to accelerate in. Feeding a
   * drag into a velocity integrator made the character feel like it was being
   * towed — you moved your thumb and the character caught up a moment later,
   * which is unusable in a game where a lane choice is worth health.
   */
  targetNx: number | null;

  health: number;
  armor: number;
  money: number;
  luck: number;
  bombs: number;
  helpers: number;
  /**
   * The bodies themselves.
   *
   * Kept alongside the count rather than derived from it: a helper has
   * momentum and a place it is heading for, and neither survives being
   * recomputed from a number every frame. The count is what the gate ladder
   * changes; these are what fire and what get drawn.
   */
  helperUnits: Helper[];
  gun: GunKind;
  /** Set when a clover is bought, cleared on entering the next shop. */
  cloverBought: boolean;

  /** Ticks down; the flamethrower is drawn while > 0. */
  firing: number;
  /**
   * Helpers keep their own trigger, so the hero's gun cannot speed them up.
   * Picking up an uzi used to make them fire at its rate as well.
   */
  helperCooldown: number;
  /** Last muzzle used, so a one-barrel gun still alternates hands. */
  muzzle: -1 | 1;

  enemies: Enemy[];
  bullets: Bullet[];
  gate: Gate | null;
  bark: Bark | null;
  /**
   * What the gate the player just went through actually did.
   *
   * Set when a gate applies and cleared by whoever reads it. The renderer needs
   * this to pick between the cheerful pickup lines and the downgrade lines —
   * without it there is no way to tell a +3 RUM from a POISON after the fact,
   * since the gate is gone by the time the bark is raised.
   */
  lastGate: "good" | "bad" | "neutral" | null;
  /** Rate-limits pickup barks so a run of gates doesn't become a wall of chat. */
  barkCooldown: number;

  score: number;
  kills: { grunt: number; blocker: number; boss: number };
  /** Enemies that walked past unkilled. Counted for the owner's run detail. */
  misses: { grunt: number; blocker: number };
  pops: Pop[];
  moneyEarned: number;
  gatesTaken: number;

  /**
   * Running average of the depth at which enemies stop existing.
   *
   * High means they are dying at the horizon and the guest is over-gunned; low
   * means they are getting through.
   */
  killDepth: number;
  /** Spawn-rate multiplier the loop above is driving. */
  pressure: number;

  /**
   * The blockers this stage draws from.
   *
   * A handful chosen when the stage starts rather than the whole roster rolled
   * per spawn. Two reasons, and the second is the one that shows: a stage gets
   * a recognisable cast instead of fourteen strangers, and the art for four
   * sheets can be fetched up front so a blocker never arrives as a placeholder
   * and pops into itself a second later.
   */
  stageBlockers: BlockerName[];

  /** The remaining beats of this stage's current cycle. */
  waves: WaveBeat[];
  /** Seconds left in the beat being played. */
  waveT: number;

  cooldown: number;
  spawnT: number;
  gateT: number;
  phaseT: number;
  invuln: number;
  hitFlash: number;
  nextId: number;
  /** Deterministic in tests, seeded from Math.random in play. */
  rng: () => number;
}

export interface StartOpts {
  stage?: number;
  money?: number;
  armor?: number;
  luck?: number;
  score?: number;
  rng?: () => number;
}

export function freshState(opts: StartOpts = {}): State {
  return {
    phase: "play",
    stage: Math.max(1, opts.stage ?? 1),
    t: 0,
    stageT: 0,
    playerNx: 0,
    drag: 0,
    targetNx: null,
    health: MAX_HEALTH,
    armor: Math.min(MAX_ARMOR, opts.armor ?? 0),
    money: opts.money ?? 0,
    luck: Math.min(100, opts.luck ?? 0),
    bombs: 0,
    helpers: 0,
    helperUnits: [],
    gun: "pistol",
    cloverBought: false,
    firing: 0,
    helperCooldown: 0,
    muzzle: 1,
    enemies: [],
    bullets: [],
    gate: null,
    bark: null,
    lastGate: null,
    barkCooldown: 0,
    score: opts.score ?? 0,
    kills: { grunt: 0, blocker: 0, boss: 0 },
    misses: { grunt: 0, blocker: 0 },
    pops: [],
    moneyEarned: 0,
    gatesTaken: 0,
    killDepth: PRESSURE_TARGET_Z,
    pressure: PRESSURE_MIN,
    stageBlockers: [],
    waves: [],
    waveT: 0.8,                          // a breath before the first wave
    cooldown: 0,
    spawnT: 0.8,
    gateT: GATE_EVERY,
    phaseT: 0,
    invuln: 0,
    hitFlash: 0,
    nextId: 1,
    rng: opts.rng ?? Math.random,
  };
}

// ─── Difficulty ──────────────────────────────────────────────────────────────
//
// The game is endless, so every lever below has to keep scaling past any
// possible build. The failure mode this guards against is not a run that is too
// hard, it is a maxed-out guest who CANNOT die, gets bored at stage 40, and
// posts an unbeatable score without ever seeing an ending.

/**
 * How much of the road a wave spans.
 *
 * Below 1 on purpose: pushing waves right to the kerb wastes them, because the
 * outer lane is where the guest sits to refuse a gate anyway.
 */
export const WAVE_SPREAD = 0.78;

/**
 * A stage is a SEQUENCE, not a sprinkler.
 *
 * Enemies used to arrive on a timer, which gave a stage no rhythm at all: the
 * road was equally busy from the first second to the last and a gate turned up
 * whenever its own clock said so, usually in the middle of a crowd.
 *
 * A stage now runs as beats, the way an arcade game does — a wave of soldiers,
 * a breath, a pair of blockers, a breath, a gate. The order is shuffled and the
 * sizes scale, but the SHAPE is always wave, pause, wave, pause, gate.
 */
export type WaveKind = "soldiers" | "blockers" | "mixed" | "gate" | "rest";

export interface WaveBeat {
  kind: WaveKind;
  /** Seconds to hold before moving to the next beat. */
  hold: number;
}

/** How long the road stays empty between waves. */
export const REST_SECONDS = 1.5;

/**
 * One cycle of a stage. Two fights, a gate, two fights, a gate.
 *
 * Always ends on a gate so cycles chain without two gates ever landing back to
 * back, and every fight is followed by a rest so nothing overlaps a gate.
 */
export function buildWaveCycle(rng: () => number): WaveBeat[] {
  const fight = (): WaveKind => {
    const r = rng();
    if (r < 0.45) return "soldiers";
    if (r < 0.75) return "mixed";
    return "blockers";
  };
  const out: WaveBeat[] = [];
  const push = (kind: WaveKind, hold: number) => out.push({ kind, hold });

  push("soldiers", 3.4);
  push("rest", REST_SECONDS);
  push(fight(), 3.8);
  push("rest", REST_SECONDS);
  push("gate", 4.2);
  push("rest", REST_SECONDS);
  push(fight(), 3.6);
  push("rest", REST_SECONDS);
  push(fight(), 3.8);
  push("rest", REST_SECONDS);
  push("gate", 4.2);
  push("rest", REST_SECONDS);
  return out;
}

/** How far off the player a blocker aims, so they don't stack into a column. */
export const BLOCKER_AIM_SPREAD = 0.3;

export function spawnInterval(stage: number): number {
  return Math.max(0.78, 2.05 / (1 + (stage - 1) * 0.12));
}

/**
 * How much denser a stage gets between its opening and its boss.
 *
 * A stage used to arrive at one flat rate, so it opened at exactly the pressure
 * it ended at — no build, and the first ten seconds were the same as the last
 * ten. Ramping within the stage gives it a shape: it starts light enough to
 * find your feet after the shop, and is pressing by the time the boss shows up.
 *
 * This is separate from the adaptive pressure loop, which reacts to how the
 * guest is doing. This one always happens.
 */
export const STAGE_RAMP = 0.55;

export function stageRamp(stageT: number): number {
  return 1 + STAGE_RAMP * Math.min(1, Math.max(0, stageT) / STAGE_SECONDS);
}

/**
 * How many enemies arrive at once.
 *
 * Enemies spawn in CLUSTERS, not one at a time. A faster trickle of single
 * enemies reads as a queue and is trivially side-stepped one by one; a wave
 * arriving abreast is what forces the guest to pick a lane and commit, and is
 * what actually fills the screen.
 */
export function waveSize(stage: number): number {
  // Scales more slowly than it did: the count climbs with depth, but a stage is
  // now paced by its beats rather than by how fast the sprinkler runs.
  return Math.min(6, 2 + Math.floor((stage - 1) * 0.18));
}

/** How many blockers a blocker beat sends. */
export function blockerWaveSize(stage: number): number {
  return Math.min(4, 1 + Math.floor((stage - 1) * 0.14));
}

// ─── Pressure ────────────────────────────────────────────────────────────────
//
// The stage curve sets a floor, but it cannot see how the run is actually
// going. A guest who takes three good gates in a row can out-gun the wave
// entirely — everything dies at the horizon, the field goes empty, and the
// stage plays out as a walk down a beach with nothing to do.
//
// So the game watches HOW DEEP enemies get before they die and opens the taps
// until they are reaching the middle of the field again. It is a closed loop,
// not a difficulty setting: lose the gun at the next gate and the pressure
// falls back on its own.

/** Where we want kills to be happening — mid-field. */
export const PRESSURE_TARGET_Z = 0.45;
/** Never gentler than the stage curve, and never more than this much harder. */
export const PRESSURE_MIN = 1;
export const PRESSURE_MAX = 4;
/** How fast the loop responds, in multiplier per second at full error. */
const PRESSURE_RATE = 0.6;
/** Weight of one death in the running average of kill depth. */
const DEPTH_WEIGHT = 0.25;
/**
 * Weight of one MISS.
 *
 * Heavier than a kill on purpose. An enemy walking past is the clearest signal
 * there is that the guest is already at their limit, and pressure has to come
 * off faster than it went on — the loop should never be the reason a run ends.
 */
const MISS_WEIGHT = 0.4;

export function blockerChance(stage: number): number {
  return Math.min(0.55, 0.08 + (stage - 1) * 0.035);
}

/**
 * How fast the world comes at you — the player's own walking pace.
 *
 * Scenery is STATIC and approaches at exactly this rate: the ground, the palms,
 * everything that isn't alive. Getting this wrong is immediately visible, and
 * it was wrong — the ground scrolled at 0.42 while enemies closed at 0.155, so
 * the sand tore past nearly three times faster than the things walking on it
 * and nothing felt connected to anything else.
 */
export function worldSpeed(stage: number): number {
  return 0.11 * (1 + (stage - 1) * 0.05);
}

/** An enemy's own walk, on top of the world coming at it. */
export function enemyWalk(stage: number): number {
  return 0.05 * (1 + (stage - 1) * 0.06);
}

/**
 * Total closing speed for an enemy: the world plus its own legs.
 *
 * Enemies are therefore always faster than the scenery, which is what makes
 * them read as walking rather than sliding along on the ground.
 */
export function enemySpeed(stage: number): number {
  return worldSpeed(stage) + enemyWalk(stage);
}

export function blockerHp(stage: number): number {
  return 7 + Math.floor((stage - 1) * 1.1);
}

export function bossHp(stage: number): number {
  return 40 + (stage - 1) * 12;
}

/**
 * How likely a gate's good side is actually good.
 *
 * Decays with depth until both sides are negative and the choice becomes damage
 * control — which is a better late-game feeling than simply more enemies, and
 * costs nothing to build.
 */
export function gateGoodChance(stage: number, luck: number): number {
  const base = Math.max(0.15, 0.95 - (stage - 1) * 0.045);
  return Math.min(0.98, base + (luck / 100) * 0.25);
}

// ─── Gates ───────────────────────────────────────────────────────────────────

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

/**
 * How often each family comes up on a gate.
 *
 * Helpers are the rarest. They are the one reward that COMPOUNDS — every
 * bottle keeps firing for the rest of the stage — so seeing them as often as
 * anything else meant a lucky run of gates snowballed into a squad that did the
 * work for you.
 */
const FAMILY_WEIGHTS: [GateFamily, number][] = [
  ["helpers", 1],
  ["gun", 2],
  ["health", 2],
  ["money", 3],
];

function pickFamily(rng: () => number): GateFamily {
  const total = FAMILY_WEIGHTS.reduce((n, [, w]) => n + w, 0);
  let r = rng() * total;
  for (const [family, w] of FAMILY_WEIGHTS) {
    r -= w;
    if (r <= 0) return family;
  }
  return FAMILY_WEIGHTS[FAMILY_WEIGHTS.length - 1][0];
}

export function makeGate(st: State): Gate {
  const roll = (bad: boolean): GateOption => {
    const family = pickFamily(st.rng);
    const ladder = LADDERS[family];
    const neutral = ladder.findIndex((r) => r.tone === "neutral");
    const tier = bad
      ? Math.floor(st.rng() * neutral)
      : neutral + 1 + Math.floor(st.rng() * (ladder.length - neutral - 1));
    return { family, tier, cure: 0 };
  };

  const good = st.rng() < gateGoodChance(st.stage, st.luck);
  const a = roll(!good);
  const b = roll(true);
  const flip = st.rng() < 0.5;
  return { z: 1, left: flip ? a : b, right: flip ? b : a, taken: false, flipped: 0 };
}

/**
 * Land a round on a panel. Returns true if this shot stepped it up a rung.
 *
 * A panel already at the top of its ladder absorbs nothing — there is no reward
 * for pouring ammunition into a gate that is already as good as it gets.
 */
export function cureGateOption(o: GateOption): boolean {
  if (isMaxedOption(o)) return false;
  o.cure += 1;
  if (o.cure < GATE_CURE_HITS) return false;
  o.tier += 1;
  o.cure = 0;
  return true;
}

export function applyEffect(st: State, e: GateEffect | null): void {
  if (!e) return;                     // the neutral rung does nothing
  switch (e.kind) {
    case "helpers":
      st.helpers = Math.max(0, Math.min(MAX_HELPERS, st.helpers + e.n));
      break;
    case "gun":
      st.gun = e.gun;
      break;
    case "bomb":
      st.bombs = Math.min(MAX_BOMBS, st.bombs + 1);
      break;
    case "money":
      st.money = Math.max(0, st.money + e.n);
      if (e.n > 0) st.moneyEarned += e.n;
      break;
    case "health":
      if (e.n > 0) st.health = Math.min(MAX_HEALTH, st.health + e.n);
      else damage(st, -e.n, true);
      break;
  }
}

// ─── Shop ────────────────────────────────────────────────────────────────────

export function armorCost(slots: number): number {
  return 20 + slots * 12;
}
export function bombCost(held: number): number {
  return 25 + held * 25;
}
export function cloverCost(luck: number): number {
  return 30 + (luck / 10) * 22;
}

export function canBuyArmor(st: { money: number; armor: number }): boolean {
  return st.armor < MAX_ARMOR && st.money >= armorCost(st.armor);
}
export function canBuyBomb(st: { money: number; bombs: number }): boolean {
  return st.bombs < MAX_BOMBS && st.money >= bombCost(st.bombs);
}

export const MAX_LUCK = 100;
/** Luck moves in tens, so one clover is one step. */
export const LUCK_STEP = 10;

/**
 * One clover per shop visit, by design.
 *
 * Luck is the only stat that persists AND compounds — it makes every future
 * gate better — so letting a rich guest buy the whole track in one stop would
 * end the gate decision permanently. Rationing it to one per visit means
 * maximum luck is a thing you build over a run, not something you purchase.
 */
export function canBuyClover(st: {
  money: number; luck: number; cloverBought: boolean;
}): boolean {
  return !st.cloverBought && st.luck < MAX_LUCK && st.money >= cloverCost(st.luck);
}

// ─── Damage ──────────────────────────────────────────────────────────────────

/**
 * Armor absorbs a whole hit before health takes anything.
 *
 * A slot per hit rather than a pool of points: at a glance the guest can count
 * how many more mistakes they have left, which a partially-drained bar does not
 * tell them.
 */
export function damage(st: State, amount: number, ignoreInvuln = false): void {
  if (!ignoreInvuln && st.invuln > 0) return;
  st.invuln = 0.75;
  st.hitFlash = 0.35;
  if (st.armor > 0) {
    st.armor -= 1;
    return;
  }
  st.health -= amount;
  if (st.health <= 0) {
    st.health = 0;
    st.phase = "over";
    st.phaseT = 0;
  }
}

export function detonateBomb(st: State): boolean {
  if (st.bombs <= 0) return false;
  st.bombs -= 1;
  // The front 40% of the field, which is where the trouble already is.
  for (const e of st.enemies) {
    if (e.z <= 0.4 && e.dying <= 0) {
      e.hp -= 999;
      e.flash = 0.2;
    }
  }
  return true;
}

// ─── Spawning ────────────────────────────────────────────────────────────────

/**
 * How far out a spawn may sit, by tier.
 *
 * Not one number for everything: a blocker is about 84 logical px across and a
 * soldier barely half that, so a shared limit either lets a blocker hang a
 * shoulder off the screen or needlessly keeps the soldiers away from the kerb.
 */
const SPAWN_LIMIT = { grunt: 0.86, blocker: 0.74 } as const;

function spawnOne(st: State, rawNx: number, blocker: boolean): void {
  const lim = blocker ? SPAWN_LIMIT.blocker : SPAWN_LIMIT.grunt;
  const nx = Math.max(-lim, Math.min(lim, rawNx));
  const world = worldSpeed(st.stage);
  const walk = enemyWalk(st.stage);

  if (blocker) {
    if (st.stageBlockers.length === 0) st.stageBlockers = pickStageBlockers(st.rng);
    const kind = pick(st.stageBlockers, st.rng);
    const elite = kind === ELITE_BLOCKER;
    const hp = Math.round(blockerHp(st.stage) * (elite ? 1.6 : 1));
    st.enemies.push({
      id: st.nextId++,
      kind,
      tier: "blocker",
      z: 1 + st.rng() * 0.12,
      nx,
      hp,
      maxHp: hp,
      // The elite is heavier in every sense: tougher, and slower with it.
      speed: world + walk * (elite ? 0.42 : 0.55),
      burn: 0,
      flash: 0,
      stagger: 0,
      tracks: true,
      // Spread the convergence point so a wave of blockers arrives abreast
      // rather than nose to tail.
      aim: (st.rng() * 2 - 1) * BLOCKER_AIM_SPREAD,
      dying: 0,
      attacking: 0,
    });
    return;
  }

  const kind = pick(GRUNTS, st.rng);
  const hp = gruntHp(st.stage);
  st.enemies.push({
    id: st.nextId++,
    kind,
    tier: "grunt",
    // Spawn slightly beyond the horizon and stagger it, so a wave fades in
    // rather than popping into existence in a rank.
    z: 1 + st.rng() * 0.12,
    nx,
    hp,
    maxHp: hp,
    // Only the enemy's OWN legs vary by type — the world comes at everything at
    // the same rate. The kiwi is quick because it runs, not because the ground
    // moves faster underneath it.
    speed: world + walk * GRUNT_SPEED[kind],
    burn: 0,
    flash: 0,
    stagger: 0,
    tracks: false,
    aim: 0,
    dying: 0,
    attacking: 0,
  });
}

/**
 * A wave, spread across the road so it cannot all be dodged with one step.
 *
 * Takes explicit counts rather than rolling a chance per enemy: a beat is "four
 * soldiers" or "two blockers", and the shape of a wave is the point of it.
 */
function spawnWave(st: State, soldiers: number, blockers: number): void {
  const n = soldiers + blockers;
  if (n <= 0) return;

  // Slots are the CENTRES of n equal lanes, not the endpoints of the road.
  //
  // Endpoints were the bug: with a wave of two, i/(n-1) gives exactly -1 and
  // +1, so every pair spawned hard against both kerbs with the whole middle of
  // the road empty. Cell centres put a wave of two at roughly a third out from
  // the middle and a wave of one straight down it.
  const order: boolean[] = [];
  for (let i = 0; i < blockers; i++) order.push(true);
  for (let i = 0; i < soldiers; i++) order.push(false);
  // Shuffle so blockers are not always the leftmost thing on the road.
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(st.rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  for (let i = 0; i < n; i++) {
    const slot = ((i + 0.5) / n) * 2 - 1;
    // Jitter stays inside its own lane, so spread never collapses back into a
    // clump — an exact grid reads as mechanical, but a wandering one leaves an
    // obvious free lane.
    const jitter = (st.rng() * 2 - 1) * (WAVE_SPREAD / n) * 0.8;
    spawnOne(st, slot * WAVE_SPREAD + jitter, order[i]);
  }
}

function spawnBoss(st: State): void {
  const hp = bossHp(st.stage);
  st.enemies.push({
    id: st.nextId++,
    kind: bossFor(st.stage),
    tier: "boss",
    z: 1,
    nx: 0,
    hp,
    maxHp: hp,
    speed: worldSpeed(st.stage) + enemyWalk(st.stage) * 0.3,
    burn: 0,
    flash: 0,
    stagger: 0,
    tracks: true,
    aim: 0,
    dying: 0,
    attacking: 0,
  });
}

/** How close a boss gets before it starts swinging. */
export const BOSS_ATTACK_Z = 0.3;
export const BOSS_ATTACK_SECONDS = 0.9;

// ─── Firing ──────────────────────────────────────────────────────────────────

function fire(st: State): void {
  const g = GUNS[st.gun];
  if (st.gun === "flame") return;
  for (let i = 0; i < g.count; i++) {
    const off = g.count === 1 ? 0 : (i / (g.count - 1) - 0.5) * 2;
    // The hero holds two pistols, so single-barrel guns alternate muzzles.
    st.muzzle = st.muzzle === 1 ? -1 : 1;
    st.bullets.push({
      z: 0.02, nx: st.playerNx, vnx: off * g.spread, damage: g.damage,
      side: g.count === 1 ? st.muzzle : off < 0 ? -1 : 1,
      pierce: PIERCING[st.gun] ?? false,
    });
  }
}

/**
 * Helper fire, on its OWN cadence and at a fraction of a pistol round.
 *
 * Both of those matter, and both were wrong. Helpers used to fire whenever the
 * hero did, for full pistol damage each — so three of them quadrupled his
 * firepower and cleared the road on sight, and picking up an uzi secretly made
 * the helpers fire at thirteen rounds a second too. They are extra bodies, not
 * a multiplier on whatever the hero is carrying.
 *
 * At HELPER_DAMAGE each they are worth roughly a fifth of the hero apiece, so a
 * full rank of six is a real upgrade without being the end of the difficulty
 * curve.
 */
function fireHelpers(st: State): void {
  for (const u of st.helperUnits) {
    // From where the helper IS, at the depth it is standing at — not from a
    // slot beside the hero. A round that starts anywhere else gives the game
    // away the moment the squad is mid-swing around him.
    st.bullets.push({
      z: Math.max(0.02, u.z),
      nx: st.playerNx + u.dnx,
      vnx: 0,
      damage: HELPER_DAMAGE,
      side: u.dnx < 0 ? -1 : 1,
      fromHelper: true,
    });
  }
}

function addPop(st: State, e: Enemy, text: string, good: boolean): void {
  st.pops.push({ nx: e.nx, z: Math.max(0, e.z), text, good, life: 0.9 });
}

/**
 * An enemy got past you.
 *
 * The HUD shows health and armor and nothing else, so a silent deduction would
 * be invisible — the guest would lose points all run without ever being told.
 * The floating number IS the feedback.
 */
function missPenalty(st: State, e: Enemy): void {
  if (e.tier === "boss") return;          // a boss cannot be dodged past
  const cost = e.tier === "grunt" ? PTS_MISS_GRUNT : PTS_MISS_BLOCKER;
  if (e.tier === "grunt") st.misses.grunt++;
  else st.misses.blocker++;
  st.score = Math.max(0, st.score - cost);
  // Got all the way past: the strongest evidence there is that the guest is at
  // their limit, so it pulls the average down hard.
  noteDepth(st, 0, MISS_WEIGHT);
  addPop(st, e, `-${cost}`, false);
}

/** Feed one outcome into the running average. z is where it happened. */
function noteDepth(st: State, z: number, weight: number): void {
  st.killDepth += (Math.max(0, Math.min(1, z)) - st.killDepth) * weight;
}

function killReward(st: State, e: Enemy): void {
  if (e.tier === "boss") {
    st.kills.boss++;
    st.score += PTS_BOSS;
  } else if (e.tier === "grunt") {
    st.kills.grunt++;
    st.score += PTS_GRUNT;
  } else {
    st.kills.blocker++;
    // The elite is worth the extra trouble it costs to bring down.
    st.score += e.kind === ELITE_BLOCKER ? PTS_BLOCKER * 2 : PTS_BLOCKER;
  }
  st.score = Math.min(MAX_SCORE, st.score);
  // A boss is a set piece, not a sample of how the wave is going.
  if (e.tier !== "boss") noteDepth(st, e.z, DEPTH_WEIGHT);
  if (e.tier !== "boss") {
    addPop(st, e, `+${e.tier === "grunt" ? PTS_GRUNT
      : e.kind === ELITE_BLOCKER ? PTS_BLOCKER * 2 : PTS_BLOCKER}`, true);
  }
}

// ─── Step ────────────────────────────────────────────────────────────────────

/**
 * Bullet travel, in z per second.
 *
 * Slower than it looks like it should be. At 2.1 a shot crossed the whole field
 * in under half a second and spent two or three frames anywhere near the
 * player, so the gun read as silent — the guest saw specks appearing in the
 * middle distance with nothing connecting them to the character.
 */
const BULLET_SPEED = 1.5;

export function update(st: State, dt: number): void {
  st.t += dt;
  st.phaseT += dt;
  if (st.invuln > 0) st.invuln -= dt;
  if (st.hitFlash > 0) st.hitFlash -= dt;
  if (st.barkCooldown > 0) st.barkCooldown -= dt;
  if (st.firing > 0) st.firing -= dt;
  if (st.bark) {
    st.bark.life -= dt;
    if (st.bark.life <= 0) st.bark = null;
  }

  if (st.phase === "over" || st.phase === "cleared") return;

  // The boss-kill beat: the field is already clear, everything holds while the
  // hero turns to camera and the sunglasses drop.
  if (st.phase === "bosskill") {
    if (st.phaseT > 3.0) {
      st.phase = "cleared";
      st.score = Math.min(MAX_SCORE, st.score + PTS_STAGE * st.stage);
    }
    return;
  }

  // ── Player ──
  const heroWas = st.playerNx;
  if (st.targetNx !== null) {
    // Fast enough to feel like the character is pinned to the thumb, smoothed
    // just enough that a jittery touch doesn't judder the sprite.
    const k = Math.min(1, FOLLOW_RATE * dt);
    const want = (st.targetNx - st.playerNx) * k;
    const cap = MAX_TRAVERSE * dt;
    st.playerNx += Math.abs(want) > cap ? Math.sign(want) * cap : want;
  } else {
    st.playerNx += st.drag * PLAYER_SPEED * dt;
  }
  if (st.playerNx < -PLAYER_NX_LIMIT) st.playerNx = -PLAYER_NX_LIMIT;
  if (st.playerNx > PLAYER_NX_LIMIT) st.playerNx = PLAYER_NX_LIMIT;

  // ── The squad ──
  // After the hero has moved, so his step this frame is what shoves them.
  stepHelpers(st, dt, st.playerNx - heroWas);

  // ── Firing ──
  const g = GUNS[st.gun];
  if (st.gun === "flame") {
    st.firing = 0.1;
  } else {
    st.cooldown -= dt;
    if (st.cooldown <= 0) {
      fire(st);
      st.firing = 0.06;
      st.cooldown = 1 / g.rate;
    }
  }

  // Helpers fire to the PISTOL's rate regardless of what the hero is carrying.
  if (st.helpers > 0) {
    st.helperCooldown -= dt;
    if (st.helperCooldown <= 0) {
      fireHelpers(st);
      st.helperCooldown = 1 / GUNS.pistol.rate;
    }
  }

  // ── Bullets ──
  for (const b of st.bullets) {
    b.z += BULLET_SPEED * dt;
    b.nx += b.vnx * dt;
  }
  st.bullets = st.bullets.filter((b) => b.z < 1.05 && Math.abs(b.nx) < 1.4);

  // ── Stage progression ──
  if (st.phase === "play") {
    st.stageT += dt;

    // Close the loop. Positive error means kills are happening too far away.
    const err = st.killDepth - PRESSURE_TARGET_Z;
    st.pressure = Math.max(PRESSURE_MIN,
      Math.min(PRESSURE_MAX, st.pressure + err * PRESSURE_RATE * dt));

    // ── Beats ──
    // The stage plays its cycle: wave, pause, wave, pause, gate. Pressure and
    // the stage ramp shorten the holds rather than opening a tap, so a busy
    // stage is a FASTER sequence of waves, never a continuous stream.
    st.waveT -= dt * st.pressure * stageRamp(st.stageT);
    if (st.waveT <= 0) {
      if (st.waves.length === 0) st.waves = buildWaveCycle(st.rng);
      const beat = st.waves.shift()!;
      st.waveT = beat.hold;

      if (beat.kind === "soldiers") spawnWave(st, waveSize(st.stage), 0);
      else if (beat.kind === "blockers") spawnWave(st, 0, blockerWaveSize(st.stage));
      else if (beat.kind === "mixed") {
        spawnWave(st, Math.max(1, waveSize(st.stage) - 1), 1);
      } else if (beat.kind === "gate" && !st.gate) {
        st.gate = makeGate(st);
      }
      // "rest" spawns nothing, which is the whole point of it.
    }

    if (st.stageT >= STAGE_SECONDS) {
      st.phase = "boss";
      st.phaseT = 0;
      spawnBoss(st);
    }
  }

  // ── Gate ──
  if (st.gate) {
    const gate = st.gate;
    gate.z -= gateSpeed(st.stage) * dt;
    if (gate.flipped > 0) gate.flipped -= dt;

    // Rounds landing on a panel cure it. The bullet is NOT consumed — a gate is
    // a sign, not a wall, and eating shots would stop the guest defending
    // themselves from whatever is walking up behind it.
    for (const b of st.bullets) {
      if (b.spentOnGate) continue;                    // one round, one count
      if (Math.abs(b.z - gate.z) > 0.06) continue;
      if (Math.abs(b.nx) > GATE_REACH) continue;      // through the open edge
      b.spentOnGate = true;
      const side = b.nx < 0 ? gate.left : gate.right;
      if (cureGateOption(side)) gate.flipped = 0.7;
    }

    if (!gate.taken && gate.z <= 0.04) {
      gate.taken = true;
      // Off the end of a panel is a clean miss — the gate simply does not
      // apply. That is the whole point of leaving the edges open.
      if (Math.abs(st.playerNx) <= GATE_REACH) {
        const chosen = st.playerNx < 0 ? gate.left : gate.right;
        const rung = rungOf(chosen);
        applyEffect(st, rung.effect);
        st.lastGate = rung.tone;
        st.gatesTaken++;
      }
    }
    if (gate.z <= -0.12) st.gate = null;
  }

  // ── Enemies ──
  const flameRange = GUNS.flame.range;
  for (const e of st.enemies) {
    if (e.dying > 0) {
      e.dying -= dt;
      continue;
    }
    if (e.flash > 0) e.flash -= dt;

    // A staggered enemy barely advances — the hit visibly stops it.
    if (e.stagger > 0) e.stagger -= dt;
    if (e.attacking > 0) e.attacking -= dt;
    // A boss winds up once it is close, which is what the attack frames are
    // for — without this the art is drawn and never seen.
    if (e.tier === "boss" && e.z <= BOSS_ATTACK_Z && e.attacking <= 0 && e.dying <= 0) {
      e.attacking = BOSS_ATTACK_SECONDS;
    }
    const stalled = e.stagger > 0
      ? (e.tier === "boss" ? BOSS_STAGGER_SPEED : STAGGER_SPEED)
      : 1;
    e.z -= e.speed * stalled * dt;
    if (e.tracks) {
      const lim = TRACK_LIMIT[e.tier] ?? 1;
      const want = Math.max(-lim, Math.min(lim, st.playerNx + e.aim));
      const d = want - e.nx;
      e.nx += Math.sign(d) * Math.min(Math.abs(d), 0.42 * dt);
      // Belt and braces: a boss spawned or knocked outside its limit walks back
      // inside it rather than staying half off the screen.
      if (e.nx > lim) e.nx = lim;
      if (e.nx < -lim) e.nx = -lim;
    }

    if (e.burn > 0) {
      e.burn -= dt;
      e.hp -= BURN_DPS * dt;
    }

    // Flamethrower: a cone, not a bullet. Everything inside it takes damage at
    // once and keeps burning after the stream moves off, which is what makes a
    // sweep across a crowd worth doing.
    if (st.gun === "flame" && e.z <= flameRange && e.z > 0) {
      const width = 0.18 + GUNS.flame.spread * (e.z / flameRange);
      if (Math.abs(e.nx - st.playerNx) < width) {
        e.hp -= GUNS.flame.damage * dt;
        e.burn = BURN_SECONDS;
      }
    }

    // Bullets.
    for (const b of st.bullets) {
      if (b.damage <= 0) continue;
      if (Math.abs(b.z - e.z) < 0.05 && Math.abs(b.nx - e.nx) < 0.16) {
        e.hp -= b.damage;
        e.flash = 0.12;
        if (b.pierce) { e.stagger = STAGGER_SECONDS; continue; }
        // Weight: stall it and shove it back up the field. Without this a hit
        // is an invisible subtraction and the gun feels like it is doing
        // nothing until the enemy abruptly disappears.
        e.stagger = STAGGER_SECONDS;
        e.z = Math.min(1.1, e.z + STAGGER_KNOCKBACK *
          (e.tier === "boss" ? BOSS_KNOCKBACK_SCALE : 1));
        b.damage = 0;
      }
    }

    if (e.hp <= 0) {
      e.dying = 0.35;
      killReward(st, e);
      if (e.tier === "boss") {
        st.phase = "bosskill";
        st.phaseT = 0;
        st.enemies = st.enemies.filter((x) => x.tier === "boss");
        st.bullets = [];
        st.gate = null;
      }
      continue;
    }

    // Contact.
    if (e.z <= CONTACT_Z && Math.abs(e.nx - st.playerNx) < contactNx(e.tier)) {
      damage(st, CONTACT_DAMAGE);
      // The WHOLE squad is lost, not one of them.
      //
      // Helpers are bodies standing alongside the hero, so anything that gets
      // close enough to hit him has walked through all of them. Losing one per
      // hit let a big rank soak several contacts in a row and quietly turned
      // helpers into a second health bar; losing the lot makes getting touched
      // hurt in a way health alone does not.
      st.helpers = 0;
      if (e.tier === "boss") {
        // A boss is NOT consumed by hitting you. Removing it here left the
        // phase stuck on "boss" with nothing on the field and no way to clear
        // the stage — an unrecoverable softlock. It falls back and comes again;
        // killing it is the only way past.
        e.z = 0.3;
        e.flash = 0.15;
      } else {
        e.dying = 0.25;
      }
      continue;
    }

    // Got past. Everything except a boss is charged for and leaves the field.
    if (e.z <= MISS_Z) {
      if (e.tier === "boss") {
        // The boss never leaves. It is the stage's exit condition, so removing
        // it here — for any reason — strands the run with nothing to kill.
        e.z = 0.3;
      } else {
        missPenalty(st, e);
        e.dying = 0.01;
      }
    }
  }

  // Floating score text.
  for (const p of st.pops) p.life -= dt;
  st.pops = st.pops.filter((p) => p.life > 0);

  st.bullets = st.bullets.filter((b) => b.damage > 0);
  st.enemies = st.enemies.filter((e) => (e.dying > 0 ? true : e.z > -0.15) && !(e.dying < 0));
}

/** What the shell stores alongside the score, for checking a suspicious run. */
export function runDetail(st: State, runs: number): Record<string, unknown> {
  return {
    stage: st.stage,
    runs,
    kills: st.kills,
    misses: st.misses,
    moneyEarned: st.moneyEarned,
    gatesTaken: st.gatesTaken,
    pressure: Math.round(st.pressure * 100) / 100,
    armor: st.armor,
    luck: st.luck,
    helpers: st.helpers,
    gun: st.gun,
    seconds: Math.round(st.t),
  };
}
