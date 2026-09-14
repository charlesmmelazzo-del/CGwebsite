"use client";

// ─── Cabinet controls ────────────────────────────────────────────────────────
//
// Every control on the pop-up is a piece of the owner's pixel art rather than
// a CSS button, so the page matches the games it leads into.
//
//   CabButton     — a pill with a text label. Three slices (two rounded ends
//                   and a middle that stretches), so one piece of art fits any
//                   label without squashing its pixels.
//   CabIconButton — a round control with its symbol drawn in: arrows, close,
//                   pause.
//
// A press swaps to the art's pressed frame, where the cap is drawn pushed down
// into its base. Both frames are always mounted so the first press never waits
// on an image download.
//
// Not to be confused with games/controls.tsx ArcadeButton, which is the
// in-canvas control for playing a game and is tuned for rapid tapping.

import { useState, type ReactNode } from "react";
import { C } from "./theme";
import { artLayer, pixelFont, UI } from "./pixelArt";

type PillArt = "teal" | "red" | "gold" | "purple";

/** The page palette's button colours, mapped onto the four pills drawn. */
const PILL_FOR: Record<string, PillArt> = {
  [C.teal]: "teal",
  [C.magenta]: "red",
  [C.gold]: "gold",
  [C.plum]: "purple",
};

/** Dark ink on the light pills, cream on the dark ones. */
const LABEL: Record<PillArt | "disabled", string> = {
  teal: "#0B1A1A",
  gold: "#1A1204",
  red: "#FFF3DC",
  purple: "#FFF3DC",
  disabled: "#2A2A2A",
};

const HEIGHT = { sm: 36, md: 50, lg: 62 } as const;
const TEXT = { sm: "text-[8px]", md: "text-[10px]", lg: "text-[12px]" } as const;

/**
 * Where the label sits. Measured off the art: the face of a raised pill is
 * centred 40% of the way down (the base takes the rest), and the pressed face
 * 50%, so the label drops with the cap.
 */
const RAISED_CENTRE = 0.4;
const PRESSED_CENTRE = 0.5;

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
  const pill = PILL_FOR[color] ?? "gold";
  const h = HEIGHT[size];
  const cap = Math.round((h * UI.pill.cap) / UI.pill.height);
  const pressed = down && !disabled;
  const shift = ((pressed ? PRESSED_CENTRE : RAISED_CENTRE) - 0.5) * h;

  const frames = disabled
    ? [{ name: "pill-disabled", visible: true }]
    : [
        { name: `pill-${pill}`, visible: !pressed },
        { name: `pill-${pill}-pressed`, visible: pressed },
      ];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      {...handlers}
      style={{
        height: h,
        minWidth: cap * 3,
        paddingLeft: Math.round(cap * 1.1),
        paddingRight: Math.round(cap * 1.1),
        color: LABEL[disabled ? "disabled" : pill],
        WebkitTapHighlightColor: "transparent",
      }}
      className={`${pixelFont.className} relative select-none inline-flex items-center justify-center uppercase leading-none disabled:cursor-not-allowed ${TEXT[size]} ${className}`}
    >
      {frames.map((f) => (
        <span
          key={f.name}
          aria-hidden
          className="pointer-events-none absolute inset-0 flex"
          style={{ opacity: f.visible ? 1 : 0 }}
        >
          <span className="h-full shrink-0" style={{ width: cap, ...artLayer(`${f.name}-l`) }} />
          <span className="h-full flex-1" style={artLayer(`${f.name}-m`)} />
          <span className="h-full shrink-0" style={{ width: cap, ...artLayer(`${f.name}-r`) }} />
        </span>
      ))}
      <span
        className="relative whitespace-nowrap"
        style={{ transform: `translateY(${shift}px)` }}
      >
        {children}
      </span>
    </button>
  );
}

export type IconArt = "arrow-left" | "arrow-right" | "close" | "pause";

/** A round cabinet button with its symbol drawn into the art. */
export function CabIconButton({
  icon,
  onClick,
  size = 56,
  disabled = false,
  ariaLabel,
  className = "",
}: {
  icon: IconArt;
  onClick?: () => void;
  /** Width in px; height follows the art. */
  size?: number;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
}) {
  const { down, handlers } = usePress();
  const pressed = down && !disabled;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      {...handlers}
      style={{ width: size, height: size, WebkitTapHighlightColor: "transparent" }}
      className={`relative select-none shrink-0 disabled:opacity-35 disabled:cursor-not-allowed ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ ...artLayer(icon, "contain"), opacity: pressed ? 0 : 1 }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ ...artLayer(`${icon}-pressed`, "contain"), opacity: pressed ? 1 : 0 }}
      />
    </button>
  );
}

/** The carousel's left/right nudge — big enough to hit with a thumb. */
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
      size={60}
      onClick={onClick}
      disabled={disabled}
      ariaLabel={direction === "left" ? "Previous cocktail" : "Next cocktail"}
    />
  );
}
