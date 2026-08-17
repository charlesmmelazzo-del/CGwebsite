"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ArcadeCanvas from "./ArcadeCanvas";
import { ArcadeButton, useArcadeKeys } from "./controls";
import {
  blink,
  clamp,
  clear,
  drawSprite,
  drawText,
  drawTextShadow,
  GAME_W,
  meter,
  outline,
  P,
  pad,
  rect,
  type Sprite,
} from "./arcade";
import {
  applyStirAngle,
  currentBpm,
  currentRpm,
  freshState,
  GRACE_SECONDS,
  GOOD_HALF,
  MAX_STRIKES,
  NOTES_PER_ROUND,
  RAIL_H,
  RAIL_Y,
  SHAKE_SECONDS,
  STIR_SECONDS,
  update,
  WINDOW_X,
  type Mood,
  type Phase,
  type State,
} from "./behindTheStickCore";
import type { ArcadeGameProps } from "./registry";

// ═══════════════════════════════════════════════════════════════════════════
// BEHIND THE STICK — the presentation layer.
//
// Ingredients slide along the rail; hit the matching button while one sits in
// the window and it goes in the tin. Miss and it hits the floor. Every ten
// pours you shake or stir it out, faster each time.
//
// All the rules live in behindTheStickCore.ts. This file draws and listens.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Ingredient art ──────────────────────────────────────────────────────────

const BOTTLE: Sprite = [
  "....ccc....",
  "....ccc....",
  "....ggg....",
  "....ggg....",
  "...ggggg...",
  "..ggggggg..",
  "..ggggggg..",
  "..glllllg..",
  "..glllllg..",
  "..glllllg..",
  "..ggggggg..",
  "..ggggggg..",
  "..ggggggg..",
  "..ggggggg..",
  "..bbbbbbb..",
];

const CITRUS: Sprite = [
  "...........",
  "...fffff...",
  "..fffffff..",
  ".fffffffff.",
  ".ffffwffff.",
  "ffffwwwffff",
  "fffwwwwwfff",
  "ffwwwwwwwff",
  "fffwwwwwfff",
  "ffffwwwffff",
  ".ffffwffff.",
  ".fffffffff.",
  "..fffffff..",
  "...fffff...",
  "...........",
];

const JAR: Sprite = [
  "...ddd.....",
  "....d......",
  "....d......",
  "..hhhhhhh..",
  ".hhhhhhhhh.",
  ".hhhhhhhhh.",
  ".hhhhhhhhh.",
  ".hhhhhhhhh.",
  ".hhhhhhhhh.",
  ".hhhhhhhhh.",
  ".hhhhhhhhh.",
  ".hhhhhhhhh.",
  "..hhhhhhh..",
  "..bbbbbbb..",
  "...........",
];

const DASHER: Sprite = [
  "...........",
  "....ccc....",
  "....ccc....",
  "....ggg....",
  "...ggggg...",
  "...ggggg...",
  "...glllg...",
  "...glllg...",
  "...glllg...",
  "...ggggg...",
  "...ggggg...",
  "...ggggg...",
  "...bbbbb...",
  "...........",
  "...........",
];

interface Ingredient {
  key: string;
  label: string;
  /** Signature colour — the button and the note share it, so matching is fast. */
  color: string;
  sprite: Sprite;
  colors: Record<string, string>;
}

/**
 * Seven ingredients, each a distinct colour AND a distinct silhouette. Colour
 * alone isn't enough at speed on a small screen, and shape alone isn't either —
 * you need both to read a note in a fifth of a second.
 */
