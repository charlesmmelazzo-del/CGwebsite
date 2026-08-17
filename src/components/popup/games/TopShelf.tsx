"use client";

import { useCallback, useRef } from "react";
import ArcadeCanvas from "./ArcadeCanvas";
import { ArcadeButton, useArcadeKeys } from "./controls";
import { blink, clear, drawText, drawTextShadow, GAME_H, GAME_W, P, pad, rect } from "./arcade";
import {
  BOTTLE_H,
  BOTTLE_W,
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

// ─── Drawing ─────────────────────────────────────────────────────────────────

function drawMan(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  face: 1 | -1,
  walking: boolean,
  t: number,
  shirt: string,
  cap: string
) {
  // y is the feet line
  const top = y - PLAYER_H;
  rect(ctx, x - 5, top, 10, 5, P.skin);          // head
  rect(ctx, x - 6, top - 2, 12, 3, cap);          // cap
  rect(ctx, x + (face > 0 ? 2 : -4), top + 2, 2, 1, P.black); // eye
  rect(ctx, x - 5, top + 5, 10, 6, shirt);        // torso
  rect(ctx, x - 7, top + 6, 2, 4, P.skin);        // arms
  rect(ctx, x + 5, top + 6, 2, 4, P.skin);

  const step = walking && Math.floor(t * 9) % 2 === 0;
  rect(ctx, x - 4, top + 11, 3, 4, P.navy);
  rect(ctx, x + 1, top + 11, 3, 4, P.navy);
  if (step) rect(ctx, x + 2 * face, top + 14, 3, 1, P.navy);
}

function drawBottleSprite(ctx: CanvasRenderingContext2D, x: number, y: number, spin: number) {
  // A rolling bottle: the highlight rotates so it reads as tumbling
  rect(ctx, x, y + 2, BOTTLE_W, BOTTLE_H - 4, P.green);
  rect(ctx, x + 1, y, BOTTLE_W - 2, 2, P.forest);
  rect(ctx, x + 1, y + BOTTLE_H - 2, BOTTLE_W - 2, 2, P.forest);
  const hx = Math.floor(spin) % 3;
  rect(ctx, x + 1 + hx * 2, y + 3, 2, 2, P.lime);
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
      const hue = [P.red, P.amber, P.cyan, P.purple, P.orange, P.lime][(i + b) % 6];
      rect(ctx, bx, sy - 11, 5, 11, hue);
      rect(ctx, bx + 1, sy - 14, 3, 3, P.slate);
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

  for (const b of st.bottles) {
    const by = b.y - st.camY;
    if (by < -20 || by > GAME_H + 20) continue;
    drawBottleSprite(ctx, b.x, by, st.t * 12 + b.x);
  }

  const ty = shelfY(st.thiefShelf) - st.camY;
  if (ty > -30 && ty < GAME_H + 30) {
    drawMan(ctx, st.thiefX, ty, st.thiefDir, true, st.t, P.magenta, P.purple);
    if (blink(st.t, 1.5)) drawText(ctx, "HA HA", st.thiefX + 12, ty - 26, P.magenta, 1);
  }

  // The player flashes while invulnerable after a hit
  const py = st.py - st.camY;
  if (!(st.invuln > 0 && blink(st.t, 8))) {
    drawMan(ctx, st.px, py, st.face, st.input.left || st.input.right, st.t, P.red, P.white);
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
      const hue = [P.red, P.amber, P.cyan, P.purple, P.orange, P.lime][(i + b) % 6];
      rect(ctx, bx, sy - 11, 5, 11, hue);
    }
    rect(ctx, 0, sy, GAME_W, SHELF_TH, P.wood);
    for (const lx of laddersFor(i)) {
      const topY = shelfY(i + 1) - cam;
      rect(ctx, lx, topY, 2, sy - topY, P.cyan);
      rect(ctx, lx + LADDER_W - 2, topY, 2, sy - topY, P.cyan);
    }
  }

  const ground = GROUND_Y - cam;

  rect(ctx, 150, ground - 26, 60, 4, P.wood);
  drawMan(ctx, 186, ground, -1, false, st.t, "#202030", "#3A2010");

  if (T < 3.4) {
    const x = 10 + Math.min(1, T / 2) * 110;
    drawMan(ctx, x, ground, 1, T < 2, st.t, P.magenta, P.purple);
    if (T > 2) {
      drawTextShadow(ctx, "I ONLY LIKE", 112, 92, P.white, 1, "center");
      drawTextShadow(ctx, "TOP SHELF BOOZE!", 112, 104, P.yellow, 1, "center");
    }
  } else if (T < 5.2) {
    const p = Math.max(0, Math.min(1, (T - 3.4) / 1.8));
    drawMan(ctx, 120, ground - p * 40, 1, false, st.t, P.magenta, P.purple);
  } else if (T < 6.6) {
    const ty = shelfY(4) - cam;
    drawMan(ctx, 112, ty, 1, true, st.t, P.magenta, P.purple);
    if (blink(st.t, 3)) drawText(ctx, "HA HA HA", 112, ty - 28, P.magenta, 1, "center");
    drawBottleSprite(ctx, 112 + Math.sin(st.t * 4) * 40, ty - BOTTLE_H, st.t * 12);
  } else {
    drawTextShadow(ctx, "GO AFTER HIM QUICK", 112, 96, P.white, 1, "center");
    drawTextShadow(ctx, "BEFORE HE WRECKS", 112, 108, P.white, 1, "center");
    drawTextShadow(ctx, "THE WHOLE BAR!", 112, 120, P.yellow, 1, "center");
    drawMan(ctx, 112, ground, 1, false, st.t, P.red, P.white);
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

export default function TopShelf({ onGameOver }: ArcadeGameProps) {
  const s = useRef<State>(freshState());
  const endedRef = useRef(false);

  const setInput = useCallback((k: keyof State["input"], v: boolean) => {
    s.current.input[k] = v;
    // Any press skips the cutscene — nobody wants to watch it on their fifth go.
    if (v && s.current.phase === "intro") s.current.introSkipped = true;
  }, []);

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

      const { finished } = update(st, dt);
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
        drawTextShadow(ctx, st.banner, 112, 60, P.yellow, st.banner.length > 14 ? 1 : 2, "center");
      }
      if (st.phase === "over") {
        rect(ctx, 20, 120, GAME_W - 40, 46, P.black);
        drawTextShadow(ctx, "GAME OVER", 112, 132, P.red, 2, "center");
        if (blink(st.t, 2)) drawText(ctx, "THE BAR IS WRECKED", 112, 152, P.yellow, 1, "center");
      }
    },
    [onGameOver]
  );

  return (
    <div>
      <ArcadeCanvas onFrame={onFrame} running />

      <div className="p-2 bg-black grid grid-cols-4 gap-1.5">
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
