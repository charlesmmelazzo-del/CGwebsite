"use client";
/**
 * File 14: "Jump back in". The last things the member opened, kept on this device only (never sent anywhere), and
 * cleared when they sign out. What shows is filtered through the Index's own data (lib/passport/nav.ts jumpBackIn),
 * so nothing they may no longer open, and no cocktail the Index rule hides, can appear.
 */
import type { Recent } from "@/lib/passport/nav";

const KEY = "pp-recent-v1";
const MAX = 12;
export function readRecent(): Recent[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => x && (x.kind === "cocktail" || x.kind === "bottle") && Number.isInteger(x.id)).slice(0, MAX) : [];
  } catch { return []; }
}
export function remember(r: Recent) {
  try {
    const next = [{ kind: r.kind, id: r.id, name: String(r.name).slice(0, 120) }, ...readRecent().filter((x) => !(x.kind === r.kind && x.id === r.id))].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("pp-recent"));
  } catch { /* private mode: nothing kept */ }
}
export function forgetRecent() {
  try { window.localStorage.removeItem(KEY); } catch { /* nothing kept */ }
}
