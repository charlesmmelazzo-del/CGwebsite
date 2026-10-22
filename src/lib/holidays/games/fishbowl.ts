// ─── 11 Fishbowl ─────────────────────────────────────────────────────────────
// Handoff defaults: everyone secretly writes three prompts; the same pool is
// played three times — describe it, act it out, then one word only. Teams
// alternate 60-second turns; Correct +1 and removes the prompt for this
// stage; one skip per turn (deferred until the turn ends); a slip also defers
// it. A stage ends when every prompt is solved; the team that didn't play last
// starts the next stage. Equal totals share the win.

import { shuffle } from "../cards";
import { nameOf, normalizeWord, randomIndex, TEAM_NAMES, teamMembers, TWO_TEAMS } from "../common";
import { GameError, type GameDef, type ScoreLine, type Seat } from "../types";

export const TURN_MS = 60_000;
export const PER_PLAYER = 3;
export const STAGES = [
  { name: "Describe it", rule: "Use any words — but not the prompt, its parts, spelling or first letters." },
  { name: "Act it out", rule: "No talking, mouthing, writing or drawing. Your team can talk." },
  { name: "One word", rule: "Say exactly one clue word (you may repeat it). No gestures." },
];

export interface FishState {
  seats: Seat[];
  phase: "submit" | "ready" | "live" | "done";
  prompts: { text: string; by: string }[];
  submitted: string[];
  stage: number;
  pool: number[];
  deferred: number[];
  card: number | null;
  scores: [number, number];
  team: number;
  giver: string;
  nextGiver: [number, number];
  endsAt: number | null;
  skipped: boolean;
  gotThisTurn: number;
  stageBanner: boolean;
  last: { team: number; giver: string; got: number } | null;
}

export type FishAction = { type: "submit"; prompts: string[] } | { type: "start" } | { type: "correct" } | { type: "skip" } | { type: "slip" };

function giverFor(s: FishState, team: number) {
  const m = teamMembers(s.seats, team);
  return m[s.nextGiver[team] % m.length].id;
}

function draw(s: FishState): Pick<FishState, "card" | "pool"> {
  return s.pool.length ? { card: s.pool[0], pool: s.pool.slice(1) } : { card: null, pool: [] };
}

/** End the turn: unsolved prompts go back into the pool, the other team is up. */
function endTurn(s: FishState, rand: () => number): FishState {
  const back = [...(s.card !== null ? [s.card] : []), ...s.deferred];
  const nextGiver: [number, number] = [...s.nextGiver];
  nextGiver[s.team]++;
  const team = 1 - s.team;
  const st: FishState = { ...s, pool: shuffle([...s.pool, ...back], rand), deferred: [], card: null, nextGiver, team, phase: "ready", endsAt: null, skipped: false, last: { team: s.team, giver: s.giver, got: s.gotThisTurn }, gotThisTurn: 0, stageBanner: false };
  return { ...st, giver: giverFor(st, team) };
}

/** After a correct answer: next prompt, or end the turn / the stage. */
function afterResolve(s: FishState, rand: () => number): FishState {
  if (s.pool.length) return { ...s, ...draw(s) };
  if (s.deferred.length) return endTurn({ ...s, card: null }, rand);
  // Every prompt solved: the stage is over. The team that didn't play last starts.
  const last = { team: s.team, giver: s.giver, got: s.gotThisTurn };
  const nextGiver: [number, number] = [...s.nextGiver];
  nextGiver[s.team]++;
  if (s.stage + 1 >= STAGES.length) return { ...s, card: null, phase: "done", endsAt: null, nextGiver, last };
  const team = 1 - s.team;
  const st: FishState = { ...s, stage: s.stage + 1, pool: shuffle(s.prompts.map((_, i) => i), rand), deferred: [], card: null, team, nextGiver, phase: "ready", endsAt: null, skipped: false, gotThisTurn: 0, stageBanner: true, last };
  return { ...st, giver: giverFor(st, team) };
}