const INGREDIENTS: Ingredient[] = [
  {
    key: "whiskey",
    label: "Whiskey",
    color: P.amber,
    sprite: BOTTLE,
    colors: { c: P.yellow, g: P.amber, l: P.bone, b: P.brown },
  },
  {
    key: "gin",
    label: "Gin",
    color: P.cyan,
    sprite: BOTTLE,
    colors: { c: P.white, g: P.cyan, l: P.white, b: P.teal },
  },
  {
    key: "tequila",
    label: "Tequila",
    color: P.bone,
    sprite: BOTTLE,
    colors: { c: P.grey, g: P.bone, l: P.lime, b: P.grey },
  },
  {
    key: "lemon",
    label: "Lemon",
    color: P.yellow,
    sprite: CITRUS,
    colors: { f: P.yellow, w: P.bone },
  },
  { key: "lime", label: "Lime", color: P.green, sprite: CITRUS, colors: { f: P.green, w: P.lime } },
  {
    key: "honey",
    label: "Honey",
    color: P.orange,
    sprite: JAR,
    colors: { d: P.tan, h: P.orange, b: P.brown },
  },
  {
    key: "bitters",
    label: "Bitters",
    color: P.red,
    sprite: DASHER,
    colors: { c: P.bone, g: P.red, l: P.bone, b: P.crimson },
  },
];

const ING_BY_KEY = new Map(INGREDIENTS.map((i) => [i.key, i]));
const colorFor = (key: string) => ING_BY_KEY.get(key)?.color ?? P.white;

// ─── Scene ───────────────────────────────────────────────────────────────────

function drawBackbar(ctx: CanvasRenderingContext2D, t: number) {
  clear(ctx, P.night);
  rect(ctx, 0, 14, GAME_W, 130, "#1A1030");

  for (let s = 0; s < 3; s++) {
    const y = 30 + s * 30;
    rect(ctx, 8, y + 18, GAME_W - 16, 3, P.brown);
    for (let b = 0; b < 12; b++) {
      const bx = 12 + b * 17 + (s % 2) * 6;
      if (bx > GAME_W - 20) continue;
      const hue = [P.red, P.amber, P.green, P.cyan, P.purple, P.orange][(b + s) % 6];
      rect(ctx, bx, y + 6, 4, 12, hue);
      rect(ctx, bx + 1, y + 2, 2, 4, P.slate);
    }
  }

  rect(ctx, 0, 144, GAME_W, 8, P.wood);
  rect(ctx, 0, 152, GAME_W, 4, P.brown);
  if (blink(t, 0.7)) drawText(ctx, "OPEN", 12, 20, P.magenta, 1);
}

