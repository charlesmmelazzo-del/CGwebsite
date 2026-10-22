// ─── 16 Five Dice ────────────────────────────────────────────────────────────
// Handoff defaults: 2–8 players, five dice, thirteen categories, up to three
// rolls a turn (hold any dice between rolls), one category filled per turn,
// upper bonus 35 at 63+. No extra five-of-a-kind bonus and no joker rules.

import { nameOf, randomIndex, sum, winnerMessage } from "../common";
import { GameError, type GameDef, type ScoreLine, type Seat } from "../types";

export const CATEGORIES = [
  { key: "ones", label: "Ones", upper: 1 },
  { key: "twos", label: "Twos", upper: 2 },
  { key: "threes", label: "Threes", upper: 3 },
  { key: "fours", label: "Fours", upper: 4 },
  { key: "fives", label: "Fives", upper: 5 },
  { key: "sixes", label: "Sixes", upper: 6 },
  { key: "three", label: "Three of a kind" },
  { key: "four", label: "Four of a kind" },
  { key: "full", label: "Full house" },
  { key: "small", label: "Small straight" },
  { key: "large", label: "Large straight" },
  { key: "five", label: "Five of a kind" },
  { key: "chance", label: "Chance" },
] as const;
export type Category = (typeof CATEGORIES)[number]["key"];

export function categoryScore(cat: Category, dice: number[]): number {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) counts[d]++;
  const total = sum(dice);
  const max = Math.max(...counts);
  const has = (run: number[]) => run.every((v) => counts[v] > 0);
  const c = CATEGORIES.find((x) => x.key === cat)!;
  if ("upper" in c) return counts[c.upper] * c.upper;
  switch (cat) {
    case "three": return max >= 3 ? total : 0;
    case "four": return max >= 4 ? total : 0;
    case "full": return counts.includes(3) && counts.includes(2) ? 25 : 0;
    case "small": return has([1, 2, 3, 4]) || has([2, 3, 4, 5]) || has([3, 4, 5, 6]) ? 30 : 0;
    case "large": return has([1, 2, 3, 4, 5]) || has([2, 3, 4, 5, 6]) ? 40 : 0;
    case "five": return max === 5 ? 50 : 0;
    case "chance": return total;
  }
  return 0;
}

export function cardTotal(card: Partial<Record<Category, number | null>>) {
  const upper = CATEGORIES.filter((c) => "upper" in c).reduce((t, c) => t + (card[c.key] ?? 0), 0);
  const bonus = upper >= 63 ? 35 : 0;
  const lower = CATEGORIES.filter((c) => !("upper" in c)).reduce((t, c) => t + (card[c.key] ?? 0), 0);
  return { upper, bonus, lower, total: upper + bonus + lower };
}

export interface DiceState {
  seats: Seat[];
  turn: number;
  dice: number[];
  held: boolean[];
  rolls: number;
  cards: Record<string, Partial<Record<Category, number>>>;
  last: { seat: number; category: Category; score: number } | null;
  over: boolean;
}

export type DiceAction = { type: "roll"; held?: boolean[] } | { type: "score"; category: Category };

const roll = (rand: () => number) => 1 + Math.floor(rand() * 6);

