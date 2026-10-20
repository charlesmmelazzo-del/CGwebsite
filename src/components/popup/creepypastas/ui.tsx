"use client";

// ─── Cocktail Creepypastas — the look ────────────────────────────────────────
//
// Black and white only, Undertale-simple: white outlines on black, a pixel
// face for anything the bartender says or the guest taps, and a plain book
// face for the stories themselves, because pixel lettering is tiring over
// thousands of words on a phone.
//
// The logo and bartender are art slots. Until the owner's sprite sheets are
// cut in, a drawn stand-in takes their place — nothing waits on the art.

import { Lora, Pixelify_Sans } from "next/font/google";
import { useEffect, useState, type ReactNode } from "react";

export const voiceFont = Pixelify_Sans({ subsets: ["latin"], display: "swap" });
export const readFont = Lora({ subsets: ["latin"], display: "swap", style: ["normal", "italic"] });

/** The logo, once it's cut from Sheet 1. Null = set the title in type. */
export const LOGO_SRC: string | null = null;

export type Pose = "idle" | "talking" | "greeting" | "thinking" | "writing";

/**
 * Bartender animation frames per pose, from Sheets 2B–2F, in order.
 * Empty until the art is cut in; any pose without frames falls back to idle,
 * then to the drawn stand-in.
 */
const FRAMES: Partial<Record<Pose, string[]>> = {};

/** Milliseconds per frame. */
const FRAME_MS: Record<Pose, number> = { idle: 600, talking: 160, greeting: 260, thinking: 420, writing: 220 };

function useFrame(pose: Pose, count: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    if (count < 2) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % count), FRAME_MS[pose]);
    return () => window.clearInterval(t);
  }, [pose, count]);
  return i;
}

// ─── The bartender ───────────────────────────────────────────────────────────

/**
 * A stand-in ghoul behind a bar: hollow eyes, a grin, a bow tie. Says nothing
 * about the real character's look — it only proves the poses work.
 * # outline · + shadow · o eye glow · b bow tie · = counter
 */
const STAND_IN = [
  "......######......",
  "....##++++++##....",
  "...#++++++++++#...",
  "..#++++++++++++#..",
  "..#++..++++..++#..",
  "..#++.o++++o.++#..",
  "..#++..++++..++#..",
  "..#++++++##++++#..",
  "..#++++++++++++#..",
  "MOUTH",
  "...#++++++++++#...",
  "....##++++++##....",
  "......#++++#......",
  "...####+bb+####...",
  "..#+++++#bb#+++++#",
  ".#++++++++++++++#.",
  ".#++++++++++++++#.",
  "==================",
  "#................#",
  "==================",
];
const MOUTHS = {
  closed: "..#++########++#..",
  open: "..#++#.#.#.#.++#..",
};

function StandIn({ pose, frame }: { pose: Pose; frame: number }) {
  const talking = pose === "talking" || pose === "greeting";
  const mouth = talking && frame % 2 === 1 ? MOUTHS.open : MOUTHS.closed;
  const rows = STAND_IN.map((r) => (r === "MOUTH" ? mouth : r));
  const fill: Record<string, string> = { "#": "#fff", "+": "#1f1f1f", o: "#fff", b: "#fff", "=": "#fff" };
  return (
    <svg viewBox="0 0 18 20" className="h-full w-auto max-w-full" shapeRendering="crispEdges" aria-hidden>
      {rows.flatMap((row, y) =>
        row.split("").map((ch, x) =>
          fill[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={fill[ch]} /> : null
        )
      )}
      {pose === "thinking" && (
        <text x="14.5" y="2.6" fontSize="2.6" fill="#fff" className={voiceFont.className}>
          {".".repeat((frame % 3) + 1)}
        </text>
      )}
      {pose === "writing" && (
        <g>
          <rect x="11" y="13" width="5" height="4" fill="#fff" />
          <rect x={11.5 + (frame % 3)} y="14.5" width="1.5" height="0.5" fill="#000" />
        </g>
      )}
    </svg>
  );
}

export function Bartender({ pose }: { pose: Pose }) {
  const frames = FRAMES[pose]?.length ? FRAMES[pose]! : FRAMES.idle ?? [];
  const frame = useFrame(pose, frames.length || (pose === "idle" ? 1 : 3));
  return (
    <div className="h-full w-full flex items-end justify-center" style={{ imageRendering: "pixelated" }}>
      {frames.length ? (
        // eslint-disable-next-line @next/next/no-img-element -- pixel art at whole-number scale; the optimizer would smooth it
        <img
          src={frames[frame % frames.length]}
          alt=""
          className="h-full w-auto max-w-full object-contain object-bottom"
          style={{ imageRendering: "pixelated" }}
        />
      ) : (
        <StandIn pose={pose} frame={frame} />
      )}
    </div>
  );
}

// ─── Speech and replies ──────────────────────────────────────────────────────

/** His words: a white-ruled bubble with a tail pointing down at him. */
export function SpeechBubble({ children, onNext }: { children: ReactNode; onNext?: () => void }) {
  return (
    <div className="relative">
      <div
        aria-live="polite"
        className={`${voiceFont.className} relative bg-black border-[3px] border-white rounded-[14px] px-4 py-3.5 text-[18px] leading-[1.45] text-white`}
      >
        {children}
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            className="absolute inset-0 w-full h-full rounded-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label="Next"
          >
            <span aria-hidden className="absolute right-3 bottom-1.5 text-[14px] motion-safe:animate-pulse">
              ▼
            </span>
          </button>
        )}
      </div>
      {/* The tail: a white triangle with a black one inset, so it reads as a continuation of the rule. */}
      <span aria-hidden className="absolute left-1/2 -bottom-[13px] -translate-x-1/2 w-0 h-0 border-x-[12px] border-x-transparent border-t-[13px] border-t-white" />
      <span aria-hidden className="absolute left-1/2 -bottom-[8px] -translate-x-1/2 w-0 h-0 border-x-[8px] border-x-transparent border-t-[9px] border-t-black" />
    </div>
  );
}

/**
 * A reply the guest can tap. Real buttons, at least 48px tall, with a pointer
 * on keyboard focus — and on hover only where there's a mouse, so a tapped
 * button on a phone doesn't stay lit.
 */
export function Choice({
  children,
  onClick,
  quiet = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  quiet?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${voiceFont.className} group w-full min-h-[48px] flex items-center gap-2 text-left px-3 py-2 text-[17px] leading-snug rounded-[6px] border-2 transition-colors
        focus:outline-none focus-visible:bg-white focus-visible:text-black focus-visible:border-white
        [@media(hover:hover)]:hover:bg-white [@media(hover:hover)]:hover:text-black [@media(hover:hover)]:hover:border-white
        disabled:opacity-40 disabled:pointer-events-none
        ${quiet ? "border-white/30 text-white/75" : "border-white text-white"}`}
    >
      <span aria-hidden className="w-3 shrink-0 opacity-0 [@media(hover:hover)]:group-hover:opacity-100 group-focus-visible:opacity-100">
        ▸
      </span>
      <span>{children}</span>
    </button>
  );
}
