"use client";

import type { LeaderboardEntry } from "@/lib/popup/types";

/**
 * Standings for a pop-up.
 *
 * Points and first-place votes are shown side by side on purpose: a cocktail
 * everyone liked second-best and a cocktail a few people adored are different
 * kinds of success, and the owner wants to be able to tell them apart when
 * deciding what comes back on a greatest-hits menu.
 */
export default function Leaderboard({
  results,
  voterCount,
  accent = "#C97D5A",
  myTopPick,
  showEmpty = true,
}: {
  results: LeaderboardEntry[];
  voterCount?: number;
  accent?: string;
  /** Cocktail id this guest ranked #1, highlighted in the list. */
  myTopPick?: string;
  showEmpty?: boolean;
}) {
  const anyVotes = results.some((r) => r.totalVotes > 0);

  if (!anyVotes && !showEmpty) return null;

  return (
    <section className="w-full">
      <div className="flex items-baseline justify-between mb-3 gap-3">
        <h2 className="text-[11px] tracking-[0.25em] uppercase text-white/70">Leaderboard</h2>
        {typeof voterCount === "number" && voterCount > 0 && (
          <span className="text-[10px] tracking-wider uppercase text-white/35">
            {voterCount} {voterCount === 1 ? "voter" : "voters"}
          </span>
        )}
      </div>

      {!anyVotes ? (
        <p className="text-sm text-white/40 py-6 text-center border border-white/10 rounded-lg">
          No votes yet — be the first.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {results.map((r) => {
            const isMine = r.cocktailId === myTopPick;
            const leading = r.position === 1 && r.points > 0;
            return (
              <li
                key={r.cocktailId}
                style={isMine ? { borderColor: `${accent}80` } : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                  isMine ? "bg-white/[0.07]" : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <span
                  style={leading ? { color: accent } : undefined}
                  className={`w-6 shrink-0 text-sm tabular-nums ${
                    leading ? "font-semibold" : "text-white/40"
                  }`}
                >
                  {r.position}
                </span>

                <span className="flex-1 min-w-0 text-sm text-white/90 truncate">
                  {r.name}
                  {isMine && (
                    <span
                      style={{ color: accent }}
                      className="ml-2 text-[9px] tracking-[0.15em] uppercase"
                    >
                      your #1
                    </span>
                  )}
                </span>

                <span className="shrink-0 text-right">
                  <span className="block text-sm tabular-nums text-white/90">{r.points}</span>
                  <span className="block text-[9px] tracking-wider uppercase text-white/35">
                    {r.points === 1 ? "point" : "points"}
                  </span>
                </span>

                <span className="shrink-0 w-14 text-right hidden sm:block">
                  <span className="block text-sm tabular-nums text-white/60">
                    {r.firstPlaceVotes}
                  </span>
                  <span className="block text-[9px] tracking-wider uppercase text-white/30">
                    #1 votes
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
