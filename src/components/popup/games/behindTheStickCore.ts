// ─── Behind the Stick — rules ────────────────────────────────────────────────
//
// The simulation, with no React and no canvas in sight. The component next door
// owns drawing and input; everything that decides a score, a strike or a game
// over lives here.
//
// Split out deliberately: a browser tab throttles requestAnimationFrame to
// nothing when it's hidden, so the only honest way to check that ten pours
// really do trigger a shake, or that three misses really do end the round, is
// to step the simulation directly. See the tests that drive `update`.

export const RAIL_Y = 214;
export const RAIL_H = 34;
export const WINDOW_X = 112;
export const GOOD_HALF = 13;
export const PERFECT_HALF = 5;
export const ATTEMPT_HALF = 58;
export const NOTES_PER_ROUND = 10;
export const MAX_STRIKES = 3;

export const PTS_PERFECT = 150;
export const PTS_GOOD = 100;
export const PTS_MISS = -50;
export const PTS_STRAY = -20;
export const PTS_SHAKE = 20;
export const PTS_STIR = 50;

export const SHAKE_SECONDS = 5;
export const STIR_SECONDS = 6;
export const START_BPM = 120;
export const START_RPM = 80;
export const RATE_STEP = 10;
export const GRACE_SECONDS = 1.2;
export const SLOW_TOLERANCE = 1.2;
export const READY_SECONDS = 1.6;
export const SERVE_SECONDS = 2.2;
export const OVER_SECONDS = 2.6;

export const INGREDIENT_KEYS = [
  "whiskey",
  "gin",
  "tequila",
  "lemon",
  "lime",
  "honey",
  "bitters",
] as const;

export type Phase = "ready" | "pour" | "shake" | "stir" | "serve" | "over";
export type Mood = "happy" | "ok" | "worried" | "panic";

export interface Note {
  id: number;
  ing: string;
  x: number;
  judged: boolean;
}

export interface Splash {
  x: number;
  y: number;
  vy: number;
  life: number;
  color: string;
}

export interface Pop {
  x: number;
  y: number;
  life: number;
  text: string;
  color: string;
}

export interface State {
  phase: Phase;
  t: number;
  phaseT: number;
  score: number;
  strikes: number;
  round: number;
  notesJudged: number;
  spawned: number;
  notes: Note[];
  nextId: number;
  spawnTimer: number;
  speed: number;
  gap: number;
  mood: Mood;
  moodTimer: number;
  splashes: Splash[];
  pops: Pop[];
  banner: string;
  bannerTimer: number;
  tinFill: number;

  target: number;
  taps: number[];
  revs: number;
  revStamps: { t: number; revs: number }[];
  slowFor: number;
  lastAngle: number | null;
  bestBpm: number;
  bestRpm: number;

  presses: string[];
  shakeTaps: number;

  /** Colour to splash when an ingredient hits the floor, looked up by the view. */
  colorFor: (key: string) => string;
}

