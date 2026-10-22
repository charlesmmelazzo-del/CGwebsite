"use client";

// ─── Home for the Holidays — the look ────────────────────────────────────────
//
// Simple and classic, from the owner's references: warm olive-grey paper,
// cream ink, one red star. Everything looks written by hand —
//   scriptFont (Sacramento)  flowing, decorative — main titles only
//   handFont   (Amatic SC)   tall hand-lettered caps — headings, buttons, menus
//   readFont   (Patrick Hand) plain handwriting — rules, descriptions, names
//
// Motion: each piece of text "writes on" left to right, a beat after the one
// before (`--i` staggers it), and every button's outline is drawn with a pen
// stroke as it appears. Quick enough that nobody waits on it.

import { Amatic_SC, Patrick_Hand, Sacramento } from "next/font/google";
import {
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";

export const scriptFont = Sacramento({ subsets: ["latin"], weight: "400", display: "swap" });
export const handFont = Amatic_SC({ subsets: ["latin"], weight: ["400", "700"], display: "swap" });
export const readFont = Patrick_Hand({ subsets: ["latin"], weight: "400", display: "swap" });

export const COLORS = {
  paper: "#5E5D50",
  paperDark: "#4E4D42",
  ink: "#F5EFE2",
  inkSoft: "rgba(245, 239, 226, 0.68)",
  inkFaint: "rgba(245, 239, 226, 0.28)",
  star: "#D63A2F",
  cardFace: "#F7F2E6",
  cardInk: "#2F2E28",
  cardRed: "#C0352B",
};

/** Stagger index for write-on animations. */
export const at = (i: number) => ({ "--i": i }) as CSSProperties;

// ─── Wobbly pen lines ────────────────────────────────────────────────────────

/** Small deterministic jitter so a box looks drawn, but the same every render. */
function jitter(seed: number) {
  let t = seed * 9301 + 49297;
  return () => {
    t = (t * 9301 + 49297) % 233280;
    return t / 233280 - 0.5;
  };
}

/**
 * A hand-drawn rounded box at the element's real pixel size: four slightly
 * bowed strokes that overshoot at two corners, the way a quick pen box does.
 */
export function sketchPath(w: number, h: number, seed = 1): string {
  const j = jitter(seed);
  const wob = Math.min(3, h * 0.06);
  const r = Math.min(14, h / 3);
  const p = (x: number, y: number) => `${(x + j() * wob).toFixed(1)} ${(y + j() * wob).toFixed(1)}`;
  const i = 2;
  return [
    `M ${p(i + r, i)}`,
    `Q ${p(w / 2, i - wob)} ${p(w - i - r, i)}`,
    `Q ${p(w - i, i)} ${p(w - i, i + r)}`,
    `Q ${p(w - i + wob, h / 2)} ${p(w - i, h - i - r)}`,
    `Q ${p(w - i, h - i)} ${p(w - i - r, h - i)}`,
    `Q ${p(w / 2, h - i + wob)} ${p(i + r, h - i)}`,
    `Q ${p(i, h - i)} ${p(i, h - i - r)}`,
    `Q ${p(i - wob, h / 2)} ${p(i, i + r)}`,
    `Q ${p(i, i)} ${p(i + r + 6, i - 1)}`,
  ].join(" ");
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** The pen outline, drawn on when it mounts. Sits behind the content. */
export function Sketch({
  w,
  h,
  seed,
  delay = 0,
  color = "currentColor",
  width = 2,
  fill,
}: {
  w: number;
  h: number;
  seed?: number;
  delay?: number;
  color?: string;
  width?: number;
  fill?: string;
}) {
  return (
    <svg aria-hidden className="absolute inset-0 pointer-events-none overflow-visible" width={w} height={h}>
      {fill && <path d={sketchPath(w, h, (seed ?? 1) + 7)} fill={fill} stroke="none" className="hh-fill" style={{ animationDelay: `${delay}ms` }} />}
      <path
        d={sketchPath(w, h, seed)}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        className="hh-draw"
        style={{ animationDelay: `${delay}ms` }}
      />
    </svg>
  );
}

// ─── Buttons & panels ────────────────────────────────────────────────────────

type HandButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Stagger position — later buttons draw a beat after earlier ones. */
  i?: number;
  /** Filled cream with dark ink: the main action on a screen. */
  primary?: boolean;
  small?: boolean;
  children: ReactNode;
};

export function HandButton({ i = 0, primary, small, className = "", children, disabled, ...rest }: HandButtonProps) {
  const [ref, size] = useSize<HTMLButtonElement>();
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      {...rest}
      className={`${handFont.className} hh-write relative w-full font-bold tracking-wide transition-transform active:scale-[0.97] disabled:opacity-40 ${
        small ? "min-h-[44px] px-3 text-[22px]" : "min-h-[56px] px-4 text-[27px]"
      } ${primary ? "text-[#2F2E28]" : "text-[#F5EFE2]"} ${className}`}
      style={at(i)}
    >
      {size && (
        <Sketch
          w={size.w}
          h={size.h}
          seed={i + 3}
          delay={i * 90}
          color={COLORS.ink}
          fill={primary ? COLORS.ink : undefined}
        />
      )}
      <span className="relative leading-none">{children}</span>
    </button>
  );
}

