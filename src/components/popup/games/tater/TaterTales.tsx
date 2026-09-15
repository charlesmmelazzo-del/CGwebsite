"use client";

import { useCallback, useEffect, useRef } from "react";
import { drawText, drawTextMarquee, drawTextShadow, pad, textWidth } from "../arcade";
import type { ArcadeGameProps } from "../registry";
import TaterCanvas from "./TaterCanvas";
import { ART, type ArtName } from "./artManifest";
import {
  ALLIE_AGAIN, ALLIE_KEEP_GOING, FLAT_LINE, GUILLERMO_LINE, SHOWDOWN_ESCAPE,
  SHOWDOWN_ESCAPE_AGAIN, SHOWDOWN_HIT, SHOWDOWN_TAUNTS,
  TATER_SOAKED, TATER_TAUNT, TATER_TAUNT_AGAIN, THANK_YOU, summitBottleFor, type BottleId,
} from "./cast";
import {
  CAMERA_ANCHOR, CAMERA_LERP, ELMER_H, FIZZ_MAX, FIZZ_PER_ZONE, HUD_H, OVERSHAKE_CYCLES,
  PIXEL_SCALE, ROW_GAP, SCORE_NEW_ZONE, T, VIEW_W, W, WALL_W,
} from "./constants";
import {
  BLOCK_H, WALL_TILE_H, drawArrow, drawArt, drawGauge, drawPlatformTiles, drawWallTile,
  drawWhole, fill, frameSize, gaugeSize, hash, keyline, prefetch,
} from "./sprites";
import { DEMO_SLIDE_HOLD, SLIDES } from "./story";
import {
  bestShot, cancelHold, createGame, drainEvents, endScene, heightRows, holdCycles, nextLap,
  press, release, rowsFor, score, step, type Item, type TaterEvent, type TaterState,
} from "./taterCore";
import { HOWTO_COPY, PARAGRAPH_GAP, lineHeight, wrapLines } from "./text";
import { SUMMIT_ROW, SUMMIT_ZONE, ZONES, zoneForRow, type ZoneArt } from "./zones";

// ─── Timing ──────────────────────────────────────────────────────────────────

const FLOAT_LIFE = 1.3;
const BANNER_LIFE = 2.4;
/** The "YOU REACHED MARS!!!" banner stays up longer: it is the big moment. */
const ZONE_BANNER_LIFE = 4;
const HOWTO_PAGES = HOWTO_COPY.length;

/** Row numbers painted on the wall signs, every this many rows. */
const SIGN_EVERY = 5;

/** Where Elmer and Tater stand on the summit, as fractions of the shaft. */
const SUMMIT_ELMER_X = W * 0.22;
const SUMMIT_TATER_X = W * 0.64;
const SUMMIT_CABINET_X = W * 0.9;

// ─── Scenes ──────────────────────────────────────────────────────────────────

type BeatId =
  // The summit, and the showdown at the top of every world
  | "taunt" | "spray" | "soaked" | "together" | "freed" | "fall" | "landed" | "hit" | "escape"
  // The showdown's lead-in and its payoff: the way into the next world
  | "arrive" | "gate";

interface Beat { id: BeatId; hold: number; line?: string }

function finaleBeats(lap: number, bottle: BottleId | null): Beat[] {
  if (lap === 1) {
    return [
      { id: "taunt", hold: 2.8, line: TATER_TAUNT },
      { id: "spray", hold: 1.2 },
      { id: "soaked", hold: 1.8, line: TATER_SOAKED },
      { id: "together", hold: 1.0 },
      { id: "fall", hold: 2.8 },
      { id: "landed", hold: 6, line: ALLIE_KEEP_GOING },
    ];
  }
  return [
    { id: "taunt", hold: 2.2, line: TATER_TAUNT_AGAIN },
    { id: "spray", hold: 1.2 },
    { id: "soaked", hold: 1.8, line: TATER_SOAKED },
    ...(bottle ? [{ id: "freed" as const, hold: 1.5, line: THANK_YOU[0] }] : []),
    { id: "fall", hold: 2.6 },
    { id: "landed", hold: 5, line: ALLIE_AGAIN },
  ];
}

/**
 * Tater at the top of a world: he taunts, Elmer sprays him, and he leaps away
 * up the shelves — with Allie, on lap one — to wait at the top of the next.
 */
function showdownBeats(zone: number, lap: number): Beat[] {
  return [
    { id: "arrive", hold: 1.6 },
    { id: "taunt", hold: 2.4, line: SHOWDOWN_TAUNTS[zone % SHOWDOWN_TAUNTS.length] },
    { id: "spray", hold: 1.2 },
    { id: "hit", hold: 1.3, line: SHOWDOWN_HIT },
    { id: "escape", hold: 1.5, line: lap === 1 ? SHOWDOWN_ESCAPE : SHOWDOWN_ESCAPE_AGAIN },
    // The camera lifts into the new world while it is announced.
    { id: "gate", hold: ZONE_BANNER_LIFE },
  ];
}

interface Scene {
  kind: "finale" | "showdown";
  beats: Beat[];
  beat: number;
  t: number;
  /** World x of Tater. */
  x: number;
  /** World y of the shelf surface. */
  y: number;
  lap: number;
  bottle: BottleId | null;
  bonus: number;
  /** For a showdown: the world whose top this is. */
  zone: number;
  /** Elmer's x when the scene started, for walking him into place. */
  elmerFrom: number;
  /** The camera when the fall down the shaft started. */
  camFrom: number;
}

// ─── The view ────────────────────────────────────────────────────────────────

type Screen = "title" | "story" | "howto" | "play" | "flat";
type ElmerAnim = "shake" | "blast" | "fly" | "fall" | "land" | "thud";

interface Float { text: string; x: number; y: number; t: number; color: string }
interface Bubble { text: string; x: number; y: number; t: number; life: number }

interface View {
  screen: Screen;
  slide: number;
  howto: number;
  g: TaterState;

  cam: number;
  camReady: boolean;

  anim: ElmerAnim;
  animT: number;

  scene: Scene | null;
  thanks: Array<{ id: BottleId; x: number; y: number; t: number }>;
  floats: Float[];
  bubble: Bubble | null;
  banner: { text: string; sub: string; t: number; big?: boolean; header?: string } | null;
  /** Soda and bubbles flying out of an exploded can. */
  bursts: Array<{ x: number; y: number; vx: number; vy: number; t: number; color: string }>;
  /** Seconds of screen shake left. */
  shake: number;
  /** Tater's shelf breaking up after Elmer leaves it. */
  crumbles: Array<{ x: number; y: number; vy: number; t: number; art: ZoneArt; frame: number }>;

  demo: boolean;
  demoHold: number;
  demoWant: { angle: number; power: number } | null;

  /** Hidden practice start near the top: never posts a real score. */
  practice: boolean;
  logoTaps: number[];

  finished: boolean;
}

const PRACTICE_ROW = SUMMIT_ROW - 5;