/** Expression and arms both react to how the round is going. */
function drawBartender(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  mood: Mood,
  pose: "idle" | "shake" | "stir" | "serve",
  t: number
) {
  const skin = P.skin;
  const vest = "#202030";
  const bob = pose === "shake" ? Math.round(Math.sin(t * 26) * 2) : 0;
  const y = baseY + bob;

  rect(ctx, cx - 11, y - 22, 22, 24, vest);
  rect(ctx, cx - 4, y - 22, 8, 24, P.bone);
  rect(ctx, cx - 1, y - 20, 2, 6, P.red);

  rect(ctx, cx - 8, y - 40, 16, 16, skin);
  rect(ctx, cx - 9, y - 42, 18, 5, "#3A2010");
  rect(ctx, cx - 9, y - 37, 2, 4, "#3A2010");
  rect(ctx, cx + 7, y - 37, 2, 4, "#3A2010");

  if (mood === "happy") {
    rect(ctx, cx - 5, y - 33, 3, 1, P.black);
    rect(ctx, cx + 2, y - 33, 3, 1, P.black);
  } else if (mood === "panic") {
    rect(ctx, cx - 6, y - 34, 4, 4, P.white);
    rect(ctx, cx + 2, y - 34, 4, 4, P.white);
    rect(ctx, cx - 5, y - 33, 2, 2, P.black);
    rect(ctx, cx + 3, y - 33, 2, 2, P.black);
  } else {
    rect(ctx, cx - 5, y - 34, 2, 3, P.black);
    rect(ctx, cx + 3, y - 34, 2, 3, P.black);
  }

  rect(ctx, cx - 5, y - 29, 10, 2, "#3A2010"); // moustache

  if (mood === "happy") {
    rect(ctx, cx - 4, y - 26, 8, 1, P.crimson);
    rect(ctx, cx - 5, y - 27, 1, 1, P.crimson);
    rect(ctx, cx + 4, y - 27, 1, 1, P.crimson);
  } else if (mood === "worried") {
    rect(ctx, cx - 3, y - 26, 6, 1, P.crimson);
    rect(ctx, cx - 4, y - 25, 1, 1, P.crimson);
    rect(ctx, cx + 3, y - 25, 1, 1, P.crimson);
  } else if (mood === "panic") {
    rect(ctx, cx - 3, y - 27, 6, 4, P.crimson);
  } else {
    rect(ctx, cx - 3, y - 26, 6, 1, P.crimson);
  }

  if (mood === "worried" || mood === "panic") {
    const drop = Math.floor(t * 6) % 3;
    rect(ctx, cx + 10, y - 38 + drop * 3, 2, 3, P.cyan);
    if (mood === "panic") rect(ctx, cx - 12, y - 36 + drop * 3, 2, 3, P.cyan);
  }

  if (pose === "shake") {
    const lift = Math.round(Math.sin(t * 26) * 4);
    rect(ctx, cx - 16, y - 26 + lift, 6, 12, skin);
    rect(ctx, cx + 10, y - 26 - lift, 6, 12, skin);
    rect(ctx, cx - 6, y - 54 + lift, 12, 16, P.grey);
    rect(ctx, cx - 7, y - 56 + lift, 14, 3, P.bone);
    rect(ctx, cx - 4, y - 50 + lift, 3, 10, P.white);
  } else if (pose === "stir") {
    const sway = Math.round(Math.sin(t * 10) * 3);
    rect(ctx, cx - 16, y - 24, 6, 12, skin);
    rect(ctx, cx + 8 + sway, y - 30, 6, 16, skin);
    rect(ctx, cx + 2, y - 14, 14, 16, "#6088A0");
    rect(ctx, cx + 3, y - 12, 12, 13, P.amber);
    rect(ctx, cx + 8 + sway, y - 34, 2, 20, P.grey);
  } else if (pose === "serve") {
    rect(ctx, cx - 16, y - 24, 6, 12, skin);
    rect(ctx, cx + 10, y - 20, 8, 6, skin);
  } else {
    rect(ctx, cx - 16, y - 24, 6, 12, skin);
    rect(ctx, cx + 10, y - 24, 6, 12, skin);
  }
}

function drawTin(ctx: CanvasRenderingContext2D, x: number, y: number, fill: number) {
  rect(ctx, x, y, 18, 26, P.grey);
  rect(ctx, x - 1, y - 3, 20, 4, P.bone);
  const h = Math.round(clamp(fill, 0, 1) * 20);
  if (h > 0) rect(ctx, x + 2, y + 24 - h, 14, h, P.amber);
  rect(ctx, x + 2, y + 2, 2, 20, P.white);
}

function drawGuest(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  state: "wait" | "happy" | "angry",
  t: number
) {
  rect(ctx, cx - 8, baseY - 18, 16, 18, state === "angry" ? P.red : P.blue);
  rect(ctx, cx - 6, baseY - 32, 12, 14, P.skin);
  rect(ctx, cx - 7, baseY - 34, 14, 4, "#202020");

  if (state === "angry") {
    rect(ctx, cx - 4, baseY - 28, 3, 2, P.black);
    rect(ctx, cx + 1, baseY - 28, 3, 2, P.black);
    rect(ctx, cx - 3, baseY - 24, 6, 3, P.black);
    if (blink(t, 6)) {
      rect(ctx, cx + 9, baseY - 34, 5, 1, P.yellow);
      rect(ctx, cx + 9, baseY - 30, 5, 1, P.yellow);
    }
  } else if (state === "happy") {
    rect(ctx, cx - 4, baseY - 28, 2, 1, P.black);
    rect(ctx, cx + 2, baseY - 28, 2, 1, P.black);
    rect(ctx, cx - 3, baseY - 25, 6, 1, P.black);
    rect(ctx, cx + 8, baseY - 20, 6, 8, P.cyan);
    rect(ctx, cx + 9, baseY - 19, 4, 3, P.amber);
  } else {
    rect(ctx, cx - 4, baseY - 28, 2, 2, P.black);
    rect(ctx, cx + 2, baseY - 28, 2, 2, P.black);
    rect(ctx, cx - 2, baseY - 24, 4, 1, P.black);
  }
}

