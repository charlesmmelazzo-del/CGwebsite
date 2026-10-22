"use client";

// Boards for the four domino games: Draw Dominoes, All Fives, Texas 42, Train Dominoes.

import { useEffect, useState } from "react";
import { TEAM_NAMES } from "@/lib/holidays/common";
import { ends } from "@/lib/holidays/dominoes";
import type { Arm, Layout, Port } from "@/lib/holidays/games/allFives";
import { bidLabel, bidLegal, type Bid, type Trump } from "@/lib/holidays/games/texas42";
import { HandButton, handFont, readFont } from "../ui";
import { Big, Board, Buttons, Domino, NextButton, Note, Seats, TeamScores, TileHand, useAct } from "./kit";
import type { BoardProps } from "./types";

/**
 * The line of laid tiles. On a phone it wraps onto as many rows as it needs —
 * read it left to right, row by row — so both open ends are always on screen,
 * and the two end numbers are spelled out underneath.
 */
function Line({ tiles, size = 26 }: { tiles: [number, number][]; size?: number }) {
  if (!tiles.length) return null;
  return (
    <div className="w-full px-3">
      <div className="flex flex-wrap items-center justify-center gap-x-0.5 gap-y-2 py-1">
        {tiles.map(([a, b], i) => (a === b ? <Domino key={i} a={a} b={b} size={size} vertical seed={i} /> : <Domino key={i} a={a} b={b} size={size} seed={i} />))}
      </div>
      <p className={`${handFont.className} text-center text-[20px] font-bold text-[#F5EFE2]/80`}>
        Left end {tiles[0][0]} · right end {tiles[tiles.length - 1][1]}
      </p>
    </div>
  );
}

// ─── Draw Dominoes ───────────────────────────────────────────────────────────

interface DrawView {
  seats: { id: string; name: string; tiles: number }[];
  you: number;
  hand: string[];
  legal: Record<string, ("left" | "right")[]>;
  line: [number, number][];
  boneyard: number;
  turn: number;
  phase: "play" | "handOver" | "over";
  result: { winner: number | null; points: number; blocked: boolean } | null;
  drew: number;
  log: string;
}

export function DrawDominoesBoard({ view: v, you, send, preview }: BoardProps<DrawView>) {
  const { error, act } = useAct(send, preview);
  const [sel, setSel] = useState<string | null>(null);
  const mine = v.turn === v.you && v.phase === "play";
  useEffect(() => setSel(null), [v.turn, v.hand.length]);
  const canPlay = Object.keys(v.legal).length > 0;

  function pickTile(t: string) {
    const options = v.legal[t];
    if (options.length === 1) void act({ type: "play", tile: t, end: options[0] });
    else setSel(t);
  }

  return (
    <Board>
      <Seats seats={v.seats} turn={v.phase === "play" ? v.turn : null} you={you} note={(i) => `${v.seats[i].tiles} tiles`} />
      <div className="flex-1 flex flex-col items-center justify-center gap-2 py-3">
        {v.line.length ? <Line tiles={v.line} /> : <Big>{mine ? "Lead any tile" : "Waiting for the first tile"}</Big>}
        <Note>Boneyard: {v.boneyard}</Note>
        {v.result && <Big>{v.result.winner === null ? "Blocked — a tie for lowest, no score" : `${v.seats[v.result.winner].name} +${v.result.points}${v.result.blocked ? " (blocked, lowest hand)" : ""}`}</Big>}
        <Note tone={error ? "error" : undefined}>{error ?? (v.drew && mine ? `You drew ${v.drew}.` : v.log)}</Note>
      </div>
      {v.phase === "handOver" && <NextButton onClick={() => act({ type: "nextHand" })}>Next hand</NextButton>}
      {mine && sel && (
        <Buttons>
          <HandButton small onClick={() => act({ type: "play", tile: sel, end: "left" })}>◀ Left end</HandButton>
          <HandButton small i={1} onClick={() => act({ type: "play", tile: sel, end: "right" })}>Right end ▶</HandButton>
        </Buttons>
      )}
      {mine && !canPlay && (
        <NextButton onClick={() => act({ type: "draw" })}>{v.boneyard ? "Nothing fits — draw" : "Nothing fits — pass"}</NextButton>
      )}
      <p className={`${handFont.className} text-center text-[19px] font-bold text-[#F5EFE2]/60`}>{mine ? (canPlay ? "Tap a tile to play it" : "No tile fits") : "Your tiles"}</p>
      <TileHand tiles={v.hand} selected={sel} legal={mine ? (t) => !!v.legal[t] : undefined} onPick={mine ? pickTile : undefined} />
    </Board>
  );
}

