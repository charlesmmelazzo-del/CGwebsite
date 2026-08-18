"use client";

// ─── The attract screen ──────────────────────────────────────────────────────
//
// What a cabinet showed before anyone put a coin in: the logo, what the machine
// is, and PRESS START.
//
// It exists so the page underneath doesn't have to explain itself. The header,
// the banner and the prize notice all used to sit permanently above the
// cocktails, pushing the actual games down the page. Moving them here means
// everything a first-time visitor needs is said once, up front, and then the
// screen belongs entirely to the games.
//
// Shown on EVERY load, deliberately — not once per session, not behind a
// dismissed flag. It's the front of house.

import Image from "next/image";
import { useEffect, useState } from "react";
import { C, R, lamp, shade, withAlpha } from "./cabinet/theme";
import { INK } from "./cabinet/art/props";

export default function StartScreen({
  subtitle,
  description,
  onStart,
}: {
  subtitle?: string;
  description?: string;
  onStart: () => void;
}) {
  // Any key starts it, as on a cabinet where every button is the start button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStart]);

  // The blink is CSS-free and driven by state, because a keyframe animation on
  // a fixed overlay kept repainting the whole layer on some phones.
  const [lit, setLit] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setLit((v) => !v), 620);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center px-5 py-8 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Press start"
      style={{
        background: `radial-gradient(120% 90% at 50% 20%, ${C.grape} 0%, ${C.grapeDeep} 55%, ${INK.black} 100%)`,
      }}
    >
      {/* Sunburst behind the logo, softened at both ends so the rays fade in. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] aspect-square opacity-[0.18]"
        style={{
          background: `repeating-conic-gradient(from 0deg at 50% 50%, ${withAlpha(C.gold, 0.7)} 0deg 5deg, transparent 5deg 12deg)`,
          maskImage: "radial-gradient(circle at 50% 50%, transparent 8%, black 26%, transparent 68%)",
          WebkitMaskImage:
            "radial-gradient(circle at 50% 50%, transparent 8%, black 26%, transparent 68%)",
          filter: "blur(1.2px)",
        }}
      />

      <div className="relative w-full max-w-2xl flex flex-col items-center text-center">
        {/* The logo carries the whole screen, so it gets the width. */}
        <Image
          src="/popup/art/logo-high-scores.png"
          alt="High Scores"
          width={1672}
          height={941}
          priority
          className="w-full max-w-lg h-auto"
        />

        {subtitle && (
          <p
            className="mt-4 text-[10px] sm:text-xs tracking-[0.42em] uppercase"
            style={{ color: C.teal }}
          >
            {subtitle}
          </p>
        )}

        {description && (
          <p
            className="mt-4 max-w-md text-xs sm:text-sm leading-relaxed"
            style={{ color: withAlpha(C.cream, 0.8) }}
          >
            {description}
          </p>
        )}

        {/* ── Press start ──────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={onStart}
          className="mt-9 px-8 py-5 sm:px-12 sm:py-6 font-black uppercase text-[13px] sm:text-base tracking-[0.2em] active:translate-y-[5px] transition-transform"
          style={{
            borderRadius: R.chip,
            background: lamp(C.gold),
            color: INK.black,
            boxShadow: [
              `inset 0 0 0 3px ${shade(C.gold, 0.5)}`,
              `0 7px 0 ${shade(C.gold, 0.6)}`,
              `0 0 34px ${withAlpha(C.gold, lit ? 0.6 : 0.25)}`,
            ].join(", "),
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Press Start
        </button>

        <p
          className="mt-5 text-[10px] sm:text-[11px] tracking-[0.18em] uppercase"
          style={{ color: lit ? C.cream : withAlpha(C.cream, 0.45) }}
        >
          Press start to see the cocktails and games
        </p>

        {/* ── How it works, said once, here ───────────────────────────── */}
        <div
          className="mt-8 px-5 py-4 max-w-md"
          style={{
            borderRadius: R.panel,
            background: withAlpha(INK.black, 0.5),
            boxShadow: `inset 0 0 0 2px ${withAlpha(C.gold, 0.3)}`,
          }}
        >
          <p
            className="text-[10px] sm:text-[11px] leading-relaxed tracking-[0.06em] uppercase font-bold"
            style={{ color: withAlpha(C.cream, 0.85) }}
          >
            Explore the cocktails. Order one to receive tickets to play its
            corresponding game. Vote for your favorites.
          </p>
          <p
            className="mt-3 text-[10px] sm:text-[11px] leading-relaxed tracking-[0.06em] uppercase font-black"
            style={{ color: C.gold }}
          >
            High score in each game at the end of the pop up wins a $15 gift card
          </p>
        </div>
      </div>
    </div>
  );
}
