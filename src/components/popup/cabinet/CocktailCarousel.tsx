"use client";

// ─── Cocktail carousel ───────────────────────────────────────────────────────
//
// One cocktail at a time, big and centred, with its neighbours peeking in at
// both edges so it's obvious there's more to swipe to. That peek is the whole
// point of the layout — a slide that fills the frame edge to edge gives a
// first-time visitor no reason to think anything else exists.
//
// The standings ride in the same carousel as the last slide rather than sitting
// below it, so voting is somewhere you arrive by swiping rather than by
// scrolling past the games.
//
// Built on embla, already a dependency here (see components/home/HomeCarousel).

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Link from "next/link";
import type {
  LeaderboardEntry,
  PopupCocktail,
  PopupViewer,
  VoteBlockReason,
} from "@/lib/popup/types";
import { VOTE_BLOCK_MESSAGE } from "@/lib/popup/access";
import { getGameMeta } from "@/lib/popup/games";
import Leaderboard from "../Leaderboard";
import CabButton, { CabArrow } from "./CabButton";
import CrtPanel from "./CrtPanel";
import GameDemo from "./GameDemo";
import { lamp, shade, withAlpha, C } from "./theme";

export default function CocktailCarousel({
  cocktails,
  results,
  viewer,
  votingOpen,
  voteBlockReason,
  voteBusy,
  rankByCocktail,
  myTopPick,
  onOpen,
  onVote,
}: {
  cocktails: PopupCocktail[];
  results: LeaderboardEntry[];
  viewer: PopupViewer | null;
  votingOpen: boolean;
  voteBlockReason: VoteBlockReason | null;
  voteBusy: boolean;
  rankByCocktail: Map<string, number>;
  myTopPick?: string;
  onOpen: (id: string) => void;
  onVote: (id: string) => void;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    // containScroll off is what lets the first and last slides also sit centred
    // with a neighbour showing, instead of being flush to the frame.
    containScroll: false,
    loop: cocktails.length > 1,
  });

  const [selected, setSelected] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect).on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect).off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  const slideCount = cocktails.length + 1; // + standings

  return (
    <div className="relative">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex touch-pan-y">
          {cocktails.map((c, i) => (
            <Slide key={c.id} active={selected === i}>
              <CocktailSlide
                cocktail={c}
                active={selected === i}
                rank={rankByCocktail.get(c.id)}
                onOpen={() => onOpen(c.id)}
                onPlay={() => onOpen(c.id)}
              />
            </Slide>
          ))}

          <Slide active={selected === cocktails.length}>
            <StandingsSlide
              cocktails={cocktails}
              results={results}
              viewer={viewer}
              votingOpen={votingOpen}
              voteBlockReason={voteBlockReason}
              voteBusy={voteBusy}
              rankByCocktail={rankByCocktail}
              myTopPick={myTopPick}
              onVote={onVote}
            />
          </Slide>
        </div>
      </div>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="mt-6 flex items-center justify-center gap-5">
        <CabArrow direction="left" onClick={() => emblaApi?.scrollPrev()} disabled={!canPrev} />

        <div className="flex items-center gap-2.5">
          {Array.from({ length: slideCount }, (_, i) => (
            <button
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className="w-3.5 h-3.5 rounded-full transition-transform"
              style={{
                background: i === selected ? lamp(C.gold) : withAlpha(C.cream, 0.22),
                boxShadow:
                  i === selected
                    ? `0 0 10px ${withAlpha(C.gold, 0.8)}, inset 0 0 0 1px ${shade(C.gold, 0.5)}`
                    : `inset 0 0 0 1px ${withAlpha(C.cream, 0.3)}`,
                transform: i === selected ? "scale(1.25)" : undefined,
              }}
            />
          ))}
        </div>

        <CabArrow direction="right" onClick={() => emblaApi?.scrollNext()} disabled={!canNext} />
      </div>

      <p
        className="mt-3 text-center text-[9px] tracking-[0.3em] uppercase"
        style={{ color: withAlpha(C.cream, 0.4) }}
      >
        Swipe or use the arrows
      </p>
    </div>
  );
}

/**
 * One slide. Sits at 82% width so the next one always shows at the edge, and
 * the inactive ones sink back a little so the centre reads as the live screen.
 */
