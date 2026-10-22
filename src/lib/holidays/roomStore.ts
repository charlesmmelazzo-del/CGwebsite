// ─── Home for the Holidays — rooms in the database (server only) ─────────────
//
// See db/holiday-rooms.sql. Every change goes through `mutate`, which retries
// on a version clash so two phones tapping at once both land.

import { randomBytes, randomInt } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import { dictionary } from "./dictionary";
import { addPlayer, applyOp, tickRoom, type Room, type RoomOp } from "./rooms";
import { GameError, type GameCtx } from "./types";

/** A room nobody has touched for this long is closed and its code freed. */
const IDLE_MS = 12 * 60 * 60 * 1000;

type Row = {
  id: string;
  code: string;
  game_key: string;
  status: Room["status"];
  players: Room["players"];
  state: unknown;
  version: number;
};

function toRoom(r: Row): Room {
  return { id: r.id, code: r.code, gameKey: r.game_key, status: r.status, players: r.players ?? [], state: r.state, version: r.version };
}

export function ctxNow(): GameCtx {
  return { now: Date.now(), rand: Math.random, isWord: dictionary() };
}

export function newToken(): string {
  return randomBytes(18).toString("base64url");
}

export function newPlayerId(): string {
  return randomBytes(6).toString("base64url");
}

/** Thrown when the table hasn't been created yet (db/holiday-rooms.sql not run). */
export class RoomsNotSetUp extends Error {}

function check(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (error.code === "42P01" || error.code === "PGRST205" || /holiday_rooms/.test(error.message ?? "")) {
    throw new RoomsNotSetUp("holiday_rooms table missing — run db/holiday-rooms.sql");
  }
  throw new Error(error.message);
}

async function closeIdleRooms() {
  if (memory) return;
  const sb = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - IDLE_MS).toISOString();
  // The bar-wide rooms (PUB-…) are permanent and never time out.
  await sb.from("holiday_rooms").update({ status: "ended" }).neq("status", "ended").lt("updated_at", cutoff).not("code", "like", "PUB-%");
}

// ─── Local testing without the table ─────────────────────────────────────────
// HOLIDAY_ROOMS_MEMORY=1 keeps rooms in this server's memory instead of
// Supabase — for `npm run dev` before db/holiday-rooms.sql has been run.
// Never set it in production: rooms vanish on every deploy.
const g = globalThis as { holidayRooms?: Map<string, Row> };
const memory = process.env.HOLIDAY_ROOMS_MEMORY === "1" ? (g.holidayRooms ??= new Map<string, Row>()) : null;

