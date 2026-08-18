// ─── CRT panel ───────────────────────────────────────────────────────────────
//
// The page's screen: a tube behind rounded glass, not a card.
//
// Distinct from games/CRTScreen.tsx, which wraps the game canvas itself at
// pixel scale. This is the larger monitor the whole slide sits inside, so its
// corner radius, bezel depth and scanline pitch are all bigger — a scanline
// gap tuned for a 224px canvas is invisible at page scale.

import type { ReactNode } from "react";
import { withAlpha, C, R } from "./theme";

export default function CrtPanel({
  children,
  glow = C.sky,
  className = "",
}: {
  children: ReactNode;
  glow?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative ${className}`}
      style={{
        // The moulded plastic surround.
        borderRadius: R.screen,
        padding: "14px",
        background: `radial-gradient(120% 120% at 50% 0%, #2A2A36 0%, #14141C 55%, #0A0A10 100%)`,
        boxShadow: [
          `inset 0 2px 0 ${withAlpha("#FFFFFF", 0.09)}`,
          `inset 0 0 26px ${withAlpha("#000000", 0.9)}`,
          `0 0 40px -10px ${withAlpha(glow, 0.45)}`,
          `0 10px 0 ${withAlpha("#000000", 0.45)}`,
        ].join(", "),
      }}
    >
      <div
        className="relative overflow-hidden px-4 py-6 sm:px-7 sm:py-8"
        style={{
          // The glass. Rounded hard — a CRT's corners are generous.
          borderRadius: "20px",
          background: `radial-gradient(130% 110% at 50% 40%, #0E0A1C 0%, #070510 62%, #030208 100%)`,
          boxShadow: `inset 0 0 60px ${withAlpha("#000000", 0.95)}`,
        }}
      >
        <div className="relative z-10">{children}</div>

        {/* Scanlines, at page scale rather than sprite scale. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 opacity-[0.35]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.5) 3px, rgba(0,0,0,0.5) 4px)",
          }}
        />

        {/* Vignette: the glass falls off toward the corners. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20"
          style={{
            background: `radial-gradient(115% 115% at 50% 50%, transparent 48%, ${withAlpha("#000000", 0.72)} 100%)`,
          }}
        />

        {/* The bulge: light catching the top of a curved tube. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-2/5 z-20"
          style={{
            background: `radial-gradient(90% 100% at 50% 0%, ${withAlpha("#FFFFFF", 0.09)} 0%, transparent 70%)`,
          }}
        />

        {/* Ambient phosphor wash, so the black isn't dead flat. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background: `radial-gradient(80% 70% at 50% 45%, ${withAlpha(glow, 0.07)} 0%, transparent 70%)`,
          }}
        />
      </div>
    </div>
  );
}
