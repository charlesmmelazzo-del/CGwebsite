// ─── 04 Classic Multiplayer Rummy ────────────────────────────────────────────
// Basic Rummy per the handoff: 2–6 players, one deck, no wilds; 10/7/6 cards;
// draw one (stock or the top discard), meld sets and same-suit runs (ace low
// only), lay off anywhere, discard (not the card just taken from the pile).
// Going out scores the others' cards. Five deals. One stock recycle, then a
// further stock draw blocks the hand; three quiet cycles on an empty stock
// also block it.

import { newDeck, rankOf, RANKS, shuffle, sortHand, suitOf } from "../cards";
import { nameOf, randomIndex, winnerMessage } from "../common";
import { GameError, type GameDef, type ScoreLine, type Seat } from "../types";

export const DEALS = 5;

export interface Meld {
  id: number;
  owner: number;
  cards: string[];
}

export interface RummyState {
  seats: Seat[];
  dealer: number;
  deal: number;
  hands: Record<string, string[]>;
  stock: string[];
  discard: string[];
  melds: Meld[];
  nextMeldId: number;
  turn: number;
  phase: "draw" | "play" | "handOver" | "over";
  /** The discard taken this turn — it can't go straight back. */
  taken: string | null;
  recycled: boolean;
  /** Turns in a row with no meld or lay-off while the stock is empty. */
  quiet: number;
  meldedThisTurn: boolean;
  scores: number[];
  result: { winner: number | null; points: number; blocked: boolean; left: number[] } | null;
  log: string;
}

export type RummyAction =
  | { type: "drawStock" }
  | { type: "takeDiscard" }
  | { type: "meld"; cards: string[] }
  | { type: "layoff"; meld: number; cards: string[] }
  | { type: "discard"; card: string }
  | { type: "nextHand" };

export const value = (c: string) => RANKS.indexOf(rankOf(c)) + 1; // A=1 … K=13
export const points = (c: string) => Math.min(10, value(c));

export function isMeld(cards: string[]): boolean {
  if (cards.length < 3 || new Set(cards).size !== cards.length) return false;
  if (cards.every((c) => rankOf(c) === rankOf(cards[0]))) return cards.length <= 4;
  if (!cards.every((c) => suitOf(c) === suitOf(cards[0]))) return false;
  const vs = cards.map(value).sort((a, b) => a - b);
  return vs.every((v, i) => i === 0 || v === vs[i - 1] + 1);
}

/** Display order for a meld: runs ascending. */
export function orderMeld(cards: string[]) {
  return cards.slice().sort((a, b) => value(a) - value(b));
}

function deal(s: Pick<RummyState, "seats">, dealer: number, rand: () => number) {
  const n = s.seats.length;
  const size = n === 2 ? 10 : n <= 4 ? 7 : 6;
  const deck = shuffle(newDeck(), rand);
  const hands: Record<string, string[]> = {};
  s.seats.forEach((p, i) => (hands[p.id] = sortHand(deck.slice(i * size, (i + 1) * size))));
  const rest = deck.slice(n * size);
  return {
    dealer,
    hands,
    discard: [rest[0]],
    stock: rest.slice(1),
    melds: [],
    nextMeldId: 1,
    turn: (dealer + 1) % n,
    phase: "draw" as const,
    taken: null,
    recycled: false,
    quiet: 0,
    meldedThisTurn: false,
    result: null,
    log: "",
  };
}

function endHand(s: RummyState, winner: number | null): RummyState {
  const left = s.seats.map((p) => s.hands[p.id].reduce((t, c) => t + points(c), 0));
  const pts = winner === null ? 0 : left.reduce((t, v, i) => (i === winner ? t : t + v), 0);
  const scores = s.scores.slice();
  if (winner !== null) scores[winner] += pts;
  return { ...s, scores, result: { winner, points: pts, blocked: winner === null, left }, phase: s.deal >= DEALS ? "over" : "handOver" };
}

