"use client";

// ─── Staying in sync with a game room ────────────────────────────────────────
//
// Every phone polls the room about once a second (slower while the phone is
// locked or the tab is hidden). When nothing changed, the server answers in a
// few bytes. Moves are POSTed and the reply is the new room, so the player who
// moved sees it instantly; everyone else sees it on their next poll.

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomView } from "@/lib/holidays/types";

const SAVED = "hh-room";

export interface Saved {
  code: string;
  token: string;
}

/** The room this phone is in, so a refresh or a locked phone lands back in the game. */
export function savedRoom(): Saved | null {
  try {
    const raw = localStorage.getItem(SAVED);
    const s = raw ? (JSON.parse(raw) as Saved) : null;
    return s?.code && s?.token ? s : null;
  } catch {
    return null;
  }
}

export function saveRoom(s: Saved | null) {
  try {
    if (s) localStorage.setItem(SAVED, JSON.stringify(s));
    else localStorage.removeItem(SAVED);
  } catch {
    // Private browsing: the game still works, it just won't survive a refresh.
  }
}

async function call<T>(url: string, init: RequestInit, token?: string): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { "x-player-token": token } : {}) },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new RoomError(data.error ?? "Something went wrong. Please try again.", res.status);
  return data as T;
}

export class RoomError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function hostRoom(gameKey: string, menuId: string, sandbox: boolean) {
  return call<{ token: string; room: RoomView }>("/api/holidays/rooms", {
    method: "POST",
    body: JSON.stringify({ gameKey, menuId, sandbox }),
  });
}

export async function joinRoom(code: string, name: string) {
  return call<{ token: string; room: RoomView }>(`/api/holidays/rooms/${code}`, {
    method: "POST",
    body: JSON.stringify({ op: "join", name }),
  });
}

export function useRoom(saved: Saved, initial: RoomView | null) {
  const [room, setRoom] = useState<RoomView | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  /** server clock − phone clock, for turn timers. */
  const [skew, setSkew] = useState(0);
  const version = useRef<number | null>(initial?.version ?? null);
  const busy = useRef(false);

  const accept = useCallback((next: RoomView) => {
    setSkew(next.serverNow - Date.now());
    if (version.current !== null && next.version < version.current) return;
    version.current = next.version;
    setRoom(next);
  }, []);

  useEffect(() => {
    let stop = false;
    let timer: number | undefined;
    const poll = async () => {
      if (stop) return;
      try {
        const v = version.current;
        const data = await call<{ same?: boolean; serverNow: number; room?: RoomView }>(
          `/api/holidays/rooms/${saved.code}${v !== null ? `?v=${v}` : ""}`,
          { method: "GET" },
          saved.token
        );
        if (data.room) accept(data.room);
        else setSkew(data.serverNow - Date.now());
        setError(null);
      } catch (e) {
        if (e instanceof RoomError && e.status === 404) {
          setGone(true);
          return;
        }
        setError("Reconnecting…");
      }
      if (!stop) timer = window.setTimeout(poll, document.hidden ? 4000 : 1000);
    };
    void poll();
    // Coming back to the tab: catch up straight away.
    const wake = () => {
      if (!document.hidden) {
        window.clearTimeout(timer);
        void poll();
      }
    };
    document.addEventListener("visibilitychange", wake);
    return () => {
      stop = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [saved.code, saved.token, accept]);

  /** Send a move. Resolves to an error message, or null when it landed. */
  const send = useCallback(
    async (op: Record<string, unknown>): Promise<string | null> => {
      if (busy.current) return null;
      busy.current = true;
      try {
        const data = await call<{ room: RoomView }>(
          `/api/holidays/rooms/${saved.code}`,
          { method: "POST", body: JSON.stringify(op) },
          saved.token
        );
        accept(data.room);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : "Something went wrong.";
      } finally {
        busy.current = false;
      }
    },
    [saved.code, saved.token, accept]
  );

  return { room, error, gone, skew, send };
}

/** Seconds left on a server-clock deadline, ticking. */
export function useCountdown(endsAt: number | null, skew: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [endsAt]);
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((endsAt - (now + skew)) / 1000));
}
