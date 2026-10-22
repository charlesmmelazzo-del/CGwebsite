"use client";

// Boards for the board & dice games: Word Grid, Five Dice, Farkle, Shut the Box.

import { useEffect, useState } from "react";
import { CATEGORIES, type Category } from "@/lib/holidays/games/fiveDice";
import { scoreDice } from "@/lib/holidays/games/farkle";
import LetterGrid from "../LetterGrid";
import { HandBox, HandButton, handFont, readFont } from "../ui";
import { Big, Board, Buttons, Countdown, Die, NextButton, Note, Seats, useAct } from "./kit";
import type { BoardProps } from "./types";

// ─── Word Grid ───────────────────────────────────────────────────────────────

interface GridView {
  board: string[];
  round: number;
  rounds: number;
  phase: "live" | "results" | "done";
  endsAt: number;
  found: string[];
  rejected: string[];
  counts: { id: string; name: string; words: number }[];
  results: { id: string; name: string; accepted: { word: string; points: number }[]; cancelled: string[]; rejected: string[]; total: number }[] | null;
}

export function WordGridBoard({ view: v, you, send, skew, preview }: BoardProps<GridView>) {
  const { error, act } = useAct(send, preview);

  if (v.phase !== "live" && v.results) {
    return (
      <Board>
        <Big className="pt-2">Round {v.round + 1} results</Big>
        <div className="px-4 space-y-3 py-2">
          {v.results.map((r, n) => (
            <HandBox key={r.id} i={n} className="px-3 py-2">
              <p className={`${handFont.className} text-[24px] font-bold`}>
                {r.id === you ? "You" : r.name} · +{r.total}
              </p>
              <p className={`${readFont.className} text-[16px]`}>{r.accepted.map((a) => `${a.word} (${a.points})`).join(", ") || "No unique words"}</p>
              {r.cancelled.length > 0 && <p className={`${readFont.className} text-[15px] text-[#F5EFE2]/55 line-through`}>{r.cancelled.join(", ")}</p>}
              {r.rejected.length > 0 && <p className={`${readFont.className} text-[14px] text-[#F0A79F]/80`}>Not words: {r.rejected.join(", ")}</p>}
            </HandBox>
          ))}
        </div>
        {v.phase === "results" && <NextButton onClick={() => act({ type: "next" })}>Next round</NextButton>}
      </Board>
    );
  }

  return (
    <Board>
      <Note>Round {v.round + 1} of {v.rounds}</Note>
      <Countdown endsAt={v.endsAt} skew={skew} size={46} />
      <div className="py-2">
        <LetterGrid board={v.board} error={error} onWord={async (path) => void (await act({ type: "word", path }))} />
      </div>
      <p className={`${readFont.className} px-4 text-[16px] text-center`}>
        <span className={`${handFont.className} font-bold text-[19px]`}>Your words ({v.found.length}): </span>
        {v.found.join(", ") || "none yet"}
        {v.rejected.length > 0 && <span className="text-[#F0A79F]/80"> · not words: {v.rejected.join(", ")}</span>}
      </p>
      <Note>{v.counts.filter((c) => c.id !== you).map((c) => `${c.name}: ${c.words}`).join(" · ")}</Note>
    </Board>
  );
}

// ─── Five Dice ───────────────────────────────────────────────────────────────

interface FiveDiceView {
  seats: { id: string; name: string; card: Partial<Record<Category, number>>; upper: number; bonus: number; total: number }[];
  you: number;
  turn: number;
  dice: number[];
  held: boolean[];
  rolls: number;
  preview: Partial<Record<Category, number>>;
  last: { seat: number; category: Category; score: number } | null;
}

