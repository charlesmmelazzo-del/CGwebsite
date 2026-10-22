// ─── Timed team turns — Forbidden Words & Word Relay ─────────────────────────
// Both games: two teams alternate fixed 60-second turns, three each; a clue
// giver (rotating within the team) resolves cards; ties add paired extra
// turns. They differ in who sees the card, what a skip costs, how many skips
// a turn allows, and who may call a foul — so each game is this engine with
// its own settings. Pass the Word (different rules entirely) lives elsewhere.

import { shuffle } from "../cards";
import { nameOf, randomIndex, TEAM_NAMES, teamMembers } from "../common";
import { GameError, type GameCtx, type GameStatus, type ScoreLine, type Seat } from "../types";

export type Outcome = "correct" | "skip" | "foul" | "expired";

export interface TurnSettings {
  turnMs: number;
  turnsPerTeam: number;
  deckSize: number;
  points: Record<Outcome, number>;
  /** Skips allowed per turn (null = unlimited). */
  skips: number | null;
  /** An opposing referee sees the card and may call Foul during the turn. */
  referee: boolean;
  /** A foul uses up one of the turn's skips, if any remain. */
  foulUsesSkip: boolean;
}

export interface TurnState {
  seats: Seat[];
  scores: [number, number];
  turns: [number, number];
  /** Turns each team plays before comparing (grows by one on a tie). */
  target: number;
  nextGiver: [number, number];
  nextRef: [number, number];
  team: number;
  giver: string;
  referee: string | null;
  phase: "ready" | "live" | "done";
  endsAt: number | null;
  deck: number[];
  card: number | null;
  skipsUsed: number;
  log: { card: number; outcome: Outcome }[];
  lastTurn: { team: number; giver: string; log: { card: number; outcome: Outcome }[]; corrections: number } | null;
}

export type TurnAction =
  | { type: "start" }
  | { type: "correct" }
  | { type: "skip" }
  | { type: "foul" }
  | { type: "review"; index: number; outcome: Outcome };

function member(seats: Seat[], team: number, idx: number): string {
  const m = teamMembers(seats, team);
  return m[idx % m.length].id;
}

function draw(s: TurnState, rand: () => number, size: number): Pick<TurnState, "card" | "deck"> {
  let deck = s.deck;
  if (deck.length === 0) deck = shuffle(Array.from({ length: size }, (_, i) => i).filter((i) => i !== s.card), rand);
  return { card: deck[0], deck: deck.slice(1) };
}

function prepare(s: TurnState, team: number, cfg: TurnSettings): TurnState {
  const giver = member(s.seats, team, s.nextGiver[team]);
  const referee = cfg.referee ? member(s.seats, 1 - team, s.nextRef[1 - team]) : null;
  return { ...s, team, giver, referee, phase: "ready", endsAt: null, card: null, skipsUsed: 0, log: [] };
}

function endTurn(s: TurnState, cfg: TurnSettings): TurnState {
  const log = s.card !== null ? [...s.log, { card: s.card, outcome: "expired" as Outcome }] : s.log;
  const turns: [number, number] = [...s.turns];
  turns[s.team]++;
  const nextGiver: [number, number] = [...s.nextGiver];
  nextGiver[s.team]++;
  const nextRef: [number, number] = [...s.nextRef];
  if (cfg.referee) nextRef[1 - s.team]++;
  let target = s.target;
  const base: TurnState = { ...s, turns, nextGiver, nextRef, card: null, lastTurn: { team: s.team, giver: s.giver, log, corrections: 0 } };
  if (turns[0] >= target && turns[1] >= target) {
    if (s.scores[0] !== s.scores[1]) return { ...base, phase: "done", endsAt: null };
    target++; // a tie: one more turn each
  }
  return prepare({ ...base, target }, 1 - s.team, cfg);
}