export function freshState(colorFor: (key: string) => string = () => "#FFFFFF"): State {
  return {
    phase: "ready",
    t: 0,
    phaseT: 0,
    score: 0,
    strikes: 0,
    round: 1,
    notesJudged: 0,
    spawned: 0,
    notes: [],
    nextId: 1,
    spawnTimer: 0.6,
    speed: 62,
    gap: 1.15,
    mood: "ok",
    moodTimer: 0,
    splashes: [],
    pops: [],
    banner: "",
    bannerTimer: 0,
    tinFill: 0,
    target: START_BPM,
    taps: [],
    revs: 0,
    revStamps: [],
    slowFor: 0,
    lastAngle: null,
    bestBpm: 0,
    bestRpm: 0,
    presses: [],
    shakeTaps: 0,
    colorFor,
  };
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

function setPhase(st: State, p: Phase) {
  st.phase = p;
  st.phaseT = 0;
}

function addPop(st: State, x: number, y: number, text: string, color: string) {
  st.pops.push({ x, y, life: 0.8, text, color });
}

function strike(st: State, x: number, color: string) {
  st.strikes++;
  st.score += PTS_MISS;
  st.splashes.push({ x, y: RAIL_Y + 20, vy: 20, life: 0.7, color });
  st.mood = st.strikes >= 2 ? "panic" : "worried";
  st.moodTimer = 1.2;
  addPop(st, x, RAIL_Y - 8, "MISS", "#E42B20");
}

/** Alternate shake and stir, and demand more each time round. */
function startMinigame(st: State) {
  const isShake = st.round % 2 === 1;
  st.notes = [];
  st.taps = [];
  st.revs = 0;
  st.revStamps = [];
  st.slowFor = 0;
  st.lastAngle = null;
  st.shakeTaps = 0;
  const step = Math.floor((st.round - 1) / 2) * RATE_STEP;
  st.target = isShake ? START_BPM + step : START_RPM + step;
  st.banner = isShake ? "SHAKE IT!" : "STIR IT!";
  st.bannerTimer = 1.4;
  setPhase(st, isShake ? "shake" : "stir");
}

/** Taps per minute over the rolling window. */
export function currentBpm(st: State): number {
  const W = 1.5;
  return (st.taps.filter((x) => x > st.phaseT - W).length / W) * 60;
}

/** Revolutions per minute over the rolling window. */
export function currentRpm(st: State): number {
  const oldest = st.revStamps[0] ?? { t: 0, revs: 0 };
  const span = Math.max(0.25, st.phaseT - oldest.t);
  return ((st.revs - oldest.revs) / span) * 60;
}

export interface UpdateResult {
  /** True on the frame the run finishes, so the view can report the score. */
  finished: boolean;
}

/**
 * Advance the simulation by `dt` seconds.
 *
 * `pickIngredient` is injected so a test can make the note stream deterministic
 * instead of fighting Math.random.
 */
export function update(
  st: State,
  dt: number,
  pickIngredient: () => string = () =>
    INGREDIENT_KEYS[Math.floor(Math.random() * INGREDIENT_KEYS.length)]
): UpdateResult {
  st.t += dt;
  st.phaseT += dt;
  if (st.bannerTimer > 0) st.bannerTimer -= dt;
  if (st.moodTimer > 0) {
    st.moodTimer -= dt;
    if (st.moodTimer <= 0) st.mood = st.strikes === 0 ? "happy" : "ok";
  }

  let finished = false;

  if (st.phase === "ready") {
    if (st.phaseT > READY_SECONDS) {
      setPhase(st, "pour");
      st.banner = "ROUND 1";
      st.bannerTimer = 1.2;
    }
  } else if (st.phase === "pour") {
    st.spawnTimer -= dt;
    if (st.spawnTimer <= 0 && st.spawned < NOTES_PER_ROUND) {
      st.notes.push({ id: st.nextId++, ing: pickIngredient(), x: -14, judged: false });
      st.spawned++;
      st.spawnTimer = st.gap;
    }

    for (const n of st.notes) {
      n.x += st.speed * dt;
      // Sailed past the window untouched
      if (!n.judged && n.x > WINDOW_X + GOOD_HALF + 6) {
        n.judged = true;
        st.notesJudged++;
        strike(st, n.x, st.colorFor(n.ing));
      }
    }
    st.notes = st.notes.filter((n) => n.x < 244);

    while (st.presses.length) {
      const key = st.presses.shift()!;

      const candidates = st.notes.filter(
        (n) => !n.judged && n.ing === key && Math.abs(n.x - WINDOW_X) <= ATTEMPT_HALF
      );
      if (!candidates.length) {
        // Nothing of that ingredient nearby: a wasted grab, not a dropped
        // bottle. Costs points but never a life — otherwise a stray tap on a
        // phone would be brutally punishing.
        st.score += PTS_STRAY;
        addPop(st, WINDOW_X, RAIL_Y - 8, "OOPS", "#909090");
        continue;
      }

      candidates.sort((a, b) => Math.abs(a.x - WINDOW_X) - Math.abs(b.x - WINDOW_X));
      const note = candidates[0];
      note.judged = true;
      st.notesJudged++;
      const dist = Math.abs(note.x - WINDOW_X);

      if (dist <= PERFECT_HALF) {
        st.score += PTS_PERFECT;
        st.tinFill = clamp(st.tinFill + 0.1, 0, 1);
        st.mood = "happy";
        st.moodTimer = 0.6;
        addPop(st, note.x, RAIL_Y - 8, "PERFECT", "#FFD500");
      } else if (dist <= GOOD_HALF) {
        st.score += PTS_GOOD;
        st.tinFill = clamp(st.tinFill + 0.1, 0, 1);
        st.mood = "happy";
        st.moodTimer = 0.4;
        addPop(st, note.x, RAIL_Y - 8, "GOOD", "#9CE800");
      } else {
        strike(st, note.x, st.colorFor(note.ing));
      }
    }

    if (st.strikes >= MAX_STRIKES) {
      st.banner = "";
      setPhase(st, "over");
    } else if (st.notesJudged >= NOTES_PER_ROUND) {
      startMinigame(st);
    }
  } else if (st.phase === "shake") {
    for (let i = 0; i < st.shakeTaps; i++) st.taps.push(st.phaseT);
    if (st.shakeTaps > 0) st.score += PTS_SHAKE * st.shakeTaps;
    st.shakeTaps = 0;

    st.taps = st.taps.filter((x) => x > st.phaseT - 1.5);
    const bpm = currentBpm(st);
    st.bestBpm = Math.max(st.bestBpm, bpm);

    if (st.phaseT > GRACE_SECONDS) {
      if (bpm < st.target) st.slowFor += dt;
      else st.slowFor = 0;
      if (st.slowFor > SLOW_TOLERANCE) {
        st.banner = "TOO SLOW!";
        st.bannerTimer = 2;
        setPhase(st, "over");
      }
    }
    if (st.phase === "shake" && st.phaseT > SHAKE_SECONDS + GRACE_SECONDS) {
      setPhase(st, "serve");
    }
  } else if (st.phase === "stir") {
    // Rolling window with one sample kept from just before it, so the rate is
    // measurable from the first frame rather than reading zero while it fills.
    st.revStamps.push({ t: st.phaseT, revs: st.revs });
    const cutoff = st.phaseT - 1.5;
    while (st.revStamps.length > 1 && st.revStamps[1].t <= cutoff) st.revStamps.shift();

    const rpm = currentRpm(st);
    st.bestRpm = Math.max(st.bestRpm, rpm);

    if (st.phaseT > GRACE_SECONDS) {
      if (rpm < st.target) st.slowFor += dt;
      else st.slowFor = 0;
      if (st.slowFor > SLOW_TOLERANCE) {
        st.banner = "TOO SLOW!";
        st.bannerTimer = 2;
        setPhase(st, "over");
      }
    }
    if (st.phase === "stir" && st.phaseT > STIR_SECONDS + GRACE_SECONDS) {
      st.score += Math.round(st.revs * PTS_STIR);
      setPhase(st, "serve");
    }
  } else if (st.phase === "serve") {
    if (st.phaseT > SERVE_SECONDS) {
      st.round++;
      st.strikes = 0;
      st.notesJudged = 0;
      st.spawned = 0;
      st.notes = [];
      st.tinFill = 0;
      st.speed = Math.min(150, st.speed + 9);
      st.gap = Math.max(0.55, st.gap - 0.06);
      st.mood = "ok";
      st.score += 250 * (st.round - 1);
      st.banner = `ROUND ${st.round}`;
      st.bannerTimer = 1.3;
      setPhase(st, "pour");
    }
  } else if (st.phase === "over") {
    if (st.phaseT > OVER_SECONDS) finished = true;
  }

  for (const sp of st.splashes) {
    sp.life -= dt;
    sp.y += sp.vy * dt;
    sp.vy += 120 * dt;
  }
  st.splashes = st.splashes.filter((x) => x.life > 0);
  for (const p of st.pops) {
    p.life -= dt;
    p.y -= 14 * dt;
  }
  st.pops = st.pops.filter((x) => x.life > 0);

  return { finished };
}

/** Add a stir input sample, in radians around the circle's centre. */
export function applyStirAngle(st: State, angle: number) {
  if (st.lastAngle !== null) {
    let d = angle - st.lastAngle;
    // Shortest way round, so crossing the seam isn't counted as a whole lap
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    st.revs += Math.abs(d) / (Math.PI * 2);
  }
  st.lastAngle = angle;
}
