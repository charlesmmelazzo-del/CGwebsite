// ─── 02 President ────────────────────────────────────────────────────────────
// Climbing/shedding per the handoff defaults: 3–7 players, all 52 cards dealt,
// ranks 3 low … A, 2 high, play singles or same-rank groups that beat the last
// play, passing is always allowed and doesn't lock you out of the pile, five
// hands, N − place points, no card exchange.

import { newDeck, rankOf, shuffle, suitOf, SUITS } from "../cards";
import { nameOf, randomIndex, winnerMessage } from "../common";
import { GameError, type GameDef, type ScoreLine, type Seat } from "../types";

export const HANDS = 5;
const ORDER = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
export const PLACE_TITLES = ["President", "Vice President"];

export const climb = (card: string) => ORDER.indexOf(rankOf(card));

export function sortClimb(cards: string[]) {
  return cards.slice().sort((a, b) => climb(a) - climb(b) || SUITS.indexOf(suitOf(a) as never) - SUITS.indexOf(suitOf(b) as never));
}

export interface PresidentState {
  seats: Seat[];
  dealer: number;
  hand: number;
  hands: Record<string, string[]>;
  /** The play to beat on the current pile, and who made it. */
  top: { seat: number; cards: string[] } | null;
  /** Seats that still have to answer the latest play (pass or beat it). */
  responders: number[];
  turn: number;
  /** Finishing order this hand. */
  finished: number[];
  scores: number[];
  lastHand: { order: number[] } | null;
  phase: "play" | "handOver" | "over";
  log: string;
}

export type PresidentAction = { type: "play"; cards: string[] } | { type: "pass" } | { type: "nextHand" };

function deal(s: Omit<PresidentState, "hands" | "top" | "responders" | "turn" | "finished" | "phase" | "log">, dealer: number, rand: () => number) {
  const deck = shuffle(newDeck(), rand);
  const n = s.seats.length;
  const hands: Record<string, string[]> = Object.fromEntries(s.seats.map((p) => [p.id, [] as string[]]));
  deck.forEach((c, i) => hands[s.seats[(dealer + 1 + i) % n].id].push(c));
  for (const id of Object.keys(hands)) hands[id] = sortClimb(hands[id]);
  return { dealer, hands, top: null, responders: [], turn: (dealer + 1) % n, finished: [], phase: "play" as const, log: "" };
}

const active = (s: PresidentState, seat: number) => !s.finished.includes(seat);

function nextActive(s: PresidentState, from: number): number {
  const n = s.seats.length;
  for (let k = 1; k <= n; k++) {
    const seat = (from + k) % n;
    if (active(s, seat)) return seat;
  }
  return from;
}

/** Next seat (after `from`) still owing a response to the latest play. */
function nextResponder(s: PresidentState, from: number, responders: number[]): number | null {
  const n = s.seats.length;
  for (let k = 1; k <= n; k++) {
    const seat = (from + k) % n;
    if (responders.includes(seat)) return seat;
  }
  return null;
}

function finishHand(s: PresidentState): PresidentState {
  const n = s.seats.length;
  const last = s.seats.findIndex((_, i) => !s.finished.includes(i));
  const order = [...s.finished, last];
  const scores = s.scores.slice();
  order.forEach((seat, place) => (scores[seat] += n - 1 - place));
  const over = s.hand >= HANDS;
  return { ...s, finished: order, scores, lastHand: { order }, phase: over ? "over" : "handOver", responders: [], top: null };
}

