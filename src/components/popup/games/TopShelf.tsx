"use client";

import { useCallback, useRef } from "react";
import ArcadeCanvas from "./ArcadeCanvas";
import CRTScreen from "./CRTScreen";
import { ArcadeButton, useArcadeKeys } from "./controls";
import {
  blink,
  clear,
  drawSprite,
  drawText,
  drawTextMarquee,
  GAME_H,
  GAME_W,
  P,
  pad,
  rect,
} from "./arcade";
import {
  CLIMBER,
  CLIMBER_HERO_COLORS,
  CLIMBER_STEP,
  CLIMBER_THIEF_COLORS,
  ROLLING_BOTTLE,
  BOTTLE_COLORS,
  SHELF_BOTTLE,
  shelfBottleColors,
} from "./sprites";
import {
  ladderAt,
  BOTTLE_H,
  freshState,
  GROUND_Y,
  laddersFor,
  LADDER_W,
  MAX_LIVES,
  PLAYER_H,
  PLAYER_SCREEN_Y,
  pseudo,
  SHELF_GAP,
  SHELF_TH,
  shelfY,
  update,
  type State,
} from "./topShelfCore";
import type { ArcadeGameProps } from "./registry";

// ═══════════════════════════════════════════════════════════════════════════
// TOP SHELF — the presentation layer.
//
// A man decides the good stuff is higher up, leaps onto the back bar and starts
// hurling bottles down at you. Climb after him, jump the bottles, and every time
// you catch him he goes higher still.
//
// All the rules and physics live in topShelfCore.ts. This file draws and listens.
// ═══════════════════════════════════════════════════════════════════════════

const HUD_H = 13;

/** The bar's stock, in the era's saturated primaries. */
const SHELF_HUES: [string, string][] = [
  [P.red, "#8E1410"],
  [P.amber, "#A86500"],
  [P.cyan, "#1E8F94"],
  [P.purple, "#5A188A"],
  [P.orange, "#A84D00"],
  [P.lime, "#5A8A00"],
];

/** The bartender watching it all happen, in his vest. */
const BARKEEP_COLORS: Record<string, string> = {
  o: "#100810",
  c: "#3A2010",
  s: P.skin,
  S: "#C98A62",
  m: "#3A2010",
  r: "#26263A",
  R: "#16162A",
  b: "#16162A",
  B: "#6B4020",
};

// ─── Drawing ─────────────────────────────────────────────────────────────────

/**
 * A climber. Hero and thief are the SAME sprite in different colours — palette
 * swapping one character into a cast is straight out of the era's playbook, and
 * it keeps both of them animating identically for free.
 */
function drawMan(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  face: 1 | -1,
  walking: boolean,
  t: number,
  colors: Record<string, string>
) {
  // Sprite is 14 x 18 and y is the feet line.
  const sprite = walking && Math.floor(t * 8) % 2 === 0 ? CLIMBER_STEP : CLIMBER;
  drawSprite(ctx, sprite, Math.round(x - 7), Math.round(y - PLAYER_H - 3), colors, 1, face < 0);
}

function drawBottleSprite(ctx: CanvasRenderingContext2D, x: number, y: number, spin: number) {
  // Outlined so it stays readable rolling across a shelf full of stock.
  drawSprite(ctx, ROLLING_BOTTLE, Math.round(x), Math.round(y), BOTTLE_COLORS, 1);
  // A highlight that travels round the bottle, so it reads as tumbling
  const phase = Math.floor(spin / 4) % 4;
  const hx = [3, 5, 6, 4][phase];
  const hy = [2, 3, 6, 7][phase];
  rect(ctx, x + hx, y + hy, 2, 2, P.lime);
}

// ─── Scene ───────────────────────────────────────────────────────────────────

