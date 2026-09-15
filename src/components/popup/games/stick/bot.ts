// ─── Behind the Stick — attract mode ─────────────────────────────────────────
//
// Plays the game for a carousel slide. It feeds the same pointer calls a thumb
// would, so what the demo shows is the real game, just a slightly sloppy
// bartender: it grabs most of the right bottles, hits most notes, and now and
// then lets a drink go watery so the loop visibly restarts.

import * as K from "./constants";
import {
  laneButtonX,
  LANE_BUTTON_Y,
  pointerDown,
  pointerMove,
  pointerUp,
  wants,
  type State,
} from "./core";

const BOT_FINGER = 9000;

export interface Bot {
  tapCooldown: number;
  shakeT: number;
  held: boolean;
}

export function newBot(): Bot {
  return { tapCooldown: 0, shakeT: 0, held: false };
}

export function botStep(bot: Bot, st: State, dt: number): void {
  bot.tapCooldown -= dt;
  const l = st.layout;

  if (st.stage === "grab" || st.stage === "finish") {
    if (bot.tapCooldown <= 0 && !st.grab.done) {
      const want = st.grab.items.find(
        (it) =>
          it.kind === "bottle" &&
          it.ing &&
          wants(st, it.ing) &&
          !st.grab.got.includes(it.ing) &&
          it.y > 110 &&
          it.y < 230
      );
      if (want) {
        pointerDown(st, BOT_FINGER + 1, K.panelX(l, want.side) + want.x * l.side, want.y);
        pointerUp(st, BOT_FINGER + 1);
        bot.tapCooldown = 0.35;
      }
    }
  }

  if (st.stage === "build" && st.build) {
    const b = st.build;
    for (const n of b.notes) {
      if (!n.judged && Math.abs(n.t - b.clock) < 0.03 && st.rand() < 0.9) {
        pointerDown(st, BOT_FINGER + 2, laneButtonX(l, n.lane), LANE_BUTTON_Y);
        pointerUp(st, BOT_FINGER + 2);
      }
    }
  }

  const f = st.stage === "finish" ? st.finish : null;
  if (f && !f.result) {
    const cx = l.rightX + l.side / 2;
    const cy = K.H * 0.52;
    bot.shakeT += dt;
    if (f.cocktail.finish === "shake") {
      const y = cy + Math.sin(bot.shakeT * 18) * 60;
      if (!bot.held) pointerDown(st, BOT_FINGER, cx, y);
      else pointerMove(st, BOT_FINGER, cx, y);
    } else {
      const a = bot.shakeT * 9;
      const x = cx + Math.cos(a) * 40;
      const y = cy + Math.sin(a) * 40;
      if (!bot.held) pointerDown(st, BOT_FINGER, x, y);
      else pointerMove(st, BOT_FINGER, x, y);
    }
    bot.held = true;
  } else if (bot.held) {
    pointerUp(st, BOT_FINGER);
    bot.held = false;
    bot.shakeT = 0;
  }
}
