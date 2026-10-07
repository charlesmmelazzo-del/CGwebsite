"use client";

// ─── Cocktail Creepypastas — the look ────────────────────────────────────────
//
// Black and white only: a gothic anthology dressed like an old RPG's dialogue
// screens. The boxes, buttons and borders are drawn here in CSS, so no art is
// needed for the page to work. Portraits and the logo are optional slots that
// fill in as the owner's sprite sheets arrive.
//
// Three faces: Pirata One for the title, Pixelify Sans for the Host's voice and
// the controls, and Lora for anything read at length (cocktail facts, and later
// the stories), because pixel lettering is tiring over a paragraph on a phone.

import { Lora, Pirata_One, Pixelify_Sans } from "next/font/google";
import { Fragment, type ReactNode } from "react";
import { HOST_NAME, type Beat, type Expression, type HostLine } from "./hostDialogue";

export const titleFont = Pirata_One({ weight: "400", subsets: ["latin"], display: "swap" });
export const voiceFont = Pixelify_Sans({ subsets: ["latin"], display: "swap" });
export const readFont = Lora({ subsets: ["latin"], display: "swap", style: ["normal", "italic"] });

/**
 * The real logo, once it's cut from the owner's sheet. Null = set the title in
 * type instead, which is also what shows if the image fails.
 */
export const LOGO_SRC: string | null = null;

/**
 * Host portrait art per expression. Empty until the sprite sheet arrives;
 * anything missing falls back to `neutral`, then to the drawn placeholder.
 */
const PORTRAITS: Partial<Record<Expression, string>> = {};

// ─── Text ────────────────────────────────────────────────────────────────────

/** Turns **this** into emphasis. Content never carries raw HTML. */
export function Rich({ text }: { text: string }) {
  const parts = text.split("**");
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-bold tracking-wide">
            {part}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}

function BeatView({ beat }: { beat: Beat }) {
  if ("direction" in beat) {
    return (
      <p className={`${readFont.className} italic text-[15px] leading-relaxed text-white/60`}>
        <Rich text={beat.direction} />
      </p>
    );
  }
  return (
    <p className="text-[18px] leading-[1.45] text-white">
      &ldquo;<Rich text={beat.say} />&rdquo;
    </p>
  );
}

// ─── The Host ────────────────────────────────────────────────────────────────

/**
 * A stand-in until his portraits exist: a shadowy bust with two pale eyes.
 * Deliberately says nothing about what he'll look like.
 */
const PLACEHOLDER = [
  "................",
  ".....######.....",
  "....########....",
  "...##########...",
  "...##########...",
  "...##W####W##...",
  "...##########...",
  "....########....",
  ".....######.....",
  "......####......",
  "...##########...",
  "..############..",
  ".##############.",
  ".##############.",
  ".##############.",
  ".##############.",
];

function PlaceholderBust() {
  return (
    <svg viewBox="0 0 16 16" className="w-full h-full" shapeRendering="crispEdges" aria-hidden>
      {PLACEHOLDER.flatMap((row, y) =>
        row.split("").map((ch, x) =>
          ch === "." ? null : (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={ch === "W" ? "#fff" : "#3b3b3b"} />
          )
        )
      )}
    </svg>
  );
}

export function HostPortrait({ expression = "neutral" }: { expression?: Expression }) {
  const src = PORTRAITS[expression] ?? PORTRAITS.neutral;
  return (
    <div
      className="shrink-0 w-[72px] h-[72px] sm:w-24 sm:h-24 bg-black border-[3px] border-white rounded-[4px] overflow-hidden"
      style={{ imageRendering: "pixelated" }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- pixel art at a whole-number scale; the optimizer would smooth it
        <img src={src} alt="" className="w-full h-full object-cover" style={{ imageRendering: "pixelated" }} />
      ) : (
        <PlaceholderBust />
      )}
    </div>
  );
}

/**
 * The Host speaking: portrait and name above a dialogue box.
 *
 * `extra` is plain speech appended after the line (the main question, say),
 * so a greeting and its question read as one breath.
 */
export function HostSays({
  line,
  extra,
  expression,
}: {
  line: HostLine | null;
  extra?: string;
  expression?: Expression;
}) {
  const beats: Beat[] = [...(line?.beats ?? []), ...(extra ? [{ say: extra }] : [])];
  return (
    <div className={voiceFont.className}>
      <div className="flex items-end gap-3 mb-3">
        <HostPortrait expression={expression ?? line?.expression} />
        <p className="pb-1 text-[13px] tracking-[0.18em] uppercase text-white/70">{HOST_NAME}</p>
      </div>
      <DialogueBox>
        <div className="space-y-3">
          {beats.map((b, i) => (
            <BeatView key={i} beat={b} />
          ))}
        </div>
      </DialogueBox>
    </div>
  );
}

// ─── Frames and controls ─────────────────────────────────────────────────────

/** The black box with a doubled white rule, as on an old RPG's text window. */
export function DialogueBox({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative bg-black border-[3px] border-white rounded-[6px] px-4 py-4 sm:px-5 ${className}`}
      style={{ boxShadow: "0 0 0 3px #000, 0 0 0 5px rgba(255,255,255,0.35)" }}
    >
      {children}
    </div>
  );
}

/**
 * A response the guest can pick. Real buttons, at least 48px tall, with a
 * pointer that appears on hover and keyboard focus.
 */
export function Choice({
  children,
  onClick,
  primary = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${voiceFont.className} group w-full min-h-[48px] flex items-center gap-2 text-left px-3 py-2.5 text-[17px] leading-snug rounded-[4px] border-2 transition-colors
        focus:outline-none focus-visible:bg-white focus-visible:text-black focus-visible:border-white
        [@media(hover:hover)]:hover:bg-white [@media(hover:hover)]:hover:text-black [@media(hover:hover)]:hover:border-white disabled:opacity-40 disabled:pointer-events-none
        ${primary ? "border-white text-white" : "border-white/35 text-white/90"}`}
    >
      <span aria-hidden className="w-3 shrink-0 opacity-0 [@media(hover:hover)]:group-hover:opacity-100 group-focus-visible:opacity-100">
        ▸
      </span>
      <span>{children}</span>
    </button>
  );
}

/** A quiet text-only action, for secondary routes like "Skip introduction". */
export function QuietAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${voiceFont.className} min-h-[44px] px-2 text-[14px] tracking-wide text-white/55 underline underline-offset-4 decoration-white/25 hover:text-white focus:outline-none focus-visible:text-white focus-visible:decoration-white`}
    >
      {children}
    </button>
  );
}
