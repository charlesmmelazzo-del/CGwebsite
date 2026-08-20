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
export const MAX_HELPERS = 6;

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
export const CONTACT_DAMAGE = 18;

export const STAGE_SECONDS = 46;          // spawning time before the boss shows
export const GATE_EVERY = 11.5;
export const GATE_SPEED = 0.30;           // z per second

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

export type GunKind = "pistol" | "shotgun" | "uzi" | "flame";

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
  shotgun: { rate: 3.2, damage: 1, count: 3, spread: 0.42, range: 1 },
  uzi: { rate: 13, damage: 1, count: 1, spread: 0.04, range: 1 },
  // Damage is per second and applies to everything inside the cone at once,
  // plus a burn that keeps ticking after the stream moves off. Devastating up
  // close, useless at any distance — the panic button, not an upgrade.
  flame: { rate: 0, damage: 9, count: 0, spread: 0.55, range: 0.34 },
};

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
export function bossFor(stage: number): BossName {
  return BOSSES[(stage - 1) % BOSSES.length];
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
 * "this is dying" is legible without counting shots. The four fruits still all
 * share one health value — variety between them stays colour, silhouette and
 * speed, so a lemon never secretly takes longer than a lime.
 */
export function gruntHp(stage: number): number {
  return 2 + Math.floor((stage - 1) / 10);
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
/** How far back up the field a hit shoves an enemy. */
export const STAGGER_KNOCKBACK = 0.012;

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
}

/**
 * Every ladder passes through neutral in the middle, so a negative can always
 * be walked to harmless first, and only then into a real reward.
 */
export const LADDERS: Record<GateFamily, Rung[]> = {
  helpers: [
    { effect: { kind: "helpers", n: -3 }, label: "-3 RUM", tone: "bad" },
    { effect: { kind: "helpers", n: -2 }, label: "-2 RUM", tone: "bad" },
    { effect: { kind: "helpers", n: -1 }, label: "-1 RUM", tone: "bad" },
    { effect: null, label: "NOTHING", tone: "neutral" },
    { effect: { kind: "helpers", n: 1 }, label: "+1 RUM", tone: "good" },
    { effect: { kind: "helpers", n: 2 }, label: "+2 RUM", tone: "good" },
    { effect: { kind: "helpers", n: 3 }, label: "+3 RUM", tone: "good" },
  ],
  money: [
    { effect: { kind: "money", n: -5 }, label: "-$5", tone: "bad" },
    { effect: null, label: "NOTHING", tone: "neutral" },
    { effect: { kind: "money", n: 5 }, label: "+$5", tone: "good" },
    { effect: { kind: "money", n: 10 }, label: "+$10", tone: "good" },
  ],
  gun: [
    { effect: { kind: "gun", gun: "pistol" }, label: "PISTOL", tone: "bad" },
    { effect: null, label: "NOTHING", tone: "neutral" },
    { effect: { kind: "gun", gun: "shotgun" }, label: "SHOTGUN", tone: "good" },
    { effect: { kind: "gun", gun: "uzi" }, label: "UZI", tone: "good" },
    { effect: { kind: "gun", gun: "flame" }, label: "FLAME", tone: "good" },
  ],
  health: [
    { effect: { kind: "health", n: -20 }, label: "POISON", tone: "bad" },
    { effect: null, label: "NOTHING", tone: "neutral" },
    { effect: { kind: "health", n: 25 }, label: "+HEALTH", tone: "good" },
    { effect: { kind: "bomb" }, label: "BOMB", tone: "good" },
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
  gun: GunKind;
  /** Ticks down; the flamethrower is drawn while > 0. */
  firing: number;
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
    gun: "pistol",
    firing: 0,
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

export function spawnInterval(stage: number): number {
  return Math.max(0.42, 1.0 / (1 + (stage - 1) * 0.13));
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
  return Math.min(6, 2 + Math.floor((stage - 1) * 0.35));
}

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
  return 3 + Math.floor((stage - 1) * 0.8);
}

export function bossHp(stage: number): number {
  return 28 + (stage - 1) * 9;
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

const FAMILIES: GateFamily[] = ["helpers", "money", "gun", "health"];

export function makeGate(st: State): Gate {
  const roll = (bad: boolean): GateOption => {
    const family = pick(FAMILIES, st.rng);
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

function spawnOne(st: State, nx: number): void {
  const blocker = st.rng() < blockerChance(st.stage);
  const world = worldSpeed(st.stage);
  const walk = enemyWalk(st.stage);

  if (blocker) {
    const kind = pick(BLOCKERS, st.rng);
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
    dying: 0,
    attacking: 0,
  });
}

/** A wave, spread across the road so it cannot all be dodged with one step. */
function spawnWave(st: State): void {
  const n = waveSize(st.stage);
  // Evenly distributed with jitter: clumping leaves an obvious free lane, and
  // an exact grid reads as mechanical.
  for (let i = 0; i < n; i++) {
    const slot = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    const jitter = (st.rng() * 2 - 1) * (0.9 / Math.max(1, n));
    spawnOne(st, Math.max(-0.92, Math.min(0.92, slot * 0.85 + jitter)));
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
    });
  }
  // Helpers flank the player and always carry the base pistol, whatever the
  // player is holding. They are extra bodies, not an upgrade multiplier.
  for (let i = 0; i < st.helpers; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const rank = Math.floor(i / 2) + 1;
    st.bullets.push({
      z: 0.02,
      nx: st.playerNx + side * rank * 0.2,
      vnx: 0,
      damage: 1,
      side: side as -1 | 1,
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
  addPop(st, e, `-${cost}`, false);
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
  if (st.playerNx < -1) st.playerNx = -1;
  if (st.playerNx > 1) st.playerNx = 1;

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

  // ── Bullets ──
  for (const b of st.bullets) {
    b.z += BULLET_SPEED * dt;
    b.nx += b.vnx * dt;
  }
  st.bullets = st.bullets.filter((b) => b.z < 1.05 && Math.abs(b.nx) < 1.4);

  // ── Stage progression ──
  if (st.phase === "play") {
    st.stageT += dt;
    st.spawnT -= dt;
    if (st.spawnT <= 0) {
      spawnWave(st);
      st.spawnT = spawnInterval(st.stage);
    }
    st.gateT -= dt;
    // A gate gets its own moment — never overlapping a blocker in the danger
    // band, where a panel over the road would get someone killed unfairly.
    if (st.gateT <= 0 && !st.gate) {
      st.gate = makeGate(st);
      st.gateT = GATE_EVERY;
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
    gate.z -= GATE_SPEED * dt;
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
    e.z -= e.speed * (e.stagger > 0 ? STAGGER_SPEED : 1) * dt;
    if (e.tracks) {
      const d = st.playerNx - e.nx;
      e.nx += Math.sign(d) * Math.min(Math.abs(d), 0.42 * dt);
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
        // Weight: stall it and shove it back up the field. Without this a hit
        // is an invisible subtraction and the gun feels like it is doing
        // nothing until the enemy abruptly disappears.
        e.stagger = STAGGER_SECONDS;
        e.z = Math.min(1.1, e.z + STAGGER_KNOCKBACK);
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
    if (e.z <= CONTACT_Z && Math.abs(e.nx - st.playerNx) < CONTACT_NX) {
      damage(st, CONTACT_DAMAGE);
      // Helpers are bodies between you and them — one is lost per hit taken.
      if (st.helpers > 0) st.helpers -= 1;
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
    armor: st.armor,
    luck: st.luck,
    helpers: st.helpers,
    gun: st.gun,
    seconds: Math.round(st.t),
  };
}