function makeView(demo: boolean, practice = false): View {
  const seed = (Math.random() * 0xffffffff) >>> 0;
  return {
    screen: "title", slide: 0, howto: 0,
    g: createGame(seed, practice ? { startRow: PRACTICE_ROW } : {}),
    cam: 0, camReady: false,
    anim: "shake", animT: 0,
    scene: null, thanks: [],
    floats: [], bubble: null, banner: null, bursts: [], shake: 0, crumbles: [],
    demo, demoHold: 0, demoWant: null,
    practice, logoTaps: [],
    finished: false,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Tater Tales — how high can Elmer get?
 *
 * The screen flow, the animation and the drawing. The RULES are in
 * taterCore.ts and nothing here decides one: this file reads the state and
 * calls `tap`, `step`, `endScene` and `nextLap`, and that is the contract.
 */
export default function TaterTales({ onGameOver, demo = false, paused = false, onShowScores }: ArcadeGameProps) {
  const view = useRef<View>(makeView(demo));
  const overRef = useRef(onGameOver);
  overRef.current = onGameOver;

  useEffect(() => {
    view.current = makeView(demo);
  }, [demo]);

  // A pause lands the finger's release on the overlay, not the game: drop the
  // hold rather than firing a blast nobody meant when play resumes.
  useEffect(() => {
    if (paused) cancelHold(view.current.g);
  }, [paused]);

  useEffect(() => {
    prefetch([
      "title", "logo", "cutscene-01", "cutscene-02",
      "elmer-shake", "elmer-blast", "elmer-fly-up", "elmer-fly-diag", "elmer-fly-side",
      "elmer-fall", "elmer-land", "elmer-thud", "guillermo-luck",
      "tile-shelf-platform", "tile-shelf-wall", "gauge-empty", "gauge-full",
    ]);
  }, []);

  const onTap = useCallback((x: number, y: number, h: number) => {
    const v = view.current;
    if (v.demo) return;

    switch (v.screen) {
      case "title": {
        const b = scoresButton(h);
        if (onShowScores && inside(x, y, b)) { onShowScores(); return; }
        // Five quick taps on the logo: practice from near the top.
        const logo = logoRect(h);
        if (inside(x, y, logo)) {
          const now = performance.now();
          v.logoTaps = [...v.logoTaps.filter((t) => now - t < 2500), now];
          if (v.logoTaps.length >= 5) {
            const next = makeView(false, !v.practice);
            Object.assign(v, next);
          }
          return;
        }
        if (v.practice) { startPlay(v); return; }
        v.screen = "story";
        v.slide = 0;
        return;
      }
      case "story": {
        if (inside(x, y, skipButton(h))) { v.screen = "howto"; v.howto = 0; return; }
        v.slide++;
        if (v.slide >= SLIDES.length) { v.screen = "howto"; v.howto = 0; }
        return;
      }
      case "howto":
        v.howto++;
        if (v.howto >= HOWTO_PAGES) startPlay(v);
        return;
      case "play":
        if (v.scene) { skipBeat(v); return; }
        // One gesture: pressing locks the arrow and starts the fizz filling.
        press(v.g);
        return;
      case "flat":
        finish(v, overRef.current);
        return;
    }
  }, [onShowScores]);

  const onRelease = useCallback(() => {
    const v = view.current;
    if (v.demo || v.screen !== "play" || v.scene) return;
    release(v.g);
  }, []);

  const onFrame = useCallback((ctx: CanvasRenderingContext2D, dt: number, t: number, h: number) => {
    const v = view.current;
    fill(ctx, 0, 0, VIEW_W, h, T.black);

    if (v.demo) driveDemo(v, dt);

    switch (v.screen) {
      case "title": drawTitle(ctx, v, h, t, Boolean(onShowScores)); break;
      case "story": drawStory(ctx, v, h, t); break;
      case "howto": drawHowTo(ctx, v, h, t); break;
      case "play":
      case "flat":
        update(v, dt, h);
        drawPlay(ctx, v, h, t);
        if (v.screen === "flat") drawFlat(ctx, v, h, t);
        break;
    }
  }, [onShowScores]);

  return <TaterCanvas onFrame={onFrame} onTap={onTap} onRelease={onRelease} running={!paused} />;
}

function inside(x: number, y: number, r: { x: number; y: number; w: number; h: number }) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** Every sprite and tile: small, and all of it can turn up within a lap. */
const PLAY_ART = (Object.keys(ART) as ArtName[]).filter(
  // Cutscenes load a slide at a time; the last three belong to the mid-climb
  // Allie scene, which was retired once every world ended in a showdown.
  (n) => !n.startsWith("cutscene-") && n !== "allie-help" && n !== "tater-grab" && n !== "elmer-react"
);

function startPlay(v: View) {
  v.screen = "play";
  prefetch(PLAY_ART);
  const floor = v.g.byRow.get(0)?.[0];
  if (floor && !v.practice) {
    v.bubble = { text: GUILLERMO_LINE, x: floor.x + floor.w - 30, y: floor.y - 44, t: 0, life: 2.6 };
  }
  if (v.practice) v.banner = { text: "PRACTICE", sub: "NEAR THE TOP", t: 0 };
  else v.banner = { header: `STAGE 1`, text: `${ZONES[0].title}!!!`, sub: "HOW HIGH CAN YOU GO?", t: 0, big: true };
}

function finish(v: View, onGameOver: ArcadeGameProps["onGameOver"]) {
  if (v.finished || v.demo) return;
  v.finished = true;
  if (v.practice) {
    onGameOver(0, { practice: true });
    return;
  }
  onGameOver(score(v.g), {
    lap: v.g.lap,
    rows: v.g.maxRow,
    world: zoneForRow(v.g.maxRow).title,
    blasts: v.g.blasts,
    bonus: v.g.bonus,
    banked: v.g.banked,
    seed: v.g.seed,
  });
}

// ─── Attract mode ────────────────────────────────────────────────────────────

function driveDemo(v: View, dt: number) {
  v.demoHold += dt;

  if (v.screen === "title") {
    if (v.demoHold > 2.6) { v.screen = "story"; v.slide = 0; v.demoHold = 0; }
    return;
  }
  if (v.screen === "story") {
    if (v.demoHold > DEMO_SLIDE_HOLD) {
      v.demoHold = 0;
      v.slide++;
      if (v.slide >= 4) startPlay(v);
    }
    return;
  }
  if (v.screen === "flat") {
    if (v.demoHold > 2.4) { Object.assign(v, makeView(true)); startPlay(v); }
    return;
  }
  if (v.screen !== "play" || v.scene) return;

  const g = v.g;
  if (g.phase === "aim") {
    if (!v.demoWant) v.demoWant = bestShot(g) ?? { angle: 0, power: 0.85 };
    if (Math.abs(g.angle - v.demoWant.angle) < 0.05 || g.t > 5) press(g);
  } else if (g.phase === "power") {
    if (Math.abs(g.power - (v.demoWant?.power ?? 0.85)) < 0.03 || g.t > 2) release(g);
  } else {
    v.demoWant = null;
  }
}

// ─── Update ──────────────────────────────────────────────────────────────────

/**
 * The camera on the bottom shelf. Lower than the climbing anchor, so the
 * floor sits near the bottom of the screen instead of a third of it being
 * spent on nothing underneath it.
 */
function groundCam(h: number) {
  return -h * 0.86;
}

function update(v: View, dt: number, h: number) {
  const g = v.g;

  if (v.scene) advanceScene(v, dt, h);
  else if (v.screen === "play") step(g, dt);

  for (const e of drainEvents(g)) handle(v, e, h);

  // ── Camera ───────────────────────────────────────────────────────────────
  const beatNow = v.scene?.beats[v.scene.beat]?.id;
  const fallBeat = beatNow === "fall";
  if (beatNow === "gate" && v.scene) {
    // Look up past Tater's shelf into the world beyond it.
    const want = v.scene.y - h * 0.92;
    v.cam += (want - v.cam) * Math.min(1, 2.2 * dt);
  } else if (fallBeat && v.scene) {
    // Racing back down the shaft to the bottom shelf.
    const s = v.scene;
    const beat = s.beats[s.beat];
    const k = Math.min(1, s.t / beat.hold);
    const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    v.cam = s.camFrom + (groundCam(h) - s.camFrom) * ease;
  } else {
    const want = Math.min(g.elmer.y - h * CAMERA_ANCHOR, groundCam(h));
    if (!v.camReady) { v.cam = want; v.camReady = true; }
    else v.cam += (want - v.cam) * Math.min(1, CAMERA_LERP * dt);
  }

  // ── Which animation ──────────────────────────────────────────────────────
  const next = animFor(g, v);
  if (next !== v.anim) { v.anim = next; v.animT = 0; }
  v.animT += dt;

  for (const f of v.floats) { f.t += dt; f.y -= dt * 22; }
  v.floats = v.floats.filter((f) => f.t < FLOAT_LIFE);
  for (const th of v.thanks) th.t += dt;
  v.thanks = v.thanks.filter((th) => th.t < 0.9);
  if (v.bubble) { v.bubble.t += dt; if (v.bubble.t > v.bubble.life) v.bubble = null; }
  if (v.banner) {
    v.banner.t += dt;
    if (v.banner.t > (v.banner.big ? ZONE_BANNER_LIFE : BANNER_LIFE)) v.banner = null;
  }
  for (const b of v.bursts) { b.t += dt; b.vy += 500 * dt; b.x += b.vx * dt; b.y += b.vy * dt; }
  v.bursts = v.bursts.filter((b) => b.t < 1.2);
  for (const c of v.crumbles) { c.t += dt; if (c.t > 0) { c.vy += 700 * dt; c.y += c.vy * dt; } }
  v.crumbles = v.crumbles.filter((c) => c.t < 1.6);
  v.shake = Math.max(0, v.shake - dt);

  if (g.over && v.screen === "play" && !v.scene) { v.screen = "flat"; v.demoHold = 0; }
}

function animFor(g: TaterState, v: View): ElmerAnim {
  const thudding = v.anim === "thud" && v.animT < 0.5;
  if (v.scene?.kind === "finale" || v.scene?.kind === "showdown") return "shake";
  switch (g.phase) {
    case "aim":
    case "power": return thudding ? "thud" : "shake";
    case "charge": return "blast";
    case "flight": return g.dropTo !== null || g.elmer.vy >= 140 ? "fall" : "fly";
    case "slide": return "land";
    case "settle":
      if (v.anim === "fall" || v.anim === "thud") return "thud";
      return v.anim === "land" ? "land" : "shake";
    case "over": return "thud";
    default: return v.anim === "thud" && !thudding ? "shake" : v.anim;
  }
}

function handle(v: View, e: TaterEvent, h: number) {
  const g = v.g;
  switch (e.kind) {
    case "pickup":
      v.floats.push({ text: "+250", x: e.x, y: e.y - 14, t: 0, color: T.cyan });
      v.floats.push({ text: "FIZZ +3", x: e.x, y: e.y - 24, t: 0, color: T.hot });
      break;
    case "match": {
      const line = THANK_YOU[Math.floor(Math.random() * THANK_YOU.length)];
      v.thanks.push({ id: e.id, x: e.x, y: e.y, t: 0 });
      v.bubble = { text: line, x: e.x, y: e.y - 40, t: 0, life: 1.8 };
      v.floats.push({ text: "+1000", x: e.x, y: e.y - 16, t: 0, color: T.brass });
      break;
    }
    case "zone":
      v.banner = zoneBanner(e.index);
      break;
    case "vanish": {
      // Block by block, falling away behind him.
      const art = zoneForRow(e.row).art;
      for (let bx = 0; bx < e.w; bx += 16) {
        v.crumbles.push({ x: e.x + bx, y: e.y, vy: -20 - hash(bx, e.row) * 60, t: -hash(e.row, bx) * 0.25, art, frame: bx === 0 ? 0 : 1 });
      }
      v.floats.push({ text: "NO WAY BACK!", x: W / 2, y: e.y - 8, t: 0, color: T.hot });
      break;
    }
    case "explode": {
      // Soda everywhere.
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2 + hash(i, g.explosions) * 0.4;
        const sp = 60 + hash(g.explosions, i) * 140;
        v.bursts.push({
          x: e.x, y: e.y - 18, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, t: 0,
          color: i % 3 === 0 ? T.white : i % 3 === 1 ? "#6E3A08" : "#C07A32",
        });
      }
      v.shake = 0.45;
      v.floats.push({ text: "KA-BLOOEY!", x: e.x, y: e.y - 44, t: 0, color: T.hot });
      v.floats.push({ text: `DOWN ${e.rows}`, x: e.x, y: e.y - 32, t: 0, color: T.white });
      break;
    }
    case "showdown": {
      v.scene = makeScene("showdown", showdownBeats(e.zone, e.lap), SUMMIT_TATER_X, e.y, g);
      v.scene.zone = e.zone;
      v.floats.push({ text: `+${e.bonus}`, x: SUMMIT_ELMER_X, y: e.y - 50, t: 0, color: T.brass });
      openBeat(v);
      break;
    }
    case "summit": {
      v.scene = makeScene("finale", finaleBeats(e.lap, e.bottle), SUMMIT_TATER_X, e.y, g);
      v.scene.lap = e.lap;
      v.scene.bottle = e.bottle;
      v.scene.bonus = e.bonus;
      v.floats.push({ text: `+${e.bonus}`, x: SUMMIT_ELMER_X, y: e.y - 50, t: 0, color: T.brass });
      openBeat(v);
      void h;
      break;
    }
  }
}

/** The big YOU REACHED banner for world `index`. */
function zoneBanner(index: number): NonNullable<View["banner"]> {
  const z = index < ZONES.length ? ZONES[index] : SUMMIT_ZONE;
  return {
    header: "YOU REACHED", text: `${z.title}!!!`,
    sub: `STAGE ${index + 1}   +${SCORE_NEW_ZONE}   +${FIZZ_PER_ZONE} FIZZ`, t: 0, big: true,
  };
}

function makeScene(kind: Scene["kind"], beats: Beat[], x: number, y: number, g: TaterState): Scene {
  return {
    kind, beats, beat: 0, t: 0, x, y, lap: g.lap, bottle: null, bonus: 0, zone: 0,
    elmerFrom: g.elmer.x, camFrom: 0,
  };
}

/** Put up the line for the beat that is starting, and do its one-off work. */
function openBeat(v: View) {
  const s = v.scene;
  if (!s) return;
  const beat = s.beats[s.beat];
  if (!beat) return;
  s.t = 0;

  if (beat.id === "fall") s.camFrom = v.cam;
  if (beat.id === "gate") v.banner = zoneBanner(s.zone + 1);
  if (beat.id === "landed") {
    // The shaft behind us is thrown away and a harder one built.
    nextLap(v.g);
    v.camReady = false;
    v.banner = { text: `LAP ${v.g.lap}`, sub: "IT GETS HARDER", t: 0 };
  }
  if (beat.id === "freed" && s.bottle) {
    v.floats.push({ text: "SET FREE!", x: SUMMIT_CABINET_X - 20, y: s.y - 50, t: 0, color: T.good });
  }

  if (!beat.line) { v.bubble = null; return; }
  const { x, y } = speakerSpot(v, beat.id);
  v.bubble = { text: beat.line, x, y, t: 0, life: Infinity };
}

/** Where a beat's speech bubble points, in world coordinates. */
function speakerSpot(v: View, id: BeatId): { x: number; y: number } {
  const s = v.scene!;
  switch (id) {
    case "taunt":
    case "hit":
    case "escape":
    case "soaked": return { x: SUMMIT_TATER_X, y: s.y - 82 };
    case "freed": return { x: SUMMIT_CABINET_X, y: s.y - 44 };
    case "landed": {
      const floor = v.g.byRow.get(0)?.[0];
      return { x: floor ? floor.x + floor.w - 56 : W - 60, y: -46 };
    }
    default: return { x: s.x, y: s.y - 40 };
  }
}

function advanceScene(v: View, dt: number, h: number) {
  const s = v.scene;
  if (!s) return;
  s.t += dt;
  const beat = s.beats[s.beat];
  if (!beat) return;

  // Walk Elmer to his mark on the summit while Tater talks.
  if (beat.id === "taunt") {
    const k = Math.min(1, s.t / 0.8);
    v.g.elmer.x = s.elmerFrom + (SUMMIT_ELMER_X - s.elmerFrom) * k;
    v.g.elmer.facing = 1;
  }

  if (s.t >= beat.hold) nextBeat(v, h);
}

function skipBeat(v: View) {
  const s = v.scene;
  if (!s) return;
  // A beat has to have been on screen a moment, or a double tap skips two.
  if (s.t < 0.25) return;
  nextBeat(v, 0);
}

function nextBeat(v: View, h: number) {
  const s = v.scene;
  if (!s) return;
  s.beat++;
  if (s.beat >= s.beats.length) {
    v.scene = null;
    v.bubble = null;
    endScene(v.g);
    return;
  }
  openBeat(v);
  void h;
}

// ─── Drawing the climb ───────────────────────────────────────────────────────

function drawPlay(ctx: CanvasRenderingContext2D, v: View, h: number, t: number) {
  const g = v.g;
  // Camera on the device grid, so tiles and sprites never shimmer against it.
  const cam = Math.round(v.cam * PIXEL_SCALE) / PIXEL_SCALE;

  ctx.save();
  if (v.shake > 0) {
    const k = v.shake * 8;
    ctx.translate(Math.round(Math.sin(t * 90) * k), Math.round(Math.cos(t * 70) * k * 0.6));
  }
  drawStage(ctx, v, cam, h);

  ctx.save();
  ctx.translate(WALL_W, 0);

  // ── Shelves ──────────────────────────────────────────────────────────────
  const rowLo = Math.floor(-(cam + h) / ROW_GAP) - 1;
  const rowHi = Math.ceil(-cam / ROW_GAP) + 1;
  const shelves = rowsFor(g, rowLo, rowHi);
  for (const p of shelves) {
    const sy = p.y - cam;
    if (sy < -40 || sy > h + BLOCK_H) continue;
    drawPlatformTiles(ctx, zoneForRow(p.row).art, p.x, sy, p.w, p.id);
  }
  // Items after every shelf, so a tall one is never cut by the shelf above.
  for (const p of shelves) {
    const sy = p.y - cam;
    if (sy < -120 || sy > h + 40) continue;
    if (p.item) drawItem(ctx, v, p.item, p.x, p.w, sy, t);
  }

  // ── Elmer ────────────────────────────────────────────────────────────────
  const ex = g.elmer.x;
  const ey = g.elmer.y - cam;
  if (!sceneDrawsElmer(v)) drawElmer(ctx, v, ex, ey);

  // ── The two controls ─────────────────────────────────────────────────────
  if (!v.scene && g.phase === "aim") {
    drawArrow(ctx, ex, ey - ELMER_H - 2, g.angle);
    hint(ctx, h, "PRESS AND HOLD TO SHAKE");
  } else if (!v.scene && g.phase === "power") {
    drawArrow(ctx, ex, ey - ELMER_H - 2, g.lockedAngle, 0.45);
    const gs = gaugeSize();
    // On the last fill before it blows: the gauge rattles and flashes.
    const danger = holdCycles(g) >= OVERSHAKE_CYCLES - 1;
    const jitter = danger ? Math.round(Math.sin(t * 60) * 1.5) : 0;
    const gx = (ex > W / 2 ? ex - 26 - gs.w : ex + 22) + jitter;
    const gy = Math.max(HUD_H + 4, ey - gs.h - 6);
    const x = Math.max(2, Math.min(W - gs.w - 2, gx));
    drawGauge(ctx, x, gy, g.power, t);
    if (danger && Math.floor(t * 8) % 2 === 0) {
      fill(ctx, x - 1, gy - 1, gs.w + 2, gs.h + 2, "rgba(240,58,46,0.35)");
    }
    if (danger) {
      ctx.save();
      ctx.globalAlpha = Math.floor(t * 6) % 2 === 0 ? 1 : 0.4;
      drawTextMarquee(ctx, "LET GO!", x + gs.w / 2, gy - 12, T.hot, 1, "center");
      ctx.restore();
    }
    hint(ctx, h, "LET GO TO BLAST");
  }

  for (const b of v.bursts) fill(ctx, b.x - 1, b.y - cam - 1, 3, 3, b.color);
  for (const c of v.crumbles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, 1.4 - c.t));
    drawPlatformTiles(ctx, c.art, c.x, c.y - cam, 16, c.frame);
    ctx.restore();
  }

  if (v.scene) drawScene(ctx, v, cam, h, t);

  for (const th of v.thanks) {
    drawArt(ctx, `thanks-${th.id}` as ArtName, 1 + Math.floor(th.t * 6.5), th.x, th.y - cam);
  }

  for (const f of v.floats) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - f.t / FLOAT_LIFE);
    drawTextMarquee(ctx, f.text, f.x, f.y - cam, f.color, 1, "center");
    ctx.restore();
  }
  if (v.bubble) drawBubble(ctx, v.bubble.text, v.bubble.x, v.bubble.y - cam, h);
  ctx.restore();

  ctx.restore();

  drawHud(ctx, v);
  if (v.banner?.big) drawZoneBanner(ctx, v.banner.header ?? "YOU REACHED", v.banner.text, v.banner.sub, h, v.banner.t);
  else if (v.banner) drawBanner(ctx, v.banner.text, v.banner.sub, h, v.banner.t);
}

