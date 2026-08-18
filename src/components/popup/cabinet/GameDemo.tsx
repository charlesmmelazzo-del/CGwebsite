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
import { withAlpha, C } from "./theme";

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

  return (
    <div ref={boxRef} className="relative w-full">
      {live ? (
        // Pointer events off: a demo that reacts to a tap looks like a game
        // that has stopped responding. Taps belong to the carousel underneath,
        // and to the Play button that starts the real thing.
        <div className="pointer-events-none">
          <Game onGameOver={() => {}} demo />
        </div>
      ) : (
        // A still frame, so a slide never flashes empty as it scrolls in.
        <div
          className="aspect-[224/288] w-full flex flex-col items-center justify-center gap-2 px-6 text-center"
          style={{ background: "#05030F" }}
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
