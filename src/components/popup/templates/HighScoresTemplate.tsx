"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, X } from "lucide-react";
import GameShell from "../games/GameShell";
import Leaderboard from "../Leaderboard";
import { VOTE_BLOCK_MESSAGE } from "@/lib/popup/access";
import { getGameMeta } from "@/lib/popup/games";
import type { PopupCocktail, PopupTemplateProps } from "@/lib/popup/types";

/**
 * HIGH SCORES — a golden-age arcade pop-up.
 *
 * The menu is a row of cabinets. Tapping one opens the cocktail: its art, what's
 * in it, how it tastes, the story behind it — and the mini game attached to it,
 * with a $15 gift card for whoever tops the board when the pop-up ends.
 *
 * Built mobile-first throughout, because nearly everyone will meet this standing
 * at the bar with a phone in one hand and a drink in the other.
 */
export default function HighScoresTemplate({
  menu,
  cocktails,
  viewer,
  votingOpen,
  isLive,
  voteBlockReason,
  myVotes,
  results,
  toggleVote,
  voteBusy,
  voteError,
  isSandbox,
}: PopupTemplateProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = cocktails.find((c) => c.id === openId) ?? null;

  // Lock the page behind the detail view so a game's controls can't scroll it.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const rankByCocktail = new Map(myVotes.map((v) => [v.cocktailId, v.rank]));
  const myTopPick = myVotes.find((v) => v.rank === 1)?.cocktailId;

  return (
    <div className="min-h-screen bg-black text-white">
      <Scanlines />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* ── Marquee ──────────────────────────────────────────────────── */}
        <header className="text-center mb-8 sm:mb-12">
          <p className="text-[9px] sm:text-[10px] tracking-[0.4em] uppercase text-[#3CE0E0] animate-pulse">
            Common Good Presents
          </p>
          <h1
            className="mt-3 text-4xl sm:text-6xl font-black tracking-tight"
            style={{
              color: "#FFD500",
              textShadow: "3px 3px 0 #E42B20, 6px 6px 0 #8828C8",
              fontFamily: "var(--font-display, system-ui)",
            }}
          >
            {menu.title || "HIGH SCORES"}
          </h1>
          {menu.subtitle && (
            <p className="mt-3 text-[10px] sm:text-xs tracking-[0.3em] uppercase text-white/50">
              {menu.subtitle}
            </p>
          )}
          {menu.description && (
            <p className="mt-4 max-w-md mx-auto text-xs sm:text-sm text-white/55 leading-relaxed">
              {menu.description}
            </p>
          )}

          <div className="mt-6 inline-block border-2 border-[#FFD500] px-4 py-2">
            <p className="text-[9px] sm:text-[10px] tracking-[0.2em] uppercase text-[#FFD500] font-bold">
              Top score on each game wins a $15 gift card
            </p>
          </div>

          {!isLive && (
            <p className="mt-4 text-[10px] tracking-[0.2em] uppercase text-white/40">
              This pop-up has closed — boards are final
            </p>
          )}
        </header>

        {/* ── Voting status ────────────────────────────────────────────── */}
        <p className="text-center text-[11px] text-white/45 leading-relaxed mb-6">
          {votingOpen
            ? myVotes.length === 0
              ? "Play the games. Then vote for the drink you liked best."
              : myVotes.length === 1
                ? "Vote locked in — tap another cocktail to rank a second favorite."
                : `You've ranked ${myVotes.length} favorites.`
            : voteBlockReason
              ? VOTE_BLOCK_MESSAGE[voteBlockReason]
              : "Voting is closed."}
        </p>
        {voteError && <p className="mb-4 text-center text-xs text-red-300">{voteError}</p>}

        {/* ── Cabinets ─────────────────────────────────────────────────── */}
        {cocktails.length === 0 ? (
          <p className="text-center text-sm text-white/40 py-16">
            No cocktails on this pop-up yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {cocktails.map((c, i) => (
              <Cabinet
                key={c.id}
                cocktail={c}
                index={i}
                rank={rankByCocktail.get(c.id)}
                onOpen={() => setOpenId(c.id)}
              />
            ))}
          </div>
        )}

        {/* ── Standings ────────────────────────────────────────────────── */}
        {cocktails.length > 0 && (
          <div className="mt-12 sm:mt-16 max-w-xl mx-auto">
            <Leaderboard results={results} accent="#FFD500" myTopPick={myTopPick} />
            {!viewer && (
              <p className="mt-4 text-center text-xs text-white/35">
                <Link href="/popup/signup" className="text-[#FFD500] hover:opacity-80">
                  Create an account
                </Link>{" "}
                to vote and get on the high score boards.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Detail ───────────────────────────────────────────────────────── */}
      {open && (
        <CocktailDetail
          cocktail={open}
          menuId={menu.id}
          viewer={viewer}
          isLive={isLive}
          isSandbox={isSandbox}
          votingOpen={votingOpen}
          voteBlockReason={voteBlockReason}
          voteBusy={voteBusy}
          rank={rankByCocktail.get(open.id)}
          onVote={() => toggleVote(open.id)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

// ─── Cabinet card ────────────────────────────────────────────────────────────

const CABINET_HUES = ["#E42B20", "#3CE0E0", "#FFD500", "#8828C8", "#00B83C", "#FF7B00"];

function Cabinet({
  cocktail,
  index,
  rank,
  onOpen,
}: {
  cocktail: PopupCocktail;
  index: number;
  rank?: number;
  onOpen: () => void;
}) {
  const hue = CABINET_HUES[index % CABINET_HUES.length];
  const game = getGameMeta(cocktail.gameKey);

  return (
    <button
      onClick={onOpen}
      style={{ borderColor: hue }}
      className="group text-left border-2 bg-[#0A0616] active:scale-[0.99] transition-transform"
    >
      {/* Cabinet marquee */}
      <div style={{ background: hue }} className="px-2 py-1.5">
        <p className="text-[9px] tracking-[0.25em] uppercase text-black font-bold truncate">
          {cocktail.name}
        </p>
      </div>

      {/* Screen */}
      <div className="relative aspect-[4/3] bg-black overflow-hidden">
        {cocktail.imageUrl ? (
          <Image
            src={cocktail.imageUrl}
            alt={cocktail.name}
            fill
            unoptimized
            className="object-cover opacity-90 group-hover:opacity-100 transition-opacity"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p style={{ color: hue }} className="text-[10px] tracking-[0.3em] uppercase">
              Insert Coin
            </p>
          </div>
        )}
        {rank !== undefined && (
          <span
            style={{ background: hue }}
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-black text-[11px] font-bold tabular-nums"
            title={`Your #${rank} pick`}
          >
            {rank}
          </span>
        )}
      </div>

      {/* Control panel */}
      <div className="px-3 py-2.5 border-t-2" style={{ borderColor: hue }}>
        {cocktail.tagline && (
          <p className="text-[10px] text-white/50 leading-snug line-clamp-2">{cocktail.tagline}</p>
        )}
        <p
          style={{ color: game ? hue : undefined }}
          className={`mt-1.5 text-[8px] tracking-[0.2em] uppercase ${game ? "" : "text-white/25"}`}
        >
          {game ? `▸ ${game.title}` : "Game coming soon"}
        </p>
      </div>
    </button>
  );
}

// ─── Detail overlay ──────────────────────────────────────────────────────────

function CocktailDetail({
  cocktail,
  menuId,
  viewer,
  isLive,
  isSandbox,
  votingOpen,
  voteBlockReason,
  voteBusy,
  rank,
  onVote,
  onClose,
}: {
  cocktail: PopupCocktail;
  menuId: string;
  viewer: PopupTemplateProps["viewer"];
  isLive: boolean;
  isSandbox: boolean;
  votingOpen: boolean;
  voteBlockReason: PopupTemplateProps["voteBlockReason"];
  voteBusy: boolean;
  rank?: number;
  onVote: () => void;
  onClose: () => void;
}) {
  const game = getGameMeta(cocktail.gameKey);
  const picked = rank !== undefined;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 overflow-y-auto overscroll-contain">
      <div className="min-h-full max-w-lg mx-auto px-4 py-4 pb-16">
        {/* Close */}
        <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-black/90 backdrop-blur flex justify-between items-center">
          <p className="text-[10px] tracking-[0.25em] uppercase text-[#FFD500] truncate">
            {cocktail.name}
          </p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 -mr-2 text-white/50 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Art */}
        {cocktail.imageUrl && (
          <div className="relative w-full aspect-[4/3] mt-2 border-2 border-white/15">
            <Image
              src={cocktail.imageUrl}
              alt={cocktail.name}
              fill
              unoptimized
              className="object-cover"
            />
          </div>
        )}

        {/* Name + tagline */}
        <h2
          className="mt-5 text-3xl font-black tracking-tight text-[#FFD500]"
          style={{ fontFamily: "var(--font-display, system-ui)" }}
        >
          {cocktail.name}
        </h2>
        {cocktail.tagline && (
          <p className="mt-1.5 text-[10px] tracking-[0.25em] uppercase text-[#3CE0E0]">
            {cocktail.tagline}
          </p>
        )}

        {/* Ingredients */}
        {cocktail.ingredients && (
          <section className="mt-5">
            <h3 className="text-[9px] tracking-[0.3em] uppercase text-white/35 mb-1.5">
              Ingredients
            </h3>
            <p className="text-sm text-white/80 leading-relaxed">{cocktail.ingredients}</p>
          </section>
        )}

        {/* Flavor */}
        {cocktail.description && (
          <section className="mt-5">
            <h3 className="text-[9px] tracking-[0.3em] uppercase text-white/35 mb-1.5">
              Tasting Notes
            </h3>
            <p className="text-sm text-white/70 leading-relaxed">{cocktail.description}</p>
          </section>
        )}

        {/* The long story */}
        {cocktail.story && (
          <section className="mt-5">
            <h3 className="text-[9px] tracking-[0.3em] uppercase text-white/35 mb-1.5">
              The Story
            </h3>
            {cocktail.story.split(/\n\s*\n/).map((para, i) => (
              <p key={i} className="text-sm text-white/60 leading-relaxed mb-3">
                {para}
              </p>
            ))}
          </section>
        )}

        {/* Vote */}
        <button
          onClick={onVote}
          disabled={voteBusy || (!votingOpen && !picked)}
          style={picked ? { background: "#FFD500" } : undefined}
          className={`mt-6 w-full py-4 text-[11px] tracking-[0.25em] uppercase font-bold transition-colors disabled:opacity-40 ${
            picked
              ? "text-black"
              : "border-2 border-white/25 text-white/70 hover:text-white hover:border-white/50"
          }`}
        >
          {picked ? (
            <span className="inline-flex items-center gap-2">
              <Check size={14} />
              {rank === 1 ? "Your favorite" : `Ranked #${rank}`}
            </span>
          ) : votingOpen ? (
            "Vote for this cocktail"
          ) : voteBlockReason ? (
            VOTE_BLOCK_MESSAGE[voteBlockReason]
          ) : (
            "Voting closed"
          )}
        </button>

        {/* The game */}
        <div className="mt-8">
          <h3 className="text-[9px] tracking-[0.3em] uppercase text-white/35 mb-3 text-center">
            {game ? "Play for the high score" : "Mini game"}
          </h3>

          {game ? (
            <GameShell
              menuId={menuId}
              cocktailId={cocktail.id}
              cocktailName={cocktail.name}
              gameKey={cocktail.gameKey!}
              viewerId={viewer?.userId ?? null}
              emailVerified={viewer?.emailVerified ?? false}
              scoringOpen={isLive}
              isSandbox={isSandbox}
              accent="#FFD500"
            />
          ) : (
            <div className="border-2 border-dashed border-white/15 p-8 text-center">
              <p className="text-[10px] tracking-[0.3em] uppercase text-white/40">Coming soon</p>
              <p className="mt-2 text-xs text-white/30 leading-relaxed">
                This cocktail&apos;s game is still in the workshop. Check back before the pop-up
                ends.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CRT scanlines ───────────────────────────────────────────────────────────

/** A faint horizontal line pattern over the whole page — cheap, and it does a
 *  lot of work selling the cabinet feel without touching any of the content. */
function Scanlines() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 opacity-[0.16]"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.9) 3px, rgba(0,0,0,0.9) 3px)",
      }}
    />
  );
}