export async function getRoom(code: string): Promise<Room | null> {
  if (memory) {
    const row = memory.get(code);
    return row ? toRoom(structuredClone(row)) : null;
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("holiday_rooms")
    .select("id, code, game_key, status, players, state, version")
    .eq("code", code)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  check(error);
  return data ? toRoom(data as Row) : null;
}

export class Conflict extends Error {}

async function save(before: Room, after: Room): Promise<Room> {
  if (memory) {
    const row = memory.get(before.code);
    if (!row || row.id !== before.id || row.version !== before.version) throw new Conflict();
    const next = { ...row, status: after.status, players: after.players, state: after.state, version: row.version + 1 };
    memory.set(before.code, structuredClone(next));
    return toRoom(next);
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("holiday_rooms")
    .update({
      status: after.status,
      players: after.players,
      state: after.state,
      version: before.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", before.id)
    .eq("version", before.version)
    .select("id, code, game_key, status, players, state, version")
    .maybeSingle();
  check(error);
  if (!data) throw new Conflict();
  return toRoom(data as Row);
}

/** Load → change → save, retrying when another phone's change landed first. */
export async function mutate(code: string, change: (room: Room) => Room | null): Promise<Room> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const room = await getRoom(code);
    if (!room) throw new GameError("No game with that code. Check the number with your host.");
    const next = change(room);
    if (!next) return room;
    try {
      return await save(room, next);
    } catch (e) {
      if (!(e instanceof Conflict)) throw e;
    }
  }
  throw new GameError("The game is busy — tap again.");
}

export async function createRoom(input: { gameKey: string; hostName: string; menuId?: string; sandbox: boolean }) {
  await closeIdleRooms();
  const host = { id: newPlayerId(), token: newToken(), name: input.hostName, host: true };
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = String(randomInt(1000, 10000));
    const draft: Room = { id: "", code, gameKey: input.gameKey, status: "lobby", players: [], state: null, version: 0 };
    const withHost = addPlayer(draft, host, new Date().toISOString());
    if (memory) {
      const open = memory.get(code);
      if (open && open.status !== "ended") continue;
      const row: Row = { id: newToken(), code, game_key: input.gameKey, status: "lobby", players: withHost.players, state: null, version: 0 };
      memory.set(code, structuredClone(row));
      return { room: toRoom(row), playerId: host.id, token: host.token };
    }
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("holiday_rooms")
      .insert({ code, game_key: input.gameKey, players: withHost.players, menu_id: input.menuId ?? null, sandbox: input.sandbox })
      .select("id, code, game_key, status, players, state, version")
      .maybeSingle();
    // 23505 = that code is open in another room; roll again.
    if (error?.code === "23505") continue;
    check(error);
    return { room: toRoom(data as Row), playerId: host.id, token: host.token };
  }
  throw new GameError("Couldn't find a free code — try again.");
}

export async function joinRoom(code: string, name: string) {
  const player = { id: newPlayerId(), token: newToken(), name, host: false };
  const room = await mutate(code, (r) => addPlayer(r, player, new Date().toISOString()));
  return { room, playerId: player.id, token: player.token };
}

export function playerFor(room: Room, token: string | null) {
  if (!token) return null;
  return room.players.find((p) => p.token === token) ?? null;
}

export async function runOp(code: string, token: string, op: RoomOp): Promise<{ room: Room; playerId: string }> {
  let playerId = "";
  const room = await mutate(code, (r) => {
    const me = playerFor(r, token);
    if (!me) throw new GameError("You're not in this game.");
    playerId = me.id;
    return applyOp(r, me.id, op, ctxNow());
  });
  return { room, playerId };
}

/** A poll: run any timer that has run out, then return the room. */
export async function pollRoom(code: string): Promise<Room | null> {
  const room = await getRoom(code);
  if (!room) return null;
  if (!tickRoom(room, ctxNow())) return room;
  return mutate(code, (r) => tickRoom(r, ctxNow()));
}

// ─── Bar-wide rooms (Play with strangers) ────────────────────────────────────

/** Fetch a permanent room, creating it the first time anyone asks. */
export async function ensureRoom(code: string, gameKey: string, init: () => unknown): Promise<Room> {
  const found = await getRoom(code);
  if (found) return found;
  if (memory) {
    const row: Row = { id: newToken(), code, game_key: gameKey, status: "playing", players: [], state: init(), version: 0 };
    memory.set(code, structuredClone(row));
    return toRoom(row);
  }
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("holiday_rooms").insert({ code, game_key: gameKey, status: "playing", state: init() });
  // 23505: someone else created it a moment ago — fine.
  if (error && error.code !== "23505") check(error);
  const room = await getRoom(code);
  if (!room) throw new Error(`Couldn't create ${code}`);
  return room;
}

/**
 * Save a "still here" heartbeat WITHOUT bumping the version, so it doesn't
 * make every phone re-download the room. Only lands if nothing else changed
 * since we read it; a heartbeat lost to a race is simply sent again later.
 */
export async function quietSave(before: Room, state: unknown): Promise<void> {
  if (memory) {
    const row = memory.get(before.code);
    if (row && row.version === before.version) memory.set(before.code, structuredClone({ ...row, state }));
    return;
  }
  const sb = getSupabaseAdmin();
  await sb.from("holiday_rooms").update({ state }).eq("id", before.id).eq("version", before.version);
}