export function makeTurnGame(cfg: TurnSettings) {
  return {
    setup(seats: Seat[], ctx: GameCtx): TurnState {
      const start = randomIndex(2, ctx.rand);
      const blank: TurnState = {
        seats,
        scores: [0, 0],
        turns: [0, 0],
        target: cfg.turnsPerTeam,
        nextGiver: [0, 0],
        nextRef: [0, 0],
        team: start,
        giver: "",
        referee: null,
        phase: "ready",
        endsAt: null,
        deck: shuffle(Array.from({ length: cfg.deckSize }, (_, i) => i), ctx.rand),
        card: null,
        skipsUsed: 0,
        log: [],
        lastTurn: null,
      };
      return prepare(blank, start, cfg);
    },

    act(s: TurnState, playerId: string, a: TurnAction, ctx: GameCtx): TurnState {
      if (s.phase === "done") throw new GameError("The game is over.");

      if (a.type === "review") {
        if (playerId !== ctx.hostId) throw new GameError("Only the host can correct a score.");
        if (s.phase !== "ready" || !s.lastTurn) throw new GameError("Corrections happen between turns.");
        const entry = s.lastTurn.log[a.index];
        if (!entry || !(a.outcome in cfg.points)) throw new GameError("Pick a card and an outcome.");
        const scores: [number, number] = [...s.scores];
        scores[s.lastTurn.team] += cfg.points[a.outcome] - cfg.points[entry.outcome];
        const log = s.lastTurn.log.map((e, i) => (i === a.index ? { ...e, outcome: a.outcome } : e));
        return { ...s, scores, lastTurn: { ...s.lastTurn, log, corrections: s.lastTurn.corrections + 1 } };
      }

      if (s.phase === "live" && s.endsAt !== null && ctx.now >= s.endsAt) return endTurn(s, cfg);

      if (a.type === "foul") {
        if (!cfg.referee) throw new GameError("Fouls are handled by the host between turns.");
        if (playerId !== s.referee) throw new GameError("Only this turn's referee can call a foul.");
        if (s.phase !== "live" || s.card === null) throw new GameError("No card is in play.");
        const scores: [number, number] = [...s.scores];
        scores[s.team] += cfg.points.foul;
        const skipsUsed = cfg.foulUsesSkip && cfg.skips !== null && s.skipsUsed < cfg.skips ? s.skipsUsed + 1 : s.skipsUsed;
        return { ...s, scores, skipsUsed, log: [...s.log, { card: s.card, outcome: "foul" }], ...draw(s, ctx.rand, cfg.deckSize) };
      }

      if (playerId !== s.giver) throw new GameError("Only the clue giver can do that.");
      if (a.type === "start") {
        if (s.phase !== "ready") throw new GameError("The turn has already started.");
        return { ...s, phase: "live", endsAt: ctx.now + cfg.turnMs, lastTurn: null, ...draw({ ...s, card: null }, ctx.rand, cfg.deckSize) };
      }
      if (s.phase !== "live" || s.card === null) throw new GameError("Tap Start first.");
      if (a.type === "skip" && cfg.skips !== null && s.skipsUsed >= cfg.skips) throw new GameError("No skips left this turn.");
      const outcome: Outcome = a.type === "correct" ? "correct" : "skip";
      const scores: [number, number] = [...s.scores];
      scores[s.team] += cfg.points[outcome];
      return {
        ...s,
        scores,
        skipsUsed: outcome === "skip" ? s.skipsUsed + 1 : s.skipsUsed,
        log: [...s.log, { card: s.card, outcome }],
        ...draw(s, ctx.rand, cfg.deckSize),
      };
    },

    tick(s: TurnState, ctx: GameCtx): TurnState | null {
      return s.phase === "live" && s.endsAt !== null && ctx.now >= s.endsAt ? endTurn(s, cfg) : null;
    },

    /** `seesCard(state, playerId)` decides who gets the card text. */
    view(s: TurnState, playerId: string, card: (i: number) => unknown, seesCard: (s: TurnState, id: string) => boolean) {
      const you = s.seats.find((p) => p.id === playerId);
      const sees = seesCard(s, playerId);
      return {
        teams: [0, 1].map((t) => ({ name: TEAM_NAMES[t], score: s.scores[t], members: teamMembers(s.seats, t).map((p) => ({ id: p.id, name: p.name })) })),
        team: s.team,
        giver: { id: s.giver, name: nameOf(s.seats, s.giver) },
        referee: s.referee ? { id: s.referee, name: nameOf(s.seats, s.referee) } : null,
        yourTeam: you?.team ?? null,
        phase: s.phase,
        endsAt: s.endsAt,
        card: sees && s.card !== null ? card(s.card) : null,
        skipsLeft: cfg.skips === null ? null : cfg.skips - s.skipsUsed,
        resolved: s.log.length,
        turn: Math.min(s.turns[s.team] + 1, s.target),
        target: s.target,
        tiebreak: s.target > cfg.turnsPerTeam,
        lastTurn: s.lastTurn
          ? { ...s.lastTurn, team: TEAM_NAMES[s.lastTurn.team], giver: nameOf(s.seats, s.lastTurn.giver), log: s.lastTurn.log.map((e) => ({ ...e, card: card(e.card) })) }
          : null,
        points: cfg.points,
      };
    },

    status(s: TurnState): GameStatus {
      if (s.phase === "done") return { over: true, message: `${TEAM_NAMES[s.scores[0] > s.scores[1] ? 0 : 1]} wins!`, turn: [] };
      const giver = nameOf(s.seats, s.giver);
      return { over: false, message: s.phase === "ready" ? `${giver} is up for ${TEAM_NAMES[s.team]}` : `${giver} is giving clues`, turn: [s.giver] };
    },

    scoreboard(s: TurnState): ScoreLine[] {
      return [0, 1].map((t) => ({ label: TEAM_NAMES[t], score: s.scores[t], playerIds: teamMembers(s.seats, t).map((p) => p.id) }));
    },
  };
}
