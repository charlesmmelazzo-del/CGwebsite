// ─── Demo time left, per game, on this device ───────────────────────────────
//
// Kept in localStorage so the 90 seconds are 90 seconds per game rather than
// per visit — closing a demo and opening it again carries on the same clock.
// It is a nudge, not a lock: clearing site data resets it, which is fine for a
// garnish. Every access is wrapped, because private windows can throw.

import { DEMO_SECONDS } from "@/lib/popup/games";

const key = (menuId: string, cocktailId: string) => `popup-demo:${menuId}:${cocktailId}`;

export function demoSecondsLeft(menuId: string, cocktailId: string): number {
  try {
    const raw = window.localStorage.getItem(key(menuId, cocktailId));
    if (raw === null) return DEMO_SECONDS;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.min(DEMO_SECONDS, n)) : DEMO_SECONDS;
  } catch {
    return DEMO_SECONDS;
  }
}

export function saveDemoSecondsLeft(menuId: string, cocktailId: string, seconds: number): void {
  try {
    window.localStorage.setItem(key(menuId, cocktailId), String(Math.max(0, seconds)));
  } catch {
    /* nothing to do */
  }
}
