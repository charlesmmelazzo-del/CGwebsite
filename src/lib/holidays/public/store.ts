// ─── Bar-wide rooms in the database (server only) ────────────────────────────
// Each game is one permanent row in holiday_rooms (code PUB-<game>). Moves
// go through the same version-checked `mutate` as the friends' games.

import { GameError } from "../types";
import { ctxNow, ensureRoom, mutate, newPlayerId, newToken, quietSave } from "../roomStore";
import { find, initState, leaderboard, pubAct, pubJoin, pubLeave, pubTick, pubTouch, pubView, type PubState } from "./engine";
import { getPublicGame, publicCode, PUBLIC_GAMES } from "./index";

function def(key: string) {
  const d = getPublicGame(key);
  if (!d) throw new GameError("That game isn't available.");
  return d;
}

async function load(key: string) {
  const d = def(key);
  return ensureRoom(publicCode(key), `public:${key}`, () => initState(d, ctxNow()));
}

/** A phone polling: run the clock, note the player is here, return their view. */
export async function pollPublic(key: string, token: string | null, haveVersion: number | null) {
  const d = def(key);
  let room = await load(key);
  if (pubTick(d, room.state as PubState, ctxNow())) {
    room = await mutate(room.code, (r) => {
      const next = pubTick(d, r.state as PubState, ctxNow());
      return next ? { ...r, state: next } : null;
    });
  }
  let state = room.state as PubState;
  const me = find(state, token);
  if (me) {
    const touched = pubTouch(state, me.id, Date.now());
    if (touched) {
      await quietSave(room, touched);
      state = touched;
    }
  }
  if (haveVersion !== null && haveVersion === room.version) return { same: true as const, serverNow: Date.now() };
  return { view: { ...pubView(d, state, me?.id ?? null, ctxNow()), version: room.version } };
}

export async function joinPublic(key: string, token: string | null, name: string) {
  const d = def(key);
  const room = await load(key);
  const fresh = { token, newId: newPlayerId(), newToken: newToken(), name };
  let playerToken = "";
  const saved = await mutate(room.code, (r) => {
    const { state, player } = pubJoin(d, r.state as PubState, fresh, ctxNow());
    playerToken = player.token;
    return { ...r, state };
  });
  const state = saved.state as PubState;
  const me = find(state, playerToken)!;
  return { token: playerToken, view: { ...pubView(d, state, me.id, ctxNow()), version: saved.version } };
}

export async function actPublic(key: string, token: string, op: "act" | "leave", action: unknown) {
  const d = def(key);
  const room = await load(key);
  let id = "";
  const saved = await mutate(room.code, (r) => {
    const st = r.state as PubState;
    const me = find(st, token);
    if (!me) throw new GameError("You're not in the game — join again.");
    id = me.id;
    return { ...r, state: op === "leave" ? pubLeave(d, st, me.id, ctxNow()) : pubAct(d, st, me.id, action, ctxNow()) };
  });
  return { view: { ...pubView(d, saved.state as PubState, id, ctxNow()), version: saved.version } };
}

/** The Daily Winners page: past days, today's leaders, and who's playing now. */
export async function publicSummary() {
  const out = [];
  for (const d of PUBLIC_GAMES) {
    let room = await load(d.key);
    const ticked = pubTick(d, room.state as PubState, ctxNow());
    if (ticked) room = await mutate(room.code, (r) => ({ ...r, state: pubTick(d, r.state as PubState, ctxNow()) ?? r.state }));
    const s = room.state as PubState;
    const now = Date.now();
    out.push({
      key: d.key,
      name: d.name,
      tagline: d.tagline,
      minPlayers: d.minPlayers,
      today: s.day,
      leaders: leaderboard(s.players, 10).map(({ name, score }) => ({ name, score })),
      playing: s.players.filter((p) => p.status !== "gone" && now - p.seenAt < 45_000).length,
      history: s.history,
    });
  }
  return out;
}