export const fishbowl: GameDef<FishState, FishAction> = {
  key: "fishbowl",
  name: "Fishbowl",
  tagline: "Write three prompts. Then describe, act, and one-word them.",
  styles: ["word", "party", "teams"],
  minPlayers: 4,
  maxPlayers: 12,
  time: "30–45 min",
  teams: TWO_TEAMS,
  description:
    "Everyone secretly writes three things — people, places, objects, anything. Then the same pile gets played three times: first by describing, then by acting it out, then with just one word. By the last round the whole table shares a language of inside jokes.",
  rules: [
    { heading: "Before you start", body: ["Everyone types three family-friendly prompts on their phone. Nobody sees the whole list.", "If two prompts are exactly the same, the second writer is asked for another."] },
    {
      heading: "Three stages, same prompts",
      body: [
        "Stage 1 — Describe it: any words, but not the prompt itself, its parts, spelling or first letters.",
        "Stage 2 — Act it out: no talking, mouthing, writing or drawing. Guessers can talk.",
        "Stage 3 — One word: say exactly one clue word (repeat it if you like). No gestures.",
      ],
    },
    {
      heading: "Turns",
      body: [
        "Teams alternate 60-second turns; clue givers rotate. Only the clue giver sees the prompt.",
        "Correct: +1 and the prompt is out for this stage. One skip per turn — it comes back after your turn. If you slip up, tap Oops: no point, and it comes back too.",
        "A stage ends when every prompt has been guessed. The team that didn't go last starts the next stage.",
      ],
    },
    { heading: "Winning", body: ["Add up all three stages. Highest total wins; a tie is a shared win."] },
  ],
  license: { name: "MIT reference (avimoondra/fishbowl); original code", url: "https://github.com/avimoondra/fishbowl/blob/master/LICENSE", note: "Prompts are written by the players." },

  setup(seats, ctx) {
    const team = randomIndex(2, ctx.rand);
    const st: FishState = { seats, phase: "submit", prompts: [], submitted: [], stage: 0, pool: [], deferred: [], card: null, scores: [0, 0], team, giver: "", nextGiver: [0, 0], endsAt: null, skipped: false, gotThisTurn: 0, stageBanner: true, last: null };
    return { ...st, giver: giverFor(st, team) };
  },

  act(s, playerId, a, ctx) {
    if (s.phase === "done") throw new GameError("The game is over.");

    if (a.type === "submit") {
      if (s.phase !== "submit") throw new GameError("Prompts are locked in.");
      if (s.submitted.includes(playerId)) throw new GameError("You've already sent yours.");
      const texts = (a.prompts ?? []).map((t) => String(t).replace(/\s+/g, " ").trim().slice(0, 60));
      if (texts.length !== PER_PLAYER || texts.some((t) => !t)) throw new GameError(`Write ${PER_PLAYER} prompts.`);
      const seen = new Set(s.prompts.map((p) => normalizeWord(p.text)));
      for (const t of texts) {
        const k = normalizeWord(t);
        if (seen.has(k)) throw new GameError(`“${t}” is already in the bowl — write a different one.`);
        seen.add(k);
      }
      const prompts = [...s.prompts, ...texts.map((text) => ({ text, by: playerId }))];
      const submitted = [...s.submitted, playerId];
      if (submitted.length < s.seats.length) return { ...s, prompts, submitted };
      return { ...s, prompts, submitted, phase: "ready", pool: shuffle(prompts.map((_, i) => i), ctx.rand) };
    }

    if (s.phase === "submit") throw new GameError("Waiting for everyone's prompts.");
    if (s.phase === "live" && s.endsAt !== null && ctx.now >= s.endsAt) return endTurn(s, ctx.rand);
    if (playerId !== s.giver) throw new GameError("Only the clue giver can do that.");

    if (a.type === "start") {
      if (s.phase !== "ready") throw new GameError("Your turn has already started.");
      return { ...s, phase: "live", endsAt: ctx.now + TURN_MS, gotThisTurn: 0, stageBanner: false, ...draw(s) };
    }
    if (s.phase !== "live" || s.card === null) throw new GameError("Tap Start first.");
    if (a.type === "correct") {
      const scores: [number, number] = [...s.scores];
      scores[s.team]++;
      return afterResolve({ ...s, scores, gotThisTurn: s.gotThisTurn + 1, card: null }, ctx.rand);
    }
    if (a.type === "skip" && s.skipped) throw new GameError("You've used your skip this turn.");
    const deferred = [...s.deferred, s.card];
    const next = { ...s, deferred, card: null, skipped: s.skipped || a.type === "skip" };
    if (next.pool.length === 0) return endTurn(next, ctx.rand);
    return { ...next, ...draw(next) };
  },

  tick(s, ctx) {
    return s.phase === "live" && s.endsAt !== null && ctx.now >= s.endsAt ? endTurn(s, ctx.rand) : null;
  },

  view(s, playerId) {
    const you = s.seats.find((p) => p.id === playerId);
    return {
      teams: [0, 1].map((t) => ({ name: TEAM_NAMES[t], score: s.scores[t], members: teamMembers(s.seats, t).map((p) => ({ id: p.id, name: p.name })) })),
      phase: s.phase,
      submitted: s.submitted.length,
      players: s.seats.length,
      youSubmitted: s.submitted.includes(playerId),
      perPlayer: PER_PLAYER,
      stage: s.stage,
      stages: STAGES,
      stageBanner: s.stageBanner,
      left: s.pool.length + s.deferred.length + (s.card !== null ? 1 : 0),
      total: s.prompts.length,
      team: s.team,
      giver: { id: s.giver, name: nameOf(s.seats, s.giver) },
      yourTeam: you?.team ?? null,
      endsAt: s.endsAt,
      card: playerId === s.giver && s.card !== null ? s.prompts[s.card].text : null,
      skipped: s.skipped,
      gotThisTurn: s.gotThisTurn,
      last: s.last ? { team: TEAM_NAMES[s.last.team], giver: nameOf(s.seats, s.last.giver), got: s.last.got } : null,
    };
  },

  status(s) {
    if (s.phase === "done") {
      const [a, b] = s.scores;
      return { over: true, message: a === b ? "A shared win!" : `${TEAM_NAMES[a > b ? 0 : 1]} wins!`, turn: [] };
    }
    if (s.phase === "submit") return { over: false, message: `Writing prompts — ${s.submitted.length} of ${s.seats.length} done`, turn: s.seats.filter((p) => !s.submitted.includes(p.id)).map((p) => p.id) };
    const g = nameOf(s.seats, s.giver);
    return { over: false, message: `Stage ${s.stage + 1}: ${STAGES[s.stage].name} · ${g}${s.phase === "ready" ? " is up" : " is giving clues"}`, turn: [s.giver] };
  },

  scoreboard(s): ScoreLine[] {
    return [0, 1].map((t) => ({ label: TEAM_NAMES[t], score: s.scores[t], playerIds: teamMembers(s.seats, t).map((p) => p.id) }));
  },
};
