// ─── Shared helpers for the game rules ───────────────────────────────────────

import { GameError, type ScoreLine, type Seat } from "./types";

export function nameOf(seats: Seat[], id: string): string {
  return seats.find((p) => p.id === id)?.name ?? "Someone";
}

/** Partners sit opposite: team 0, team 1, team 0, team 1 … in turn order. */
export function alternateTeams(seats: Seat[]): Seat[] {
  const a = seats.filter((p) => p.team === 0);
  const b = seats.filter((p) => p.team === 1);
  const out: Seat[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) out.push(a[i]);
    if (b[i]) out.push(b[i]);
  }
  return out;
}

export function teamMembers(seats: Seat[], team: number): Seat[] {
  return seats.filter((p) => p.team === team);
}

export function requireTurn(current: string, playerId: string) {
  if (current !== playerId) throw new GameError("It's not your turn.");
}

/** Everyone tied for the best score ("best" = highest unless `low`). */
export function leaders(lines: ScoreLine[], low = false): ScoreLine[] {
  if (lines.length === 0) return [];
  const best = low ? Math.min(...lines.map((l) => l.score)) : Math.max(...lines.map((l) => l.score));
  return lines.filter((l) => l.score === best);
}

export function winnerMessage(lines: ScoreLine[], low = false): string {
  const top = leaders(lines, low);
  if (top.length === 1) return `${top[0].label} wins!`;
  return `A shared win — ${top.map((l) => l.label).join(" & ")}!`;
}

export function randomIndex(n: number, rand: () => number): number {
  return Math.floor(rand() * n);
}

/** Lowercase, trimmed, accents folded, inner spaces collapsed. */
export function normalizeWord(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function sum(ns: number[]): number {
  return ns.reduce((t, n) => t + n, 0);
}

/** Team names used by every team game. */
export const TEAM_NAMES = ["Team Mistletoe", "Team Gingerbread"];

export const TWO_TEAMS = { count: 2, minPerTeam: 2, names: TEAM_NAMES };
export const PARTNERS = { count: 2, minPerTeam: 2, exactPerTeam: 2, names: TEAM_NAMES };
