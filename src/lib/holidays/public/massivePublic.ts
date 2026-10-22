// ─── Massive Decks with the whole bar ────────────────────────────────────────
// Needs four people. Until then everyone sees "waiting for N more players".
// Each round: 45 s to play an answer card, 30 s for the judge, 8 s to see who
// won — then straight into the next round. Nobody can stall it:
//   - Didn't play a card in time? The game plays a random one for you.
//   - Judge didn't pick? The game picks at random (no point for the judge's
//     indecision — the winning card's owner still scores).
//   - Two auto-played turns in a row, or no sign of you for 45 seconds, and
//     you're taken out of the game (rejoin any time; today's score is kept).
// Joining mid-round puts you in the next round.

import { shuffle } from "../cards";
import { MASSIVE_ANSWERS, MASSIVE_PROMPTS } from "../decks";
import { GameError } from "../types";
import { here, type PubPlayer, type PubState, type PublicGameDef } from "./engine";

export const MIN_PLAYERS = 4;
export const MAX_ACTIVE = 24;
export const HAND = 7;
export const SUBMIT_MS = 45_000;
export const JUDGE_MS = 30_000;
export const RESULT_MS = 8_000;
/** Auto-played turns in a row before a player is removed. */
export const KICK_AFTER = 2;

export interface MDRound {
  phase: "waiting" | "submit" | "judge" | "result";
  round: number;
  participants: string[];
  judge: string | null;
  hands: Record<string, number[]>;
  answers: number[];
  discard: number[];
  prompts: number[];
  prompt: number;
  deadline: number;
  submissions: Record<string, { card: number; auto: boolean }>;
  order: string[];
  winner: string | null;
  autoJudged: boolean;
  voided: boolean;
}

export type MDAction = { type: "submit"; card: number } | { type: "pick"; card: number };
type S = PubState<MDRound>;

function drawCards(g: MDRound, n: number, rand: () => number): { cards: number[]; g: MDRound } {
  let answers = g.answers;
  let discard = g.discard;
  const cards: number[] = [];
  while (cards.length < n) {
    if (!answers.length) {
      if (!discard.length) break;
      answers = shuffle(discard, rand);
      discard = [];
    }
    cards.push(answers[0]);
    answers = answers.slice(1);
  }
  return { cards, g: { ...g, answers, discard } };
}

/** Take a player out: their cards go back to the discard pile. */
function release(g: MDRound, id: string): MDRound {
  const hand = g.hands[id];
  if (!hand) return g;
  const hands = { ...g.hands };
  delete hands[id];
  return { ...g, hands, discard: [...g.discard, ...hand] };
}

function startRound(s: S, now: number, rand: () => number): S {
  let g = s.game;
  // Remove anyone who keeps missing turns or has gone quiet.
  const players: PubPlayer[] = s.players.map((p) => {
    if (p.status === "gone") return p;
    if (p.missed >= KICK_AFTER || !here(p, now)) {
      g = release(g, p.id);
      return { ...p, status: "gone", removed: "idle" };
    }
    return p;
  });
  for (const p of players) if (p.status === "gone") g = release(g, p.id);

  const ready = players.filter((p) => p.status !== "gone");
  // Players from the last round keep their seats first, then newcomers in arrival order.
  const seated = [...ready.filter((p) => p.status === "active"), ...ready.filter((p) => p.status === "queued")].slice(0, MAX_ACTIVE).map((p) => p.id);
  if (seated.length < MIN_PLAYERS) {
    return { ...s, players: players.map((p) => (p.status === "active" ? { ...p, status: "queued" as const } : p)), game: { ...g, phase: "waiting", participants: [], judge: null, submissions: {}, order: [], winner: null } };
  }

  const hands = { ...g.hands };
  for (const id of seated) {
    const need = HAND - (hands[id]?.length ?? 0);
    if (need > 0) {
      const d = drawCards(g, need, rand);
      g = d.g;
      hands[id] = [...(hands[id] ?? []), ...d.cards];
    }
  }
  // The judge's seat moves round the table.
  const prevIdx = g.judge ? seated.indexOf(g.judge) : -1;
  const judge = seated[(prevIdx + 1) % seated.length];
  const prompts = g.prompts.length ? g.prompts : shuffle(MASSIVE_PROMPTS.map((_, i) => i).filter((i) => i !== g.prompt), rand);
  return {
    ...s,
    players: players.map((p) => (seated.includes(p.id) ? { ...p, status: "active" as const } : p.status === "active" ? { ...p, status: "queued" as const } : p)),
    game: { ...g, hands, phase: "submit", round: g.round + 1, participants: seated, judge, prompt: prompts[0], prompts: prompts.slice(1), deadline: now + SUBMIT_MS, submissions: {}, order: [], winner: null, autoJudged: false, voided: false },
  };
}