// ─── All Fives ───────────────────────────────────────────────────────────────

interface FivesView {
  seats: { id: string; name: string; tiles: number }[];
  you: number;
  hand: string[];
  legal: Record<string, { port: Port; sum: number }[]>;
  layout: Layout;
  endSum: number;
  boneyard: number;
  turn: number;
  phase: "play" | "handOver" | "over";
  lastScore: { seat: number; points: number; sum: number } | null;
  result: { winner: number | null; bonus: number } | null;
  drew: number;
  log: string;
}

const PORT_LABEL: Record<Port, string> = { left: "◀ Left", right: "Right ▶", W: "◀ Left arm", E: "Right arm ▶", N: "▲ Top arm", S: "▼ Bottom arm" };

/** The last few tiles of an arm, outward from the spinner. */
function ArmView({ links, vertical, reverse }: { links: Layout["arms"][Arm]; vertical?: boolean; reverse?: boolean }) {
  const shown = links.slice(-3);
  const hidden = links.length - shown.length;
  const tiles = shown.map((l, i) => {
    const pair: [number, number] = reverse ? [l.far, l.near] : [l.near, l.far];
    const dbl = l.near === l.far;
    return <Domino key={i} a={pair[0]} b={pair[1]} size={24} vertical={vertical ? !dbl : dbl} seed={i + 40} />;
  });
  return (
    <div className={`flex items-center gap-0.5 ${vertical ? "flex-col" : ""} ${reverse ? (vertical ? "flex-col-reverse" : "flex-row-reverse") : ""}`}>
      {tiles}
      {hidden > 0 && <span className={`${handFont.className} text-[15px] font-bold text-[#F5EFE2]/60`}>+{hidden}</span>}
    </div>
  );
}

export function AllFivesBoard({ view: v, you, send, preview }: BoardProps<FivesView>) {
  const { error, act } = useAct(send, preview);
  const [sel, setSel] = useState<string | null>(null);
  const mine = v.turn === v.you && v.phase === "play";
  useEffect(() => setSel(null), [v.turn, v.hand.length]);
  const L = v.layout;
  const canPlay = Object.keys(v.legal).length > 0;

  function pickTile(t: string) {
    const options = v.legal[t];
    if (options.length === 1) void act({ type: "play", tile: t, port: options[0].port });
    else setSel(t);
  }

  return (
    <Board>
      <Seats seats={v.seats} turn={v.phase === "play" ? v.turn : null} you={you} note={(i) => `${v.seats[i].tiles}`} />
      <div className="flex-1 flex flex-col items-center justify-center gap-2 py-2">
        {L.spinner === null ? (
          L.line.length ? <Line tiles={L.line.map((l) => [l.near, l.far])} /> : <Big>{mine ? "Lead any tile" : "Waiting for the first tile"}</Big>
        ) : (
          <div className="grid grid-cols-[1fr_auto_1fr] grid-rows-[auto_auto_auto] items-center justify-items-center gap-1">
            <div className="col-start-2 row-start-1"><ArmView links={L.arms.N} vertical reverse /></div>
            <div className="col-start-1 row-start-2 justify-self-end"><ArmView links={L.arms.W} reverse /></div>
            <div className="col-start-2 row-start-2"><Domino a={L.spinner} b={L.spinner} size={28} vertical seed={99} /></div>
            <div className="col-start-3 row-start-2 justify-self-start"><ArmView links={L.arms.E} /></div>
            <div className="col-start-2 row-start-3"><ArmView links={L.arms.S} vertical /></div>
          </div>
        )}
        <Big>Ends add up to {v.endSum}{v.endSum > 0 && v.endSum % 5 === 0 ? " ★" : ""}</Big>
        {v.lastScore && v.lastScore.points > 0 && <Note>{v.seats[v.lastScore.seat].name} scored {v.lastScore.points}!</Note>}
        {v.result && <Big>{v.result.winner === null ? "Blocked — tied, no bonus" : `${v.seats[v.result.winner].name} +${v.result.bonus} bonus`}</Big>}
        <Note>Boneyard: {v.boneyard}</Note>
        <Note tone={error ? "error" : undefined}>{error ?? v.log}</Note>
      </div>
      {v.phase === "handOver" && <NextButton onClick={() => act({ type: "nextHand" })}>Next hand</NextButton>}
      {mine && sel && (
        <div className="px-4 pb-2 grid grid-cols-2 gap-2">
          {v.legal[sel].map((o, i) => (
            <HandButton key={o.port} small i={i} onClick={() => act({ type: "play", tile: sel, port: o.port })}>
              {PORT_LABEL[o.port]} → {o.sum}
              {o.sum > 0 && o.sum % 5 === 0 ? " ★" : ""}
            </HandButton>
          ))}
        </div>
      )}
      {mine && !canPlay && <NextButton onClick={() => act({ type: "draw" })}>{v.boneyard ? "Nothing fits — draw" : "Nothing fits — pass"}</NextButton>}
      <p className={`${handFont.className} text-center text-[19px] font-bold text-[#F5EFE2]/60`}>{mine ? (canPlay ? "Tap a tile · ★ = it scores" : "No tile fits") : "Your tiles"}</p>
      <TileHand tiles={v.hand} selected={sel} legal={mine ? (t) => !!v.legal[t] : undefined} onPick={mine ? pickTile : undefined} />
    </Board>
  );
}