/** HandButton's look on a link (downloads, outside pages). */
export function HandLink({ i = 0, primary, href, onClick, children, download }: { i?: number; primary?: boolean; href: string; onClick?: () => void; children: ReactNode; download?: boolean }) {
  const [ref, size] = useSize<HTMLAnchorElement>();
  return (
    <a
      ref={ref}
      href={href}
      target="_blank"
      rel="noreferrer"
      download={download}
      onClick={onClick}
      className={`${handFont.className} hh-write relative flex items-center justify-center w-full min-h-[52px] px-4 text-[25px] font-bold tracking-wide active:scale-[0.97] transition-transform ${
        primary ? "text-[#2F2E28]" : "text-[#F5EFE2]"
      }`}
      style={at(i)}
    >
      {size && <Sketch w={size.w} h={size.h} seed={i + 5} delay={i * 90} color={COLORS.ink} fill={primary ? COLORS.ink : undefined} />}
      <span className="relative leading-none">{children}</span>
    </a>
  );
}

/** A pen-drawn panel for grouping things (game cards, the lobby code…). */
export function HandBox({ i = 0, className = "", children, onClick, label }: { i?: number; className?: string; children: ReactNode; onClick?: () => void; label?: string }) {
  const [ref, size] = useSize<HTMLDivElement>();
  return (
    <div
      ref={ref}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={label}
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick()) : undefined}
      className={`hh-write relative ${onClick ? "cursor-pointer active:scale-[0.99] transition-transform" : ""} ${className}`}
      style={at(i)}
    >
      {size && <Sketch w={size.w} h={size.h} seed={i + 11} delay={i * 90} color={COLORS.inkSoft} width={1.6} />}
      <div className="relative">{children}</div>
    </div>
  );
}

// ─── Type ────────────────────────────────────────────────────────────────────

/** Any text that should write itself on. */
export function Write({ i = 0, as: Tag = "div", className = "", children }: { i?: number; as?: "div" | "p" | "h1" | "h2" | "h3" | "span" | "li"; className?: string; children: ReactNode }) {
  return (
    <Tag className={`hh-write ${className}`} style={at(i)}>
      {children}
    </Tag>
  );
}