const playing = (s: S, id: string) => s.players.find((p) => p.id === id)?.status !== "gone";
/** Non-judges still in the game who owe a card. */
const owing = (s: S) => s.game.participants.filter((id) => id !== s.game.judge && playing(s, id) && !(id in s.game.submissions));

function toJudging(s: S, now: number, rand: () => number): S {
  const g = s.game;
  if (Object.keys(g.submissions).length < 2) {
    // Too few answers: hand them back and go again.
    const hands = { ...g.hands };
    for (const [id, sub] of Object.entries(g.submissions)) if (hands[id]) hands[id] = [...hands[id], sub.card];
    return { ...s, game: { ...g, hands, submissions: {}, phase: "result", voided: true, deadline: now + RESULT_MS } };
  }
  return { ...s, game: { ...g, phase: "judge", order: shuffle(Object.keys(g.submissions), rand), deadline: now + JUDGE_MS } };
}

function finish(s: S, winner: string, auto: boolean, now: number): S {
  const g = s.game;
  const players = s.players.map((p) => {
    if (p.id === winner) return { ...p, score: p.score + 1 };
    if (auto && p.id === g.judge) return { ...p, missed: p.missed + 1 };
    return p;
  });
  return { ...s, players, game: { ...g, phase: "result", winner, autoJudged: auto, discard: [...g.discard, ...Object.values(g.submissions).map((x) => x.card)], deadline: now + RESULT_MS } };
}

