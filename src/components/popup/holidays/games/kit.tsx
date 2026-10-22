"use client";

// ─── Shared pieces for the game boards ───────────────────────────────────────
// Dominoes, dice, a card hand, seat lists, timers and team scores, all drawn
// in the pop-up's pen-and-paper style.

import { useState, type CSSProperties, type ReactNode } from "react";
import { ends } from "@/lib/holidays/dominoes";
import PlayingCard, { cardName } from "../PlayingCard";
import { useCountdown } from "../useRoom";
import { at, COLORS, HandBox, HandButton, handFont, readFont, sketchPath } from "../ui";

// ─── Dominoes ────────────────────────────────────────────────────────────────

/**
 * Finished domino art: (a, b) → image path, drawn with `a` on the left/top.
 * Null = draw the tiles. See the design prompt.
 */
export const DOMINO_ART: ((a: number, b: number) => string) | null = null;

/** Pip positions on a 3×3 grid for 0–9; 10–12 add a middle column (double-twelve). */
const PIPS: Record<number, [number, number][]> = {
  0: [],
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
  7: [[0, 0], [0, 1], [0, 2], [1, 1], [2, 0], [2, 1], [2, 2]],
  8: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2]],
  9: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
};

function Half({ n, x, y, size }: { n: number; x: number; y: number; size: number }) {
  if (n > 9) {
    // 10–12: a numeral reads better than a crowd of dots on a phone.
    return (
      <text x={x + size / 2} y={y + size / 2 + size * 0.17} textAnchor="middle" fontSize={size * 0.5} fontWeight={700} className={handFont.className} fill={COLORS.cardInk}>
        {n}
      </text>
    );
  }
  const step = size / 4;
  return (
    <>
      {PIPS[n].map(([r, c], i) => (
        <circle key={i} cx={x + step * (c + 1)} cy={y + step * (r + 1)} r={size * 0.085} fill={COLORS.cardInk} />
      ))}
    </>
  );
}

/** A domino showing [a, b]. Horizontal by default (a on the left). */
export function Domino({
  a,
  b,
  size = 26,
  vertical,
  selected,
  dim,
  seed = 1,
}: {
  a: number;
  b: number;
  /** Width of one half, in px. */
  size?: number;
  vertical?: boolean;
  selected?: boolean;
  dim?: boolean;
  seed?: number;
}) {
  const w = vertical ? size : size * 2;
  const h = vertical ? size * 2 : size;
  if (DOMINO_ART) {
    // eslint-disable-next-line @next/next/no-img-element -- static tile art
    return <img src={DOMINO_ART(a, b)} alt={`${a}–${b}`} width={w} height={h} className={`${vertical ? "rotate-90" : ""} ${dim ? "opacity-40" : ""}`} />;
  }
  return (
    <svg
      width={w}
      height={h}
      role="img"
      aria-label={`Domino ${a}–${b}`}
      className={`shrink-0 overflow-visible transition-transform ${selected ? "-translate-y-1.5" : ""} ${dim ? "opacity-40" : ""}`}
    >
      <path d={sketchPath(w, h, seed)} fill={COLORS.cardFace} stroke={selected ? COLORS.star : COLORS.cardInk} strokeWidth={selected ? 2.4 : 1.4} />
      {vertical ? (
        <line x1={size * 0.18} x2={size * 0.82} y1={size} y2={size} stroke={COLORS.cardInk} strokeWidth={1.2} />
      ) : (
        <line x1={size} x2={size} y1={size * 0.18} y2={size * 0.82} stroke={COLORS.cardInk} strokeWidth={1.2} />
      )}
      <Half n={a} x={0} y={0} size={size} />
      <Half n={b} x={vertical ? 0 : size} y={vertical ? size : 0} size={size} />
    </svg>
  );
}

export function TileButton({ tile, onClick, selected, dim, size = 24, i = 0 }: { tile: string; onClick?: () => void; selected?: boolean; dim?: boolean; size?: number; i?: number }) {
  const [a, b] = ends(tile);
  return (
    <button type="button" onClick={onClick} disabled={!onClick} aria-pressed={selected} aria-label={`Domino ${a}–${b}`} className="hh-deal p-0.5" style={at(i)}>
      <Domino a={a} b={b} size={size} vertical selected={selected} dim={dim} seed={i + 30} />
    </button>
  );
}

/** A tile hand that wraps onto more rows instead of scrolling. */
export function TileHand({ tiles, legal, selected, onPick, size }: { tiles: string[]; legal?: (t: string) => boolean; selected?: string | null; onPick?: (t: string) => void; size?: number }) {
  return (
    <div className="flex flex-wrap justify-center gap-1 px-3">
      {tiles.map((t, i) => {
        const ok = legal ? legal(t) : true;
        return <TileButton key={t} tile={t} i={i} size={size} selected={selected === t} dim={!!legal && !ok} onClick={onPick && ok ? () => onPick(t) : undefined} />;
      })}
    </div>
  );
}

// ─── Dice ────────────────────────────────────────────────────────────────────

/** Finished die art per face (1–6). Null = draw them. */
export const DIE_ART: ((face: number) => string) | null = null;

