"use client";

// ─── Attract mode ────────────────────────────────────────────────────────────
//
// What a cabinet showed while nobody was playing: the title, the rules, and a
// demo of the game playing itself, cycling until someone put a coin in.
//
// This is the attract CARD half of that — title, blurb, how-to-play, cycling
// one line at a time. The self-playing demo is the other half and is not built
// yet; when it lands it belongs here, alternating with this card, driven by a
// bot stepping the pure cores in behindTheStickCore.ts / topShelfCore.ts and
// rendered through each game's own draw code.
//
// `running` is false for every off-centre carousel slide. Whatever renders here
// must respect it — a row of canvases all animating at once is the fastest way
// to make a phone hot.

import { useEffect, useState } from "react";
import { getGameMeta } from "@/lib/popup/games";
import { withAlpha, C } from "./theme";

export default function GameDemo({
  gameKey,
  running,
}: {
  gameKey?: string;
  running: boolean;
}) {
  const meta = getGameMeta(gameKey);
  const [step, setStep] = useState(0);

  // Cycle the instructions the way an attract screen paged through them.
  useEffect(() => {
    if (!running || !meta) return;
    const id = window.setInterval(() => setStep((s) => s + 1), 2200);
    return () => window.clearInterval(id);
  }, [running, meta]);

  if (!meta) {
    return (
      <Screen>
        <p
          className="text-center text-[11px] tracking-[0.3em] uppercase font-black"
          style={{ color: withAlpha(C.cream, 0.5) }}
        >
          Cabinet under construction
        </p>
        <p
          className="mt-3 text-center text-[10px] leading-relaxed"
          style={{ color: withAlpha(C.cream, 0.35) }}
        >
          This cocktail&apos;s game is still being built.
        </p>
      </Screen>
    );
  }

  const line = meta.howToPlay[step % meta.howToPlay.length];

  return (
    <Screen>
      <p
        className="text-center text-lg sm:text-2xl font-black uppercase tracking-[0.12em] leading-none"
        style={{
          fontFamily: "var(--font-display, system-ui)",
          color: C.teal,
          textShadow: `0 0 12px ${withAlpha(C.teal, 0.6)}, 2px 3px 0 ${C.ink}`,
        }}
      >
        {meta.title}
      </p>

      <p
        className="mt-2 text-center text-[9px] sm:text-[10px] tracking-[0.28em] uppercase"
        style={{ color: withAlpha(C.cream, 0.6) }}
      >
        {meta.blurb}
      </p>

      {/* One rule at a time, so the panel stays short and keeps moving. */}
      <div className="mt-5 h-9 flex items-center justify-center">
        <p
          key={step}
          className="text-center text-[11px] sm:text-xs leading-relaxed px-2"
          style={{ color: C.gold, animation: "cabFade 400ms ease-out" }}
        >
          {line}
        </p>
      </div>

      <p
        className="mt-3 text-center text-[9px] tracking-[0.35em] uppercase"
        style={{ color: withAlpha(C.cream, running ? 0.75 : 0.3) }}
      >
        {running ? "▸ Insert coin" : ""}
      </p>

      <style>{`@keyframes cabFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }`}</style>
    </Screen>
  );
}

/** The inner picture area — a letterboxed 4:3 window, like the tube itself. */
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative w-full aspect-[4/3] flex flex-col items-center justify-center px-4"
      style={{
        borderRadius: "14px",
        background: `radial-gradient(120% 110% at 50% 30%, #120C24 0%, #08061240 60%, transparent 100%)`,
        boxShadow: `inset 0 0 0 1px ${withAlpha(C.teal, 0.14)}`,
      }}
    >
      {children}
    </div>
  );
}
