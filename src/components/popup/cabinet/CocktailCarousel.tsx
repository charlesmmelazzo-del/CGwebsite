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
import Image from "next/image";
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
import CabButton, { CabArrow, CabIconButton } from "./CabButton";
import { artLayer } from "./pixelArt";
import CrtPanel from "./CrtPanel";
import GameDemo from "./GameDemo";
import { withAlpha, C } from "./theme";

export default function CocktailCarousel({
  cocktails,
  results,
  viewer,
  votingOpen,
  voteBlockReason,
  voteBusy,
  rankByCocktail,
  myTopPick,
  scoringOpen,
  startIndex = 0,
  onFreePlay,
  onHighScoreRun,
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
  /** False once the pop-up has closed — High Score Runs stop with it. */
  scoringOpen: boolean;
  /** Slide to open on, e.g. the game a guest just signed in to play. */
  startIndex?: number;
  onFreePlay: (id: string) => void;
  onHighScoreRun: (id: string) => void;
  onVote: (id: string) => void;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    startIndex,
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
                scoringOpen={scoringOpen}
                onFreePlay={() => onFreePlay(c.id)}
                onHighScoreRun={() => onHighScoreRun(c.id)}
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
              aria-current={i === selected}
              className="w-4 h-4"
              style={artLayer(i === selected ? "light-on" : "light-off", "contain")}
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
//
// Front: the cocktail's name, its game playing itself, and the two ways to play.
// Back: everything about the drink. "Cocktail Info" turns the whole screen over
// rather than opening a separate overlay, so the guest never loses their place.

function CocktailSlide({
  cocktail,
  active,
  rank,
  scoringOpen,
  onFreePlay,
  onHighScoreRun,
}: {
  cocktail: PopupCocktail;
  active: boolean;
  rank?: number;
  scoringOpen: boolean;
  onFreePlay: () => void;
  onHighScoreRun: () => void;
}) {
  const game = getGameMeta(cocktail.gameKey);
  const [flipped, setFlipped] = useState(false);

  // Swiping away turns the card back to its demo for next time.
  useEffect(() => {
    if (!active) setFlipped(false);
  }, [active]);

  const face: React.CSSProperties = {
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  };

  return (
    <div style={{ perspective: "1600px" }}>
      <div
        className="relative transition-transform duration-700"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          transitionTimingFunction: "cubic-bezier(0.3, 0.1, 0.2, 1)",
        }}
      >
        {/* ── Front ─────────────────────────────────────────────────────── */}
        <div style={{ ...face, transform: "rotateY(0deg)" }} aria-hidden={flipped}>
          <CrtPanel>
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
              <GameDemo gameKey={cocktail.gameKey} running={active && !flipped} />
            </div>

            {game ? (
              <div className="mt-5 flex flex-col items-center">
                <Caption>Free play to play without high scores</Caption>
                <div className="mt-3 w-full max-w-[280px] flex flex-col gap-4">
                  <CabButton color={C.teal} size="md" className="w-full" onClick={onFreePlay}>
                    Free Play
                  </CabButton>
                  <CabButton
                    color={C.magenta}
                    size="md"
                    className="w-full"
                    onClick={onHighScoreRun}
                    disabled={!scoringOpen}
                  >
                    High Score Run
                  </CabButton>
                </div>
                <Caption className="mt-4">
                  {scoringOpen ? "High score run to win prizes" : "This pop-up has closed — scores are final"}
                </Caption>
              </div>
            ) : (
              <p
                className="mt-5 text-center text-[10px] tracking-[0.3em] uppercase"
                style={{ color: withAlpha(C.cream, 0.55) }}
              >
                Game coming soon
              </p>
            )}

            <div className="mt-5 flex justify-center">
              <CabButton color={C.gold} size="sm" onClick={() => setFlipped(true)}>
                Cocktail Info
              </CabButton>
            </div>
          </CrtPanel>
        </div>

        {/* ── Back ──────────────────────────────────────────────────────── */}
        <div
          className="absolute inset-0"
          style={{ ...face, transform: "rotateY(180deg)" }}
          aria-hidden={!flipped}
        >
          <CrtPanel fill accents={false} glow={C.gold}>
            <CocktailInfo cocktail={cocktail} onClose={() => setFlipped(false)} />
          </CrtPanel>
        </div>
      </div>
    </div>
  );
}

function Caption({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={`text-center text-[9px] sm:text-[10px] tracking-[0.06em] uppercase leading-relaxed ${className}`}
      style={{ color: withAlpha(C.cream, 0.65) }}
    >
      {children}
    </p>
  );
}

function CocktailInfo({ cocktail, onClose }: { cocktail: PopupCocktail; onClose: () => void }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className="text-2xl sm:text-3xl font-black uppercase tracking-tight leading-none"
            style={{
              fontFamily: "var(--font-display, system-ui)",
              color: C.gold,
              textShadow: `0 0 14px ${withAlpha(C.gold, 0.5)}, 3px 4px 0 ${C.ink}`,
            }}
          >
            {cocktail.name}
          </h3>
          {cocktail.tagline && (
            <p className="mt-2 text-[9px] tracking-[0.28em] uppercase" style={{ color: C.teal }}>
              {cocktail.tagline}
            </p>
          )}
        </div>
        <CabIconButton icon="close" size={44} ariaLabel="Close cocktail info" onClick={onClose} />
      </div>

      {/* Long stories scroll inside the card, so it keeps the demo side's size. */}
      <div className="mt-4 flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1">
        {cocktail.imageUrl && (
          <div className="relative w-full aspect-[4/3] overflow-hidden rounded-xl">
            <Image src={cocktail.imageUrl} alt={cocktail.name} fill unoptimized className="object-cover" />
          </div>
        )}

        {cocktail.ingredients && (
          <InfoSection title="Ingredients">
            <p className="text-sm leading-relaxed" style={{ color: withAlpha(C.cream, 0.9) }}>
              {cocktail.ingredients}
            </p>
          </InfoSection>
        )}

        {cocktail.description && (
          <InfoSection title="Tasting Notes">
            <p className="text-sm leading-relaxed" style={{ color: withAlpha(C.cream, 0.75) }}>
              {cocktail.description}
            </p>
          </InfoSection>
        )}

        {cocktail.story && (
          <InfoSection title="The Story">
            {cocktail.story.split(/\n\s*\n/).map((para, i) => (
              <p key={i} className="text-sm leading-relaxed mb-3" style={{ color: withAlpha(C.cream, 0.65) }}>
                {para}
              </p>
            ))}
          </InfoSection>
        )}

        {!cocktail.ingredients && !cocktail.description && !cocktail.story && !cocktail.imageUrl && (
          <p className="mt-6 text-center text-xs" style={{ color: withAlpha(C.cream, 0.5) }}>
            More about this one soon.
          </p>
        )}
      </div>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h4 className="text-[9px] tracking-[0.32em] uppercase mb-2 font-bold" style={{ color: C.sunset }}>
        {title}
      </h4>
      {children}
    </section>
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
                    color={rank !== undefined ? C.gold : C.plum}
                    disabled={voteBusy || !votingOpen}
                    onClick={() => onVote(c.id)}
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
