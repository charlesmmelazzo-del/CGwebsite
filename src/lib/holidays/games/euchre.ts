// ─── 01 Euchre ───────────────────────────────────────────────────────────────
// North American rules per the handoff: 4 players in partnerships, 24 cards
// (9–A), two bidding rounds, dealer picks up on an order-up, makers may go
// alone, bowers, follow the effective suit, first partnership to 10.

import { rankOf, shuffle, suitOf, SUIT_NAMES, type Suit } from "../cards";
import { alternateTeams, nameOf, PARTNERS, randomIndex, TEAM_NAMES } from "../common";
import { GameError, type GameDef, type ScoreLine, type Seat } from "../types";

export const TARGET = 10;
const RANKS = ["9", "10", "J", "Q", "K", "A"];
const SUITS: Suit[] = ["S", "H", "D", "C"];
const PARTNER_SUIT: Record<Suit, Suit> = { S: "C", C: "S", H: "D", D: "H" };

export interface EuchreState {
  seats: Seat[];
  dealer: number;
  hands: Record<string, string[]>;
  upcard: string;
  phase: "bid1" | "bid2" | "discard" | "play" | "handOver" | "over";
  /** Seat deciding in the auction, or leading/playing in a trick. */
  turn: number;
  passes: number;
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

export type EuchreAction =
  | { type: "pass" }
  | { type: "order"; alone?: boolean }
  | { type: "name"; suit: Suit; alone?: boolean }
  | { type: "discard"; card: string }
  | { type: "play"; card: string }
  | { type: "nextHand" };

export function effectiveSuit(card: string, trump: Suit | null): Suit {
  if (trump && rankOf(card) === "J" && suitOf(card) === PARTNER_SUIT[trump]) return trump;
  return suitOf(card);
}

/** Strength within a trick (0 = can't win). */
export function cardPower(card: string, led: Suit, trump: Suit): number {
  const s = effectiveSuit(card, trump);
  const r = rankOf(card);
  if (s === trump) {
    if (r === "J") return suitOf(card) === trump ? 200 : 199;
    return 100 + RANKS.indexOf(r);
  }
  if (s === led) return 10 + RANKS.indexOf(r);
  return 0;
}

const team = (seat: number) => seat % 2;
const next = (s: EuchreState, seat: number) => {
  let n = (seat + 1) % 4;
  if (n === s.sitOut) n = (n + 1) % 4;
  return n;
};

function deal(seats: Seat[], dealer: number, rand: () => number): Partial<EuchreState> {
  const deck = shuffle(SUITS.flatMap((s) => RANKS.map((r) => r + s)), rand);
  const hands: Record<string, string[]> = {};
  seats.forEach((p, i) => (hands[p.id] = sortEuchre(deck.slice(i * 5, i * 5 + 5), null)));
  return {
    dealer,
    hands,
    upcard: deck[20],
    phase: "bid1",
    turn: (dealer + 1) % 4,
    passes: 0,
    trump: null,
    maker: null,
    alone: false,
    sitOut: null,
    trick: [],
    tricks: [0, 0],
    lastTrick: null,
    result: null,
  };
}

export function sortEuchre(cards: string[], trump: Suit | null): string[] {
  const order = (c: string) => {
    const s = effectiveSuit(c, trump);
    const suitRank = s === trump ? 9 : SUITS.indexOf(s);
    return suitRank * 1000 + (trump ? cardPower(c, s, trump) : RANKS.indexOf(rankOf(c)));
  };
  return cards.slice().sort((a, b) => order(a) - order(b));
}

export function legalPlays(s: EuchreState, seat: number): string[] {
  const hand = s.hands[s.seats[seat].id];
  if (s.phase !== "play" || s.turn !== seat) return [];
  if (s.trick.length === 0) return hand;
  const led = effectiveSuit(s.trick[0].card, s.trump);
  const follow = hand.filter((c) => effectiveSuit(c, s.trump) === led);
  return follow.length ? follow : hand;
}

function choose(s: EuchreState, seat: number, trump: Suit, alone: boolean, phase: "discard" | "play"): EuchreState {
  const sitOut = alone ? (seat + 2) % 4 : null;
  const hands = Object.fromEntries(Object.entries(s.hands).map(([id, h]) => [id, sortEuchre(h, trump)]));
  const base = { ...s, hands, trump, maker: seat, alone, sitOut, passes: 0 };
  const log = `${s.seats[seat].name} chose ${SUIT_NAMES[trump]}${alone ? " and is going alone" : ""}.`;
  if (phase === "discard") {
    const dealerId = s.seats[s.dealer].id;
    return { ...base, phase: "discard", turn: s.dealer, hands: { ...hands, [dealerId]: sortEuchre([...hands[dealerId], s.upcard], trump) }, log };
  }
  return startPlay({ ...base, log });
}

function startPlay(s: EuchreState): EuchreState {
  return { ...s, phase: "play", turn: next(s, s.dealer) };
}

export const euchre: GameDef<EuchreState, EuchreAction> = {
  key: "euchre",
  name: "Euchre",
  tagline: "Pick trump, back your partner, take three tricks.",
  styles: ["cards", "teams"],
  minPlayers: 4,
  maxPlayers: 4,
  time: "30–45 min",
  teams: PARTNERS,
  description:
    "The great Midwestern partnership card game. Two teams of two try to win tricks with a small 24-card deck. Whoever names trump has to take at least three of the five tricks — and the jacks become the two highest cards in the deck. First team to 10 points wins.",
  rules: [
    { heading: "Teams & the deal", body: ["Four players in two partnerships; partners sit opposite each other.", "The deck is the 9s through aces — 24 cards. Everyone gets 5. One card is turned face up; the other three stay hidden."] },
    {
      heading: "Choosing trump",
      body: [
        "Starting left of the dealer, each player either passes or orders up the face-up card's suit as trump. If someone orders it up, the dealer takes that card and discards one.",
        "If all four pass, go around again: name any other suit as trump, or pass. If everyone passes again, the deal moves on.",
        "Whoever picks trump may go alone — their partner sits the hand out.",
      ],
    },
    {
      heading: "Playing tricks",
      body: [
        "The player left of the dealer leads. Follow the suit led if you can; otherwise play anything.",
        "Trump, highest to lowest: the jack of trump (right bower), the other jack of the same colour (left bower — it counts as trump), then A, K, Q, 10, 9.",
        "Highest trump wins the trick, otherwise the highest card of the suit led. The winner leads next.",
      ],
    },
    {
      heading: "Scoring",
      body: [
        "The team that chose trump scores 1 point for 3 or 4 tricks, 2 points for all 5, or 4 points for all 5 going alone.",
        "If they take fewer than 3 tricks, the other team scores 2 (they've been euchred).",
        "First team to 10 points wins.",
      ],
    },
  ],
  license: { name: "Traditional — public domain", note: "Original implementation. Rules after Bicycle and Pagat (North American Euchre)." },

  setup(seats, ctx) {
    const s = alternateTeams(seats).map((p, i) => ({ ...p, team: i % 2 }));
    const dealer = randomIndex(4, ctx.rand);
    return { seats: s, scores: [0, 0], log: "", ...deal(s, dealer, ctx.rand) } as EuchreState;
  },

  act(s, playerId, a, ctx) {
    const seat = s.seats.findIndex((p) => p.id === playerId);
    if (seat < 0) throw new GameError("You're not in this game.");
    if (s.phase === "over") throw new GameError("The game is over.");

    if (a.type === "nextHand") {
      if (s.phase !== "handOver") throw new GameError("The hand is still going.");
      return { ...s, ...deal(s.seats, (s.dealer + 1) % 4, ctx.rand), log: "" };
    }
    if (s.turn !== seat) throw new GameError("It's not your turn.");
    const hand = s.hands[playerId];

    switch (s.phase) {
      case "bid1":
      case "bid2": {
        if (a.type === "pass") {
          const passes = s.passes + 1;
          if (passes < 4) return { ...s, passes, turn: (seat + 1) % 4, log: `${s.seats[seat].name} passed.` };
          if (s.phase === "bid1") return { ...s, phase: "bid2", passes: 0, turn: (s.dealer + 1) % 4, log: "Everyone passed. Name another suit, or pass." };
          return { ...s, ...deal(s.seats, (s.dealer + 1) % 4, ctx.rand), log: "Nobody chose trump — new deal." };
        }
        if (s.phase === "bid1" && a.type === "order") return choose(s, seat, suitOf(s.upcard), !!a.alone, "discard");
        if (s.phase === "bid2" && a.type === "name") {
          if (!SUITS.includes(a.suit)) throw new GameError("Pick a suit.");
          if (a.suit === suitOf(s.upcard)) throw new GameError("That suit was turned down — pick another.");
          return choose(s, seat, a.suit, !!a.alone, "play");
        }
        throw new GameError("Pass or choose trump.");
      }
      case "discard": {
        if (a.type !== "discard" || !hand.includes(a.card)) throw new GameError("Pick a card to discard.");
        return startPlay({ ...s, hands: { ...s.hands, [playerId]: hand.filter((c) => c !== a.card) }, log: `${s.seats[seat].name} picked up and discarded.` });
      }
      case "play": {
        if (a.type !== "play") throw new GameError("Play a card.");
        if (!legalPlays(s, seat).includes(a.card)) throw new GameError(hand.includes(a.card) ? "You have to follow the suit led." : "That card isn't in your hand.");
        const trick = [...s.trick, { seat, card: a.card }];
        const hands = { ...s.hands, [playerId]: hand.filter((c) => c !== a.card) };
        const needed = s.alone ? 3 : 4;
        if (trick.length < needed) return { ...s, hands, trick, turn: next(s, seat), log: "" };

        const led = effectiveSuit(trick[0].card, s.trump);
        const winner = trick.reduce((best, t) => (cardPower(t.card, led, s.trump!) > cardPower(best.card, led, s.trump!) ? t : best)).seat;
        const tricks: [number, number] = [...s.tricks];
        tricks[team(winner)]++;
        const done = tricks[0] + tricks[1] === 5;
        const after: EuchreState = { ...s, hands, trick: [], tricks, lastTrick: { cards: trick, winner }, turn: winner, log: `${s.seats[winner].name} took the trick.` };
        if (!done) return after;

        const makers = team(s.maker!);
        const made = tricks[makers];
        const points = made === 5 ? (s.alone ? 4 : 2) : made >= 3 ? 1 : 2;
        const scoring = made >= 3 ? makers : 1 - makers;
        const scores: [number, number] = [...s.scores];
        scores[scoring] += points;
        return { ...after, scores, result: { makers, tricks: made, points, team: scoring }, phase: scores[scoring] >= TARGET ? "over" : "handOver" };
      }
    }
    throw new GameError("Not now.");
  },

  view(s, playerId) {
    const seat = s.seats.findIndex((p) => p.id === playerId);
    return {
      seats: s.seats.map((p, i) => ({ id: p.id, name: p.name, team: i % 2, cards: s.hands[p.id].length })),
      you: seat,
      hand: s.hands[playerId] ?? [],
      legal: seat >= 0 ? legalPlays(s, seat) : [],
      upcard: s.phase === "bid1" || s.phase === "bid2" ? s.upcard : null,
      turnedDown: s.phase === "bid2" ? suitOf(s.upcard) : null,
      phase: s.phase,
      dealer: s.dealer,
      turn: s.turn,
      trump: s.trump,
      maker: s.maker,
      alone: s.alone,
      sitOut: s.sitOut,
      trick: s.trick,
      tricks: s.tricks,
      lastTrick: s.lastTrick,
      scores: s.scores,
      result: s.result,
      log: s.log,
    };
  },

  status(s) {
    if (s.phase === "over") return { over: true, message: `${TEAM_NAMES[s.scores[0] >= TARGET ? 0 : 1]} wins!`, turn: [] };
    if (s.phase === "handOver") {
      const r = s.result!;
      return { over: false, message: `${TEAM_NAMES[r.team]} +${r.points}`, turn: [] };
    }
    const p = s.seats[s.turn];
    const what = s.phase === "discard" ? "picking a discard" : s.phase === "play" ? "to play" : "to bid";
    return { over: false, message: `${nameOf(s.seats, p.id)} ${what}`, turn: [p.id] };
  },

  scoreboard(s): ScoreLine[] {
    return [0, 1].map((t) => ({ label: TEAM_NAMES[t], score: s.scores[t], playerIds: s.seats.filter((_, i) => i % 2 === t).map((p) => p.id) }));
  },
};