/**
 * Background colour bands, scattered decorations and the two walls — the
 * Ice Climbers layout. Zones cut hard at the line halfway between two rows.
 */
function drawStage(ctx: CanvasRenderingContext2D, v: View, cam: number, h: number) {
  const topWorld = cam;
  const botWorld = cam + h;

  // ── Background bands ─────────────────────────────────────────────────────
  const rowAt = (y: number) => Math.round(-y / ROW_GAP);
  let y = botWorld;
  while (y > topWorld) {
    const row = Math.max(0, rowAt(y));
    const z = zoneForRow(row);
    const bandTop = row >= SUMMIT_ROW ? -Infinity : -(z.toRow + 1) * ROW_GAP + ROW_GAP / 2;
    const top = Math.max(topWorld, bandTop);
    fill(ctx, 0, top - cam, VIEW_W, y - top + 1, z.bg);
    y = top - 0.01;
    if (bandTop === -Infinity) break;
  }

  // ── Under the bottom shelf: more shelf, so the floor is not floating ─────
  if (botWorld > 0) {
    for (let yy = BLOCK_H + 2; yy < botWorld + BLOCK_H; yy += BLOCK_H * 2) {
      drawPlatformTiles(ctx, "shelf", WALL_W, yy - cam, W, Math.floor(yy));
    }
  }

  // ── Decorations, between rows ────────────────────────────────────────────
  const rLo = Math.max(1, Math.floor(-botWorld / ROW_GAP));
  const rHi = Math.min(SUMMIT_ROW - 1, Math.ceil(-topWorld / ROW_GAP) + 1);
  for (let r = rLo; r <= rHi; r++) {
    const roll = hash(r, v.g.lap * 31 + 7);
    if (roll > 0.45) continue;
    const art = zoneForRow(r).art;
    const name = `tile-${art}-${roll < 0.22 ? "deco1" : "deco2"}` as ArtName;
    const dx = WALL_W + 12 + hash(r, 99) * (W - 24);
    drawArt(ctx, name, 0, dx, -r * ROW_GAP + ROW_GAP * 0.55 - cam, { alpha: 0.55, scale: 2 });
  }

  // ── Walls ────────────────────────────────────────────────────────────────
  const k0 = Math.floor(topWorld / WALL_TILE_H) - 1;
  const k1 = Math.ceil(botWorld / WALL_TILE_H) + 1;
  for (let k = k0; k <= k1; k++) {
    const wy = k * WALL_TILE_H;
    const row = Math.max(0, rowAt(wy + WALL_TILE_H / 2));
    const art: ZoneArt = zoneForRow(row).art;
    const sy = wy - cam;
    // A sign on the tile that holds a numbered row's surface.
    const signRow = Math.round(-(wy + WALL_TILE_H) / ROW_GAP);
    const signed = signRow > 0 && signRow % SIGN_EVERY === 0 && signRow < SUMMIT_ROW &&
      Math.abs(-signRow * ROW_GAP - (wy + WALL_TILE_H)) < WALL_TILE_H / 2 + 0.01;
    const frame = signed ? 2 : hash(k, 5) > 0.72 ? 1 : 0;
    drawWallTile(ctx, art, frame, 0, sy, false);
    drawWallTile(ctx, art, frame, VIEW_W - WALL_W, sy, true);
    if (signed) {
      const label = String(signRow);
      drawText(ctx, label, WALL_W / 2, sy + WALL_TILE_H / 2 - 3, T.brass, 1, "center");
      drawText(ctx, label, VIEW_W - WALL_W / 2, sy + WALL_TILE_H / 2 - 3, T.brass, 1, "center");
    }
  }
}

