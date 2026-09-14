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
import { C, withAlpha } from "./cabinet/theme";
import CabButton from "./cabinet/CabButton";
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
        {/*
          unoptimized on purpose. Next's optimizer fetches the source image
          from the server side, and that fetch carries no credentials — so on
          the password-gated preview our own middleware 401s it and the
          optimizer answers 400, leaving a broken image. Serving the file
          directly lets the browser fetch it with the session it already has.
          It is one logo; there is nothing to optimise that is worth this.
        */}
        <Image
          src="/popup/art/logo-high-scores.png"
          alt="High Scores"
          width={1672}
          height={941}
          priority
          unoptimized
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
        <div
          className="mt-9 w-full max-w-[320px] transition-[filter] duration-300"
          style={{ filter: `drop-shadow(0 0 ${lit ? 18 : 6}px ${withAlpha(C.gold, lit ? 0.6 : 0.25)})` }}
        >
          <CabButton color={C.gold} size="lg" className="w-full" onClick={onStart}>
            Press Start
          </CabButton>
        </div>
      </div>
    </div>
  );
}