export const president: GameDef<PresidentState, PresidentAction> = {
  key: "president",
  name: "President",
  tagline: "Beat the last play with higher cards. First one out is President.",
  styles: ["cards"],
  minPlayers: 3,
  maxPlayers: 7,
  time: "30–45 min",
  description:
    "A fast climbing game. Play a single card, a pair, three or four of a kind — the next player has to beat it with the same number of higher cards, or pass. Twos are the highest cards. Empty your hand first to become President; five hands decide the winner.",
  rules: [
    { heading: "The deal", body: ["All 52 cards are dealt out — some players may get one more card than others.", "Card order, low to high: 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A, 2. Suits don't matter."] },
    {
      heading: "Playing",
      body: [
        "The player left of the dealer starts a pile with one card, a pair, three of a kind or four of a kind.",
        "Each next player either plays the same number of cards, all of one higher rank — or passes. You can pass even if you could play.",
        "Passing doesn't knock you out: if someone else beats the pile, you get another chance when it comes back round.",
        "When everyone else passes, the pile is cleared and whoever played last starts a new one with anything.",
      ],
    },
    { heading: "Finishing", body: ["Run out of cards and you're done for the hand — first out is President, then Vice President, and so on.", "The hand ends when only one player still has cards."] },
    { heading: "Scoring", body: ["Each hand, first place scores one less than the number of players, second scores one less than that, down to zero for last.", "After five hands, the highest total wins. Equal totals share the win."] },
  ],
  license: { name: "Traditional — public domain", note: "Original implementation. Rules after Pagat and Bicycle; no card exchange." },

  setup(seats, ctx) {
    const base = { seats, hand: 1, scores: seats.map(() => 0), lastHand: null };
    return { ...base, ...deal(base as never, randomIndex(seats.length, ctx.rand), ctx.rand) } as PresidentState;
  },

  act(s, playerId, a, ctx) {
    if (s.phase === "over") throw new GameError("The game is over.");
    if (a.type === "nextHand") {
      if (s.phase !== "handOver") throw new GameError("The hand is still going.");
      const n = s.seats.length;
      return { ...s, hand: s.hand + 1, ...deal(s, (s.dealer + 1) % n, ctx.rand) };
    }
    if (s.phase !== "play") throw new GameError("Not now.");
    const seat = s.seats.findIndex((p) => p.id === playerId);
    if (seat !== s.turn) throw new GameError("It's not your turn.");
    const hand = s.hands[playerId];
    const others = () => s.seats.map((_, i) => i).filter((i) => i !== seat && active(s, i));

    if (a.type === "pass") {
      if (!s.top) throw new GameError("You're starting the pile — play something.");
      const responders = s.responders.filter((r) => r !== seat);
      if (responders.length === 0) {
        // Everyone passed: clear the pile. The last player leads, or the next one still in.
        const lead = active(s, s.top.seat) ? s.top.seat : nextActive(s, s.top.seat);
        return { ...s, top: null, responders: [], turn: lead, log: `Pile cleared — ${nameOf(s.seats, s.seats[lead].id)} leads.` };
      }
      return { ...s, responders, turn: nextResponder(s, seat, responders)!, log: `${s.seats[seat].name} passed.` };
    }

    const cards = a.cards ?? [];
    if (cards.length < 1 || cards.length > 4 || new Set(cards).size !== cards.length) throw new GameError("Play one to four cards.");
    if (!cards.every((c) => hand.includes(c))) throw new GameError("Those cards aren't all in your hand.");
    if (!cards.every((c) => rankOf(c) === rankOf(cards[0]))) throw new GameError("All the cards have to be the same rank.");
    if (s.top) {
      if (cards.length !== s.top.cards.length) throw new GameError(`Play exactly ${s.top.cards.length} card${s.top.cards.length > 1 ? "s" : ""}.`);
      if (climb(cards[0]) <= climb(s.top.cards[0])) throw new GameError("That doesn't beat the pile.");
    }

    const left = hand.filter((c) => !cards.includes(c));
    let next: PresidentState = { ...s, hands: { ...s.hands, [playerId]: left }, top: { seat, cards }, log: `${s.seats[seat].name} played ${cards.length > 1 ? `${cards.length} ${rankOf(cards[0])}s` : rankOf(cards[0])}.` };
    if (left.length === 0) {
      next = { ...next, finished: [...s.finished, seat] };
      if (s.seats.length - next.finished.length <= 1) return finishHand(next);
    }
    const responders = others().filter((i) => active(next, i));
    if (responders.length === 0) {
      const lead = nextActive(next, seat);
      return { ...next, top: null, responders: [], turn: lead };
    }
    return { ...next, responders, turn: nextResponder(next, seat, responders)! };
  },

  view(s, playerId) {
    const seat = s.seats.findIndex((p) => p.id === playerId);
    return {
      seats: s.seats.map((p, i) => ({ id: p.id, name: p.name, cards: s.hands[p.id].length, place: s.finished.indexOf(i) })),
      you: seat,
      hand: s.hands[playerId] ?? [],
      top: s.top,
      turn: s.turn,
      phase: s.phase,
      hand_no: s.hand,
      hands: HANDS,
      lastHand: s.lastHand,
      log: s.log,
    };
  },

  status(s) {
    const lines = president.scoreboard!(s);
    if (s.phase === "over") return { over: true, message: winnerMessage(lines), turn: [] };
    if (s.phase === "handOver") return { over: false, message: `${s.seats[s.lastHand!.order[0]].name} is President!`, turn: [] };
    const p = s.seats[s.turn];
    return { over: false, message: `${p.name}'s turn${s.top ? "" : " to lead"}`, turn: [p.id] };
  },

  scoreboard(s): ScoreLine[] {
    return s.seats.map((p, i) => ({ label: p.name, score: s.scores[i], playerIds: [p.id] }));
  },
};