/** Whatever is standing on a shelf. */
function drawItem(
  ctx: CanvasRenderingContext2D, v: View, item: Item, x: number, w: number, sy: number, t: number
) {
  const cx = x + w / 2;
  switch (item.kind) {
    case "mixer":
      drawArt(ctx, `mixer-${item.id}` as ArtName, Math.floor(t * 3 + x), cx, sy, { flip: (x | 0) % 2 === 0 });
      break;
    case "bottle":
      // Dusty and sad until somebody brings a mixer.
      drawArt(ctx, `thanks-${item.id}` as ArtName, 0, cx, sy);
      break;
    case "guillermo": {
      const gx = x + w - 30;
      drawArt(ctx, "guillermo-luck", Math.floor(t * 5), gx, sy);
      // After the rescue Allie waits down here, cheering him on.
      if (v.g.lap >= 2) drawArt(ctx, "allie-cheer", Math.floor(t * 5), gx - 30, sy);
      break;
    }
    case "tater":
      // Waiting at the top of this world.
      drawArt(ctx, v.g.lap >= 2 ? "tater-summit-solo" : "tater-summit", Math.floor(t * 4), SUMMIT_TATER_X, sy);
      break;
    case "summit": {
      drawArt(ctx, "tile-summit-deco1", 0, SUMMIT_CABINET_X, sy, { scale: 3 });
      // From lap two, the rare bottle waiting in front of his cabinet.
      const bottle = summitBottleFor(v.g.lap);
      const beatId = v.scene?.kind === "finale" ? v.scene.beats[v.scene.beat]?.id : undefined;
      const freedYet = beatId === "freed" || beatId === "fall" || beatId === "landed";
      if (bottle && !freedYet) drawArt(ctx, `thanks-${bottle}` as ArtName, 0, SUMMIT_CABINET_X, sy - 6);
      if (!v.scene || v.scene.kind !== "finale") {
        const solo = v.g.lap >= 2;
        drawArt(ctx, solo ? "tater-summit-solo" : "tater-summit", Math.floor(t * 4), SUMMIT_TATER_X, sy);
      }
      break;
    }
  }
}