export const fiveDice: GameDef<DiceState, DiceAction> = {
  key: "five-dice",
  name: "Five Dice",
  tagline: "Roll, keep, roll again. Fill your scorecard.",
  styles: ["dice"],
  minPlayers: 2,
  maxPlayers: 8,
  time: "20–40 min",
  description:
    "The scorecard dice game. Roll five dice up to three times a turn, keeping the ones you like, then pick a box on your scorecard — sixes, a full house, a straight, five of a kind. Every box gets filled once, even with a zero. Highest total after thirteen turns wins.",
  rules: [
    { heading: "Your turn", body: ["Roll all five dice. Tap dice to keep them, then roll the rest — up to three rolls in all.", "Stop whenever you like and choose one empty box on your scorecard. You can score a zero in any box."] },
    {
      heading: "The scorecard",
      body: [
        "Ones to Sixes: add up the dice showing that number. Score 63 or more across these six for a 35-point bonus.",
        "Three / Four of a kind: at least that many matching dice — score the total of all five.",
        "Full house (three of one number and two of another): 25. Small straight (four in a row): 30. Large straight (five in a row): 40. Five of a kind: 50. Chance: the total of all five.",
      ],
    },
    { heading: "Winning", body: ["After every box is filled — thirteen turns each — the highest total wins. Ties share the win.", "Rolling five of a kind again after that box is filled earns no extra bonus."] },
  ],
  license: { name: "MIT reference (TrygoGH/multiplayer-yahtzee); original code", url: "https://github.com/TrygoGH/multiplayer-yahtzee/blob/main/LICENSE", note: "A simplified scorecard variant; not an official edition." },

  setup(seats, ctx) {
    return { seats, turn: randomIndex(seats.length, ctx.rand), dice: [1, 2, 3, 4, 5], held: [false, false, false, false, false], rolls: 0, cards: Object.fromEntries(seats.map((p) => [p.id, {}])), last: null, over: false };
  },

  act(s, playerId, a, ctx) {
    if (s.over) throw new GameError("The game is over.");
    const seat = s.seats.findIndex((p) => p.id === playerId);
    if (seat !== s.turn) throw new GameError("It's not your turn.");

    if (a.type === "roll") {
      if (s.rolls >= 3) throw new GameError("That was your last roll — pick a box.");
      const held = s.rolls === 0 ? [false, false, false, false, false] : (a.held ?? s.held).slice(0, 5).map(Boolean);
      if (held.every(Boolean)) throw new GameError("You're keeping every die — pick a box, or let some go.");
      return { ...s, dice: s.dice.map((d, i) => (held[i] ? d : roll(ctx.rand))), held, rolls: s.rolls + 1 };
    }
    if (s.rolls === 0) throw new GameError("Roll first.");
    if (!CATEGORIES.some((c) => c.key === a.category)) throw new GameError("Pick a box.");
    const card = s.cards[playerId];
    if (card[a.category] !== undefined) throw new GameError("That box is already filled.");
    const score = categoryScore(a.category, s.dice);
    const cards = { ...s.cards, [playerId]: { ...card, [a.category]: score } };
    const over = s.seats.every((p) => Object.keys(cards[p.id]).length === CATEGORIES.length);
    return { ...s, cards, last: { seat, category: a.category, score }, over, turn: (seat + 1) % s.seats.length, rolls: 0, held: [false, false, false, false, false] };
  },

  view(s, playerId) {
    const seat = s.seats.findIndex((p) => p.id === playerId);
    const card = s.cards[s.seats[s.turn].id];
    return {
      seats: s.seats.map((p) => ({ id: p.id, name: p.name, card: s.cards[p.id], ...cardTotal(s.cards[p.id]) })),
      you: seat,
      turn: s.turn,
      dice: s.dice,
      held: s.held,
      rolls: s.rolls,
      // What each open box would score with these dice.
      preview: s.rolls > 0 ? Object.fromEntries(CATEGORIES.filter((c) => card[c.key] === undefined).map((c) => [c.key, categoryScore(c.key, s.dice)])) : {},
      last: s.last,
    };
  },

  status(s) {
    if (s.over) return { over: true, message: winnerMessage(fiveDice.scoreboard!(s)), turn: [] };
    const p = s.seats[s.turn];
    return { over: false, message: `${nameOf(s.seats, p.id)}'s turn${s.rolls ? ` · roll ${s.rolls} of 3` : ""}`, turn: [p.id] };
  },

  scoreboard(s): ScoreLine[] {
    return s.seats.map((p) => ({ label: p.name, score: cardTotal(s.cards[p.id]).total, playerIds: [p.id] }));
  },
};
