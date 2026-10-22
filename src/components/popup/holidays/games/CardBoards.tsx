"use client";

// Boards for the four card games: Euchre, President, I Doubt It, Rummy.

import { useEffect, useState } from "react";
import { rankOf, SUIT_NAMES, SUIT_SYMBOLS, type Suit } from "@/lib/holidays/cards";
import { TEAM_NAMES } from "@/lib/holidays/common";
import { rankWord } from "@/lib/holidays/games/iDoubtIt";
import { isMeld } from "@/lib/holidays/games/rummy";
import PlayingCard from "../PlayingCard";
import { COLORS, HandButton, handFont, readFont } from "../ui";
import { Big, Board, Buttons, CardHand, Countdown, NextButton, Note, Seats, TeamScores, useAct } from "./kit";
import type { BoardProps } from "./types";

const SUITS: Suit[] = ["S", "H", "D", "C"];
const suitColor = (s: Suit) => (s === "H" || s === "D" ? "#F0A79F" : COLORS.ink);

/** Played cards laid out by seat, with names. */
function Trick({ cards, seats, you, winner }: { cards: { seat: number; card: string }[]; seats: { id: string; name: string }[]; you: string; winner?: number }) {
  return (
    <div className="flex justify-center gap-2 min-h-[110px] items-end">
      {cards.map((t, i) => (
        <div key={t.card} className="hh-deal flex flex-col items-center" style={{ "--i": i } as React.CSSProperties}>
          <PlayingCard card={t.card} width={56} seed={i + 4} />
          <span className={`${readFont.className} text-[14px] ${winner === t.seat ? "text-[#F5EFE2]" : "text-[#F5EFE2]/60"}`}>
            {winner === t.seat && "★ "}
            {seats[t.seat].id === you ? "You" : seats[t.seat].name}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Euchre ──────────────────────────────────────────────────────────────────

interface EuchreView {
  seats: { id: string; name: string; team: number; cards: number }[];
  you: number;
  hand: string[];
  legal: string[];
  upcard: string | null;
  turnedDown: Suit | null;
  phase: "bid1" | "bid2" | "discard" | "play" | "handOver" | "over";
  dealer: number;
  turn: number;
  trump: Suit | null;
  maker: number | null;
  alone: boolean;
  sitOut: number | null;
  trick: { seat: number; card: string }[];
  tricks: [number, number];
  lastTrick: { cards: { seat: number; card: string }[]; winner: number } | null;
  scores: [number, number];
  result: { makers: number; tricks: number; points: number; team: number } | null;
  log: string;
}

export function EuchreBoard({ view: v, you, send, preview }: BoardProps<EuchreView>) {
  const { error, act } = useAct(send, preview);
  const [alone, setAlone] = useState(false);
  const mine = v.turn === v.you;
  const dealerName = v.seats[v.dealer]?.id === you ? "you" : v.seats[v.dealer]?.name;
  const showTrick = v.trick.length ? v.trick : v.lastTrick?.cards ?? [];

  return (
    <Board>
      <TeamScores teams={[0, 1].map((t) => ({ name: TEAM_NAMES[t], score: v.scores[t] }))} />
      <Seats seats={v.seats} turn={v.phase === "handOver" ? null : v.turn} you={you} note={(i) => (i === v.sitOut ? "sitting out" : i === v.dealer ? "dealer" : `${v.seats[i].cards}`)} />

      <div className="flex-1 flex flex-col items-center justify-center gap-2 py-2">
        {v.trump && (
          <p className={`${handFont.className} text-[22px] font-bold`}>
            Trump: <span style={{ color: suitColor(v.trump) }}>{SUIT_SYMBOLS[v.trump]} {SUIT_NAMES[v.trump]}</span>
            {v.maker !== null && <span className="text-[#F5EFE2]/60"> · {v.seats[v.maker].name}{v.alone ? " alone" : ""}</span>}
          </p>
        )}
        {v.upcard && (
          <div className="flex flex-col items-center">
            <PlayingCard card={v.upcard} width={76} seed={9} dim={v.phase === "bid2"} />
            <span className={`${readFont.className} text-[14px] text-[#F5EFE2]/60`}>{v.phase === "bid2" ? "turned down" : `face up · ${dealerName} deals`}</span>
          </div>
        )}
        {(v.phase === "play" || v.phase === "handOver" || v.phase === "over") && <Trick cards={showTrick} seats={v.seats} you={you} winner={v.trick.length ? undefined : v.lastTrick?.winner} />}
        {(v.phase === "play" || v.phase === "handOver") && (
          <p className={`${handFont.className} text-[19px] font-bold text-[#F5EFE2]/70`}>
            Tricks — {TEAM_NAMES[0]}: {v.tricks[0]} · {TEAM_NAMES[1]}: {v.tricks[1]}
          </p>
        )}
        {v.result && (
          <Big>
            {v.result.tricks >= 3 ? `${TEAM_NAMES[v.result.makers]} took ${v.result.tricks}` : `Euchred! ${TEAM_NAMES[v.result.makers]} took only ${v.result.tricks}`} — {TEAM_NAMES[v.result.team]} +{v.result.points}
          </Big>
        )}
        <Note tone={error ? "error" : undefined}>{error ?? v.log}</Note>
      </div>

      {v.phase === "handOver" && <NextButton onClick={() => act({ type: "nextHand" })}>Deal the next hand</NextButton>}

      {mine && (v.phase === "bid1" || v.phase === "bid2") && (
        <div className="px-4 pb-2 space-y-2">
          <label className={`${handFont.className} flex items-center justify-center gap-2 text-[21px] font-bold`}>
            <input type="checkbox" checked={alone} onChange={(e) => setAlone(e.target.checked)} className="w-5 h-5 accent-[#D63A2F]" />
            Go alone
          </label>
          {v.phase === "bid1" ? (
            <Buttons>
              <HandButton small onClick={() => act({ type: "pass" })}>Pass</HandButton>
              <HandButton small primary onClick={() => act({ type: "order", alone })}>
                {v.dealer === v.you ? "Pick it up" : "Order it up"}
              </HandButton>
            </Buttons>
          ) : (
            <div className="grid grid-cols-5 gap-1.5">
              <HandButton small onClick={() => act({ type: "pass" })}>Pass</HandButton>
              {SUITS.filter((s) => s !== v.turnedDown).map((s, i) => (
                <HandButton key={s} small i={i + 1} onClick={() => act({ type: "name", suit: s, alone })} aria-label={`Name ${SUIT_NAMES[s]}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- drawn suit */}
                  <img src={`/popup/holidays/suits/${SUIT_NAMES[s].toLowerCase()}.webp`} alt="" className="h-[30px] w-auto mx-auto" draggable={false} />
                </HandButton>
              ))}
            </div>
          )}
        </div>
      )}

      <p className={`${handFont.className} text-center text-[19px] font-bold text-[#F5EFE2]/60`}>
        {v.you === v.sitOut ? "Your partner is going alone — sit this one out" : mine && v.phase === "discard" ? "Tap a card to discard" : mine && v.phase === "play" ? "Your turn — tap a card" : "Your hand"}
      </p>
      <CardHand
        cards={v.hand}
        dimmed={(c) => v.phase === "play" && mine && !v.legal.includes(c)}
        onToggle={mine && (v.phase === "play" || v.phase === "discard") ? (c) => (v.phase === "discard" ? act({ type: "discard", card: c }) : v.legal.includes(c) && act({ type: "play", card: c })) : undefined}
      />
    </Board>
  );
}

// ─── President ───────────────────────────────────────────────────────────────

interface PresidentView {
  seats: { id: string; name: string; cards: number; place: number }[];
  you: number;
  hand: string[];
  top: { seat: number; cards: string[] } | null;
  turn: number;
  phase: "play" | "handOver" | "over";
  hand_no: number;
  hands: number;
  lastHand: { order: number[] } | null;
  log: string;
}

const PLACE = (n: number, total: number) => (n === 0 ? "President" : n === 1 ? "Vice President" : n === total - 1 ? "last" : `${n + 1}th`);

export function PresidentBoard({ view: v, you, send, preview }: BoardProps<PresidentView>) {
  const { error, act } = useAct(send, preview);
  const [sel, setSel] = useState<string[]>([]);
  const mine = v.turn === v.you && v.phase === "play";
  useEffect(() => setSel([]), [v.turn, v.hand.length]);

  const toggle = (c: string) => {
    if (!mine) return;
    // Only same-rank groups: picking another rank starts over.
    setSel((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : cur.length && rankOf(cur[0]) !== rankOf(c) ? [c] : [...cur, c]));
  };

  return (
    <Board>
      <Note>Hand {v.hand_no} of {v.hands}</Note>
      <Seats seats={v.seats} turn={v.phase === "play" ? v.turn : null} you={you} note={(i) => (v.seats[i].place >= 0 ? PLACE(v.seats[i].place, v.seats.length) : `${v.seats[i].cards} cards`)} />
      <div className="flex-1 flex flex-col items-center justify-center gap-2 py-3">
        {v.top ? (
          <>
            <div className="flex gap-1">
              {v.top.cards.map((c, i) => (
                <PlayingCard key={c} card={c} width={66} seed={i + 2} />
              ))}
            </div>
            <span className={`${readFont.className} text-[15px] text-[#F5EFE2]/60`}>played by {v.seats[v.top.seat].id === you ? "you" : v.seats[v.top.seat].name}</span>
          </>
        ) : v.phase === "play" ? (
          <Big>{mine ? "Start a new pile — play anything" : "New pile"}</Big>
        ) : null}
        {v.lastHand && v.phase !== "play" && (
          <ol className={`${readFont.className} text-[17px] text-center`}>
            {v.lastHand.order.map((seat, place) => (
              <li key={seat}>
                {PLACE(place, v.seats.length)}: {v.seats[seat].name} (+{v.seats.length - 1 - place})
              </li>
            ))}
          </ol>
        )}
        <Note tone={error ? "error" : undefined}>{error ?? v.log}</Note>
      </div>
      {v.phase === "handOver" && <NextButton onClick={() => act({ type: "nextHand" })}>Deal the next hand</NextButton>}
      {mine && (
        <Buttons>
          {v.top && (
            <HandButton small onClick={() => act({ type: "pass" })}>
              Pass
            </HandButton>
          )}
          <HandButton small primary i={1} disabled={!sel.length} onClick={() => act({ type: "play", cards: sel })}>
            {sel.length ? `Play ${sel.length > 1 ? `${sel.length} × ` : ""}${rankOf(sel[0])}` : "Pick cards"}
          </HandButton>
        </Buttons>
      )}
      <p className={`${handFont.className} text-center text-[19px] font-bold text-[#F5EFE2]/60`}>{mine ? (v.top ? `Beat ${v.top.cards.length > 1 ? `${v.top.cards.length} × ` : ""}${rankOf(v.top.cards[0])} — or pass` : "Your lead") : "Your hand · 3 low … 2 high"}</p>
      <CardHand cards={v.hand} selected={sel} onToggle={mine ? toggle : undefined} />
    </Board>
  );
}

// ─── I Doubt It ──────────────────────────────────────────────────────────────

interface DoubtView {
  seats: { id: string; name: string; cards: number }[];
  you: number;
  hand: string[];
  pileCount: number;
  turn: number;
  rank: string;
  pending: { seat: number; count: number; rank: string; deadline: number } | null;
  reveal: { seat: number; challenger: number; cards: string[]; rank: string; truthful: boolean; taker: number; count: number } | null;
  winner: number | null;
  log: string;
}

export function IDoubtItBoard({ view: v, you, send, skew, preview }: BoardProps<DoubtView>) {
  const { error, act } = useAct(send, preview);
  const [sel, setSel] = useState<string[]>([]);
  const mine = v.turn === v.you && !v.pending && v.winner === null;
  useEffect(() => setSel([]), [v.turn, v.hand.length]);
  const canDoubt = v.pending && v.pending.seat !== v.you;

  return (
    <Board>
      <Seats seats={v.seats} turn={v.pending ? v.pending.seat : v.turn} you={you} note={(i) => `${v.seats[i].cards}`} />
      <div className="flex-1 flex flex-col items-center justify-center gap-2 py-3">
        <div className="flex items-end gap-3">
          <PlayingCard card={null} faceDown width={70} seed={5} />
          <Big>{v.pileCount} in the pile</Big>
        </div>
        {v.pending ? (
          <>
            <Big className="text-[30px]">
              {v.seats[v.pending.seat].id === you ? "You" : v.seats[v.pending.seat].name} played {v.pending.count} {rankWord(v.pending.rank, v.pending.count)}
            </Big>
            <Countdown endsAt={v.pending.deadline} skew={skew} size={44} />
          </>
        ) : (
          v.winner === null && <Big>Next up: {rankWord(v.rank, 2)}</Big>
        )}
        {v.reveal && (
          <div className="flex flex-col items-center gap-1">
            <div className="flex gap-1">
              {v.reveal.cards.map((c, i) => (
                <PlayingCard key={c} card={c} width={52} seed={i + 12} />
              ))}
            </div>
            <Note>{v.reveal.truthful ? "It was true!" : "Caught bluffing!"} {v.seats[v.reveal.taker].id === you ? "You pick" : `${v.seats[v.reveal.taker].name} picks`} up {v.reveal.count} cards.</Note>
          </div>
        )}
        <Note tone={error ? "error" : undefined}>{error ?? (v.reveal ? "" : v.log)}</Note>
      </div>
      {canDoubt && (
        <div className="px-4 pb-2">
          <HandButton primary onClick={() => act({ type: "doubt" })}>
            I doubt it!
          </HandButton>
        </div>
      )}
      {mine && (
        <div className="px-4 pb-2">
          <HandButton primary small disabled={!sel.length} onClick={() => act({ type: "submit", cards: sel })}>
            {sel.length ? `Play as ${sel.length} ${rankWord(v.rank, sel.length)}` : `Pick 1–4 cards to play as ${rankWord(v.rank, 2)}`}
          </HandButton>
        </div>
      )}
      <p className={`${handFont.className} text-center text-[19px] font-bold text-[#F5EFE2]/60`}>{mine ? "Truth or bluff — your call" : "Your hand"}</p>
      <CardHand cards={v.hand} selected={sel} onToggle={mine ? (c) => setSel((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : cur.length < 4 ? [...cur, c] : cur)) : undefined} />
    </Board>
  );
}

// ─── Rummy ───────────────────────────────────────────────────────────────────

interface RummyView {
  seats: { id: string; name: string; cards: number }[];
  you: number;
  hand: string[];
  stockCount: number;
  discardTop: string | null;
  melds: { id: number; owner: number; cards: string[] }[];
  turn: number;
  phase: "draw" | "play" | "handOver" | "over";
  taken: string | null;
  deal: number;
  deals: number;
  result: { winner: number | null; points: number; blocked: boolean; left: number[] } | null;
  log: string;
}

export function RummyBoard({ view: v, you, send, preview }: BoardProps<RummyView>) {
  const { error, act } = useAct(send, preview);
  const [sel, setSel] = useState<string[]>([]);
  const mine = v.turn === v.you;
  useEffect(() => setSel([]), [v.turn, v.hand.length, v.melds.length]);
  const toggle = (c: string) => setSel((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  return (
    <Board>
      <Note>Deal {v.deal} of {v.deals}</Note>
      <Seats seats={v.seats} turn={v.phase === "draw" || v.phase === "play" ? v.turn : null} you={you} note={(i) => `${v.seats[i].cards}`} />

      {/* Melds on the table: tap one to add your selected cards to it. */}
      <div className="flex flex-wrap justify-center gap-2 px-3 py-2">
        {v.melds.map((m) => {
          const fits = mine && v.phase === "play" && sel.length > 0 && isMeld([...m.cards, ...sel]);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => fits && act({ type: "layoff", meld: m.id, cards: sel })}
              disabled={!fits}
              aria-label={`Meld: ${m.cards.join(", ")}${fits ? " — tap to add your cards" : ""}`}
              className={`flex rounded-[8px] p-1 ${fits ? "outline outline-2 outline-[#D63A2F]" : ""}`}
            >
              {m.cards.map((c, i) => (
                <span key={c} className={i ? "-ml-6" : ""}>
                  <PlayingCard card={c} width={40} seed={i + m.id} />
                </span>
              ))}
            </button>
          );
        })}
        {v.melds.length === 0 && <Note>No melds on the table yet</Note>}
      </div>

      <div className="flex-1 flex items-center justify-center gap-6 py-2">
        <button type="button" disabled={!mine || v.phase !== "draw"} onClick={() => act({ type: "drawStock" })} className="flex flex-col items-center" aria-label={`Draw from the stock (${v.stockCount} left)`}>
          <PlayingCard card={null} faceDown width={66} seed={3} />
          <span className={`${handFont.className} text-[17px] font-bold text-[#F5EFE2]/60`}>{v.stockCount} left</span>
        </button>
        <button type="button" disabled={!mine || v.phase !== "draw" || !v.discardTop} onClick={() => act({ type: "takeDiscard" })} className="flex flex-col items-center" aria-label="Take the top discard">
          {v.discardTop ? <PlayingCard card={v.discardTop} width={66} seed={6} /> : <div className="w-[66px] h-[92px] border-2 border-dashed border-[#F5EFE2]/25 rounded-[8px]" />}
          <span className={`${handFont.className} text-[17px] font-bold text-[#F5EFE2]/60`}>discard</span>
        </button>
      </div>
      {v.result && (
        <Big>
          {v.result.blocked ? "Blocked — no score this deal" : `${v.seats[v.result.winner!].name} went out: +${v.result.points}`}
        </Big>
      )}
      <Note tone={error ? "error" : undefined}>{error ?? v.log}</Note>

      {v.phase === "handOver" && <NextButton onClick={() => act({ type: "nextHand" })}>Deal the next hand</NextButton>}
      {mine && v.phase === "play" && (
        <Buttons>
          <HandButton small disabled={!isMeld(sel)} onClick={() => act({ type: "meld", cards: sel })}>
            Meld
          </HandButton>
          <HandButton small primary i={1} disabled={sel.length !== 1 || (sel[0] === v.taken && v.hand.length > 1)} onClick={() => act({ type: "discard", card: sel[0] })}>
            Discard
          </HandButton>
        </Buttons>
      )}
      <p className={`${handFont.className} text-center text-[19px] font-bold text-[#F5EFE2]/60`}>
        {!mine ? "Your hand" : v.phase === "draw" ? "Draw from the stock or the discard" : sel.length ? "Meld, tap a meld to add to it, or discard one" : "Select cards to meld, or one to discard"}
      </p>
      <CardHand cards={v.hand} selected={sel} onToggle={mine && v.phase === "play" ? toggle : undefined} />
    </Board>
  );
}
