"use client";

// ─── Cabinet controls ────────────────────────────────────────────────────────
//
// Plain arcade-menu blocks: one flat colour, a thick dark outline, a hard
// shadow underneath, and a pixel-font label. Drawn in CSS rather than from
// the pixel-art sheets — the stretched art looked odd at phone sizes, and a
// block stays crisp at any size.
//
//   CabButton     — a text button.
//   CabIconButton — a square button with a drawn symbol: arrows, close, pause.
//
// A press drops the button onto its shadow, so it reads as pushed in.
//
// Not to be confused with games/controls.tsx ArcadeButton, which is the
// in-canvas control for playing a game and is tuned for rapid tapping.

import { useState, type CSSProperties, type ReactNode } from "react";
import { C } from "./theme";
import { pixelFont } from "./pixelArt";

const INK = "#12060F";
const DISABLED = "#77727E";

/** Dark text on the light colours, cream on the dark ones. */
const LABEL: Record<string, string> = {
  [C.teal]: INK,
  [C.gold]: INK,
  [C.magenta]: "#FFF3DC",
  [C.plum]: "#FFF3DC",
};

const HEIGHT = { sm: 32, md: 40, lg: 52 } as const;
const TEXT = { sm: "text-[8px]", md: "text-[10px]", lg: "text-[12px]" } as const;

/** How far the button sits above its shadow, and so how far a press travels. */
const LIFT = 4;

function usePress() {
  const [down, setDown] = useState(false);
  const handlers = {
    onPointerDown: () => setDown(true),
    onPointerUp: () => setDown(false),
    onPointerLeave: () => setDown(false),
    onPointerCancel: () => setDown(false),
    onKeyDown: (e: React.KeyboardEvent) => (e.key === " " || e.key === "Enter") && setDown(true),
    onKeyUp: () => setDown(false),
    onBlur: () => setDown(false),
  };
  return { down, handlers };
}

function blockStyle(color: string, pressed: boolean, disabled: boolean): CSSProperties {
  const lift = pressed ? 0 : LIFT;
  return {
    background: disabled ? DISABLED : color,
    border: `3px solid ${INK}`,
    boxShadow: [
      `inset 0 3px 0 rgba(255,255,255,${disabled ? 0.12 : 0.35})`,
      `inset 0 -4px 0 rgba(0,0,0,0.22)`,
      `0 ${lift}px 0 ${INK}`,
    ].join(", "),
    transform: `translateY(${LIFT - lift}px)`,
    WebkitTapHighlightColor: "transparent",
  };
}

export default function CabButton({
  children,
  onClick,
  color = C.magenta,
  size = "md",
  disabled = false,
  ariaLabel,
  className = "",
  type = "button",
}: {
  children?: ReactNode;
  onClick?: () => void;
  color?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  type?: "button" | "submit";
}) {
  const { down, handlers } = usePress();
  const pressed = down && !disabled;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      {...handlers}
      style={{
        ...blockStyle(color, pressed, disabled),
        height: HEIGHT[size],
        color: disabled ? "#2A2A2A" : (LABEL[color] ?? INK),
      }}
      className={`${pixelFont.className} select-none inline-flex items-center justify-center px-4 uppercase leading-none whitespace-nowrap disabled:cursor-not-allowed ${TEXT[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export type IconArt = "arrow-left" | "arrow-right" | "close" | "pause";

/** Symbols on a 7×7 pixel grid, so they share the labels' blocky look. */
const ICON_PATH: Record<IconArt, string> = {
  "arrow-left": "M4 0h1v7H4zM3 1h1v5H3zM2 2h1v3H2zM1 3h1v1H1z",
  "arrow-right": "M2 0h1v7H2zM3 1h1v5H3zM4 2h1v3H4zM5 3h1v1H5z",
  close: "M0 0h2v1H0zM1 1h2v1H1zM2 2h3v3H2zM4 1h2v1H4zM5 0h2v1H5zM1 5h2v1H1zM0 6h2v1H0zM4 5h2v1H4zM5 6h2v1H5z",
  pause: "M1 0h2v7H1zM4 0h2v7H4z",
};

/** A square button with a pixel symbol. */
export function CabIconButton({
  icon,
  onClick,
  color = C.gold,
  size = 44,
  disabled = false,
  ariaLabel,
  className = "",
}: {
  icon: IconArt;
  onClick?: () => void;
  color?: string;
  size?: number;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
}) {
  const { down, handlers } = usePress();
  const pressed = down && !disabled;
  const ink = LABEL[color] ?? INK;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      {...handlers}
      style={{ ...blockStyle(color, pressed, disabled), width: size, height: size }}
      className={`select-none shrink-0 inline-flex items-center justify-center disabled:cursor-not-allowed ${className}`}
    >
      <svg
        aria-hidden
        width={Math.round(size * 0.36)}
        height={Math.round(size * 0.36)}
        viewBox="0 0 7 7"
        shapeRendering="crispEdges"
      >
        <path d={ICON_PATH[icon]} fill={disabled ? "#2A2A2A" : ink} />
      </svg>
    </button>
  );
}

/** The carousel's left/right nudge. */
export function CabArrow({
  direction,
  onClick,
  disabled = false,
}: {
  direction: "left" | "right";
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <CabIconButton
      icon={direction === "left" ? "arrow-left" : "arrow-right"}
      size={40}
      onClick={onClick}
      disabled={disabled}
      ariaLabel={direction === "left" ? "Previous cocktail" : "Next cocktail"}
    />
  );
}
