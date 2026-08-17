"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Trophy } from "lucide-react";
import Leaderboard from "../Leaderboard";
import { VOTE_BLOCK_MESSAGE } from "@/lib/popup/access";
import type { PopupTemplateProps } from "@/lib/popup/types";

/**
 * The baseline pop-up experience: a card grid with voting and standings.
 *
 * Deliberately plain. It exists so the platform works end to end and so there
 * is always something safe to fall back to — the distinctive pop-up designs
 * (trivia, mini games) get their own templates alongside this one.
 */
export default function ClassicTemplate({
  menu,
  cocktails,
  votingOpen,
  voteBlockReason,
  myVotes,
  results,
  toggleVote,
  voteBusy,
  voteError,
  viewer,
}: PopupTemplateProps) {
  const accent = menu.accentColor ?? "#C97D5A";
  const rankByCocktail = new Map(myVotes.map((v) => [v.cocktailId, v.rank]));
  const myTopPick = myVotes.find((v) => v.rank === 1)?.cocktailId;
  const showLeaderboard = menu.config?.showLeaderboard !== false;
  const showIngredients = menu.config?.showIngredients !== false;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      <header className="text-center mb-10 sm:mb-14">
        {menu.coverImageUrl && (
          <div className="relative w-full h-44 sm:h-64 mb-8 rounded-xl overflow-hidden">
            <Image
              src={menu.coverImageUrl}
              alt=""
              fill
              unoptimized
              className="object-cover"
              priority
            />
          </div>
        )}
        <h1
          style={{ fontFamily: "var(--font-display, serif)" }}
          className="text-3xl sm:text-5xl text-white tracking-wide"
        >
          {menu.title}
        </h1>
        {menu.subtitle && (
          <p className="mt-3 text-[11px] sm:text-xs tracking-[0.25em] uppercase text-white/50">
            {menu.subtitle}
          </p>
        )}
        {menu.description && (
          <p className="mt-5 max-w-xl mx-auto text-sm text-white/60 leading-relaxed">
            {menu.description}
          </p>
        )}
      </header>

      {/* ── Voting status ────────────────────────────────────────────────── */}
      <div className="mb-8">
        {votingOpen ? (
          <p className="text-center text-xs text-white/50 leading-relaxed">
            {myVotes.length === 0
              ? "Tap the cocktail you liked best."
              : myVotes.length === 1
                ? "Your vote is in. Tap another to rank a second favorite."
                : `You've ranked ${myVotes.length} favorites.`}
          </p>
        ) : (
          <div className="max-w-md mx-auto text-center px-4 py-3 rounded-lg border border-white/15 bg-white/[0.04]">
            <p className="text-xs text-white/60">
              {voteBlockReason ? VOTE_BLOCK_MESSAGE[voteBlockReason] : "Voting is closed."}
            </p>
            {voteBlockReason === "not_signed_in" && (
              <Link
                href="/popup/login"
                style={{ color: accent }}
                className="inline-block mt-2 text-[10px] tracking-[0.2em] uppercase hover:opacity-80"
              >
                Sign in →
              </Link>
            )}
            {voteBlockReason === "email_unverified" && (
              <Link
                href="/popup/account"
                style={{ color: accent }}
                className="inline-block mt-2 text-[10px] tracking-[0.2em] uppercase hover:opacity-80"
              >
                Resend confirmation →
              </Link>
            )}
          </div>
        )}
        {voteError && <p className="mt-3 text-center text-xs text-red-300">{voteError}</p>}
      </div>

      {/* ── Cocktails ────────────────────────────────────────────────────── */}
      {cocktails.length === 0 ? (
        <p className="text-center text-sm text-white/40 py-16">
          This pop-up doesn&apos;t have any cocktails on it yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cocktails.map((c) => {
            const rank = rankByCocktail.get(c.id);
            const picked = rank !== undefined;
            return (
              <article
                key={c.id}
                style={picked ? { borderColor: accent } : undefined}
                className={`flex flex-col rounded-xl border overflow-hidden transition-colors ${
                  picked ? "bg-white/[0.07]" : "border-white/10 bg-white/[0.03]"
                }`}
              >
                {c.imageUrl && (
                  <div className="relative w-full aspect-[4/3]">
                    <Image src={c.imageUrl} alt={c.name} fill unoptimized className="object-cover" />
                    {picked && (
                      <span
                        style={{ background: accent }}
                        className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-black text-xs font-semibold tabular-nums"
                        title={`Your #${rank} pick`}
                      >
                        {rank}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex-1 p-5">
                  <h3
                    style={{ fontFamily: "var(--font-display, serif)" }}
                    className="text-xl text-white"
                  >
                    {c.name}
                  </h3>
                  {c.tagline && (
                    <p className="mt-1 text-[10px] tracking-[0.2em] uppercase text-white/40">
                      {c.tagline}
                    </p>
                  )}
                  {c.description && (
                    <p className="mt-3 text-sm text-white/60 leading-relaxed">{c.description}</p>
                  )}
                  {showIngredients && c.ingredients && (
                    <p className="mt-3 text-xs text-white/40 leading-relaxed italic">
                      {c.ingredients}
                    </p>
                  )}
                </div>

                {(votingOpen || picked) && (
                  <div className="px-5 pb-5">
                    <button
                      onClick={() => toggleVote(c.id)}
                      disabled={voteBusy || !votingOpen}
                      style={picked ? { background: accent } : undefined}
                      className={`w-full py-3 rounded-lg text-[10px] tracking-[0.2em] uppercase transition-colors disabled:opacity-40 ${
                        picked
                          ? "text-black font-medium"
                          : "border border-white/20 text-white/70 hover:text-white hover:border-white/40"
                      }`}
                    >
                      {picked ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Check size={13} />
                          {rank === 1 ? "Your favorite" : `Ranked #${rank}`}
                        </span>
                      ) : (
                        "Vote for this"
                      )}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* ── Standings ────────────────────────────────────────────────────── */}
      {showLeaderboard && cocktails.length > 0 && (
        <div className="mt-14 max-w-2xl mx-auto">
          {!votingOpen && (
            <p className="mb-4 flex items-center justify-center gap-2 text-[10px] tracking-[0.2em] uppercase text-white/40">
              <Trophy size={13} />
              Final results
            </p>
          )}
          <Leaderboard results={results} accent={accent} myTopPick={myTopPick} />
          {!viewer && (
            <p className="mt-4 text-center text-xs text-white/35">
              <Link href="/popup/signup" style={{ color: accent }} className="hover:opacity-80">
                Create an account
              </Link>{" "}
              to add your vote.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
