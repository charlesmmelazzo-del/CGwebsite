// ─── Play with strangers — the bar-wide games ────────────────────────────────
//
// One always-on room per game for the whole bar. Unlike a friends' game,
// people come and go freely:
//   - Rounds run on the clock and never wait for anyone. Anyone who doesn't
//     act in time is played for automatically; keep missing turns (or close
//     the page) and you're removed, so nobody else is ever stuck.
//   - Join while a round is in progress and you wait for the next one.
//   - Every player's score is for TODAY. At the day boundary (4 a.m. bar
//     time, so a late night counts as one day) the leader is saved to the
//     daily winners list and everyone starts again from zero.
//
// Like the friends' games, this is pure rules: the server passes the clock
// and random source in, which is what lets the tests fast-forward days.

import { normalizeWord } from "../common";
import { isOffensiveName, NAME_REFUSED } from "../nameFilter";
import { GameError, type GameCtx, type RulesSection } from "../types";

/** No poll for this long = you've left (closed the page, phone locked a while). */
export const STALE_MS = 45_000;
/** Phones re-confirm they're here at most this often. */
export const HEARTBEAT_MS = 15_000;
/** Days of winners to keep. */
export const HISTORY_DAYS = 120;
const TZ = "America/Chicago";
const DAY_START_HOUR = 4;

export interface PubPlayer {
  id: string;
  token: string;
  name: string;
  /** active = in the current round · queued = waiting for the next · gone = left or removed */
  status: "active" | "queued" | "gone";
  seenAt: number;
  /** Points today. */
  score: number;
  /** Turns in a row the game had to play for them. */
  missed: number;
  /** Why they're gone, to tell them. */
  removed?: "idle" | "left";
}

export interface DayResult {
  day: string;
  winners: { name: string; score: number }[];
  top: { name: string; score: number }[];
  players: number;
}

export interface PubState<G = unknown> {
  day: string;
  players: PubPlayer[];
  history: DayResult[];
  game: G;
}

export interface PublicGameDef<G, A> {
  key: string;
  name: string;
  tagline: string;
  description: string;
  rules: RulesSection[];
  /** Players needed before a round can start. */
  minPlayers: number;
  /** Players in a round at once; the rest wait for a seat. */
  maxActive: number;
  init(ctx: GameCtx): G;
  /** A new or returning player arrived (already in `players`, status queued). */
  onJoin(s: PubState<G>, playerId: string, ctx: GameCtx): PubState<G>;
  /** Someone left or was removed mid-round. */
  onLeave?(s: PubState<G>, playerId: string, ctx: GameCtx): PubState<G>;
  act(s: PubState<G>, playerId: string, action: A, ctx: GameCtx): PubState<G>;
  /** Clock-driven changes; null = nothing to do. */
  tick(s: PubState<G>, ctx: GameCtx): PubState<G> | null;
  view(s: PubState<G>, playerId: string | null, ctx: GameCtx): unknown;
}

/** "2026-10-22": the bar's day, which runs 4 a.m. to 4 a.m. Chicago time. */
export function dayKey(now: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now - DAY_START_HOUR * 3600_000));
}

export function here(p: PubPlayer, now: number): boolean {
  return p.status !== "gone" && now - p.seenAt < STALE_MS;
}

export function leaderboard(players: PubPlayer[], n = 10) {
  return players
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((p) => ({ id: p.id, name: p.name, score: p.score }));
}

/** Close out yesterday: save its winners, reset everyone's score. */
export function rollDay<G>(s: PubState<G>, now: number): PubState<G> {
  const today = dayKey(now);
  if (s.day === today) return s;
  const top = leaderboard(s.players, 5).map(({ name, score }) => ({ name, score }));
  const best = top[0]?.score ?? 0;
  const history = top.length
    ? [{ day: s.day, winners: top.filter((t) => t.score === best), top, players: s.players.filter((p) => p.score > 0).length }, ...s.history].slice(0, HISTORY_DAYS)
    : s.history;
  const players = s.players.filter((p) => p.status !== "gone").map((p) => ({ ...p, score: 0, missed: 0 }));
  return { ...s, day: today, history, players };
}

export function initState<G>(def: PublicGameDef<G, unknown>, ctx: GameCtx): PubState<G> {
  return { day: dayKey(ctx.now), players: [], history: [], game: def.init(ctx) };
}

