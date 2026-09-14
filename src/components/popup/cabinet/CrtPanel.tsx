// ─── CRT panel ───────────────────────────────────────────────────────────────
//
// The page's screen: the owner's pixel cabinet bezel around dark glass.
//
// Distinct from games/CRTScreen.tsx, which wraps the game canvas itself at
// pixel scale. This is the larger monitor the whole slide sits inside, so its
// scanline pitch is bigger — a gap tuned for a 224px canvas is invisible at
// page scale.

import type { ReactNode } from "react";
import { withAlpha, C } from "./theme";
import { BEZEL_INSET, BezelFrame } from "./pixelArt";
import { BartenderArt, GUEST_SWAPS, SpriteArt } from "../CabinetArt";
import { GUEST } from "../CabinetArt";

export default function CrtPanel({
  children,
  glow = C.sky,
  className = "",
  fill = false,
  accents = true,
}: {
  children: ReactNode;
  glow?: string;
  className?: string;
  /** Stretch to the parent's height, glass and all — for the back of a flip card. */
  fill?: boolean;
  /** The little sprites in the top corners. */
  accents?: boolean;
}) {
  return (
    <div
      className={`relative ${fill ? "h-full flex flex-col" : ""} ${className}`}
      style={{ padding: BEZEL_INSET }}
    >
      <BezelFrame glow={glow} />

      <div
        className={`relative overflow-hidden px-3 py-5 sm:px-7 sm:py-8 ${fill ? "flex-1 min-h-0" : ""}`}
        style={{
          // The glass, square-cornered to sit flush in the pixel bezel.
          background: `radial-gradient(130% 110% at 50% 40%, #0E0A1C 0%, #070510 62%, #030208 100%)`,
          boxShadow: `inset 0 0 40px ${withAlpha("#000000", 0.95)}`,
        }}
      >
        {/*
          Pixel accents in the corners of the glass: the game's own sprites,
          small, framing the screen the game plays in.
        */}
        {accents && (
          <>
            <div aria-hidden className="hidden sm:block absolute left-3 top-3 z-[5] opacity-80">
              <BartenderArt px={2} mood="happy" holdingTin={false} />
            </div>
            <div
              aria-hidden
              className="hidden sm:block absolute right-3 top-3 z-[5] opacity-80"
              style={{ transform: "scaleX(-1)" }}
            >
              <SpriteArt sprite={GUEST} colors={GUEST_SWAPS[0]} px={2} />
            </div>
          </>
        )}

        {/*
          The tube effects sit BEHIND the content. Laid over it, the scanlines
          striped every button and shimmered as the carousel slid; the demo
          canvas carries its own scanlines, so the glass loses nothing.
        */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.5) 3px, rgba(0,0,0,0.5) 4px)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background: `radial-gradient(80% 70% at 50% 45%, ${withAlpha(glow, 0.07)} 0%, transparent 70%)`,
          }}
        />

        <div className={`relative z-10 ${fill ? "h-full" : ""}`}>{children}</div>
      </div>
    </div>
  );
}