export function FiveDiceBoard({ view: v, you, send, preview }: BoardProps<FiveDiceView>) {
  const { error, act } = useAct(send, preview);
  const [held, setHeld] = useState<boolean[]>(v.held);
  const [confirm, setConfirm] = useState<Category | null>(null);
  const mine = v.turn === v.you;
  useEffect(() => {
    setHeld(v.held);
    setConfirm(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when a new roll lands
  }, [v.turn, v.rolls]);
  const showing = v.seats[v.turn];
  const rollKey = `${v.turn}-${v.rolls}-${v.dice.join("")}`;

  return (
    <Board>
      <Seats seats={v.seats} turn={v.turn} you={you} note={(i) => `${v.seats[i].total}`} />
      <div className="flex justify-center gap-2 pt-4 pb-6" key={rollKey}>
        {v.dice.map((d, i) => (
          <Die key={i} i={i} value={d} held={v.rolls > 0 && held[i]} rolling={v.rolls > 0 && !held[i]} onClick={mine && v.rolls > 0 && v.rolls < 3 ? () => setHeld((cur) => cur.map((h, k) => (k === i ? !h : h))) : undefined} />
        ))}
      </div>
      <Note tone={error ? "error" : undefined}>
        {error ?? (mine ? (v.rolls === 0 ? "Roll the dice!" : v.rolls < 3 ? `Roll ${v.rolls} of 3 · tap dice to keep them, or pick a box` : "Last roll — pick a box") : `${showing.name}'s turn${v.rolls ? ` · roll ${v.rolls} of 3` : ""}`)}
      </Note>
      {mine && v.rolls < 3 && <NextButton onClick={() => act({ type: "roll", held })}>{v.rolls === 0 ? "Roll" : `Roll again (${3 - v.rolls} left)`}</NextButton>}

      {/* The active player's scorecard, with what each open box would score. */}
      <div className="px-4 pt-1">
        <p className={`${handFont.className} text-[21px] font-bold text-center`}>{mine ? "Your scorecard" : `${showing.name}'s scorecard`}</p>
        <ul className="mt-1 divide-y divide-[#F5EFE2]/10">
          {CATEGORIES.map((c) => {
            const filled = showing.card[c.key];
            const could = v.preview[c.key];
            const tappable = mine && filled === undefined && v.rolls > 0;
            return (
              <li key={c.key}>
                <button
                  type="button"
                  disabled={!tappable}
                  onClick={() => (confirm === c.key ? act({ type: "score", category: c.key }) : setConfirm(c.key))}
                  className={`w-full flex justify-between py-1.5 ${readFont.className} text-[17px] ${confirm === c.key ? "text-[#F5EFE2] font-bold" : ""}`}
                >
                  <span>{c.label}</span>
                  <span className={filled !== undefined ? "" : "text-[#F5EFE2]/50"}>
                    {filled !== undefined ? filled : could !== undefined ? (confirm === c.key ? `tap again to score ${could}` : `(${could})`) : "–"}
                  </span>
                </button>
              </li>
            );
          })}
          <li className={`flex justify-between py-1.5 ${handFont.className} text-[20px] font-bold`}>
            <span>Upper {showing.upper}/63 · bonus {showing.bonus}</span>
            <span>Total {showing.total}</span>
          </li>
        </ul>
      </div>
    </Board>
  );
}

// ─── Farkle ──────────────────────────────────────────────────────────────────

interface FarkleView {
  seats: { id: string; name: string; banked: number; final: boolean }[];
  you: number;
  turn: number;
  turnTotal: number;
  dice: number[];
  phase: "roll" | "choose" | "over";
  canBankFrom: number;
  finals: boolean;
  last: { seat: number; kind: "farkle" | "bank"; points: number; dice: number[]; name: string } | null;
}

export function FarkleBoard({ view: v, you, send, preview }: BoardProps<FarkleView>) {
  const { error, act } = useAct(send, preview);
  const [keep, setKeep] = useState<number[]>([]);
  const mine = v.turn === v.you;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when a new roll lands
  useEffect(() => setKeep([]), [v.dice.join(""), v.turn, v.turnTotal]);
  const picked = keep.map((i) => v.dice[i]);
  const keepScore = keep.length ? scoreDice(picked) : 0;
  const running = v.turnTotal + Math.max(0, keepScore);
  const canBank = keepScore > 0 && running >= v.canBankFrom;
  const rollKey = `${v.turn}-${v.turnTotal}-${v.dice.join("")}`;

  return (
    <Board>
      <Seats seats={v.seats} turn={v.turn} you={you} note={(i) => `${v.seats[i].banked.toLocaleString()}${v.seats[i].final ? " · final turn" : ""}`} />
      {v.finals && <Note>Someone reached 10,000 — everyone else gets one last turn!</Note>}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-3">
        {v.last && v.last.kind === "farkle" && v.phase === "roll" && (
          <div className="flex flex-col items-center gap-1">
            <div className="flex gap-1.5">{v.last.dice.map((d, i) => <Die key={i} value={d} size={34} i={i} />)}</div>
            <Note>{v.last.name} farkled{v.last.points ? ` and lost ${v.last.points}` : ""}!</Note>
          </div>
        )}
        {v.last && v.last.kind === "bank" && v.phase === "roll" && <Note>{v.last.name} banked {v.last.points.toLocaleString()}.</Note>}
        {v.phase === "choose" && (
          <div className="flex flex-wrap justify-center gap-2 pb-4" key={rollKey}>
            {v.dice.map((d, i) => (
              <Die key={i} i={i} value={d} rolling held={keep.includes(i)} onClick={mine ? () => setKeep((k) => (k.includes(i) ? k.filter((x) => x !== i) : [...k, i])) : undefined} />
            ))}
          </div>
        )}
        <Big className="text-[32px]">
          {v.turnTotal ? `${v.turnTotal.toLocaleString()} riding` : v.phase === "roll" ? (mine ? "Your turn — roll!" : `${v.seats[v.turn].name}'s turn`) : "Nothing banked yet this turn"}
        </Big>
        {mine && v.phase === "choose" && (
          <Note tone={keepScore < 0 ? "error" : undefined}>
            {keep.length === 0 ? "Tap the scoring dice you want to keep" : keepScore < 0 ? "Every die you keep has to score" : `Keeping ${keepScore} → ${running.toLocaleString()} this turn${running < v.canBankFrom ? ` (need ${v.canBankFrom} to bank)` : ""}`}
          </Note>
        )}
        <Note tone="error">{error}</Note>
      </div>
      {mine && v.phase === "roll" && <NextButton onClick={() => act({ type: "roll" })}>Roll six dice</NextButton>}
      {mine && v.phase === "choose" && (
        <Buttons>
          <HandButton small disabled={!canBank} onClick={() => act({ type: "bank", keep })}>Bank {canBank ? running.toLocaleString() : ""}</HandButton>
          <HandButton small primary i={1} disabled={keepScore <= 0} onClick={() => act({ type: "roll", keep })}>
            Roll {keepScore > 0 ? (v.dice.length - keep.length || 6) : ""} {keepScore > 0 && v.dice.length === keep.length ? "(hot dice!)" : ""}
          </HandButton>
        </Buttons>
      )}
    </Board>
  );
}

// ─── Shut the Box ────────────────────────────────────────────────────────────

interface BoxView {
  seats: { id: string; name: string; penalty: number }[];
  turn: number;
  yourTurn: boolean;
  round: number;
  rounds: number;
  open: number[];
  roll: number[] | null;
  oneDie: boolean;
  last: { seat: number; penalty: number; shut: boolean; roll: number[] | null; name: string } | null;
}

export function ShutTheBoxBoard({ view: v, you, send, preview }: BoardProps<BoxView>) {
  const { error, act } = useAct(send, preview);
  const [sel, setSel] = useState<number[]>([]);
  useEffect(() => setSel([]), [v.roll, v.turn]);
  const total = v.roll ? v.roll.reduce((t, n) => t + n, 0) : 0;
  const chosen = sel.reduce((t, n) => t + n, 0);

  return (
    <Board>
      <Note>Round {v.round + 1} of {v.rounds} · lowest total wins</Note>
      <Seats seats={v.seats} turn={v.turn} you={you} note={(i) => `${v.seats[i].penalty}`} />
      <div className="flex justify-center gap-1 px-2 pt-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
          const open = v.open.includes(n);
          const on = sel.includes(n);
          return (
            <button
              key={n}
              type="button"
              disabled={!v.yourTurn || !v.roll || !open}
              onClick={() => setSel((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]))}
              aria-label={`Tile ${n}${open ? "" : ", shut"}`}
              aria-pressed={on}
              className="relative w-[36px] h-[64px] transition-transform"
              style={{ transform: open ? (on ? "translateY(-6px)" : "none") : "translateY(6px) scale(0.94)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- static tile art */}
              <img src={`/popup/holidays/box/${open ? "open" : "shut"}-${n}.webp`} alt="" width={36} height={60} draggable={false} className="absolute inset-0 w-full h-full object-contain select-none" style={on ? { filter: "drop-shadow(0 0 2px #D63A2F) drop-shadow(0 0 1px #D63A2F)" } : undefined} />
            </button>
          );
        })}
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-2 py-3">
        {v.roll && (
          <div className="flex gap-3" key={v.roll.join("-") + v.open.length}>
            {v.roll.map((d, i) => <Die key={i} value={d} i={i} rolling />)}
          </div>
        )}
        {v.roll && <Big className="text-[30px]">Rolled {total}{v.yourTurn && sel.length ? ` · picked ${chosen}` : ""}</Big>}
        {!v.roll && v.last && (
          <Note>
            {v.last.name} {v.last.roll ? `rolled ${v.last.roll.reduce((t, n) => t + n, 0)} and ` : ""}
            {v.last.shut ? "shut the box!" : `was stuck with ${v.last.penalty}.`}
          </Note>
        )}
        <Note tone={error ? "error" : undefined}>{error ?? (v.yourTurn ? (v.roll ? "Pick open tiles that add up to the roll" : "Roll the dice") : `${v.seats[v.turn].name}'s turn`)}</Note>
      </div>
      {v.yourTurn && !v.roll && (
        <Buttons>
          {v.oneDie && <HandButton small onClick={() => act({ type: "roll", dice: 1 })}>Roll one die</HandButton>}
          <HandButton small primary i={1} onClick={() => act({ type: "roll", dice: 2 })}>Roll two dice</HandButton>
        </Buttons>
      )}
      {v.yourTurn && v.roll && <NextButton onClick={() => chosen === total && act({ type: "close", tiles: sel })}>{chosen === total ? `Shut ${sel.join(" + ")}` : `Pick tiles adding up to ${total}`}</NextButton>}
    </Board>
  );
}