function drawRail(ctx: CanvasRenderingContext2D, st: State, t: number) {
  rect(ctx, 0, RAIL_Y, GAME_W, RAIL_H, "#101020");
  rect(ctx, 0, RAIL_Y, GAME_W, 1, P.slate);
  rect(ctx, 0, RAIL_Y + RAIL_H - 1, GAME_W, 1, P.slate);

  const wx = WINDOW_X - GOOD_HALF - 2;
  const ww = (GOOD_HALF + 2) * 2;
  rect(ctx, wx, RAIL_Y + 1, ww, RAIL_H - 2, "#182848");
  outline(ctx, wx, RAIL_Y + 1, ww, RAIL_H - 2, blink(t, 3) ? P.cyan : P.teal);

  for (const n of st.notes) {
    if (n.judged) continue;
    const ing = ING_BY_KEY.get(n.ing);
    if (!ing) continue;
    drawSprite(ctx, ing.sprite, Math.round(n.x - 5), RAIL_Y + 10, ing.colors, 1);
  }
}

function drawShake(ctx: CanvasRenderingContext2D, st: State) {
  const bpm = currentBpm(st);
  const ok = bpm >= st.target;

  rect(ctx, 0, RAIL_Y - 6, GAME_W, RAIL_H + 12, "#101020");
  drawText(ctx, "TAP SHAKE FAST", 112, RAIL_Y - 2, P.white, 1, "center");
  meter(ctx, 32, RAIL_Y + 10, 160, 8, clamp(bpm / (st.target * 1.4), 0, 1), ok ? P.lime : P.red);
  rect(ctx, 32 + 160 / 1.4, RAIL_Y + 7, 1, 14, P.yellow);
  drawText(
    ctx,
    `${Math.round(bpm)} / ${st.target} BPM`,
    112,
    RAIL_Y + 23,
    ok ? P.lime : P.red,
    1,
    "center"
  );
  if (!ok && st.phaseT > GRACE_SECONDS) {
    drawTextShadow(ctx, "FASTER!", 112, 96, P.red, 2, "center");
  }
  drawText(
    ctx,
    Math.max(0, SHAKE_SECONDS + GRACE_SECONDS - st.phaseT).toFixed(1),
    208,
    RAIL_Y - 2,
    P.yellow,
    1,
    "right"
  );
}

function drawStir(ctx: CanvasRenderingContext2D, st: State) {
  const rpm = currentRpm(st);
  const ok = rpm >= st.target;

  const cx = 112;
  const cy = 108;
  const r = 34;
  for (let a = 0; a < 32; a++) {
    const ang = (a / 32) * Math.PI * 2;
    rect(ctx, cx + Math.cos(ang) * r - 1, cy + Math.sin(ang) * r - 1, 2, 2, P.slate);
  }
  const lead = st.lastAngle ?? -Math.PI / 2;
  rect(ctx, cx + Math.cos(lead) * r - 2, cy + Math.sin(lead) * r - 2, 5, 5, ok ? P.lime : P.yellow);
  drawText(ctx, "DRAG IN A CIRCLE", cx, cy - 4, P.white, 1, "center");

  rect(ctx, 0, RAIL_Y - 6, GAME_W, RAIL_H + 12, "#101020");
  meter(ctx, 32, RAIL_Y + 10, 160, 8, clamp(rpm / (st.target * 1.4), 0, 1), ok ? P.lime : P.red);
  rect(ctx, 32 + 160 / 1.4, RAIL_Y + 7, 1, 14, P.yellow);
  drawText(
    ctx,
    `${Math.round(rpm)} / ${st.target} RPM`,
    112,
    RAIL_Y + 23,
    ok ? P.lime : P.red,
    1,
    "center"
  );
  if (!ok && st.phaseT > GRACE_SECONDS) {
    drawTextShadow(ctx, "STIR FASTER!", 112, 60, P.red, 2, "center");
  }
  drawText(
    ctx,
    Math.max(0, STIR_SECONDS + GRACE_SECONDS - st.phaseT).toFixed(1),
    208,
    RAIL_Y - 2,
    P.yellow,
    1,
    "right"
  );
}