export const massivePublic: PublicGameDef<MDRound, MDAction> = {
  key: "massive-decks",
  name: "Massive Decks",
  tagline: "Fill in the blank with the whole bar. Needs 4 players.",
  description:
    "The fill-in-the-blank card game, bar-wide. A prompt goes up, everyone plays their funniest answer card, and a rotating judge picks a favourite without knowing whose it is. Every round you win is a point toward today's crown.",
  rules: [
    { heading: "Starting", body: [`The game needs at least ${MIN_PLAYERS} players. Until then you'll see how many more are needed.`, "Join while a round is running and you're dealt in next round."] },
    { heading: "Each round", body: ["You have 45 seconds to lock in one answer card. The judge then has 30 seconds to pick a favourite.", "The winning card's owner scores a point. The judge's seat moves round each time."] },
    {
      heading: "Keep it moving",
      body: [
        "If you don't play in time, the game plays a random card for you. If the judge doesn't pick, the game picks at random.",
        "Miss two turns in a row, or close the page, and you'll be taken out of the game. You can rejoin any time and keep today's score.",
      ],
    },
    { heading: "Today's winner", body: ["Points add up all day. The highest score when the day ends (4 a.m.) goes on the Daily Winners board."] },
  ],
  minPlayers: MIN_PLAYERS,
  maxActive: MAX_ACTIVE,

  init(ctx) {
    const prompts = shuffle(MASSIVE_PROMPTS.map((_, i) => i), ctx.rand);
    return {
      phase: "waiting",
      round: 0,
      participants: [],
      judge: null,
      hands: {},
      answers: shuffle(MASSIVE_ANSWERS.map((_, i) => i), ctx.rand),
      discard: [],
      prompts: prompts.slice(1),
      prompt: prompts[0],
      deadline: 0,
      submissions: {},
      order: [],
      winner: null,
      autoJudged: false,
      voided: false,
    };
  },

  onJoin(s, playerId, ctx) {
    if (s.game.phase === "waiting") return startRound(s, ctx.now, ctx.rand);
    if (s.game.participants.includes(playerId) && s.game.hands[playerId]) {
      return { ...s, players: s.players.map((p) => (p.id === playerId ? { ...p, status: "active" as const } : p)) };
    }
    return s;
  },

  onLeave(s, playerId, ctx) {
    if (s.game.phase === "submit" && owing(s).length === 0) return toJudging(s, ctx.now, ctx.rand);
    // A judge who walks off mid-judging: pick at random now rather than wait.
    if (s.game.phase === "judge" && s.game.judge === playerId) {
      const pick = s.game.order[Math.floor(ctx.rand() * s.game.order.length)];
      return finish(s, pick, true, ctx.now);
    }
    return s;
  },

  act(s, playerId, a, ctx) {
    const g = s.game;
    if (a.type === "submit") {
      if (g.phase !== "submit") throw new GameError("Answers are locked for this round.");
      if (!g.participants.includes(playerId)) throw new GameError("You'll be dealt in next round.");
      if (playerId === g.judge) throw new GameError("You're judging this round.");
      if (playerId in g.submissions) throw new GameError("Your answer is locked in.");
      if (!g.hands[playerId]?.includes(a.card)) throw new GameError("That card isn't in your hand.");
      const next: S = { ...s, game: { ...g, hands: { ...g.hands, [playerId]: g.hands[playerId].filter((c) => c !== a.card) }, submissions: { ...g.submissions, [playerId]: { card: a.card, auto: false } } } };
      return owing(next).length === 0 ? toJudging(next, ctx.now, ctx.rand) : next;
    }
    if (g.phase !== "judge") throw new GameError("Not time to judge.");
    if (playerId !== g.judge) throw new GameError("Only the judge picks.");
    const winner = Object.entries(g.submissions).find(([, x]) => x.card === a.card)?.[0];
    if (!winner) throw new GameError("Pick one of the answers.");
    return finish(s, winner, false, ctx.now);
  },

  tick(s, ctx) {
    const g = s.game;
    if (g.phase === "waiting") {
      const ready = s.players.filter((p) => here(p, ctx.now)).length;
      return ready >= MIN_PLAYERS ? startRound(s, ctx.now, ctx.rand) : null;
    }
    if (ctx.now < g.deadline) {
      if (g.phase === "submit" && owing(s).length === 0) return toJudging(s, ctx.now, ctx.rand);
      return null;
    }
    if (g.phase === "submit") {
      // Time's up: play a random card for everyone who didn't.
      let hands = g.hands;
      const submissions = { ...g.submissions };
      const missed = new Set<string>();
      for (const id of owing(s)) {
        const hand = hands[id];
        if (!hand?.length) continue;
        const card = hand[Math.floor(ctx.rand() * hand.length)];
        hands = { ...hands, [id]: hand.filter((c) => c !== card) };
        submissions[id] = { card, auto: true };
        missed.add(id);
      }
      const players = s.players.map((p) => (missed.has(p.id) ? { ...p, missed: p.missed + 1 } : p));
      return toJudging({ ...s, players, game: { ...g, hands, submissions } }, ctx.now, ctx.rand);
    }
    if (g.phase === "judge") return finish(s, g.order[Math.floor(ctx.rand() * g.order.length)], true, ctx.now);
    return startRound(s, ctx.now, ctx.rand); // result shown long enough
  },

  view(s, playerId, ctx) {
    const g = s.game;
    const reveal = g.phase === "result";
    const name = (id: string | null) => (id ? s.players.find((p) => p.id === id)?.name ?? "" : "");
    const ready = s.players.filter((p) => here(p, ctx.now)).length;
    return {
      phase: g.phase,
      round: g.round,
      needed: Math.max(0, MIN_PLAYERS - ready),
      ready,
      prompt: g.phase === "waiting" ? null : MASSIVE_PROMPTS[g.prompt],
      deadline: g.deadline,
      inRound: !!playerId && g.participants.includes(playerId),
      seats: g.participants.length,
      judge: g.judge ? { id: g.judge, name: name(g.judge) } : null,
      isJudge: !!playerId && playerId === g.judge,
      hand: playerId && g.participants.includes(playerId) ? (g.hands[playerId] ?? []).map((c) => ({ id: c, text: MASSIVE_ANSWERS[c] })) : [],
      yourAnswer: playerId && g.submissions[playerId] ? { text: MASSIVE_ANSWERS[g.submissions[playerId].card], auto: g.submissions[playerId].auto } : null,
      locked: Object.keys(g.submissions).length,
      owed: g.participants.filter((id) => id !== g.judge).length,
      answers: g.phase === "judge" || reveal ? g.order.map((id) => ({ id: g.submissions[id].card, text: MASSIVE_ANSWERS[g.submissions[id].card], by: reveal ? name(id) : null, won: reveal && g.winner === id, auto: reveal && g.submissions[id].auto })) : [],
      winner: g.winner ? name(g.winner) : null,
      autoJudged: g.autoJudged,
      voided: g.voided,
    };
  },
};
