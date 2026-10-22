// ─── 13 Massive Decks ────────────────────────────────────────────────────────
// Handoff defaults: 3–12 players, seven answer cards each, a rotating judge.
// Everyone else locks in one card for the prompt (60 s); answers are shown
// anonymously; the judge picks a favourite (45 s) for 1 point. Fewer than two
// answers voids the round. Hands refill to seven. First to 5 wins. Our own
// family-friendly deck — no third-party card content.

import { shuffle } from "../cards";
import { nameOf, randomIndex, winnerMessage } from "../common";
import { MASSIVE_ANSWERS, MASSIVE_PROMPTS } from "../decks";
import { GameError, type GameDef, type ScoreLine, type Seat } from "../types";

export const HAND = 7;
export const TARGET = 5;
export const SUBMIT_MS = 60_000;
export const JUDGE_MS = 45_000;

export interface MassiveState {
  seats: Seat[];
  judge: number;
  hands: Record<string, number[]>;
  answers: number[];
  answerDiscard: number[];
  prompts: number[];
  prompt: number;
  phase: "submit" | "judge" | "result" | "over";
  deadline: number;
  /** playerId → answer card, locked. */
  submissions: Record<string, number>;
  /** Shuffled order the judge sees. */
  order: string[];
  winner: string | null;
  voided: boolean;
  scores: number[];
}

export type MassiveAction = { type: "submit"; card: number } | { type: "pick"; card: number } | { type: "next" };

function drawAnswers(s: MassiveState, n: number, rand: () => number): { cards: number[]; answers: number[]; answerDiscard: number[] } {
  let answers = s.answers;
  let answerDiscard = s.answerDiscard;
  const cards: number[] = [];
  while (cards.length < n) {
    if (answers.length === 0) {
      answers = shuffle(answerDiscard, rand);
      answerDiscard = [];
      if (answers.length === 0) break;
    }
    cards.push(answers[0]);
    answers = answers.slice(1);
  }
  return { cards, answers, answerDiscard };
}

function nextPrompt(s: MassiveState, rand: () => number): Pick<MassiveState, "prompt" | "prompts"> {
  const prompts = s.prompts.length ? s.prompts : shuffle(MASSIVE_PROMPTS.map((_, i) => i).filter((i) => i !== s.prompt), rand);
  return { prompt: prompts[0], prompts: prompts.slice(1) };
}

function closeSubmissions(s: MassiveState, now: number, rand: () => number): MassiveState {
  const ids = Object.keys(s.submissions);
  if (ids.length < 2) {
    // Void: cards go back to their owners, the prompt is discarded.
    const hands = { ...s.hands };
    for (const [id, c] of Object.entries(s.submissions)) hands[id] = [...hands[id], c];
    return { ...s, hands, submissions: {}, phase: "result", voided: true, winner: null, deadline: now };
  }
  return { ...s, phase: "judge", order: shuffle(ids, rand), deadline: now + JUDGE_MS, voided: false };
}

function finishRound(s: MassiveState, winner: string | null): MassiveState {
  const scores = s.scores.slice();
  if (winner) scores[s.seats.findIndex((p) => p.id === winner)]++;
  const answerDiscard = [...s.answerDiscard, ...Object.values(s.submissions)];
  return { ...s, scores, winner, answerDiscard, phase: scores.some((v) => v >= TARGET) ? "over" : "result" };
}