function drawServe(ctx: CanvasRenderingContext2D, st: State) {
  const p = clamp(st.phaseT / 1.6, 0, 1);
  const x = 120 + p * 60;
  rect(ctx, x, 186, 8, 12, P.cyan);
  rect(ctx, x + 1, 188, 6, 4, P.amber);
  rect(ctx, 0, RAIL_Y - 6, GAME_W, RAIL_H + 12, "#101020");
  drawTextShadow(ctx, "ORDER UP!", 112, RAIL_Y + 6, P.lime, 2, "center");
}

function drawOver(ctx: CanvasRenderingContext2D, t: number) {
  rect(ctx, 0, RAIL_Y - 6, GAME_W, RAIL_H + 12, "#101020");
  drawTextShadow(ctx, "GAME OVER", 112, RAIL_Y + 4, P.red, 2, "center");
  if (blink(t, 2)) {
    drawTextShadow(ctx, "WHERE IS MY DRINK!?", 112, RAIL_Y + 24, P.yellow, 1, "center");
  }
}

function drawHud(ctx: CanvasRenderingContext2D, st: State) {
  rect(ctx, 0, 0, GAME_W, 13, P.black);
  drawText(ctx, `SCORE ${pad(Math.max(0, st.score))}`, 4, 3, P.white, 1);
  drawText(ctx, `ROUND ${st.round}`, 148, 3, P.cyan, 1);
  for (let i = 0; i < MAX_STRIKES; i++) {
    drawText(ctx, i < st.strikes ? "X" : "-", 108 + i * 8, 3, i < st.strikes ? P.red : P.slate, 1);
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BehindTheStick({ onGameOver }: ArcadeGameProps) {
  const s = useRef<State>(freshState(colorFor));
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const endedRef = useRef(false);

  // Mirrored into React only so the right controls render — never per frame.
  const [uiPhase, setUiPhase] = useState<Phase>("ready");
  const uiPhaseRef = useRef<Phase>("ready");

  const press = useCallback((key: string) => {
    if (s.current.phase === "pour") s.current.presses.push(key);
  }, []);

  const tapShake = useCallback(() => {
    if (s.current.phase === "shake") s.current.shakeTaps++;
  }, []);

  const onStirMove = useCallback((e: React.PointerEvent) => {
    const st = s.current;
    if (st.phase !== "stir") return;
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    applyStirAngle(
      st,
      Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2))
    );
  }, []);

  const endStir = useCallback(() => {
    s.current.lastAngle = null;
  }, []);

  useArcadeKeys(
    true,
    (key) => {
      const st = s.current;
      if (st.phase === "shake" && (key === " " || key === "Spacebar")) {
        st.shakeTaps++;
        return;
      }
      const idx = "1234567".indexOf(key);
      if (idx >= 0) press(INGREDIENTS[idx].key);
    },
    () => {}
  );

  useEffect(() => {
    endedRef.current = false;
  }, []);

  // Icons built after mount: they need `document`, and generating them during
  // render would make the server HTML differ from the first client paint.
  const [iconUrls, setIconUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const out: Record<string, string> = {};
    for (const ing of INGREDIENTS) {
      const c = document.createElement("canvas");
      c.width = 11;
      c.height = 15;
      const cx = c.getContext("2d");
      if (!cx) continue;
      drawSprite(cx, ing.sprite, 0, 0, ing.colors, 1);
      out[ing.key] = c.toDataURL();
    }
    setIconUrls(out);
  }, []);

  const onFrame = useCallback(
    (ctx: CanvasRenderingContext2D, dt: number, t: number) => {
      const st = s.current;

      const { finished } = update(st, dt);
      if (finished && !endedRef.current) {
        endedRef.current = true;
        onGameOver(Math.max(0, Math.round(st.score)), {
          game: "behind-the-stick",
          rounds: st.round,
          poursServed: (st.round - 1) * NOTES_PER_ROUND + st.notesJudged,
          bestBpm: Math.round(st.bestBpm),
          bestRpm: Math.round(st.bestRpm),
        });
      }

      if (st.phase !== uiPhaseRef.current) {
        uiPhaseRef.current = st.phase;
        setUiPhase(st.phase);
      }

      // ── Draw ──────────────────────────────────────────────────────────
      drawBackbar(ctx, t);

      const pose =
        st.phase === "shake"
          ? "shake"
          : st.phase === "stir"
            ? "stir"
            : st.phase === "serve"
              ? "serve"
              : "idle";
      drawBartender(ctx, 112, 144, st.phase === "over" ? "panic" : st.mood, pose, t);
      if (pose === "idle") drawTin(ctx, 150, 118, st.tinFill);

      drawGuest(ctx, 30, 200, st.phase === "over" ? "angry" : "wait", t);
      drawGuest(
        ctx,
        194,
        200,
        st.phase === "serve" ? "happy" : st.phase === "over" ? "angry" : "wait",
        t
      );
      rect(ctx, 0, 200, GAME_W, 6, P.wood);

      if (st.phase === "pour" || st.phase === "ready") drawRail(ctx, st, t);
      else if (st.phase === "shake") drawShake(ctx, st);
      else if (st.phase === "stir") drawStir(ctx, st);
      else if (st.phase === "serve") drawServe(ctx, st);
      else if (st.phase === "over") drawOver(ctx, t);

      for (const sp of st.splashes) {
        rect(ctx, sp.x - 3, sp.y, 6, 2, sp.color);
        rect(ctx, sp.x - 5, sp.y + 2, 2, 2, sp.color);
        rect(ctx, sp.x + 4, sp.y + 2, 2, 2, sp.color);
      }
      for (const p of st.pops) drawText(ctx, p.text, p.x, p.y, p.color, 1, "center");

      drawHud(ctx, st);

      if (st.bannerTimer > 0 && st.banner) {
        drawTextShadow(ctx, st.banner, 112, 96, P.yellow, 2, "center");
      }
    },
    [onGameOver]
  );

  return (
    <div>
      <div
        ref={wrapRef}
        onPointerMove={onStirMove}
        onPointerDown={onStirMove}
        onPointerUp={endStir}
        onPointerCancel={endStir}
        onPointerLeave={endStir}
        style={{ touchAction: uiPhase === "stir" ? "none" : "auto" }}
      >
        <ArcadeCanvas onFrame={onFrame} running />
      </div>

      <div className="p-2 bg-black">
        {uiPhase === "shake" ? (
          <ArcadeButton
            label="SHAKE!"
            sublabel="tap as fast as you can"
            onPress={tapShake}
            color={P.lime}
            className="w-full h-24"
          />
        ) : uiPhase === "stir" ? (
          <div className="h-24 flex items-center justify-center border-2 border-dashed border-white/25 text-center px-4">
            <p className="text-[11px] tracking-widest uppercase text-white/60 leading-relaxed">
              Drag your finger in circles
              <br />
              <span className="text-white/35">on the screen above</span>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {INGREDIENTS.map((ing) => (
              <ArcadeButton
                key={ing.key}
                ariaLabel={ing.label}
                color={ing.color}
                disabled={uiPhase !== "pour"}
                onPress={() => press(ing.key)}
                className="h-16"
                label={
                  <span className="flex flex-col items-center gap-1">
                    {/* Fixed box either way, so the icon appearing after mount
                        doesn't shift the button under the player's thumb. */}
                    <span style={{ width: 15, height: 20 }} className="flex items-center">
                      {iconUrls[ing.key] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={iconUrls[ing.key]}
                          alt=""
                          width={11}
                          height={15}
                          style={{ imageRendering: "pixelated", width: 15, height: 20 }}
                        />
                      )}
                    </span>
                    <span className="text-[8px] tracking-wider">{ing.label.toUpperCase()}</span>
                  </span>
                }
              />
            ))}
            <div className="h-16 flex items-center justify-center text-[7px] tracking-widest uppercase text-white/20 text-center leading-tight">
              keys
              <br />
              1-7
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
