// ─── Top Shelf — rules and physics ───────────────────────────────────────────
//
// No React, no canvas. Climbing, ladders, rolling bottles, lives and catching
// the thief all live here so they can be stepped directly in a test — a hidden
// browser tab stops calling requestAnimationFrame entirely, so watching the
// canvas is not a way to check any of this.

export const SHELF_GAP = 46;
export const SHELF_TH = 5;
export const GROUND_Y = 1000;
export const LADDER_W = 9;
export const PLAYER_W = 10;
export const PLAYER_H = 15;
export const BOTTLE_W = 9;
export const BOTTLE_H = 9;

export const GRAVITY = 460;
export const RUN_SPEED = 56;
export const JUMP_V = -152;
export const CLIMB_SPEED = 44;

export const GAME_W = 224;
export const PLAYER_SCREEN_Y = 190;

export const PTS_BOTTLE = 100;
export const PTS_CATCH = 1000;
export const PTS_SHELF = 25;
export const MAX_LIVES = 3;

export const INTRO_SECONDS = 8.4;
export const HIT_SECONDS = 1.1;
export const CATCH_SECONDS = 1.6;
export const OVER_SECONDS = 2.6;

export type Phase = "intro" | "play" | "hit" | "catch" | "over";

export interface Bottle {
  x: number;
  y: number;
  dir: 1 | -1;
  shelf: number;
  falling: boolean;
  jumped: boolean;
}

export interface Pop {
  x: number;
  y: number;
  life: number;
  text: string;
  color: string;
}

export interface Input {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
}

export interface State {
  phase: Phase;
  phaseT: number;
  t: number;
  score: number;
  lives: number;
  wave: number;

  px: number;
  py: number;
  vx: number;
  vy: number;
  onGround: boolean;
  climbing: boolean;
  face: 1 | -1;
  highestShelf: number;
  invuln: number;

  thiefShelf: number;
  thiefX: number;
  thiefDir: 1 | -1;

  bottles: Bottle[];
  spawnTimer: number;
  spawnGap: number;
  bottleSpeed: number;

  camY: number;
  pops: Pop[];
  banner: string;
  bannerT: number;

  input: Input;
  introSkipped: boolean;
}

