// ─── Cocktail Competitions — scoring ─────────────────────────────────────────
//
// Pure functions, no database — tested directly by
// src/lib/compete/__tests__/scoring.test.ts.
//
// The owner's rules (2026-10-01):
//   * A ballot is 1–5 stars in each category. Its value is the average of its
//     categories.
//   * Each tier's ballots are averaged within the tier. Each tier then counts
//     for the percentage the admin set (e.g. Judges 50%, VIP 20%, General 30%).
//     A tier with no ballots for a contestant drops out and the rest are
//     re-weighted, so an empty tier never drags anyone to zero.
//   * Overall winner = highest weighted score. Superlatives = one person, one
//     vote, most picks wins.
//   * Ties are decided by the host — these functions report them, never break them.
//   * Raw numbers are never shown to guests; only winners are revealed.

import type { ScoreCategory, Tier } from "./types";

export type Ballot = { tierId: string; scores: Record<string, number> };

const EPS = 1e-9;

/** A ballot's value: the average of its valid 1–5 category scores, or null if empty. */
export function ballotValue(scores: Record<string, number>, categories: ScoreCategory[]): number | null {
  const vals = categories
    .map((c) => scores[c.id])
    .filter((v): v is number => typeof v === "number" && v >= 1 && v <= 5);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export type TierBreakdown = { tierId: string; ballots: number; average: number | null };

/** One contestant's weighted overall score, with the per-tier working. */
export function contestantScore(
  ballots: Ballot[],
  tiers: Tier[],
  categories: ScoreCategory[]
): { overall: number | null; tiers: TierBreakdown[] } {
  const breakdown: TierBreakdown[] = tiers.map((t) => {
    const values = ballots
      .filter((b) => b.tierId === t.id)
      .map((b) => ballotValue(b.scores, categories))
      .filter((v): v is number => v !== null);
    return {
      tierId: t.id,
      ballots: values.length,
      average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
    };
  });

  let weighted = 0;
  let weightSum = 0;
  for (const b of breakdown) {
    const tier = tiers.find((t) => t.id === b.tierId)!;
    const w = Math.max(0, Number(tier.weight) || 0);
    if (b.average === null || w === 0) continue;
    weighted += w * b.average;
    weightSum += w;
  }
  return { overall: weightSum > 0 ? weighted / weightSum : null, tiers: breakdown };
}

/** The top entries of a score map. More than one id means a tie. Empty if nobody scored. */
export function leaders(scores: Map<string, number | null>): string[] {
  let best = -Infinity;
  for (const v of Array.from(scores.values())) if (v !== null && v > best) best = v;
  if (best === -Infinity) return [];
  return Array.from(scores.entries()).filter(([, v]) => v !== null && Math.abs(v - best) < EPS).map(([id]) => id);
}

/** Superlative tally: one pick per person. Returns the ids with the most picks. */
export function superlativeLeaders(picks: string[]): string[] {
  const counts = new Map<string, number | null>();
  for (const id of picks) counts.set(id, ((counts.get(id) as number | undefined) ?? 0) + 1);
  return leaders(counts);
}

/**
 * Resolve a result: the single leader, or the host's tie-break pick if it's
 * one of the tied contestants. Null means "tied and the host hasn't chosen yet"
 * (or nobody voted).
 */
export function resolveWinner(tied: string[], tieBreak?: string): string | null {
  if (tied.length === 1) return tied[0];
  if (tied.length > 1 && tieBreak && tied.includes(tieBreak)) return tieBreak;
  return null;
}