function sceneDrawsElmer(v: View): boolean {
  const id = v.scene?.beats[v.scene.beat]?.id;
  return id === "spray" || id === "hit" || id === "together" || id === "fall" ||
    (id === "soaked" || id === "freed");
}

function drawElmer(ctx: CanvasRenderingContext2D, v: View, x: number, y: number) {
  const g = v.g;
  const at = v.animT;
  const flip = g.elmer.facing === -1;
  switch (v.anim) {
    case "shake":
      drawArt(ctx, "elmer-shake", at * 10, x, y);
      break;
    case "blast":
      drawArt(ctx, "elmer-blast", Math.min(5, at * 14), x, y, { flip });
      break;
    case "fly": {
      // Three drawn angles, mirrored for the left: pixel art is never rotated.
      const a = Math.atan2(Math.abs(g.elmer.vx), -g.elmer.vy);
      const name: ArtName = a < 0.4 ? "elmer-fly-up" : a < 1.15 ? "elmer-fly-diag" : "elmer-fly-side";
      drawArt(ctx, name, at * 10, x, y - ELMER_H / 2, { flip: g.elmer.vx < -1 });
      break;
    }
    case "fall":
      drawArt(ctx, "elmer-fall", at * 10, x, y - ELMER_H / 2, { flip });
      break;
    case "land":
      drawArt(ctx, "elmer-land", Math.min(5, at * 12), x, y, { flip });
      break;
    case "thud":
      drawArt(ctx, "elmer-thud", Math.min(5, at * 12), x, y);
      break;
  }
}

