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

/** The logo, cut from Sheet 1 by scripts/creepypastas-art.py. Null = set the title in type. */
export const LOGO_SRC: string | null = "/popup/creepypastas/logo.png";

export type Pose = "idle" | "talking" | "greeting" | "thinking" | "writing";

/**
 * Bartender animation frames per pose, from Sheets 2B–2F, cut by
 * scripts/creepypastas-art.py. A pose without frames falls back to idle,
 * then to the drawn stand-in.
 */
const frames = (pose: Pose) => [1, 2, 3, 4].map((n) => `/popup/creepypastas/bartender/${pose}-${n}.png`);
const FRAMES: Partial<Record<Pose, string[]>> = {
  idle: frames("idle"),
  talking: frames("talking"),
  greeting: frames("greeting"),
  thinking: frames("thinking"),
  writing: frames("writing"),
};

/** Every frame, so the browser can fetch them before he first moves. */
export const ALL_FRAMES = Object.values(FRAMES).flat() as string[];

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

/** Fills the room it's given — a fixed share of the screen, so he never resizes mid-conversation. */
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

// ─── His dialogue box ────────────────────────────────────────────────────────

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Milliseconds per character as a line types out. */
const TYPE_MS = 24;

/**
 * His words, typed out a letter at a time like an old RPG, in a box at the
 * bottom of the screen. Tapping finishes the line at once; tapping a finished
 * line moves on (when there's more).
 *
 * The rest of the line is laid out invisibly while it types, so the box never
 * grows or rewraps mid-sentence. Screen readers get the whole line at once.
 * Reduced motion: the line simply appears.
 */
export function DialogueBox({
  text,
  typed,
  onTyped,
  onTap,
  more,
}: {
  text: string;
  /** Finished typing (or skipped). Owned by the caller, who shows replies after. */
  typed: boolean;
  onTyped: () => void;
  /** A tap on a finished line. */
  onTap?: () => void;
  /** There's another line after this one: show the ▼. */
  more: boolean;
}) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
    if (!text) return;
    if (prefersReducedMotion()) {
      setShown(text.length);
      onTyped();
      return;
    }
    // Long lines type a little faster so nobody waits more than a few seconds.
    const step = text.length > 160 ? 2 : 1;
    let n = 0;
    const t = window.setInterval(() => {
      n = Math.min(text.length, n + step);
      setShown(n);
      if (n >= text.length) {
        window.clearInterval(t);
        onTyped();
      }
    }, TYPE_MS);
    return () => window.clearInterval(t);
    // onTyped is a fresh closure each render; the line is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // Skipped from outside, or by a tap.
  const visible = typed ? text.length : shown;

  return (
    <button
      type="button"
      onClick={() => (typed ? onTap?.() : onTyped())}
      className={`${voiceFont.className} relative w-full flex-1 min-h-0 overflow-y-auto flex flex-col items-start justify-start text-left bg-black border-[3px] border-white rounded-[6px] px-4 py-3
        text-[clamp(19px,5.4vw,23px)] leading-[1.38] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70`}
      aria-label={typed && more ? "Next" : undefined}
    >
      <span className="sr-only" aria-live="polite">
        {text}
      </span>
      <span aria-hidden>
        {text.slice(0, visible)}
        <span className="invisible">{text.slice(visible)}</span>
      </span>
      {typed && more && (
        <span aria-hidden className="absolute right-3 bottom-2 text-[14px] motion-safe:animate-bounce">
          ▼
        </span>
      )}
    </button>
  );
}

/**
 * A reply that opens a file — the recipe PDF — styled as the main reply on
 * screen. Opens in a new tab, where phones show the PDF with their own
 * save/share controls.
 */
export function ChoiceLink({ href, children, onClick }: { href: string; children: ReactNode; onClick?: () => void }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      download
      onClick={onClick}
      className={`${voiceFont.className} w-full h-full min-h-[52px] flex items-center justify-center text-center px-3 py-2 leading-snug rounded-[6px]
        bg-white text-black border-2 border-white text-[clamp(18px,5vw,21px)]
        focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black`}
    >
      {children}
    </a>
  );
}

/** His words over the recipe cards: a white-ruled bubble with a tail. */
export function SpeechBubble({ children, onNext }: { children: ReactNode; onNext?: () => void }) {
  return (
    <div className="relative">
      <div
        aria-live="polite"
        className={`${voiceFont.className} relative bg-black border-[3px] border-white rounded-[14px] px-4 py-3.5 text-[clamp(19px,5.6vw,24px)] leading-[1.35] text-white`}
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
 * A reply the guest can tap: a real button, centred, at least 52px tall. It
 * inverts on keyboard focus — and on hover only where there's a mouse, so a
 * tapped button on a phone doesn't stay lit.
 */
export function Choice({
  children,
  onClick,
  quiet = false,
  disabled = false,
  small = false,
}: {
  children: ReactNode;
  onClick: () => void;
  quiet?: boolean;
  disabled?: boolean;
  /** Smaller text, for two-across grids. */
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${voiceFont.className} w-full h-full min-h-[52px] flex items-center justify-center text-center py-2 leading-snug
        ${small ? "px-2 text-[clamp(15px,4.3vw,18px)]" : "px-3 text-[clamp(18px,5vw,21px)]"} rounded-[6px] border-2 transition-colors
        focus:outline-none focus-visible:bg-white focus-visible:text-black focus-visible:border-white
        [@media(hover:hover)]:hover:bg-white [@media(hover:hover)]:hover:text-black [@media(hover:hover)]:hover:border-white
        disabled:opacity-40 disabled:pointer-events-none
        ${quiet ? "border-white/30 text-white/75" : "border-white text-white"}`}
    >
      {children}
    </button>
  );
}