export function freshState(): State {
  return {
    phase: "intro",
    phaseT: 0,
    t: 0,
    score: 0,
    lives: MAX_LIVES,
    wave: 1,
    px: 112,
    py: GROUND_Y,
    vx: 0,
    vy: 0,
    onGround: true,
    climbing: false,
    face: 1,
    highestShelf: 0,
    invuln: 0,
    thiefShelf: 4,
    thiefX: 112,
    thiefDir: 1,
    bottles: [],
    spawnTimer: 1.2,
    spawnGap: 1.9,
    bottleSpeed: 40,
    camY: GROUND_Y - PLAYER_SCREEN_Y,
    pops: [],
    banner: "",
    bannerT: 0,
    input: { left: false, right: false, up: false, down: false, jump: false },
    introSkipped: false,
  };
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Deterministic 0..1 — shelves must look identical every time they scroll back. */
export function pseudo(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function shelfY(index: number): number {
  return GROUND_Y - index * SHELF_GAP;
}

/** Ladder x positions connecting shelf `index` up to `index + 1`. */
export function laddersFor(index: number): number[] {
  const a = 18 + Math.floor(pseudo(index) * 58);
  const b = 128 + Math.floor(pseudo(index + 77) * 58);
  return index % 3 === 2 ? [a] : [a, b];
}

/** The ladder under the player's feet, if any. */
export function ladderAt(x: number, feetY: number): { x: number; shelf: number } | null {
  const shelfIdx = Math.round((GROUND_Y - feetY) / SHELF_GAP);
  for (const idx of [shelfIdx, shelfIdx - 1]) {
    if (idx < 0) continue;
    for (const lx of laddersFor(idx)) {
      const top = shelfY(idx + 1);
      const bottom = shelfY(idx);
      if (feetY >= top - 2 && feetY <= bottom + 2 && Math.abs(x - (lx + LADDER_W / 2)) < 7) {
        return { x: lx + LADDER_W / 2, shelf: idx };
      }
    }
  }
  return null;
}

function addPop(st: State, x: number, y: number, text: string, color: string) {
  st.pops.push({ x, y, life: 0.9, text, color });
}

function spawnBottle(st: State) {
  st.bottles.push({
    x: st.thiefX,
    y: shelfY(st.thiefShelf) - BOTTLE_H,
    dir: Math.random() < 0.5 ? 1 : -1,
    shelf: st.thiefShelf,
    falling: false,
    jumped: false,
  });
}

function loseLife(st: State) {
  st.lives--;
  st.invuln = 2;
  st.banner = st.lives > 0 ? "OUCH!" : "";
  st.bannerT = 1.2;
  st.vy = 0;
  st.climbing = false;
  st.phase = st.lives <= 0 ? "over" : "hit";
  st.phaseT = 0;
}

export interface UpdateResult {
  finished: boolean;
}

/** Advance the simulation by `dt` seconds. */
export function update(st: State, dt: number): UpdateResult {
  st.t += dt;
  st.phaseT += dt;
  if (st.bannerT > 0) st.bannerT -= dt;
  if (st.invuln > 0) st.invuln -= dt;

  let finished = false;

  if (st.phase === "intro") {
    if (st.introSkipped || st.phaseT > INTRO_SECONDS) {
      st.phase = "play";
      st.phaseT = 0;
      st.banner = "GO!";
      st.bannerT = 1;
    }
    return { finished };
  }

  if (st.phase === "play") {
    const inp = st.input;

    st.vx = 0;
    if (inp.left) {
      st.vx = -RUN_SPEED;
      st.face = -1;
    }
    if (inp.right) {
      st.vx = RUN_SPEED;
      st.face = 1;
    }

    // ── Ladders ─────────────────────────────────────────────────────────
    const lad = ladderAt(st.px, st.py);
    if (lad && (inp.up || inp.down) && !st.climbing) {
      const topOfLadder = shelfY(lad.shelf + 1);
      const canUp = inp.up && st.py > topOfLadder;
      const canDown = inp.down && st.py < shelfY(lad.shelf);
      if (canUp || canDown) {
        st.climbing = true;
        st.px = lad.x;
        st.vy = 0;
      }
    }

    if (st.climbing) {
      const l2 = ladderAt(st.px, st.py);
      if (!l2) {
        st.climbing = false;
      } else {
        const top = shelfY(l2.shelf + 1);
        const bottom = shelfY(l2.shelf);
        if (inp.up) st.py -= CLIMB_SPEED * dt;
        else if (inp.down) st.py += CLIMB_SPEED * dt;
        st.px = l2.x;
        st.vx = 0;

        if (st.py <= top) {
          st.py = top;
          st.climbing = false;
          st.onGround = true;
        } else if (st.py >= bottom) {
          st.py = bottom;
          st.climbing = false;
          st.onGround = true;
        }
      }
    }

    if (!st.climbing) {
      if (inp.jump && st.onGround) {
        st.vy = JUMP_V;
        st.onGround = false;
      }
      st.vy += GRAVITY * dt;
      const prevY = st.py;
      st.py += st.vy * dt;
      st.px += st.vx * dt;
      st.px = clamp(st.px, 6, GAME_W - 6);

      // Land when crossing a shelf top while falling
      if (st.vy > 0) {
        const idxBelow = Math.floor((GROUND_Y - st.py) / SHELF_GAP);
        for (let i = idxBelow; i <= idxBelow + 1; i++) {
          if (i < 0) continue;
          const sy = shelfY(i);
          if (prevY <= sy && st.py >= sy) {
            st.py = sy;
            st.vy = 0;
            st.onGround = true;
            break;
          }
        }
      }
      // Never climb past the thief's ceiling
      if (st.py < shelfY(st.thiefShelf + 6)) st.py = shelfY(st.thiefShelf + 6);
    }

    const currentShelf = Math.round((GROUND_Y - st.py) / SHELF_GAP);
    if (currentShelf > st.highestShelf) {
      st.score += PTS_SHELF * (currentShelf - st.highestShelf);
      st.highestShelf = currentShelf;
    }

    // ── Bottles ─────────────────────────────────────────────────────────
    st.spawnTimer -= dt;
    if (st.spawnTimer <= 0) {
      spawnBottle(st);
      st.spawnTimer = st.spawnGap;
    }

    for (const b of st.bottles) {
      if (b.falling) {
        b.y += 110 * dt;
        const target = shelfY(b.shelf) - BOTTLE_H;
        if (b.y >= target) {
          b.y = target;
          b.falling = false;
        }
      } else {
        b.x += b.dir * st.bottleSpeed * dt;

        for (const lx of laddersFor(b.shelf - 1)) {
          const cx = lx + LADDER_W / 2;
          if (Math.abs(b.x - cx) < 2 && b.shelf > 0 && Math.random() < 0.02) {
            b.shelf--;
            b.falling = true;
          }
        }

        if (b.x < 4 || b.x > GAME_W - 4 - BOTTLE_W) {
          b.dir = (b.dir * -1) as 1 | -1;
          b.x = clamp(b.x, 4, GAME_W - 4 - BOTTLE_W);
          if (b.shelf > 0) {
            b.shelf--;
            b.falling = true;
          }
        }
      }

      if (!b.jumped && !st.onGround && Math.abs(b.x + BOTTLE_W / 2 - st.px) < 10 && st.py < b.y + 2) {
        b.jumped = true;
        st.score += PTS_BOTTLE;
        addPop(st, st.px, st.py - 20, "+100", "#FFD500");
      }

      if (st.invuln <= 0) {
        const hit =
          st.px + PLAYER_W / 2 > b.x &&
          st.px - PLAYER_W / 2 < b.x + BOTTLE_W &&
          st.py > b.y &&
          st.py - PLAYER_H < b.y + BOTTLE_H;
        if (hit) {
          loseLife(st);
          break;
        }
      }
    }

    st.bottles = st.bottles.filter(
      (b) => !(b.shelf <= 0 && (b.x < 6 || b.x > GAME_W - 12)) && b.y < st.camY + 288 + 80
    );
    if (st.bottles.length > 40) st.bottles.splice(0, st.bottles.length - 40);

    // ── The thief ───────────────────────────────────────────────────────
    st.thiefX += st.thiefDir * 16 * dt;
    if (st.thiefX < 20 || st.thiefX > GAME_W - 20) st.thiefDir = (st.thiefDir * -1) as 1 | -1;

    if (
      st.phase === "play" &&
      Math.abs(st.py - shelfY(st.thiefShelf)) < 4 &&
      Math.abs(st.px - st.thiefX) < 12
    ) {
      st.score += PTS_CATCH;
      st.wave++;
      st.thiefShelf += 4;
      st.spawnGap = Math.max(0.5, st.spawnGap - 0.22);
      st.bottleSpeed = Math.min(96, st.bottleSpeed + 9);
      st.banner = "ACK! I LIKE PRICIER STUFF ANYHOW";
      st.bannerT = 2.2;
      st.phase = "catch";
      st.phaseT = 0;
      addPop(st, st.px, st.py - 24, "+1000", "#9CE800");
    }
  } else if (st.phase === "hit") {
    if (st.phaseT > HIT_SECONDS) {
      st.phase = "play";
      st.phaseT = 0;
    }
  } else if (st.phase === "catch") {
    if (st.phaseT > CATCH_SECONDS) {
      st.phase = "play";
      st.phaseT = 0;
    }
  } else if (st.phase === "over") {
    if (st.phaseT > OVER_SECONDS) finished = true;
  }

  const wantCam = st.py - PLAYER_SCREEN_Y;
  st.camY += (wantCam - st.camY) * Math.min(1, dt * 6);
  st.camY = Math.min(st.camY, GROUND_Y - 288 + 40);

  for (const p of st.pops) {
    p.life -= dt;
    p.y -= 16 * dt;
  }
  st.pops = st.pops.filter((p) => p.life > 0);

  return { finished };
}