function drawScene(ctx: CanvasRenderingContext2D, v: View, cam: number, h: number, t: number) {
  const s = v.scene!;
  const beat = s.beats[s.beat];
  if (!beat) return;
  const k = Math.min(1, s.t / beat.hold);
  const sy = s.y - cam;

  const solo = s.lap >= 2;
  const ex = SUMMIT_ELMER_X;

  // ── A world's showdown ───────────────────────────────────────────────────
  if (s.kind === "showdown") {
    switch (beat.id) {
      case "arrive": {
        drawArt(ctx, solo ? "tater-summit-solo" : "tater-summit", Math.floor(s.t * 4), SUMMIT_TATER_X, sy);
        const next = ZONES[Math.min(ZONES.length - 1, s.zone + 1)];
        const top = Math.round(h * 0.26);
        ctx.save();
        ctx.globalAlpha = Math.min(1, s.t * 5);
        fill(ctx, -WALL_W, top - 8, VIEW_W, 64, "rgba(0,0,0,0.78)");
        fill(ctx, -WALL_W, top - 8, VIEW_W, 2, T.hot);
        fill(ctx, -WALL_W, top + 54, VIEW_W, 2, T.hot);
        drawTextMarquee(ctx, "MR. TATER!", W / 2, top, Math.floor(s.t * 8) % 2 ? T.hot : T.white, 3, "center");
        drawText(ctx, "STANDS BETWEEN YOU AND", W / 2, top + 30, T.bone, 1, "center");
        drawTextMarquee(ctx, next.title, W / 2, top + 42, T.brass, 1, "center");
        ctx.restore();
        break;
      }
      case "gate":
        break;
      case "taunt":
        drawArt(ctx, solo ? "tater-summit-solo" : "tater-summit", Math.floor(s.t * 4), SUMMIT_TATER_X, sy);
        break;
      case "spray": {
        drawArt(ctx, solo ? "tater-summit-solo" : "tater-summit", 1, SUMMIT_TATER_X, sy);
        const f = Math.min(5, s.t * 6);
        drawArt(ctx, "elmer-spray", f, ex, sy);
        if (f >= 3) sodaJet(ctx, ex + 20, SUMMIT_TATER_X - 18, sy - 20, t);
        break;
      }
      case "hit":
        // Only the first three frames: soaked and flailing, but still standing.
        drawArt(ctx, solo ? "tater-soaked-solo" : "tater-soaked", Math.min(2, k * 4), SUMMIT_TATER_X, sy);
        drawArt(ctx, "elmer-spray", 5, ex, sy);
        if (k < 0.35) sodaJet(ctx, ex + 20, SUMMIT_TATER_X - 18, sy - 20, t);
        break;
      case "escape": {
        const rise = k > 0.25 ? ((k - 0.25) / 0.75) * (h + 100) : 0;
        if (solo) drawArt(ctx, "tater-land", 0, SUMMIT_TATER_X, sy - rise);
        else drawArt(ctx, "tater-leap", Math.min(5, k * 7), SUMMIT_TATER_X, sy - rise);
        break;
      }
    }
    drawTapHint(ctx, "TAP TO SKIP", h, t);
    return;
  }

  // ── The finale ───────────────────────────────────────────────────────────
  switch (beat.id) {
    case "taunt":
      drawArt(ctx, solo ? "tater-summit-solo" : "tater-summit", Math.floor(s.t * 4), SUMMIT_TATER_X, sy);
      break;
    case "spray": {
      drawArt(ctx, solo ? "tater-summit-solo" : "tater-summit", 1, SUMMIT_TATER_X, sy);
      const f = Math.min(5, s.t * 6);
      drawArt(ctx, "elmer-spray", f, ex, sy);
      if (f >= 3) sodaJet(ctx, ex + 20, SUMMIT_TATER_X - 18, sy - 20, t);
      break;
    }
    case "soaked":
      drawArt(ctx, solo ? "tater-soaked-solo" : "tater-soaked", Math.min(5, k * 6.5), SUMMIT_TATER_X, sy);
      drawArt(ctx, "elmer-spray", 5, ex, sy);
      if (k < 0.4) sodaJet(ctx, ex + 20, SUMMIT_TATER_X - 18, sy - 20, t);
      break;
    case "together":
      drawArt(ctx, "duo-jump", 0, W * 0.34, sy);
      break;
    case "freed":
      if (s.bottle) drawArt(ctx, `thanks-${s.bottle}` as ArtName, 1 + Math.min(4, k * 5), SUMMIT_CABINET_X, sy - 6);
      drawArt(ctx, "elmer-jump", 5, ex, sy);
      break;
    case "fall": {
      const name: ArtName = solo ? "elmer-jump" : "duo-jump";
      const f = s.t < 0.3 ? 1 : 2 + (Math.floor(s.t * 8) % 2);
      const landY = -cam; // the bottom shelf, on screen
      const midY = h * 0.45;
      const drop = k < 0.75 ? midY : midY + (landY - midY) * ((k - 0.75) / 0.25);
      drawArt(ctx, name, f, W * 0.34, Math.min(drop, landY));
      break;
    }
    case "landed":
      break;
  }
  if (beat.id === "freed" && s.bottle) {
    // The cabinet bottle's line is the bubble; nothing else to draw.
  }
  if (beat.id !== "landed") drawTapHint(ctx, "TAP TO SKIP", h, t);
  else drawTapHint(ctx, "TAP TO CLIMB AGAIN", h, t);
}

/** A stream of soda and bubbles from Mixey's tab to Tater. */
function sodaJet(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, t: number) {
  for (let x = x0; x < x1; x += 2) {
    const wob = Math.round(Math.sin(x * 0.6 + t * 30) * 1.2);
    fill(ctx, x, y + wob, 2, 2, "#6E3A08");
    if (((x * 7 + Math.floor(t * 20)) | 0) % 9 === 0) fill(ctx, x, y + wob - 2, 1, 1, T.white);
  }
}

