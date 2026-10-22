// ─── Home for the Holidays — what a room allows ──────────────────────────────
//
// Pure functions over a room: who may join, rename, pick a team, start, play
// and end. No database here — roomStore.ts loads a room, calls `applyOp`, and
// saves the result only if nobody else changed the room in between.

import { getGame } from "./games";
import { GameError, type GameCtx, type RoomPlayer, type RoomStatus, type RoomView, type Seat } from "./types";

export interface Room {
  id: string;
  code: string;
  gameKey: string;
  status: RoomStatus;
  players: RoomPlayer[];
  state: unknown;
  version: number;
}

export type RoomOp =
  | { op: "rename"; name: string }
  | { op: "team"; team: number }
  | { op: "start" }
  | { op: "act"; action: unknown }
  | { op: "rematch" }
  | { op: "end" }
  | { op: "leave" }
  | { op: "kick"; playerId: string };

export const NAME_MAX = 16;

export function cleanName(input: unknown): string {
  return String(input ?? "")
    .replace(/[\u0000-\u001f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX);
}

/** Room codes are four digits — easy to read across a table. */
export function normalizeCode(input: unknown): string {
  return String(input ?? "").replace(/\D/g, "").slice(0, 4);
}

export function seatsOf(room: Room): Seat[] {
  return room.players.map((p) => ({ id: p.id, name: p.name, team: p.team }));
}

/** Two "Sam"s become "Sam" and "Sam 2". */
function uniqueName(players: RoomPlayer[], name: string, selfId?: string): string {
  const taken = new Set(players.filter((p) => p.id !== selfId).map((p) => p.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let n = 2; ; n++) {
    const candidate = `${name.slice(0, NAME_MAX - 2)} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/** Why the host can't start yet, or null when they can. */
export function startProblem(room: Room): string | null {
  const game = getGame(room.gameKey);
  if (!game) return "This game isn't available any more.";
  const n = room.players.length;
  if (n < game.minPlayers) return `Waiting for players — this game needs at least ${game.minPlayers}.`;
  if (n > game.maxPlayers) return `Too many players — this game takes up to ${game.maxPlayers}.`;
  if (room.players.some((p) => !p.name)) return "Everyone needs a name first.";
  if (game.teams) {
    const { count, minPerTeam, exactPerTeam } = game.teams;
    if (room.players.some((p) => p.team === undefined || p.team < 0 || p.team >= count)) return "Everyone needs to pick a team.";
    for (let t = 0; t < count; t++) {
      const size = room.players.filter((p) => p.team === t).length;
      const label = game.teams.names?.[t] ?? `Team ${t + 1}`;
      if (exactPerTeam !== undefined && size !== exactPerTeam) return `${label} needs exactly ${exactPerTeam} players.`;
      if (size < minPerTeam) return `${label} needs at least ${minPerTeam} players.`;
    }
  }
  return null;
}

export function addPlayer(room: Room, player: { id: string; token: string; name: string; host: boolean }, now: string): Room {
  const game = getGame(room.gameKey);
  if (!game) throw new GameError("This game isn't available any more.");
  if (room.status === "ended") throw new GameError("That game has ended. Ask your host for a new code.");
  if (room.status !== "lobby") throw new GameError("That game has already started. Ask the host to start a new one.");
  if (room.players.length >= game.maxPlayers) throw new GameError(`That game is full (${game.maxPlayers} players).`);
  const name = player.name ? uniqueName(room.players, player.name) : "";
  if (!player.host && !name) throw new GameError("Enter your name.");
  return { ...room, players: [...room.players, { ...player, name, joinedAt: now }] };
}

export function applyOp(room: Room, playerId: string, op: RoomOp, ctx: GameCtx): Room {
  const me = room.players.find((p) => p.id === playerId);
  if (!me) throw new GameError("You're not in this game.");
  const game = getGame(room.gameKey);
  if (!game) throw new GameError("This game isn't available any more.");
  const hostOnly = () => {
    if (!me.host) throw new GameError("Only the host can do that.");
  };

  switch (op.op) {
    case "rename": {
      if (room.status !== "lobby") throw new GameError("Names are locked once the game starts.");
      const name = cleanName(op.name);
      if (!name) throw new GameError("Enter your name.");
      return { ...room, players: room.players.map((p) => (p.id === playerId ? { ...p, name: uniqueName(room.players, name, playerId) } : p)) };
    }
    case "team": {
      if (room.status !== "lobby") throw new GameError("Teams are locked once the game starts.");
      if (!game.teams) throw new GameError("This game doesn't use teams.");
      if (!Number.isInteger(op.team) || op.team < 0 || op.team >= game.teams.count) throw new GameError("Pick a team.");
      return { ...room, players: room.players.map((p) => (p.id === playerId ? { ...p, team: op.team } : p)) };
    }
    case "start": {
      hostOnly();
      if (room.status !== "lobby") throw new GameError("The game has already started.");
      const problem = startProblem(room);
      if (problem) throw new GameError(problem);
      return { ...room, status: "playing", state: game.setup(seatsOf(room), ctx) };
    }
    case "rematch": {
      hostOnly();
      if (room.status !== "playing" || !game.status(room.state).over) throw new GameError("Finish this game first.");
      return { ...room, state: game.setup(seatsOf(room), ctx) };
    }
    case "act": {
      if (room.status !== "playing") throw new GameError(room.status === "lobby" ? "The game hasn't started yet." : "The game has ended.");
      const hostId = room.players.find((p) => p.host)?.id;
      return { ...room, state: game.act(room.state, playerId, op.action, { ...ctx, hostId }) };
    }
    case "end":
      hostOnly();
      return { ...room, status: "ended" };
    case "leave": {
      if (room.status !== "lobby") return room; // mid-game seats stay so turns don't break
      // The host walking away closes the room — nobody else can start it.
      if (me.host) return { ...room, status: "ended" };
      return { ...room, players: room.players.filter((p) => p.id !== playerId) };
    }
    case "kick": {
      hostOnly();
      if (room.status !== "lobby") throw new GameError("Players can only be removed before the game starts.");
      if (op.playerId === playerId) throw new GameError("You can't remove yourself.");
      return { ...room, players: room.players.filter((p) => p.id !== op.playerId) };
    }
  }
}

/** Run the game's clock, if it has one. Null = nothing changed. */
export function tickRoom(room: Room, ctx: GameCtx): Room | null {
  if (room.status !== "playing") return null;
  const game = getGame(room.gameKey);
  const next = game?.tick?.(room.state, ctx);
  return next ? { ...room, state: next } : null;
}

export function viewFor(room: Room, playerId: string | null, now: number): RoomView {
  const game = getGame(room.gameKey);
  const me = room.players.find((p) => p.id === playerId) ?? null;
  const playing = room.status !== "lobby" && room.state != null && !!game;
  const gameStatus = playing ? game!.status(room.state) : null;
  return {
    code: room.code,
    gameKey: room.gameKey,
    status: room.status,
    version: room.version,
    you: me ? { id: me.id, host: me.host } : null,
    players: room.players.map((p) => ({ id: p.id, name: p.name, team: p.team, host: p.host })),
    game: playing && me ? game!.view(room.state, me.id) : null,
    scoreboard: playing && game!.scoreboard ? game!.scoreboard(room.state) : null,
    lowScoreWins: !!game?.lowScoreWins,
    gameStatus,
    endedBy: room.status === "ended" ? (gameStatus?.over ? "game" : "host") : undefined,
    serverNow: now,
  };
}