export function Star({ size = 22, className = "", i = 0 }: { size?: number; className?: string; i?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className={`hh-pop ${className}`} style={at(i)}>
      <path
        d="M12 2.2l2.6 6.4 6.9.5-5.3 4.4 1.7 6.7L12 16.5l-5.9 3.7 1.7-6.7L2.5 9.1l6.9-.5z"
        fill={COLORS.star}
        stroke={COLORS.star}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A flourish under a title, drawn with the pen. */
export function Squiggle({ i = 0, width = 160 }: { i?: number; width?: number }) {
  return (
    <svg viewBox="0 0 160 12" width={width} height={(width / 160) * 12} aria-hidden className="mx-auto overflow-visible">
      <path
        d="M2 7 C 22 1, 34 11, 54 6 S 88 2, 104 7 S 140 10, 158 4"
        fill="none"
        stroke={COLORS.inkSoft}
        strokeWidth="1.6"
        strokeLinecap="round"
        pathLength={1}
        className="hh-draw"
        style={{ animationDelay: `${i * 90}ms` }}
      />
    </svg>
  );
}

/** Screen title in the flowing script, with the red star above. */
export function ScriptTitle({ children, i = 0, star = true, size = "clamp(44px, 13vw, 64px)" }: { children: ReactNode; i?: number; star?: boolean; size?: string }) {
  return (
    <div className="text-center">
      {star && <Star className="mx-auto mb-1" i={i} />}
      <h1 className={`${scriptFont.className} hh-write hh-slow leading-[1.05]`} style={{ ...at(i), fontSize: size }}>
        {children}
      </h1>
    </div>
  );
}

/** Small hand-lettered caps heading. */
export function Label({ children, i = 0, className = "" }: { children: ReactNode; i?: number; className?: string }) {
  return (
    <Write i={i} className={`${handFont.className} font-bold tracking-[0.12em] uppercase text-[18px] text-[#F5EFE2]/70 ${className}`}>
      {children}
    </Write>
  );
}

/** Back link at the top-left of a screen. */
export function BackLink({ onClick, children = "Back" }: { onClick: () => void; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${handFont.className} hh-write font-bold text-[22px] min-h-[44px] pr-3 text-[#F5EFE2]/80 hover:text-[#F5EFE2]`}
    >
      ← {children}
    </button>
  );
}

/** Animations, scoped by class name. Rendered once by the template. */
export function HolidayStyles() {
  return (
    <style>{`
      .hh-write { animation: hh-write 520ms cubic-bezier(0.55, 0.1, 0.35, 1) both; animation-delay: calc(var(--i, 0) * 90ms); }
      .hh-slow { animation-duration: 1100ms; }
      @keyframes hh-write {
        from { clip-path: inset(-20% 100% -20% 0); opacity: 0.3; transform: translateX(-2px) rotate(-0.4deg); }
        to   { clip-path: inset(-20% -2% -20% 0); transform: none; }
      }
      .hh-draw { stroke-dasharray: 1 1; animation: hh-draw 620ms cubic-bezier(0.6, 0.05, 0.3, 1) both; }
      @keyframes hh-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
      .hh-fill { animation: hh-fill 380ms ease-out both; animation-delay: 300ms; }
      @keyframes hh-fill { from { opacity: 0; } to { opacity: 1; } }
      .hh-pop { animation: hh-pop 520ms cubic-bezier(0.3, 1.6, 0.5, 1) both; animation-delay: calc(var(--i, 0) * 90ms); }
      @keyframes hh-pop { from { transform: scale(0) rotate(-40deg); } to { transform: none; } }
      .hh-screen { animation: hh-screen 260ms ease-out both; }
      @keyframes hh-screen { from { opacity: 0; } to { opacity: 1; } }
      .hh-sheet { animation: hh-sheet 280ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
      @keyframes hh-sheet { from { transform: translateY(100%); } to { transform: none; } }
      .hh-deal { animation: hh-deal 300ms cubic-bezier(0.2, 0.8, 0.2, 1) both; animation-delay: calc(var(--i, 0) * 40ms); }
      @keyframes hh-deal { from { opacity: 0; transform: translateY(24px) rotate(6deg); } to { opacity: 1; transform: none; } }
      .hh-roll { animation: hh-roll 520ms cubic-bezier(0.2, 0.8, 0.3, 1) both; }
      @keyframes hh-roll { from { transform: rotate(var(--r, 200deg)) scale(0.6); opacity: 0.4; } to { transform: none; opacity: 1; } }
      .hh-paper {
        background-color: ${COLORS.paper};
        background-image:
          radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.07), transparent 60%),
          radial-gradient(ellipse at 50% 110%, rgba(0,0,0,0.22), transparent 60%),
          url(/popup/holidays/paper.webp);
        background-size: auto, auto, cover;
        background-position: center;
      }
      @media (prefers-reduced-motion: reduce) {
        .hh-write, .hh-draw, .hh-fill, .hh-pop, .hh-screen, .hh-sheet, .hh-deal, .hh-roll { animation: none; }
      }
    `}</style>
  );
}
