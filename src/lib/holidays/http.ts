import { NextResponse } from "next/server";
import { RoomsNotSetUp } from "./roomStore";
import { GameError } from "./types";

/** A game rule said no → 400 with its message; anything else is logged. */
export function failure(e: unknown) {
  if (e instanceof GameError) return NextResponse.json({ error: e.message }, { status: 400 });
  if (e instanceof RoomsNotSetUp) {
    console.error("[holidays]", e.message);
    return NextResponse.json({ error: "Group games aren't switched on yet." }, { status: 503 });
  }
  console.error("[holidays]", e);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

// ─── Guess limiting ──────────────────────────────────────────────────────────
// A whole bar shares one internet address on its Wi-Fi, so limits must never
// trip on normal play. Only WRONG room codes count (that's what guessing
// looks like); joining a real game is never limited.
const wrongCodes = new Map<string, { count: number; resetAt: number }>();
const WRONG_MAX = 120;
const WRONG_WINDOW_MS = 10 * 60 * 1000;

export function tooManyWrongCodes(ip: string): boolean {
  const e = wrongCodes.get(ip);
  return !!e && Date.now() < e.resetAt && e.count >= WRONG_MAX;
}

export function noteWrongCode(ip: string) {
  const now = Date.now();
  const e = wrongCodes.get(ip);
  if (!e || now > e.resetAt) wrongCodes.set(ip, { count: 1, resetAt: now + WRONG_WINDOW_MS });
  else e.count++;
}