function drawWorld(ctx: CanvasRenderingContext2D, st: State) {
  clear(ctx, "#0A0616");

  const topShelfIdx = Math.ceil((GROUND_Y - st.camY) / SHELF_GAP) + 1;
  const botShelfIdx = Math.max(0, Math.floor((GROUND_Y - st.camY - GAME_H) / SHELF_GAP) - 1);

  for (let i = botShelfIdx; i <= topShelfIdx; i++) {
    const sy = shelfY(i) - st.camY;
    if (sy < -SHELF_GAP || sy > GAME_H + SHELF_GAP) continue;

    // Bottles standing on the shelf — the stock the thief is working through
    for (let b = 0; b < 9; b++) {
      const bx = 8 + b * 24 + Math.floor(pseudo(i * 31 + b) * 8);
      const [body, shade] = SHELF_HUES[(i + b) % SHELF_HUES.length];
      drawSprite(ctx, SHELF_BOTTLE, bx, sy - 12, shelfBottleColors(body, shade), 1);
    }

    rect(ctx, 0, sy, GAME_W, SHELF_TH, P.wood);
    rect(ctx, 0, sy + SHELF_TH, GAME_W, 1, P.brown);

    for (const lx of laddersFor(i)) {
      const topY = shelfY(i + 1) - st.camY;
      rect(ctx, lx, topY, 2, sy - topY, P.cyan);
      rect(ctx, lx + LADDER_W - 2, topY, 2, sy - topY, P.cyan);
      for (let r = topY + 4; r < sy; r += 6) rect(ctx, lx, r, LADDER_W, 1, P.teal);
    }
  }


  // The floor of the bar, below the lowest shelf — otherwise the bottom of the
  // screen is an empty void once the camera bottoms out.
  const groundScreen = shelfY(0) - st.camY;
  if (groundScreen < GAME_H) {
    rect(ctx, 0, groundScreen + SHELF_TH, GAME_W, GAME_H - groundScreen, "#1C1030");
    for (let i = 0; i < 9; i++) {
      rect(ctx, i * 26 + 4, groundScreen + SHELF_TH, 1, GAME_H, "#140A22");
    }
    rect(ctx, 0, groundScreen + SHELF_TH, GAME_W, 1, "#4A2808");
  }

  for (const b of st.bottles) {
    const by = b.y - st.camY;
    if (by < -20 || by > GAME_H + 20) continue;
    drawBottleSprite(ctx, b.x, by, st.t * 12 + b.x);
  }

  const ty = shelfY(st.thiefShelf) - st.camY;
  if (ty > -30 && ty < GAME_H + 30) {
    drawMan(ctx, st.thiefX, ty, st.thiefDir, true, st.t, CLIMBER_THIEF_COLORS);
    if (blink(st.t, 1.5)) drawText(ctx, "HA HA", st.thiefX + 12, ty - 26, P.magenta, 1);
  }

  // The player flashes while invulnerable after a hit
  const py = st.py - st.camY;
  if (!(st.invuln > 0 && blink(st.t, 8))) {
    drawMan(ctx, st.px, py, st.face, st.input.left || st.input.right, st.t, CLIMBER_HERO_COLORS);
  }

  for (const p of st.pops) {
    drawText(ctx, p.text, p.x, p.y - st.camY, p.color, 1, "center");
  }
}

/** The opening cutscene: he walks in, announces himself, and takes the high ground. */
function drawIntro(ctx: CanvasRenderingContext2D, st: State, T: number) {
  clear(ctx, "#0A0616");

  let cam = GROUND_Y - PLAYER_SCREEN_Y;
  if (T > 3.8 && T <= 5.2) cam -= ((T - 3.8) / 1.4) * SHELF_GAP * 4;
  else if (T > 5.2 && T <= 6.6) cam -= SHELF_GAP * 4;
  else if (T > 6.6) cam -= SHELF_GAP * 4 * Math.max(0, 1 - (T - 6.6) / 1.2);
  st.camY = cam;

  for (let i = 0; i <= 12; i++) {
    const sy = shelfY(i) - cam;
    if (sy < -SHELF_GAP || sy > GAME_H + SHELF_GAP) continue;
    for (let b = 0; b < 9; b++) {
      const bx = 8 + b * 24 + Math.floor(pseudo(i * 31 + b) * 8);
      const [body, shade] = SHELF_HUES[(i + b) % SHELF_HUES.length];
      drawSprite(ctx, SHELF_BOTTLE, bx, sy - 12, shelfBottleColors(body, shade), 1);
    }
    rect(ctx, 0, sy, GAME_W, SHELF_TH, P.wood);
    for (const lx of laddersFor(i)) {
      const topY = shelfY(i + 1) - cam;
      rect(ctx, lx, topY, 2, sy - topY, P.cyan);
      rect(ctx, lx + LADDER_W - 2, topY, 2, sy - topY, P.cyan);
    }
  }

  const ground = GROUND_Y - cam;

  if (ground < GAME_H) {
    rect(ctx, 0, ground + SHELF_TH, GAME_W, GAME_H - ground, "#1C1030");
    for (let i = 0; i < 9; i++) {
      rect(ctx, i * 26 + 4, ground + SHELF_TH, 1, GAME_H, "#140A22");
    }
    rect(ctx, 0, ground + SHELF_TH, GAME_W, 1, "#4A2808");
  }

  rect(ctx, 150, ground - 26, 60, 4, P.wood);
  drawMan(ctx, 186, ground, -1, false, st.t, BARKEEP_COLORS);

  if (T < 3.4) {
    const x = 10 + Math.min(1, T / 2) * 110;
    drawMan(ctx, x, ground, 1, T < 2, st.t, CLIMBER_THIEF_COLORS);
    if (T > 2) {
      drawTextMarquee(ctx, "I ONLY LIKE", 112, 92, P.white, 1, "center");
      drawTextMarquee(ctx, "TOP SHELF BOOZE!", 112, 104, P.yellow, 1, "center");
    }
  } else if (T < 5.2) {
    const p = Math.max(0, Math.min(1, (T - 3.4) / 1.8));
    drawMan(ctx, 120, ground - p * 40, 1, false, st.t, CLIMBER_THIEF_COLORS);
  } else if (T < 6.6) {
    const ty = shelfY(4) - cam;
    drawMan(ctx, 112, ty, 1, true, st.t, CLIMBER_THIEF_COLORS);
    if (blink(st.t, 3)) drawText(ctx, "HA HA HA", 112, ty - 28, P.magenta, 1, "center");
    drawBottleSprite(ctx, 112 + Math.sin(st.t * 4) * 40, ty - BOTTLE_H, st.t * 12);
  } else {
    drawTextMarquee(ctx, "GO AFTER HIM QUICK", 112, 96, P.white, 1, "center");
    drawTextMarquee(ctx, "BEFORE HE WRECKS", 112, 108, P.white, 1, "center");
    drawTextMarquee(ctx, "THE WHOLE BAR!", 112, 120, P.yellow, 1, "center");
    drawMan(ctx, 112, ground, 1, false, st.t, CLIMBER_HERO_COLORS);
  }

  if (blink(st.t, 1.5)) {
    drawText(ctx, "PRESS ANY BUTTON TO SKIP", 112, GAME_H - 12, P.slate, 1, "center");
  }
}

