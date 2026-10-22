// ─── 03 I Doubt It ───────────────────────────────────────────────────────────
// The ascending-rank bluffing game, with the handoff's app defaults: 3–8
// players, all cards dealt, claims run A, 2 … K and round again, 1–4 cards
// face down per turn (the count is always true, the rank may be a lie), a
// 5-second challenge window, and a hand only wins once it survives its last
// challenge window.

import { newDeck, rankOf, RANKS, shuffle, sortHand } from "../cards";
import { nameOf, randomIndex } from "../common";
import { GameError, type GameDef, type Seat } from "../types";

export const WINDOW_MS = 5000;

export interface DoubtState {
  seats: Seat[];
  hands: Record<string, string[]>;
  pile: string[];
  turn: number;
  /** Index into RANKS of the rank the current player must claim. */
  claim: number;
  pending: { seat: number; cards: string[]; rank: string; deadline: number } | null;
  reveal: { seat: number; challenger: number; cards: string[]; rank: string; truthful: boolean; taker: number; count: number } | null;
  winner: number | null;
  log: string;
}

export type DoubtAction = { type: "submit"; cards: string[] } | { type: "doubt" };

function advance(s: DoubtState, after: number): Pick<DoubtState, "turn" | "claim"> {
  return { turn: (after + 1) % s.seats.length, claim: (s.claim + 1) % RANKS.length };
}

