"use client";

// ─── Word Grid's letter board ────────────────────────────────────────────────
// Press a letter and drag through touching letters (diagonals count); lift
// your finger to add the word. Slide back onto the previous letter to undo
// it. A red pen line follows your path.
//
// Tapping still works too, for anyone who finds dragging awkward: tap letters
// one at a time, then Add word.

import { useEffect, useRef, useState } from "react";
import { adjacent } from "@/lib/holidays/games/wordGrid";
import { COLORS, HandButton, handFont, readFont, sketchPath } from "./ui";

const MAX_CELL = 74;
const GAP = 6;

export default function LetterGrid({ board, onWord, error, hint = true }: { board: string[]; onWord: (path: number[]) => Promise<void> | void; error?: string | null; hint?: boolean }) {
  const [path, setPath] = useState<number[]>([]);
  // Tiles shrink to fit narrow phones (16 px margins each side).
  const [CELL, setCell] = useState(MAX_CELL);
  useEffect(() => {
    const fitCell = () => setCell(Math.min(MAX_CELL, Math.floor((window.innerWidth - 32 - GAP * 3) / 4)));
    fitCell();
    window.addEventListener("resize", fitCell);
    return () => window.removeEventListener("resize", fitCell);
  }, []);
  const [dragging, setDragging] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ start: number; tapBase: number[]; moved: boolean; path: number[] } | null>(null);
  const word = path.map((i) => board[i]).join("").toLowerCase();

  /** The tile under a finger, only when it's well inside the tile (so diagonals don't misfire). */
  function tileAt(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y)?.closest("[data-tile]") as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const inner = 0.36;
    if (Math.abs(x - (r.left + r.width / 2)) > r.width * inner || Math.abs(y - (r.top + r.height / 2)) > r.height * inner) return null;
    return Number(el.dataset.tile);
  }

  function tap(i: number, base: number[]) {
    if (base[base.length - 1] === i) return base.slice(0, -1); // tap the last letter again to undo it
    if (base.includes(i)) return base;
    if (base.length && !adjacent(base[base.length - 1], i)) return [i]; // start a new word
    return [...base, i];
  }

  async function submit(p: number[]) {
    const w = p.map((i) => board[i]).join("");
    setPath([]);
    if (w.length >= 3) await onWord(p);
  }

  function onPointerDown(e: React.PointerEvent) {
    const i = tileAt(e.clientX, e.clientY) ?? (() => {
      const el = (e.target as HTMLElement).closest("[data-tile]") as HTMLElement | null;
      return el ? Number(el.dataset.tile) : null;
    })();
    if (i === null) return;
    e.preventDefault();
    try {
      gridRef.current?.setPointerCapture(e.pointerId); // keep getting moves if the finger leaves the grid
    } catch {
      // Some browsers refuse capture; moves over the grid still work.
    }
    drag.current = { start: i, tapBase: path, moved: false, path: [i] };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const j = tileAt(e.clientX, e.clientY);
    if (j === null) return;
    const p = d.path;
    const last = p[p.length - 1];
    if (j === last) return;
    if (p.length > 1 && j === p[p.length - 2]) d.path = p.slice(0, -1); // slid back: undo
    else if (!p.includes(j) && adjacent(last, j)) d.path = [...p, j];
    else return;
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
    }
    setPath(d.path);
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    if (d.moved) void submit(d.path);
    else setPath(tap(d.start, d.tapBase));
  }

  const center = (i: number) => [(i % 4) * (CELL + GAP) + CELL / 2, Math.floor(i / 4) * (CELL + GAP) + CELL / 2];
  const size = CELL * 4 + GAP * 3;

  return (
    <div className="flex flex-col items-center">
      <div
        ref={gridRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative grid grid-cols-4 select-none"
        style={{ gap: GAP, width: size, height: size, touchAction: "none" }}
      >
        {board.map((l, i) => {
          const on = path.includes(i);
          const last = path[path.length - 1] === i;
          return (
            <div
              key={i}
              data-tile={i}
              role="button"
              tabIndex={0}
              aria-label={`Letter ${l}`}
              aria-pressed={on}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setPath((p) => tap(i, p)))}
              className="relative flex items-center justify-center cursor-pointer"
              style={{ width: CELL, height: CELL }}
            >
              <svg width={CELL} height={CELL} className="absolute inset-0 overflow-visible pointer-events-none" aria-hidden>
                <path d={sketchPath(CELL, CELL, i + 3)} fill={on ? COLORS.ink : COLORS.cardFace} stroke={last ? COLORS.star : COLORS.cardInk} strokeWidth={last ? 3 : 1.4} />
              </svg>
              <span className={`${handFont.className} relative font-bold pointer-events-none`} style={{ color: COLORS.cardInk, fontSize: Math.round(CELL * 0.54) }}>
                {l}
              </span>
            </div>
          );
        })}
        {/* The pen line through the chosen letters. */}
        {path.length > 1 && (
          <svg width={size} height={size} className="absolute inset-0 pointer-events-none" aria-hidden>
            <polyline points={path.map((i) => center(i).join(",")).join(" ")} fill="none" stroke={COLORS.star} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
          </svg>
        )}
      </div>

      <p className={`${handFont.className} text-center text-[36px] font-bold min-h-[44px] tracking-[0.08em] uppercase`}>{word || " "}</p>
      {error ? (
        <p className={`${readFont.className} text-center text-[16px] text-[#F0A79F]`}>{error}</p>
      ) : (
        hint && <p className={`${readFont.className} text-center text-[16px] text-[#F5EFE2]/75`}>{dragging ? "Lift your finger to add it" : "Drag through touching letters — or tap them one by one"}</p>
      )}
      <div className="w-full px-4 pt-2 grid grid-cols-2 gap-2">
        <HandButton small onClick={() => setPath([])}>
          Clear
        </HandButton>
        <HandButton small primary i={1} disabled={word.length < 3} onClick={() => submit(path)}>
          Add word
        </HandButton>
      </div>
    </div>
  );
}