const NAME_MAX = 16;
function cleanName(input: unknown): string {
  return String(input ?? "")
    .replace(/[\u0000-\u001f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX);
}

/** Two "Sam"s at the bar become "Sam" and "Sam 2". */
function uniqueName(players: PubPlayer[], name: string, selfId?: string): string {
  const taken = new Set(players.filter((p) => p.id !== selfId && p.status !== "gone").map((p) => normalizeWord(p.name)));
  if (!taken.has(normalizeWord(name))) return name;
  for (let n = 2; ; n++) {
    const c = `${name.slice(0, NAME_MAX - 3)} ${n}`;
    if (!taken.has(normalizeWord(c))) return c;
  }
}

export function find<G>(s: PubState<G>, token: string | null): PubPlayer | null {
  return token ? s.players.find((p) => p.token === token) ?? null : null;
}

/** Run the day boundary, then the game's clock, until nothing changes. */
export function pubTick<G, A>(def: PublicGameDef<G, A>, s0: PubState<G>, ctx: GameCtx): PubState<G> | null {
  let s = rollDay(s0, ctx.now);
  let changed = s !== s0;
  for (let i = 0; i < 6; i++) {
    const next = def.tick(s, ctx);
    if (!next) break;
    s = next;
    changed = true;
  }
  return changed ? s : null;
}

/**
 * Join (or come back). A token you already hold keeps today's score; a new
 * one makes a new player. You always start out waiting for the next round —
 * the game decides whether one can start right away.
 */
export function pubJoin<G, A>(def: PublicGameDef<G, A>, s0: PubState<G>, input: { token: string | null; newId: string; newToken: string; name: string }, ctx: GameCtx): { state: PubState<G>; player: PubPlayer } {
  const s = pubTick(def, s0, ctx) ?? s0;
  const name = cleanName(input.name);
  if (!name) throw new GameError("Enter a name for the scoreboard.");
  if (isOffensiveName(name)) throw new GameError(NAME_REFUSED);
  const existing = find(s, input.token);
  let player: PubPlayer;
  let players: PubPlayer[];
  if (existing) {
    const stillIn = existing.status !== "gone";
    player = { ...existing, name: uniqueName(s.players, name, existing.id), seenAt: ctx.now, missed: 0, removed: undefined, status: stillIn ? existing.status : "queued" };
    players = s.players.map((p) => (p.id === existing.id ? player : p));
  } else {
    if (s.players.filter((p) => here(p, ctx.now)).length >= 200) throw new GameError("The bar's game is full right now — try again in a bit.");
    player = { id: input.newId, token: input.newToken, name: uniqueName(s.players, name), status: "queued", seenAt: ctx.now, score: 0, missed: 0 };
    players = [...s.players, player];
  }
  const joined = def.onJoin({ ...s, players }, player.id, ctx);
  return { state: joined, player: joined.players.find((p) => p.id === player.id)! };
}

export function pubLeave<G, A>(def: PublicGameDef<G, A>, s: PubState<G>, playerId: string, ctx: GameCtx): PubState<G> {
  const players = s.players.map((p) => (p.id === playerId ? { ...p, status: "gone" as const, removed: "left" as const } : p));
  const st = { ...s, players };
  return def.onLeave ? def.onLeave(st, playerId, ctx) : st;
}

export function pubAct<G, A>(def: PublicGameDef<G, A>, s0: PubState<G>, playerId: string, action: A, ctx: GameCtx): PubState<G> {
  const s = pubTick(def, s0, ctx) ?? s0;
  const me = s.players.find((p) => p.id === playerId);
  if (!me || me.status === "gone") throw new GameError("You're not in the game — join again.");
  // Any move counts as being here and awake.
  const st = { ...s, players: s.players.map((p) => (p.id === playerId ? { ...p, seenAt: ctx.now, missed: 0 } : p)) };
  return def.act(st, playerId, action, ctx);
}

/** A poll from a phone: note they're still here (only every HEARTBEAT_MS). */
export function pubTouch<G>(s: PubState<G>, playerId: string, now: number): PubState<G> | null {
  const me = s.players.find((p) => p.id === playerId);
  if (!me || me.status === "gone" || now - me.seenAt < HEARTBEAT_MS) return null;
  return { ...s, players: s.players.map((p) => (p.id === playerId ? { ...p, seenAt: now } : p)) };
}

/** What every phone sees on top of the game's own view. */
export function pubView<G, A>(def: PublicGameDef<G, A>, s: PubState<G>, playerId: string | null, ctx: GameCtx) {
  const me = s.players.find((p) => p.id === playerId) ?? null;
  const rank = me && me.score > 0 ? s.players.filter((p) => p.score > me.score).length + 1 : null;
  return {
    gameKey: def.key,
    day: s.day,
    you: me ? { id: me.id, name: me.name, status: me.status, score: me.score, rank, removed: me.removed ?? null, missed: me.missed } : null,
    here: s.players.filter((p) => here(p, ctx.now)).length,
    leaders: leaderboard(s.players, 10),
    game: def.view(s, playerId, ctx),
    serverNow: ctx.now,
  };
}
