"use client";

// ─── Attract mode ────────────────────────────────────────────────────────────
//
// What a cabinet showed while nobody was playing: the game playing itself,
// looping until someone put a coin in.
//
// This wrapper is deliberately thin. Everything game-specific — how to play it,
// how well, when to give up — lives inside the game, next to the rules it is
// playing against. A central bot would need to know every game's internals and
// would rot the moment a game changed.
//
// TO GIVE A NEW GAME A DEMO: honour the `demo` prop in ArcadeGameProps (drive
// the state from a bot, hide the controls, restart instead of reporting a
// score). Nothing in this file needs to change.

import { useEffect, useRef, useState } from "react";
import { getGameMeta } from "@/lib/popup/games";
import { getGameComponent } from "../games/registry";
import { GAME_H, GAME_W } from "../games/arcade";
import * as SHOTS from "../games/shots/constants";
import * as TIKI from "../games/tiki/constants";
import * as STICK from "../games/stick/constants";
import { withAlpha, C } from "./theme";

/**
 * Width ÷ height of each game's own screen, so a demo window is the shape the
 * game draws for and nothing is squashed.
 *
 * The string-art games are a fixed 224×288. The full-bleed games pick their
 * height from the box they're given but only within a range (H_MIN..H_MAX), so
 * a box shorter than that range stretches them — they get their reference
 * shape here instead.
 *
 * TO ADD A FULL-BLEED GAME: add its W / H_REF below. A game left off gets the
 * 224×288 shape.
 */
const DEMO_ASPECT: Record<string, number> = {
  "tiki-wars": TIKI.W / TIKI.H_REF,
  "lets-do-shots": SHOTS.W / SHOTS.H_REF,
  "behind-the-stick": STICK.W_REF / STICK.H,
};

/**
 * Sideways games show several demos stacked, so the slide is about as tall
 * as the portrait games' instead of a thin letterbox. Each copy plays its own
 * run, started at a different point, so the stack shows different parts of
 * the game at once.
 */
const DEMO_STACK: Record<string, number> = {
  "behind-the-stick": 3,
};

function stackOf(gameKey: string | undefined): number {
  return (gameKey && DEMO_STACK[gameKey]) || 1;
}

export function demoAspect(gameKey: string | undefined): number {
  return ((gameKey && DEMO_ASPECT[gameKey]) || GAME_W / GAME_H) / stackOf(gameKey);
}

export default function GameDemo({
  gameKey,
  running,
}: {
  gameKey?: string;
  /** False for every off-centre carousel slide. */
  running: boolean;
}) {
  const meta = getGameMeta(gameKey);
  const Game = gameKey ? getGameComponent(gameKey) : null;
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [onScreen, setOnScreen] = useState(false);

  /**
   * Two conditions, both required, for different reasons.
   *
   * `running` is the carousel's: only the centre slide gets to animate, because
   * a row of canvases at 60fps is the fastest way to make a phone hot.
   *
   * `onScreen` is the page's: a carousel keeps every slide mounted, so a
   * fourteen-cocktail pop-up scrolled past would leave demos running below the
   * fold. Mounting on visibility rather than passing a paused flag means an
   * off-screen demo isn't merely idle — its animation frame is cancelled and
   * its state is gone, so it starts fresh rather than resuming mid-fumble.
   */
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting && entry.intersectionRatio > 0.3),
      { threshold: [0, 0.3, 0.7] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const live = running && onScreen && !!Game;
  const aspectRatio = String(demoAspect(gameKey));

  return (
    <div ref={boxRef} className="relative w-full">
      {live ? (
        // Pointer events off: a demo that reacts to a tap looks like a game
        // that has stopped responding. Taps belong to the carousel underneath,
        // and to the Play button that starts the real thing.
        // The aspect box gives the game a definite height to fill. Without one,
        // its percentage heights resolve to auto and the screen collapses to
        // its intrinsic 224px.
        <div
          className="pointer-events-none w-full grid gap-[3px] bg-black"
          style={{ aspectRatio, gridTemplateRows: `repeat(${stackOf(gameKey)}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: stackOf(gameKey) }, (_, i) => (
            <div key={i} className="relative min-h-0">
              <Game onGameOver={() => {}} demo />
            </div>
          ))}
        </div>
      ) : (
        // A still frame, so a slide never flashes empty as it scrolls in.
        <div
          className="w-full flex flex-col items-center justify-center gap-2 px-6 text-center"
          style={{ background: "#05030F", aspectRatio }}
        >
          <p
            className="text-[11px] tracking-[0.25em] uppercase font-black"
            style={{ color: C.gold }}
          >
            {meta?.title ?? "Coming soon"}
          </p>
          {meta?.blurb && (
            <p
              className="text-[10px] leading-relaxed"
              style={{ color: withAlpha(C.cream, 0.55) }}
            >
              {meta.blurb}
            </p>
          )}
        </div>
      )}

      {/* The tag a cabinet showed so nobody thought they were already playing. */}
      {live && (
        <div className="pointer-events-none absolute top-2 left-2 px-2 py-1 bg-black/70 border border-white/25">
          <p className="text-[8px] tracking-[0.28em] uppercase text-white/70">Demo</p>
        </div>
      )}
    </div>
  );
}