// ─── Texas 42 ────────────────────────────────────────────────────────────────

interface FortyTwoView {
  seats: { id: string; name: string; team: number; tiles: number }[];
  you: number;
  hand: string[];
  legal: string[];
  phase: "bid" | "trump" | "play" | "handOver" | "over";
  dealer: number;
  turn: number;
  bids: { seat: number; bid: Bid | null }[];
  high: { seat: number; bid: Bid } | null;
  trump: Trump | null;
  trick: { seat: number; tile: string }[];
  points: number[];
  tricks: number[];
  lastTrick: { tiles: { seat: number; tile: string }[]; winner: number } | null;
  marks: [number, number];
  result: { bidders: number; made: boolean; marks: number; points: number } | null;
  log: string;
}

export function Texas42Board({ view: v, you, send, preview }: BoardProps<FortyTwoView>) {
  const { error, act } = useAct(send, preview);
  const mine = v.turn === v.you;
  const [points, setPoints] = useState(30);
  const high = v.high?.bid ?? null;
  useEffect(() => {
    if (high && "points" in high) setPoints(Math.min(42, high.points + 1));
  }, [high]);
  const showTrick = v.trick.length ? v.trick : v.lastTrick?.tiles ?? [];
  const marksBid: Bid = !high || "points" in high ? { marks: 2 } : { marks: high.marks + 1 };

  return (
    <Board>
      <TeamScores teams={[0, 1].map((t) => ({ name: TEAM_NAMES[t], score: v.marks[t] }))} unit="marks" />
      <Seats seats={v.seats} turn={v.phase === "handOver" ? null : v.turn} you={you} note={(i) => (i === v.dealer ? "dealer" : `${v.seats[i].tiles}`)} />
      <div className="flex-1 flex flex-col items-center justify-center gap-2 py-2">
        {v.phase === "bid" && (
          <ul className={`${readFont.className} text-[17px] text-center`}>
            {v.bids.map((b) => (
              <li key={b.seat}>{v.seats[b.seat].name}: {b.bid ? bidLabel(b.bid) : "pass"}</li>
            ))}
            {v.bids.length === 0 && <li className="text-[#F5EFE2]/60">Bidding starts left of the dealer</li>}
          </ul>
        )}
        {v.high && v.phase !== "bid" && (
          <p className={`${handFont.className} text-[21px] font-bold`}>
            {v.seats[v.high.seat].name} bid {bidLabel(v.high.bid)}
            {v.trump !== null && ` · ${v.trump === "doubles" ? "doubles" : `${v.trump}s`} are trumps`}
          </p>
        )}
        {(v.phase === "play" || v.phase === "handOver" || v.phase === "over") && (
          <>
            <div className="flex gap-2 min-h-[64px] items-end">
              {showTrick.map((t, i) => {
                const [a, b] = ends(t.tile);
                return (
                  <div key={t.tile} className="hh-deal flex flex-col items-center" style={{ "--i": i } as React.CSSProperties}>
                    <Domino a={b} b={a} size={28} vertical seed={i} />
                    <span className={`${readFont.className} text-[13px] ${v.trick.length === 0 && v.lastTrick?.winner === t.seat ? "text-[#F5EFE2]" : "text-[#F5EFE2]/60"}`}>{v.seats[t.seat].id === you ? "You" : v.seats[t.seat].name}</span>
                  </div>
                );
              })}
            </div>
            <p className={`${handFont.className} text-[18px] font-bold text-[#F5EFE2]/70`}>
              Points — {TEAM_NAMES[0]}: {v.points[0]} · {TEAM_NAMES[1]}: {v.points[1]}
            </p>
          </>
        )}
        {v.result && <Big>{v.result.made ? `Made it with ${v.result.points}!` : `Set! Only ${v.result.points}.`} {TEAM_NAMES[v.result.made ? v.result.bidders : 1 - v.result.bidders]} +{v.result.marks} mark{v.result.marks > 1 ? "s" : ""}</Big>}
        <Note tone={error ? "error" : undefined}>{error ?? v.log}</Note>
      </div>

      {v.phase === "handOver" && <NextButton onClick={() => act({ type: "nextHand" })}>Shuffle for the next hand</NextButton>}
      {mine && v.phase === "bid" && (
        <div className="px-4 pb-2 space-y-2">
          <div className="flex items-center justify-center gap-3">
            <button type="button" className={`${handFont.className} text-[30px] font-bold min-w-[44px] min-h-[44px]`} onClick={() => setPoints((p) => Math.max(30, p - 1))} aria-label="Lower bid">−</button>
            <span className={`${handFont.className} text-[38px] font-bold w-14 text-center`}>{points}</span>
            <button type="button" className={`${handFont.className} text-[30px] font-bold min-w-[44px] min-h-[44px]`} onClick={() => setPoints((p) => Math.min(42, p + 1))} aria-label="Raise bid">+</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <HandButton small onClick={() => act({ type: "bid", bid: null })}>Pass</HandButton>
            <HandButton small i={1} disabled={!bidLegal(high, { points })} onClick={() => act({ type: "bid", bid: { points } })}>Bid {points}</HandButton>
            <HandButton small i={2} disabled={!bidLegal(high, marksBid)} onClick={() => act({ type: "bid", bid: marksBid })}>{bidLabel(marksBid)}</HandButton>
          </div>
        </div>
      )}
      {mine && v.phase === "trump" && (
        <div className="px-4 pb-2 grid grid-cols-4 gap-2">
          {[0, 1, 2, 3, 4, 5, 6].map((n, i) => (
            <HandButton key={n} small i={i} onClick={() => act({ type: "trump", trump: n })}>{n}s</HandButton>
          ))}
          <HandButton small i={7} onClick={() => act({ type: "trump", trump: "doubles" })}>Doubles</HandButton>
        </div>
      )}
      <p className={`${handFont.className} text-center text-[19px] font-bold text-[#F5EFE2]/60`}>{mine && v.phase === "play" ? "Your turn — tap a tile" : mine && v.phase === "trump" ? "Name trumps" : "Your tiles"}</p>
      <TileHand tiles={v.hand} legal={mine && v.phase === "play" ? (t) => v.legal.includes(t) : undefined} onPick={mine && v.phase === "play" ? (t) => act({ type: "play", tile: t }) : undefined} />
    </Board>
  );
}