export const rummy: GameDef<RummyState, RummyAction> = {
  key: "classic-rummy",
  name: "Classic Rummy",
  tagline: "Draw, make sets and runs, discard. Go out first.",
  styles: ["cards"],
  minPlayers: 2,
  maxPlayers: 6,
  time: "30–45 min",
  description:
    "Plain, classic Rummy. Each turn, draw a card, lay down any sets (three or four of a kind) or runs (three or more in a row, same suit), add to anyone's melds on the table, then discard. The first player to get rid of every card scores what everyone else is still holding. Five deals; highest total wins.",
  rules: [
    { heading: "The deal", body: ["Two players get 10 cards; three or four get 7; five or six get 6.", "One card starts the discard pile; the rest are the face-down stock."] },
    {
      heading: "Your turn",
      body: [
        "Take one card: the top of the stock, or the top card of the discard pile.",
        "Lay down melds if you like: a set is 3 or 4 cards of the same rank; a run is 3 or more cards in a row of one suit. Aces are low only — A-2-3 works, Q-K-A doesn't.",
        "You can also add cards to any meld on the table, yours or anyone's.",
        "End your turn by discarding one card — but not the card you just took from the discard pile.",
      ],
    },
    {
      heading: "Going out & scoring",
      body: [
        "Get rid of your last card (by melding or discarding) and the hand ends at once.",
        "You score the cards left in everyone else's hand: J, Q, K are 10; aces are 1; other cards are their number.",
        "After five deals, the highest total wins.",
      ],
    },
    {
      heading: "If the stock runs out",
      body: [
        "The first time, the discard pile (except its top card) is shuffled into a new stock.",
        "If it runs out again — or three full rounds pass with no one melding while the stock is empty — the hand is blocked and nobody scores.",
      ],
    },
  ],
  license: { name: "Traditional — public domain", note: "Original implementation. Rules after Bicycle and Pagat (basic Rummy)." },

  setup(seats, ctx) {
    return { seats, deal: 1, scores: seats.map(() => 0), ...deal({ seats }, randomIndex(seats.length, ctx.rand), ctx.rand) };
  },

  act(s, playerId, a, ctx) {
    if (s.phase === "over") throw new GameError("The game is over.");
    if (a.type === "nextHand") {
      if (s.phase !== "handOver") throw new GameError("The hand is still going.");
      return { ...s, deal: s.deal + 1, ...deal(s, (s.dealer + 1) % s.seats.length, ctx.rand) };
    }
    const seat = s.seats.findIndex((p) => p.id === playerId);
    if (seat !== s.turn) throw new GameError("It's not your turn.");
    const hand = s.hands[playerId];
    const name = nameOf(s.seats, playerId);

    if (s.phase === "draw") {
      if (a.type === "takeDiscard") {
        const top = s.discard[s.discard.length - 1];
        if (!top) throw new GameError("The discard pile is empty.");
        return { ...s, hands: { ...s.hands, [playerId]: sortHand([...hand, top]) }, discard: s.discard.slice(0, -1), taken: top, phase: "play", log: `${name} took the discard.` };
      }
      if (a.type === "drawStock") {
        let st = s;
        if (st.stock.length === 0) {
          if (st.recycled || st.discard.length <= 1) return endHand({ ...st, log: "The stock ran out — the hand is blocked." }, null);
          const top = st.discard[st.discard.length - 1];
          st = { ...st, stock: shuffle(st.discard.slice(0, -1), ctx.rand), discard: [top], recycled: true, quiet: 0 };
        }
        const [card, ...stock] = st.stock;
        return { ...st, stock, hands: { ...st.hands, [playerId]: sortHand([...hand, card]) }, taken: null, phase: "play", log: `${name} drew from the stock.` };
      }
      throw new GameError("Draw a card first.");
    }

    if (s.phase !== "play") throw new GameError("Not now.");
    switch (a.type) {
      case "meld": {
        const cards = a.cards ?? [];
        if (!cards.every((c) => hand.includes(c))) throw new GameError("Those cards aren't all in your hand.");
        if (!isMeld(cards)) throw new GameError("That's not a set or a run.");
        const left = hand.filter((c) => !cards.includes(c));
        const next: RummyState = { ...s, hands: { ...s.hands, [playerId]: left }, melds: [...s.melds, { id: s.nextMeldId, owner: seat, cards: orderMeld(cards) }], nextMeldId: s.nextMeldId + 1, meldedThisTurn: true, log: `${name} laid down a meld.` };
        return left.length === 0 ? endHand({ ...next, log: `${name} went out!` }, seat) : next;
      }
      case "layoff": {
        const meld = s.melds.find((m) => m.id === a.meld);
        const cards = a.cards ?? [];
        if (!meld) throw new GameError("That meld isn't on the table.");
        if (cards.length === 0 || !cards.every((c) => hand.includes(c))) throw new GameError("Pick cards from your hand.");
        if (!isMeld([...meld.cards, ...cards])) throw new GameError("Those cards don't fit that meld.");
        const left = hand.filter((c) => !cards.includes(c));
        const melds = s.melds.map((m) => (m.id === meld.id ? { ...m, cards: orderMeld([...m.cards, ...cards]) } : m));
        const next: RummyState = { ...s, hands: { ...s.hands, [playerId]: left }, melds, meldedThisTurn: true, log: `${name} added to a meld.` };
        return left.length === 0 ? endHand({ ...next, log: `${name} went out!` }, seat) : next;
      }
      case "discard": {
        if (!hand.includes(a.card)) throw new GameError("That card isn't in your hand.");
        if (a.card === s.taken && hand.length > 1) throw new GameError("You can't throw back the card you just took.");
        const left = hand.filter((c) => c !== a.card);
        let next: RummyState = { ...s, hands: { ...s.hands, [playerId]: left }, discard: [...s.discard, a.card], log: `${name} discarded.` };
        if (left.length === 0) return endHand({ ...next, log: `${name} went out!` }, seat);
        const quiet = s.stock.length === 0 && !s.meldedThisTurn ? s.quiet + 1 : 0;
        next = { ...next, quiet, turn: (seat + 1) % s.seats.length, phase: "draw", taken: null, meldedThisTurn: false };
        if (quiet >= 3 * s.seats.length) return endHand({ ...next, log: "Three quiet rounds on an empty stock — the hand is blocked." }, null);
        return next;
      }
    }
    throw new GameError("Meld, lay off, or discard.");
  },

  view(s, playerId) {
    const seat = s.seats.findIndex((p) => p.id === playerId);
    return {
      seats: s.seats.map((p) => ({ id: p.id, name: p.name, cards: s.hands[p.id].length })),
      you: seat,
      hand: s.hands[playerId] ?? [],
      stockCount: s.stock.length,
      discardTop: s.discard[s.discard.length - 1] ?? null,
      melds: s.melds,
      turn: s.turn,
      phase: s.phase,
      taken: seat === s.turn ? s.taken : null,
      deal: s.deal,
      deals: DEALS,
      result: s.result,
      log: s.log,
    };
  },

  status(s) {
    if (s.phase === "over") return { over: true, message: winnerMessage(rummy.scoreboard!(s)), turn: [] };
    if (s.phase === "handOver") {
      const r = s.result!;
      return { over: false, message: r.winner === null ? "Blocked hand — no score" : `${s.seats[r.winner].name} went out for ${r.points}`, turn: [] };
    }
    const p = s.seats[s.turn];
    return { over: false, message: s.phase === "draw" ? `${p.name} to draw` : `${p.name} to meld or discard`, turn: [p.id] };
  },

  scoreboard(s): ScoreLine[] {
    return s.seats.map((p, i) => ({ label: p.name, score: s.scores[i], playerIds: [p.id] }));
  },
};