export function Die({ value, size = 52, held, onClick, label, i = 0, rolling }: { value: number; size?: number; held?: boolean; onClick?: () => void; label?: string; i?: number; rolling?: boolean }) {
  const face = DIE_ART ? (
    // eslint-disable-next-line @next/next/no-img-element -- static die art
    <img src={DIE_ART(value)} alt="" width={size} height={size} />
  ) : (
    <svg width={size} height={size} className="overflow-visible" aria-hidden>
      <path d={sketchPath(size, size, value + i * 3)} fill={held ? COLORS.ink : COLORS.cardFace} stroke={held ? COLORS.star : COLORS.cardInk} strokeWidth={held ? 2.6 : 1.4} />
      {(PIPS[value] ?? []).map(([r, c], k) => (
        <circle key={k} cx={(size / 4) * (c + 1)} cy={(size / 4) * (r + 1)} r={size * 0.085} fill={COLORS.cardInk} />
      ))}
    </svg>
  );
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-pressed={held}
      aria-label={label ?? `Die showing ${value}${held ? ", kept" : ""}`}
      className={`relative ${rolling ? "hh-roll" : ""} ${held ? "-translate-y-1" : ""} transition-transform`}
      style={{ ...at(i), "--r": `${(i % 2 ? 1 : -1) * (180 + i * 40)}deg` } as CSSProperties}
    >
      {face}
      {held && <span className={`${handFont.className} absolute -bottom-5 left-0 right-0 text-center text-[15px] font-bold text-[#F5EFE2]/80`}>kept</span>}
    </button>
  );
}

// ─── Cards ───────────────────────────────────────────────────────────────────

/** A hand of cards with optional multi-select. Wraps to two rows on big hands. */
export function CardHand({
  cards,
  selected = [],
  onToggle,
  dimmed,
  width,
}: {
  cards: string[];
  selected?: string[];
  onToggle?: (c: string) => void;
  /** Cards to grey out (not playable). */
  dimmed?: (c: string) => boolean;
  width?: number;
}) {
  const w = width ?? (cards.length > 13 ? 44 : cards.length > 8 ? 50 : 60);
  return (
    <div className="flex flex-wrap justify-center px-2 pt-3 pb-1" style={{ rowGap: 6 }}>
      {cards.map((c, i) => (
        <button
          key={c}
          type="button"
          onClick={onToggle ? () => onToggle(c) : undefined}
          disabled={!onToggle}
          aria-label={cardName(c)}
          aria-pressed={selected.includes(c)}
          className="hh-deal -ml-3 first:ml-0"
          style={at(i * 0.5)}
        >
          <PlayingCard card={c} width={w} seed={i + 20} lifted={selected.includes(c)} dim={dimmed?.(c)} />
        </button>
      ))}
    </div>
  );
}

// ─── Table furniture ─────────────────────────────────────────────────────────

/** Everyone at the table, with a note each (card count, score…). */
export function Seats({ seats, turn, you, note }: { seats: { id: string; name: string; team?: number }[]; turn: number | string | null; you: string; note?: (i: number) => ReactNode }) {
  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-0.5 px-3 pt-1">
      {seats.map((p, i) => {
        const on = turn === i || turn === p.id;
        return (
          <li key={p.id} className={`${readFont.className} text-[16px] ${on ? "text-[#F5EFE2]" : "text-[#F5EFE2]/55"}`}>
            {on && <span style={{ color: COLORS.star }}>★ </span>}
            {p.id === you ? "You" : p.name}
            {p.team !== undefined && <span className="text-[#F5EFE2]/45"> ({p.team === 0 ? "M" : "G"})</span>}
            {note && <span className="text-[#F5EFE2]/55"> · {note(i)}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function TeamScores({ teams, active, unit }: { teams: { name: string; score: number }[]; active?: number; unit?: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 px-3">
      {teams.map((t, i) => (
        <HandBox key={t.name} i={i} className={`px-2 py-1.5 text-center ${active === undefined || active === i ? "" : "opacity-60"}`}>
          <p className={`${handFont.className} text-[19px] font-bold leading-tight`}>
            {active === i && <span style={{ color: COLORS.star }}>★ </span>}
            {t.name}
          </p>
          <p className={`${handFont.className} text-[30px] font-bold leading-none`}>
            {t.score}
            {unit && <span className="text-[16px] text-[#F5EFE2]/60"> {unit}</span>}
          </p>
        </HandBox>
      ))}
    </div>
  );
}

/** Seconds left on a deadline, big and handwritten; turns red at 10. */
export function Countdown({ endsAt, skew, size = 56 }: { endsAt: number | null; skew: number; size?: number }) {
  const left = useCountdown(endsAt, skew);
  if (left === null) return null;
  return (
    <p className={`${handFont.className} font-bold leading-none tabular-nums text-center`} style={{ fontSize: size, color: left <= 10 ? COLORS.star : undefined }} aria-live="off">
      {left >= 60 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : left}
    </p>
  );
}

export function Note({ children, tone }: { children: ReactNode; tone?: "error" }) {
  if (!children) return null;
  return (
    <p className={`${readFont.className} text-center text-[16px] px-4 min-h-[22px] ${tone === "error" ? "text-[#F0A79F]" : "text-[#F5EFE2]/75"}`} aria-live="polite">
      {children}
    </p>
  );
}

export function Big({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`${handFont.className} text-center text-[26px] font-bold leading-tight ${className}`}>{children}</p>;
}

/** The "deal the next hand" style button any player can press between hands. */
export function NextButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <div className="px-4 pb-2">
      <HandButton primary small onClick={onClick}>
        {children}
      </HandButton>
    </div>
  );
}

export function Buttons({ children }: { children: ReactNode }) {
  return <div className="px-4 pb-2 grid grid-cols-2 gap-2 [&>*:only-child]:col-span-2">{children}</div>;
}

/** Board wrapper: scrolls when the phone is short. */
export function Board({ children }: { children: ReactNode }) {
  return <div className="h-full overflow-y-auto flex flex-col pb-3">{children}</div>;
}

/** Send an action and keep its error message for display. */
export function useAct(send: (a: unknown) => Promise<string | null>, preview?: boolean) {
  const [error, setError] = useState<string | null>(null);
  const act = async (a: unknown) => {
    if (preview) return;
    setError(await send(a));
  };
  return { error, act, clear: () => setError(null) };
}