// ─── Train Dominoes ──────────────────────────────────────────────────────────

interface TrainView {
  seats: { id: string; name: string; tiles: number }[];
  you: number;
  hand: string[];
  legal: { tile: string; train: number }[];
  trains: { owner: number | null; tiles: { tile: string; near: number; far: number }[]; public: boolean; closed: boolean; end: number }[];
  engine: number;
  round: number;
  rounds: number;
  boneyard: number;
  turn: number;
  pending: { train: number; value: number } | null;
  drawn: string | null;
  phase: "play" | "roundOver" | "over";
  result: { out: number | null; added: number[] } | null;
  log: string;
}

export function TrainBoard({ view: v, send, preview }: BoardProps<TrainView>) {
  const { error, act } = useAct(send, preview);
  const [sel, setSel] = useState<string | null>(null);
  const mine = v.turn === v.you && v.phase === "play";
  useEffect(() => setSel(null), [v.turn, v.hand.length]);
  const trainsFor = (t: string) => v.legal.filter((m) => m.tile === t).map((m) => m.train);
  const label = (i: number) => {
    const t = v.trains[i];
    return t.owner === null ? "Community train" : t.owner === v.you ? "Your train" : `${v.seats[t.owner].name}'s train`;
  };

  function pickTile(t: string) {
    const ts = trainsFor(t);
    if (ts.length === 1) void act({ type: "play", tile: t, train: ts[0] });
    else setSel(t);
  }

  return (
    <Board>
      <Note>Round {v.round + 1} of {v.rounds} · engine {v.engine}-{v.engine} · boneyard {v.boneyard}</Note>
      <ul className="px-3 space-y-1 py-1">
        {v.trains.map((t, i) => {
          const playable = sel ? trainsFor(sel).includes(i) : false;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={!playable}
                onClick={() => sel && act({ type: "play", tile: sel, train: i })}
                className={`w-full flex items-center gap-2 rounded-[8px] px-2 py-1 text-left ${playable ? "outline outline-2 outline-[#D63A2F]" : ""} ${v.pending?.train === i ? "bg-[#F5EFE2]/10" : ""}`}
              >
                <span className={`${readFont.className} w-[34%] shrink-0 text-[15px] leading-tight ${t.owner === v.turn ? "text-[#F5EFE2]" : "text-[#F5EFE2]/70"}`}>
                  {label(i)}
                  {t.public && t.owner !== null && <span className="text-[#D63A2F]"> · open</span>}
                  {t.closed && " · closed"}
                  {t.owner !== null && <span className="text-[#F5EFE2]/45"> ({v.seats[t.owner].tiles})</span>}
                </span>
                <span className="flex-1 flex items-center justify-end gap-0.5 overflow-hidden">
                  {t.tiles.length > 2 && <span className={`${handFont.className} text-[14px] font-bold text-[#F5EFE2]/50`}>+{t.tiles.length - 2}</span>}
                  {t.tiles.slice(-2).map((x, k) => (
                    <Domino key={k} a={x.near} b={x.far} size={22} vertical={x.near === x.far} seed={k + i} />
                  ))}
                  <span className={`${handFont.className} w-7 text-center text-[20px] font-bold`}>{t.end}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex-1 flex flex-col justify-center py-1">
        {v.pending && <Big>Cover the double {v.pending.value}-{v.pending.value}!</Big>}
        {v.result && <Big>{v.result.out === null ? "Round blocked" : `${v.seats[v.result.out].name} went out!`} Pips added: {v.seats.map((p, i) => `${p.name} ${v.result!.added[i]}`).join(", ")}</Big>}
        <Note tone={error ? "error" : undefined}>{error ?? v.log}</Note>
      </div>
      {v.phase === "roundOver" && <NextButton onClick={() => act({ type: "nextRound" })}>Next round</NextButton>}
      {mine && sel && <Note>Tap a highlighted train for {sel}</Note>}
      {mine && v.legal.length === 0 && <NextButton onClick={() => act({ type: "draw" })}>{v.boneyard ? "Nothing plays — draw one" : "Nothing plays — pass"}</NextButton>}
      <p className={`${handFont.className} text-center text-[19px] font-bold text-[#F5EFE2]/60`}>{mine ? (v.drawn ? `Play the tile you drew (${v.drawn})` : v.legal.length ? "Tap a tile" : "No tile plays") : "Your tiles"}</p>
      <TileHand tiles={v.hand} selected={sel} size={26} legal={mine ? (t) => trainsFor(t).length > 0 : undefined} onPick={mine ? pickTile : undefined} />
    </Board>
  );
}