function Slide({ children, active }: { children: React.ReactNode; active: boolean }) {
  return (
    <div className="min-w-0 shrink-0 grow-0 basis-[82%] sm:basis-[70%] px-2 sm:px-3">
      <div
        className="transition-all duration-300"
        style={{
          transform: active ? "scale(1)" : "scale(0.9)",
          opacity: active ? 1 : 0.45,
          filter: active ? undefined : "saturate(0.6)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Cocktail slide ──────────────────────────────────────────────────────────

function CocktailSlide({
  cocktail,
  active,
  rank,
  onOpen,
  onPlay,
}: {
  cocktail: PopupCocktail;
  active: boolean;
  rank?: number;
  onOpen: () => void;
  onPlay: () => void;
}) {
  const game = getGameMeta(cocktail.gameKey);

  return (
    <CrtPanel>
      {/* Name */}
      <div className="text-center">
        <h3
          className="text-2xl sm:text-4xl font-black uppercase tracking-tight leading-none"
          style={{
            fontFamily: "var(--font-display, system-ui)",
            color: C.gold,
            textShadow: `0 0 14px ${withAlpha(C.gold, 0.5)}, 3px 4px 0 ${C.ink}`,
          }}
        >
          {cocktail.name}
        </h3>
        {rank !== undefined && (
          <p className="mt-2 text-[9px] tracking-[0.3em] uppercase" style={{ color: C.teal }}>
            {rank === 1 ? "★ Your favorite" : `★ Ranked #${rank}`}
          </p>
        )}
      </div>

      {/* Attract-mode demo of this cocktail's game */}
      <div className="mt-4">
        <GameDemo gameKey={cocktail.gameKey} running={active} />
      </div>

      {/* Tagline */}
      <p
        className="mt-4 text-center text-[11px] sm:text-sm leading-relaxed"
        style={{ color: withAlpha(C.cream, 0.85) }}
      >
        {cocktail.tagline || (game ? game.blurb : "")}
      </p>

      {/* Controls */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <CabButton color={C.teal} size="md" onClick={onOpen}>
          Cocktail Info
        </CabButton>
        <CabButton color={C.magenta} size="md" onClick={onPlay} disabled={!game}>
          {game ? "Play Game" : "Coming Soon"}
        </CabButton>
      </div>
    </CrtPanel>
  );
}

// ─── Standings slide ─────────────────────────────────────────────────────────

function StandingsSlide({
  cocktails,
  results,
  viewer,
  votingOpen,
  voteBlockReason,
  voteBusy,
  rankByCocktail,
  myTopPick,
  onVote,
}: {
  cocktails: PopupCocktail[];
  results: LeaderboardEntry[];
  viewer: PopupViewer | null;
  votingOpen: boolean;
  voteBlockReason: VoteBlockReason | null;
  voteBusy: boolean;
  rankByCocktail: Map<string, number>;
  myTopPick?: string;
  onVote: (id: string) => void;
}) {
  return (
    <CrtPanel>
      <div className="text-center">
        <h3
          className="text-2xl sm:text-4xl font-black uppercase tracking-tight leading-none"
          style={{
            fontFamily: "var(--font-display, system-ui)",
            color: C.teal,
            textShadow: `0 0 14px ${withAlpha(C.teal, 0.5)}, 3px 4px 0 ${C.ink}`,
          }}
        >
          Standings
        </h3>
        <p
          className="mt-2 text-[9px] tracking-[0.3em] uppercase"
          style={{ color: withAlpha(C.cream, 0.55) }}
        >
          {votingOpen ? "Vote for your favorites" : "Voting closed"}
        </p>
      </div>

      <div className="mt-4">
        <Leaderboard results={results} accent={C.gold} myTopPick={myTopPick} />
      </div>

      {/* Voting happens here, on the same screen as the standings. */}
      <div className="mt-5">
        {voteBlockReason && !votingOpen ? (
          <p
            className="text-center text-[11px] leading-relaxed"
            style={{ color: withAlpha(C.cream, 0.6) }}
          >
            {VOTE_BLOCK_MESSAGE[voteBlockReason]}
          </p>
        ) : (
          <>
            <p
              className="text-center text-[9px] tracking-[0.28em] uppercase mb-3"
              style={{ color: withAlpha(C.cream, 0.5) }}
            >
              Tap a cocktail to rank it
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {cocktails.map((c) => {
                const rank = rankByCocktail.get(c.id);
                return (
                  <CabButton
                    key={c.id}
                    size="sm"
                    depth={4}
                    color={rank !== undefined ? C.gold : C.plum}
                    disabled={voteBusy || !votingOpen}
                    onClick={() => onVote(c.id)}
                    className={rank !== undefined ? "" : "!text-[#FFE9C4]"}
                  >
                    {rank !== undefined ? `#${rank} ${c.name}` : c.name}
                  </CabButton>
                );
              })}
            </div>
          </>
        )}
      </div>

      {!viewer && (
        <p
          className="mt-5 text-center text-[11px]"
          style={{ color: withAlpha(C.cream, 0.55) }}
        >
          <Link href="/popup/signup" className="underline" style={{ color: C.gold }}>
            Create an account
          </Link>{" "}
          to vote and get on the high score boards.
        </p>
      )}
    </CrtPanel>
  );
}
