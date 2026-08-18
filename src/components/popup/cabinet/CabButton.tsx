"use client";

// ─── Cabinet controls ────────────────────────────────────────────────────────
//
// Every control on the pop-up is a physical object, not a web button. Three
// shapes cover everything the page needs:
//
//   round  — the concave-lit button off a cabinet's control deck
//   pill   — a longer version of the same for text like "PLAY GAME"
//   pad    — the soft-cornered rectangle of an 8/16-bit console face button
//
// What makes them read as physical rather than as CSS:
//
//   * A hard offset shadow underneath, not a blur. Plastic on metal casts an
//     edge, and blurred shadows are the giveaway of a web button.
//   * The press TRAVELS. The cap moves down by exactly the shadow's depth and
//     the shadow collapses, so the button bottoms out against the deck. Nothing
//     about a colour change alone reads as a press.
//   * A domed highlight up and to the left (see theme.domed) so light has a
//     consistent direction across the whole page.
//
// Not to be confused with games/controls.tsx ArcadeButton, which is the
// in-canvas control for playing a game and is tuned for rapid tapping.

import { useState, type ReactNode } from "react";
import { domed, shade, withAlpha, C } from "./theme";

type Shape = "round" | "pill" | "pad";

const RADIUS: Record<Shape, string> = {
  round: "999px",
  pill: "999px",
  pad: "16px",
};

export default function CabButton({
  children,
  onClick,
  color = C.magenta,
  shape = "pill",
  size = "md",
  disabled = false,
  ariaLabel,
  className = "",
  depth = 6,
}: {
  children?: ReactNode;
  onClick?: () => void;
  color?: string;
  shape?: Shape;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  /** How far the cap sits above the deck, in px. Also its press travel. */
  depth?: number;
}) {
  const pad =
    shape === "round"
      ? { sm: "h-10 w-10", md: "h-14 w-14", lg: "h-20 w-20" }[size]
      : { sm: "px-4 py-2", md: "px-6 py-3", lg: "px-8 py-4" }[size];

  const text = { sm: "text-[9px]", md: "text-[11px]", lg: "text-[13px]" }[size];

  // Press travel is state rather than :active, because the resting shadow is
  // an inline style — a CSS rule would need !important to beat it, and the cap
  // has to move by exactly the shadow depth for the button to bottom out.
  const [down, setDown] = useState(false);
  const lift = down ? 0 : depth;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      onPointerCancel={() => setDown(false)}
      onKeyDown={(e) => (e.key === " " || e.key === "Enter") && setDown(true)}
      onKeyUp={() => setDown(false)}
      onBlur={() => setDown(false)}
      style={{
        background: domed(color),
        borderRadius: RADIUS[shape],
        transform: `translateY(${depth - lift}px)`,
        // Rim, then the hard cast shadow, then the tube's light on the deck.
        boxShadow: [
          `inset 0 0 0 2px ${shade(color, 0.55)}`,
          `inset 0 2px 0 ${withAlpha("#FFFFFF", 0.35)}`,
          `0 ${lift}px 0 ${shade(color, 0.62)}`,
          `0 ${lift + 4}px ${lift + 6}px ${withAlpha("#000000", 0.45)}`,
        ].join(", "),
        transition: "transform 60ms ease-out, box-shadow 60ms ease-out",
      }}
      className={`select-none inline-flex items-center justify-center gap-2 font-black uppercase tracking-[0.18em] text-[#12060F] disabled:opacity-40 disabled:pointer-events-none ${pad} ${text} ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * The carousel's left/right nudge. Round, lit, and deliberately large enough
 * to hit with a thumb on a phone.
 */
export function CabArrow({
  direction,
  onClick,
  disabled = false,
  color = C.gold,
}: {
  direction: "left" | "right";
  onClick?: () => void;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <CabButton
      shape="round"
      size="md"
      color={color}
      onClick={onClick}
      disabled={disabled}
      ariaLabel={direction === "left" ? "Previous cocktail" : "Next cocktail"}
      depth={5}
    >
      {/* Drawn rather than an icon font, so it matches the pixel art's weight. */}
      <svg width="18" height="18" viewBox="0 0 12 12" aria-hidden shapeRendering="crispEdges">
        <path
          d={direction === "left" ? "M8 1 L3 6 L8 11 L8 8 L6 6 L8 4 Z" : "M4 1 L9 6 L4 11 L4 8 L6 6 L4 4 Z"}
          fill="#12060F"
        />
      </svg>
    </CabButton>
  );
}

/**
 * A joystick, as the carousel's swipe affordance on desktop. Purely decorative
 * — it leans toward whichever arrow the pointer is nearest.
 */
export function CabJoystick({ lean = 0 }: { lean?: -1 | 0 | 1 }) {
  return (
    <div aria-hidden className="relative w-16 h-16 shrink-0">
      {/* Dust washer */}
      <div
        className="absolute inset-x-2 bottom-0 h-5 rounded-full"
        style={{
          background: domed("#1A1A22"),
          boxShadow: `0 2px 0 ${withAlpha("#000000", 0.6)}`,
        }}
      />
      {/* Shaft */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-3 w-2 h-7 rounded-full"
        style={{ background: `linear-gradient(90deg, #6A6A78, #C8C8D4, #6A6A78)` }}
      />
      {/* Ball top */}
      <div
        className="absolute w-9 h-9 rounded-full transition-transform duration-200"
        style={{
          left: "50%",
          top: 0,
          transform: `translateX(-50%) translateX(${lean * 7}px) rotate(${lean * 12}deg)`,
          background: domed(C.magenta),
          boxShadow: `inset 0 0 0 2px ${shade(C.magenta, 0.5)}, 0 3px 0 ${shade(C.magenta, 0.6)}`,
        }}
      />
    </div>
  );
}