// ─── The readouts ────────────────────────────────────────────────────────────

/**
 * The arcade header: 1UP and score, height, lap, fizz and mixers.
 * All of it left of the pause button GameShell floats in the top-right corner.
 */
function drawHud(ctx: CanvasRenderingContext2D, v: View) {
  const g = v.g;
  fill(ctx, 0, 0, VIEW_W, HUD_H, "#000000");
  fill(ctx, 0, HUD_H - 1, VIEW_W, 1, "#2A2438");

  drawTextMarquee(ctx, "1UP", 6, 4, T.hot, 1, "left");
  drawTextMarquee(ctx, v.practice ? "PRACTICE" : pad(score(g)), 28, 4, T.white, 1, "left");
  drawTextMarquee(ctx, `L=${String(g.lap).padStart(2, "0")}`, 104, 4, T.cyan, 1, "left");
  drawTextMarquee(ctx, `${Math.max(0, Math.round(heightRows(g)))}UP`, 144, 4, T.brass, 1, "left");

  const pips = Math.min(FIZZ_MAX, Math.max(0, g.fizz));
  for (let i = 0; i < FIZZ_MAX; i++) {
    const px = 6 + i * 5;
    fill(ctx, px, 17, 3, 7, i < pips ? (pips <= 3 ? T.hot : T.cola) : "#2A2438");
    if (i < pips) fill(ctx, px, 17, 1, 7, T.colaLit);
  }
  if (g.mixers > 0) {
    const icons: ArtName[] = ["icon-cola", "icon-gingerbeer", "icon-tonic"];
    const shown = Math.min(g.mixers, 6);
    for (let i = 0; i < shown; i++) drawArt(ctx, icons[i % 3], 0, 90 + i * 9, 27);
    if (g.mixers > 6) drawText(ctx, `+${g.mixers - 6}`, 146, 18, T.cyan, 1, "left");
  }
}

function hint(ctx: CanvasRenderingContext2D, h: number, label: string) {
  drawTextShadow(ctx, label, W / 2, h - 16, "rgba(255,255,255,0.7)", 1, "center");
}

function drawTapHint(ctx: CanvasRenderingContext2D, label: string, h: number, t: number) {
  ctx.save();
  ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 4);
  drawTextShadow(ctx, label, W / 2, h - 14, T.white, 1, "center");
  ctx.restore();
}

/** A speech bubble in SHAFT coordinates, wrapped, with a tail. */
function drawBubble(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, h: number) {
  const maxW = W - 24;
  const lines = wrapLines(text, maxW - 10, 1);
  const lh = lineHeight(1);
  const boxW = Math.min(maxW, Math.max(...lines.map((l) => textWidth(l, 1))) + 10);
  const boxH = lines.length * lh + 5;
  const bx = Math.max(2, Math.min(W - boxW - 2, x - boxW / 2));
  const by = Math.max(HUD_H + 4, Math.min(h - boxH - 24, y - boxH));

  fill(ctx, bx, by, boxW, boxH, T.bone);
  keyline(ctx, bx, by, boxW, boxH);
  const tx = Math.max(bx + 3, Math.min(bx + boxW - 7, x - 2));
  if (by + boxH < y + 6) {
    fill(ctx, tx, by + boxH, 4, 2, T.bone);
    fill(ctx, tx + 1, by + boxH + 2, 2, 2, T.bone);
  }
  lines.forEach((line, i) => drawText(ctx, line, bx + boxW / 2, by + 3 + i * lh, T.ink, 1, "center"));
}

/**
 * YOU REACHED MARS!!! — big, flashing, and up for a while. Reaching a new world
 * takes minutes of climbing, so it gets a proper fanfare.
 */
function drawZoneBanner(
  ctx: CanvasRenderingContext2D, header: string, place: string, sub: string, h: number, t: number
) {
  const life = ZONE_BANNER_LIFE;
  const alpha = t < 0.15 ? t / 0.15 : t > life - 0.5 ? (life - t) / 0.5 : 1;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  // The place as big as the screen allows: triple size, double if it will not fit.
  const pop = textWidth(place, 3) <= VIEW_W - 12 ? 3 : 2;
  const words = wrapLines(place, VIEW_W - 12, pop);
  const lh = lineHeight(pop);
  const top = Math.round(h * 0.24);
  const head = lineHeight(2);
  const boxH = head + words.length * lh + 22;
  fill(ctx, 0, top - 8, VIEW_W, boxH, "rgba(0,0,0,0.78)");
  fill(ctx, 0, top - 8, VIEW_W, 2, T.brass);
  fill(ctx, 0, top - 8 + boxH - 2, VIEW_W, 2, T.brass);
  const flash = Math.floor(t * 6) % 2 === 0;
  drawTextMarquee(ctx, header, VIEW_W / 2, top, T.white, 2, "center");
  words.forEach((line, i) => {
    drawTextMarquee(ctx, line, VIEW_W / 2, top + head + i * lh, flash ? T.brass : T.hot, pop, "center");
  });
  drawTextMarquee(ctx, sub, VIEW_W / 2, top + head + words.length * lh + 2, T.good, 1, "center");
  ctx.restore();
}

function drawBanner(ctx: CanvasRenderingContext2D, text: string, sub: string, h: number, t: number) {
  const alpha = t < 0.2 ? t / 0.2 : t > BANNER_LIFE - 0.4 ? (BANNER_LIFE - t) / 0.4 : 1;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  const y = Math.round(h * 0.3);
  fill(ctx, 0, y - 6, VIEW_W, 28, "rgba(0,0,0,0.7)");
  drawTextMarquee(ctx, text, VIEW_W / 2, y, T.brass, 1, "center");
  drawTextMarquee(ctx, sub, VIEW_W / 2, y + 12, T.good, 1, "center");
  ctx.restore();
}

// ─── Title ───────────────────────────────────────────────────────────────────

function pictureRect(h: number) {
  const w = VIEW_W;
  const ph = Math.round(w * 1.5);
  return { x: 0, y: Math.round((h - ph) / 2), w, h: ph };
}

function logoRect(h: number) {
  const { w: lw, h: lh } = frameSize("logo");
  const pic = pictureRect(h);
  return { x: (VIEW_W - lw) / 2, y: Math.max(8, pic.y + 6), w: lw, h: lh };
}

function scoresButton(h: number) {
  return { x: VIEW_W / 2 - 52, y: h - 50, w: 104, h: 22 };
}

function skipButton(h: number) {
  return { x: VIEW_W - 50, y: h - 26, w: 44, h: 20 };
}