export const massiveDecks: GameDef<MassiveState, MassiveAction> = {
  key: "massive-decks",
  name: "Massive Decks",
  tagline: "Fill in the blank with your funniest card. The judge picks.",
  styles: ["party", "cards"],
  minPlayers: 3,
  maxPlayers: 12,
  time: "20–40 min",
  description:
    "A fill-in-the-blank party game with a family-friendly holiday deck. A prompt goes up; everyone plays the answer card from their hand that makes it funniest. The judge picks a favourite without knowing who played what. First to five points wins.",
  rules: [
    { heading: "Cards", body: ["Everyone holds seven answer cards. Each round, one player is the judge; the role rotates."] },
    {
      heading: "Playing",
      body: [
        "A prompt appears with a blank. Everyone except the judge has 60 seconds to pick one answer card and lock it in.",
        "Answers are shuffled and shown with no names. The judge has 45 seconds to pick a favourite.",
        "Whoever played it gets a point. Then names are revealed and everyone draws back up to seven.",
      ],
    },
    { heading: "Winning", body: ["First to 5 points wins.", "If fewer than two answers come in, the round is skipped and nobody scores."] },
  ],
  license: {
    name: "AGPL-3.0 reference (Lattyware/massivedecks); original code and deck",
    url: "https://github.com/Lattyware/massivedecks/blob/main/LICENSE",
    note: "No code from that project is used here. Cards are written for Common Good.",
  },

  setup(seats, ctx) {
    let answers = shuffle(MASSIVE_ANSWERS.map((_, i) => i), ctx.rand);
    const hands: Record<string, number[]> = {};
    for (const p of seats) {
      hands[p.id] = answers.slice(0, HAND);
      answers = answers.slice(HAND);
    }
    const prompts = shuffle(MASSIVE_PROMPTS.map((_, i) => i), ctx.rand);
    return {
      seats,
      judge: randomIndex(seats.length, ctx.rand),
      hands,
      answers,
      answerDiscard: [],
      prompt: prompts[0],
      prompts: prompts.slice(1),
      phase: "submit",
      deadline: ctx.now + SUBMIT_MS,
      submissions: {},
      order: [],
      winner: null,
      voided: false,
      scores: seats.map(() => 0),
    };
  },

  act(s, playerId, a, ctx) {
    if (s.phase === "over") throw new GameError("The game is over.");
    const ticked = massiveDecks.tick!(s, ctx);
    if (ticked) {
      if (a.type === "next") return massiveDecks.act(ticked, playerId, a, ctx);
      throw new GameError("Time's up.");
    }
    const judge = s.seats[s.judge].id;

    if (a.type === "submit") {
      if (s.phase !== "submit") throw new GameError("Answers are locked.");
      if (playerId === judge) throw new GameError("You're judging this round.");
      if (playerId in s.submissions) throw new GameError("Your answer is locked in.");
      if (!s.hands[playerId].includes(a.card)) throw new GameError("That card isn't in your hand.");
      const next = { ...s, hands: { ...s.hands, [playerId]: s.hands[playerId].filter((c) => c !== a.card) }, submissions: { ...s.submissions, [playerId]: a.card } };
      return Object.keys(next.submissions).length >= s.seats.length - 1 ? closeSubmissions(next, ctx.now, ctx.rand) : next;
    }
    if (a.type === "pick") {
      if (s.phase !== "judge") throw new GameError("Not time to judge.");
      if (playerId !== judge) throw new GameError("Only the judge picks.");
      const winner = Object.entries(s.submissions).find(([, c]) => c === a.card)?.[0];
      if (!winner) throw new GameError("Pick one of the answers.");
      return finishRound(s, winner);
    }
    // next round
    if (s.phase !== "result") throw new GameError("Finish this round first.");
    let st: MassiveState = { ...s };
    const hands = { ...s.hands };
    for (const p of s.seats) {
      const need = HAND - hands[p.id].length;
      if (need > 0) {
        const d = drawAnswers(st, need, ctx.rand);
        hands[p.id] = [...hands[p.id], ...d.cards];
        st = { ...st, answers: d.answers, answerDiscard: d.answerDiscard };
      }
    }
    return { ...st, hands, ...nextPrompt(st, ctx.rand), judge: (s.judge + 1) % s.seats.length, phase: "submit", deadline: ctx.now + SUBMIT_MS, submissions: {}, order: [], winner: null, voided: false };
  },

  tick(s, ctx) {
    if (ctx.now < s.deadline) return null;
    if (s.phase === "submit") return closeSubmissions(s, ctx.now, ctx.rand);
    if (s.phase === "judge") return finishRound(s, null);
    return null;
  },

  view(s, playerId) {
    const judge = s.seats[s.judge].id;
    const reveal = s.phase === "result" || s.phase === "over";
    return {
      prompt: MASSIVE_PROMPTS[s.prompt],
      phase: s.phase,
      deadline: s.deadline,
      judge: { id: judge, name: nameOf(s.seats, judge) },
      isJudge: playerId === judge,
      hand: (s.hands[playerId] ?? []).map((c) => ({ id: c, text: MASSIVE_ANSWERS[c] })),
      yourAnswer: s.submissions[playerId] !== undefined ? MASSIVE_ANSWERS[s.submissions[playerId]] : null,
      locked: Object.keys(s.submissions).length,
      players: s.seats.length - 1,
      // Anonymous until the judge has picked.
      answers:
        s.phase === "judge" || reveal
          ? s.order.map((id) => ({ id: s.submissions[id], text: MASSIVE_ANSWERS[s.submissions[id]], by: reveal ? nameOf(s.seats, id) : null, won: reveal && s.winner === id }))
          : [],
      winner: s.winner ? nameOf(s.seats, s.winner) : null,
      voided: s.voided,
    };
  },

  status(s) {
    if (s.phase === "over") return { over: true, message: winnerMessage(massiveDecks.scoreboard!(s)), turn: [] };
    const judge = s.seats[s.judge];
    if (s.phase === "submit") return { over: false, message: `Pick your answer · ${judge.name} is judging`, turn: s.seats.filter((p) => p.id !== judge.id && !(p.id in s.submissions)).map((p) => p.id) };
    if (s.phase === "judge") return { over: false, message: `${judge.name} is choosing…`, turn: [judge.id] };
    return { over: false, message: s.voided ? "Not enough answers — round skipped" : s.winner ? `${nameOf(s.seats, s.winner)} wins the round!` : "The judge ran out of time", turn: [] };
  },

  scoreboard(s): ScoreLine[] {
    return s.seats.map((p, i) => ({ label: p.name, score: s.scores[i], playerIds: [p.id] }));
  },
};