function drawHud(ctx: CanvasRenderingContext2D, st: State) {
  rect(ctx, 0, 0, GAME_W, HUD_H, P.black);
  drawText(ctx, `SCORE ${pad(Math.max(0, st.score))}`, 4, 3, P.white, 1);
  drawText(ctx, `WAVE ${st.wave}`, 152, 3, P.cyan, 1);
  for (let i = 0; i < MAX_LIVES; i++) {
    rect(ctx, 108 + i * 7, 4, 4, 6, i < st.lives ? P.red : P.slate);
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Plays the game, imperfectly on purpose.
 *
 * Climbs toward the thief, jumps at bottles that are close and coming at it,
 * and misses sometimes — a flawless demo never shows the player that being hit
 * is possible, which is half of what a demo is for.
 *
 * Reads only state a player can see on screen: where the thief is, where the
 * bottles are, whether a ladder is underfoot. It is not a second copy of the
 * rules, so changing the rules cannot silently break it.
 */
function runDemoBot(st: State, dt: number, memo: { jumpFor: number; dither: number }) {
  const inp = st.input;
  inp.left = inp.right = inp.up = inp.down = inp.jump = false;

  if (st.phase !== "play") return;

  memo.dither -= dt;
  if (memo.jumpFor > 0) {
    memo.jumpFor -= dt;
    inp.jump = true;
  }

  // ── Dodge ───────────────────────────────────────────────────────────────
  // A bottle on this shelf, close, and heading this way.
  const danger = st.bottles.find((b) => {
    const sameLevel = Math.abs(b.y - st.py) < 12;
    const gap = b.x - st.px;
    // Rolling toward us: the bottle's direction points at the gap we're on.
    const closing = Math.sign(gap) !== b.dir;
    return sameLevel && Math.abs(gap) < 26 && closing;
  });
  if (danger && st.onGround && memo.jumpFor <= 0) {
    // Not every time. Getting clipped is worth showing.
    if (Math.random() < 0.82) memo.jumpFor = 0.12;
    else memo.dither = 0.5;
  }

  // ── Climb ───────────────────────────────────────────────────────────────
  const ladder = ladderAt(st.px, st.py);
  if (ladder && st.thiefShelf > st.highestShelf) {
    inp.up = true;
    return;
  }

  if (memo.dither > 0) return;

  // ── Head for the nearest ladder that goes up, or for the thief ─────────
  const ladders = laddersFor(st.highestShelf);
  const goingUp = st.thiefShelf > st.highestShelf && ladders.length > 0;
  const targetX = goingUp
    ? ladders.reduce((best, x) => (Math.abs(x - st.px) < Math.abs(best - st.px) ? x : best), ladders[0])
    : st.thiefX;

  if (targetX - st.px > 3) inp.right = true;
  else if (targetX - st.px < -3) inp.left = true;
}

export default function TopShelf({ onGameOver, demo = false }: ArcadeGameProps) {
  const s = useRef<State>(freshState());
  const endedRef = useRef(false);

  const botMemo = useRef({ jumpFor: 0, dither: 0 });

  const setInput = useCallback((k: keyof State["input"], v: boolean) => {
    // A demo drives itself; a stray tap must not steer it.
    if (demo) return;
    s.current.input[k] = v;
    // Any press skips the cutscene — nobody wants to watch it on their fifth go.
    if (v && s.current.phase === "intro") s.current.introSkipped = true;
  }, [demo]);

  useArcadeKeys(
    true,
    (key) => {
      if (key === "ArrowLeft") setInput("left", true);
      else if (key === "ArrowRight") setInput("right", true);
      else if (key === "ArrowUp") setInput("up", true);
      else if (key === "ArrowDown") setInput("down", true);
      else if (key === " " || key === "Spacebar") setInput("jump", true);
    },
    (key) => {
      if (key === "ArrowLeft") setInput("left", false);
      else if (key === "ArrowRight") setInput("right", false);
      else if (key === "ArrowUp") setInput("up", false);
      else if (key === "ArrowDown") setInput("down", false);
      else if (key === " " || key === "Spacebar") setInput("jump", false);
    }
  );

  const onFrame = useCallback(
    (ctx: CanvasRenderingContext2D, dt: number) => {
      const st = s.current;

      // The bot moves before the rules do, so an input it sets this frame is
      // acted on this frame — the same order a real press arrives in.
      if (demo) runDemoBot(st, dt, botMemo.current);

      const { finished } = update(st, dt);

      // A demo loops instead of ending, and never reports a score — an entry
      // from a game nobody played would be indistinguishable from a cheated one.
      if (finished && demo) {
        s.current = freshState();
        botMemo.current = { jumpFor: 0, dither: 0 };
        return;
      }
      if (finished && !endedRef.current) {
        endedRef.current = true;
        onGameOver(Math.max(0, Math.round(st.score)), {
          game: "top-shelf",
          wave: st.wave,
          shelvesClimbed: st.highestShelf,
        });
      }

      if (st.phase === "intro") {
        drawIntro(ctx, st, st.phaseT);
        drawHud(ctx, st);
        return;
      }

      drawWorld(ctx, st);
      drawHud(ctx, st);

      if (st.bannerT > 0 && st.banner) {
        drawTextMarquee(
          ctx,
          st.banner,
          112,
          60,
          P.yellow,
          st.banner.length > 14 ? 1 : 2,
          "center",
          P.black,
          P.crimson
        );
      }
      if (st.phase === "over") {
        rect(ctx, 20, 120, GAME_W - 40, 46, P.black);
        drawTextMarquee(ctx, "GAME OVER", 112, 132, P.red, 2, "center", P.black, "#3A0000");
        if (blink(st.t, 2)) drawText(ctx, "THE BAR IS WRECKED", 112, 152, P.yellow, 1, "center");
      }
    },
    [onGameOver, demo]
  );

  return (
    <div>
      <CRTScreen glow="#3CE0E0">
          <ArcadeCanvas onFrame={onFrame} running />
        </CRTScreen>

      <div className={`p-2 bg-black grid-cols-4 gap-1.5 ${demo ? "hidden" : "grid"}`}>
        <ArcadeButton
          label="◀"
          ariaLabel="Move left"
          color={P.cyan}
          onPress={() => setInput("left", true)}
          onRelease={() => setInput("left", false)}
          className="h-16"
        />
        <ArcadeButton
          label="▶"
          ariaLabel="Move right"
          color={P.cyan}
          onPress={() => setInput("right", true)}
          onRelease={() => setInput("right", false)}
          className="h-16"
        />
        <ArcadeButton
          label="▲"
          sublabel="climb"
          ariaLabel="Climb ladder"
          color={P.lime}
          onPress={() => setInput("up", true)}
          onRelease={() => setInput("up", false)}
          className="h-16"
        />
        <ArcadeButton
          label="JUMP"
          ariaLabel="Jump"
          color={P.yellow}
          onPress={() => setInput("jump", true)}
          onRelease={() => setInput("jump", false)}
          className="h-16"
        />
      </div>
      <p className="pb-2 text-center text-[7px] tracking-[0.2em] uppercase text-white/25">
        Desktop: arrow keys + space
      </p>
    </div>
  );
}