function drawTitle(ctx: CanvasRenderingContext2D, v: View, h: number, t: number, scores: boolean) {
  const pic = pictureRect(h);
  drawWhole(ctx, "title", pic.x, pic.y, pic.w, pic.h);
  fill(ctx, 0, 0, VIEW_W, h, "rgba(0,0,0,0.25)");

  const logo = logoRect(h);
  if (!drawWhole(ctx, "logo", logo.x, logo.y, logo.w, logo.h)) {
    drawTextMarquee(ctx, "TATER TALES", VIEW_W / 2, logo.y + 40, T.brass, 2, "center");
  }

  const startY = Math.round(h * 0.52);
  ctx.save();
  ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 3.4);
  fill(ctx, VIEW_W / 2 - 56, startY - 5, 112, 17, "rgba(0,0,0,0.75)");
  drawTextMarquee(ctx, "TAP TO START", VIEW_W / 2, startY, T.white, 1, "center");
  ctx.restore();

  if (v.practice) {
    fill(ctx, 0, startY + 16, VIEW_W, 13, "rgba(0,0,0,0.8)");
    drawText(ctx, "PRACTICE: STARTS NEAR THE TOP, NO SCORE", VIEW_W / 2, startY + 19, T.good, 1, "center");
  }

  if (scores) {
    const b = scoresButton(h);
    fill(ctx, b.x, b.y, b.w, b.h, T.ink);
    keyline(ctx, b.x, b.y, b.w, b.h, T.brass);
    drawText(ctx, "HIGH SCORES", b.x + b.w / 2, b.y + 8, T.brass, 1, "center");
  }
}

// ─── The story ───────────────────────────────────────────────────────────────

function drawStory(ctx: CanvasRenderingContext2D, v: View, h: number, t: number) {
  const slide = SLIDES[Math.min(v.slide, SLIDES.length - 1)];
  const next = SLIDES[v.slide + 1];
  if (next) prefetch([next.art]);

  const text = slide.line ?? slide.caption ?? "";
  const lines = text ? wrapLines(text, VIEW_W - 20, 1) : [];
  const lh = lineHeight(1);
  const speaker = slide.line && slide.speaker ? `${SPEAKER_NAMES[slide.speaker] ?? slide.speaker.toUpperCase()}:` : "";
  const textTop = 34;
  const textH = (speaker ? lh : 0) + lines.length * lh;

  // The picture as large as the width allows, pushed down only if the words
  // above it need the room. Its own top 128 source pixels are black, so words
  // may sit over that band.
  const pic = pictureRect(h);
  const band = Math.round(pic.h * (128 / 1536));
  const y = Math.max(pic.y, textTop + textH + 4 - band);
  drawWhole(ctx, slide.art, 0, y, pic.w, pic.h);

  let ty = textTop;
  if (speaker) { drawTextMarquee(ctx, speaker, 10, ty, T.brass, 1, "left"); ty += lh; }
  for (const line of lines) {
    drawText(ctx, line, VIEW_W / 2, ty, slide.line ? T.bone : T.dim, 1, "center");
    ty += lh;
  }

  drawText(ctx, `${v.slide + 1}/${SLIDES.length}`, 8, h - 20, T.dim, 1, "left");
  drawTapHint(ctx, "TAP", h, t);
  const skip = skipButton(h);
  fill(ctx, skip.x, skip.y, skip.w, skip.h, T.ink);
  keyline(ctx, skip.x, skip.y, skip.w, skip.h, T.dim);
  drawText(ctx, "SKIP", skip.x + skip.w / 2, skip.y + 7, T.dim, 1, "center");
}

const SPEAKER_NAMES: Record<string, string> = {
  elmer: "ELMER",
  allie: "ALLIE",
  tater: "MR. TATER",
  mixey: "MIXEY",
  guillermo: "GUILLERMO",
  johnny: "JOHNNY",
  alistaire: "ALISTAIRE",
  sodey: "SODEY",
};

// ─── How to play ─────────────────────────────────────────────────────────────

function drawHowTo(ctx: CanvasRenderingContext2D, v: View, h: number, t: number) {
  fill(ctx, 0, 0, VIEW_W, h, "#0A0710");
  const page = Math.min(v.howto, HOWTO_PAGES - 1);
  drawTextMarquee(ctx, "HOW TO PLAY", VIEW_W / 2, 34, T.brass, 1, "center");
  drawText(ctx, `${page + 1} / ${HOWTO_PAGES}`, VIEW_W / 2, 48, T.dim, 1, "center");

  const cx = VIEW_W / 2;
  const stageY = Math.round(h * 0.42);
  // A strip of shelf to stand the demonstration on.
  drawPlatformTiles(ctx, "shelf", cx - 56, stageY, 112, 3);
  if (page === 0) {
    drawArt(ctx, "elmer-shake", t * 10, cx, stageY);
    drawArrow(ctx, cx, stageY - ELMER_H - 2, Math.sin(t * 2.4) * 1.2);
  } else if (page === 1) {
    drawArt(ctx, "elmer-shake", t * 10, cx - 20, stageY);
    const gs = gaugeSize();
    drawGauge(ctx, cx + 10, stageY - gs.h - 4, (Math.sin(t * 2) + 1) / 2, t);
  } else if (page === 2) {
    drawArt(ctx, "mixer-cola", t * 3, cx - 30, stageY);
    drawText(ctx, "+", cx, stageY - 14, T.bone, 2, "center");
    drawArt(ctx, "thanks-gin", Math.floor(t * 2) % 2 === 0 ? 0 : 3, cx + 30, stageY);
  } else {
    drawArt(ctx, "tater-summit", t * 4, cx, stageY);
  }

  let y = Math.round(h * 0.55);
  for (const para of HOWTO_COPY[page]) {
    for (const line of wrapLines(para, VIEW_W - 32, 1)) {
      drawText(ctx, line, VIEW_W / 2, y, T.bone, 1, "center");
      y += lineHeight(1);
    }
    y += PARAGRAPH_GAP;
  }

  drawTapHint(ctx, page === HOWTO_PAGES - 1 ? "TAP TO CLIMB" : "TAP", h, t);
}

// ─── The end of a run ────────────────────────────────────────────────────────

function drawFlat(ctx: CanvasRenderingContext2D, v: View, h: number, t: number) {
  fill(ctx, 0, 0, VIEW_W, h, "rgba(8,6,14,0.75)");
  const y = Math.round(h * 0.32);
  const cx = VIEW_W / 2;
  drawTextMarquee(ctx, FLAT_LINE, cx, y, T.hot, 2, "center");
  drawText(ctx, "OUT OF CARBONATION", cx, y + 26, T.dim, 1, "center");
  drawTextMarquee(ctx, `LAP ${v.g.lap}  -  ${v.g.maxRow} ${v.g.maxRow === 1 ? "SHELF" : "SHELVES"} UP`,
    cx, y + 48, T.brass, 1, "center");
  drawText(ctx, zoneForRow(v.g.maxRow).title, cx, y + 62, T.bone, 1, "center");
  drawTextMarquee(ctx, v.practice ? "PRACTICE" : pad(score(v.g)), cx, y + 80, T.white, 2, "center");
  drawTapHint(ctx, "TAP TO FINISH", h, t);
}