export const iDoubtIt: GameDef<DoubtState, DoubtAction> = {
  key: "i-doubt-it",
  name: "I Doubt It",
  tagline: "Play cards face down, claim the next rank. Bluff boldly.",
  styles: ["cards", "party"],
  minPlayers: 3,
  maxPlayers: 8,
  time: "15–30 min",
  description:
    "The bluffing game you may know by another name. Everyone takes turns laying cards face down and saying what they are — aces, then twos, then threes, all the way to kings and around again. Tell the truth or don't. If someone doubts you and you lied, the whole pile is yours. First to empty their hand wins.",
  rules: [
    { heading: "The deal", body: ["All 52 cards are dealt out. A random player goes first."] },
    {
      heading: "Your turn",
      body: [
        "Lay 1 to 4 cards face down. The app announces how many and the rank you're claiming — aces first, then twos, threes … kings, then aces again.",
        "You must play, even if you have none of the rank. Lying about the rank is allowed; the number of cards is always true.",
      ],
    },
    {
      heading: "Doubting",
      body: [
        "After each play, everyone else has 5 seconds to tap I Doubt It.",
        "The play is turned over. If every card matches the claim, the doubter picks up the whole pile. If any card doesn't, the player who lied picks it up.",
        "Play then carries on from the player after the one who was doubted, with the next rank.",
      ],
    },
    { heading: "Winning", body: ["Empty your hand and survive the doubt window to win.", "If your last play is doubted and it was a lie, you pick up the pile and keep going."] },
  ],
  license: { name: "Traditional — public domain", note: "Original implementation. Ascending-rank rules after Pagat and Bicycle." },

  setup(seats, ctx) {
    const deck = shuffle(newDeck(), ctx.rand);
    const hands: Record<string, string[]> = Object.fromEntries(seats.map((p) => [p.id, [] as string[]]));
    deck.forEach((c, i) => hands[seats[i % seats.length].id].push(c));
    for (const id of Object.keys(hands)) hands[id] = sortHand(hands[id]);
    return { seats, hands, pile: [], turn: randomIndex(seats.length, ctx.rand), claim: 0, pending: null, reveal: null, winner: null, log: "" };
  },

  act(s, playerId, a, ctx) {
    if (s.winner !== null) throw new GameError("The game is over.");
    const seat = s.seats.findIndex((p) => p.id === playerId);
    if (seat < 0) throw new GameError("You're not in this game.");
    // A window that has already run out closes before anything else happens.
    if (s.pending && ctx.now >= s.pending.deadline) {
      const closed = iDoubtIt.tick!(s, ctx)!;
      if (a.type === "doubt") throw new GameError("Too late — that play was accepted.");
      return iDoubtIt.act(closed, playerId, a, ctx);
    }

    if (a.type === "doubt") {
      if (!s.pending) throw new GameError("There's nothing to doubt right now.");
      if (s.pending.seat === seat) throw new GameError("You can't doubt yourself.");
      const { cards, rank } = s.pending;
      const truthful = cards.every((c) => rankOf(c) === rank);
      const taker = truthful ? seat : s.pending.seat;
      const takerId = s.seats[taker].id;
      const hands = { ...s.hands, [takerId]: sortHand([...s.hands[takerId], ...s.pile]) };
      const submitterOut = s.hands[s.seats[s.pending.seat].id].length === 0 && truthful;
      const who = s.seats[seat].name;
      return {
        ...s,
        hands,
        pile: [],
        pending: null,
        reveal: { seat: s.pending.seat, challenger: seat, cards, rank, truthful, taker, count: s.pile.length },
        winner: submitterOut ? s.pending.seat : null,
        ...advance(s, s.pending.seat),
        log: truthful ? `${who} doubted — but it was true! ${who} picks up the pile.` : `${who} doubted — caught! ${s.seats[s.pending.seat].name} picks up the pile.`,
      };
    }

    if (s.pending) throw new GameError("Wait for the doubt window to close.");
    if (seat !== s.turn) throw new GameError("It's not your turn.");
    const cards = a.cards ?? [];
    const hand = s.hands[playerId];
    if (cards.length < 1 || cards.length > 4 || new Set(cards).size !== cards.length) throw new GameError("Play one to four cards.");
    if (!cards.every((c) => hand.includes(c))) throw new GameError("Those cards aren't all in your hand.");
    const rank = RANKS[s.claim];
    return {
      ...s,
      hands: { ...s.hands, [playerId]: hand.filter((c) => !cards.includes(c)) },
      pile: [...s.pile, ...cards],
      pending: { seat, cards, rank, deadline: ctx.now + WINDOW_MS },
      reveal: null,
      log: `${s.seats[seat].name}: “${cards.length} ${rankWord(rank, cards.length)}.”`,
    };
  },

  tick(s, ctx) {
    if (!s.pending || ctx.now < s.pending.deadline) return null;
    const out = s.hands[s.seats[s.pending.seat].id].length === 0;
    return { ...s, pending: null, winner: out ? s.pending.seat : null, ...advance(s, s.pending.seat) };
  },

  view(s, playerId) {
    const seat = s.seats.findIndex((p) => p.id === playerId);
    return {
      seats: s.seats.map((p) => ({ id: p.id, name: p.name, cards: s.hands[p.id].length })),
      you: seat,
      hand: s.hands[playerId] ?? [],
      pileCount: s.pile.length,
      turn: s.turn,
      rank: RANKS[s.claim],
      // The submitted cards themselves stay secret until a doubt reveals them.
      pending: s.pending ? { seat: s.pending.seat, count: s.pending.cards.length, rank: s.pending.rank, deadline: s.pending.deadline } : null,
      reveal: s.reveal,
      winner: s.winner,
      log: s.log,
    };
  },

  status(s) {
    if (s.winner !== null) return { over: true, message: `${s.seats[s.winner].name} wins!`, turn: [] };
    if (s.pending) {
      const others = s.seats.filter((_, i) => i !== s.pending!.seat).map((p) => p.id);
      return { over: false, message: `Doubt it? ${nameOf(s.seats, s.seats[s.pending.seat].id)} claims ${s.pending.cards.length} ${rankWord(s.pending.rank, s.pending.cards.length)}`, turn: others };
    }
    const p = s.seats[s.turn];
    return { over: false, message: `${p.name} plays ${rankWord(RANKS[s.claim], 2)}`, turn: [p.id] };
  },
};

const WORDS: Record<string, string> = { A: "ace", J: "jack", Q: "queen", K: "king" };
export function rankWord(rank: string, n: number) {
  const w = WORDS[rank] ?? rank;
  return n === 1 ? w : rank === "6" ? "sixes" : `${w}s`;
}
