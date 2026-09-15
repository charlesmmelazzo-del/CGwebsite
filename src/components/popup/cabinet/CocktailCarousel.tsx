"use client";

// ─── Cocktail carousel ───────────────────────────────────────────────────────
//
// One cocktail at a time, big and centred, with its neighbours peeking in at
// both edges so it's obvious there's more to swipe to. That peek is the whole
// point of the layout — a slide that fills the frame edge to edge gives a
// first-time visitor no reason to think anything else exists.
//
// The whole thing is sized to the phone's screen, so the name, the demo, both
// ways to play and the info button are all visible without scrolling. The demo
// takes whatever height is left over, measured by the layout itself (a flex
// column plus a container query) rather than guessed, so it fills any phone.
//
// Built on embla, already a dependency here (see components/home/HomeCarousel).

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Image from "next/image";
import type { PopupCocktail } from "@/lib/popup/types";
import { getGameMeta } from "@/lib/popup/games";
import CabButton, { CabArrow, CabIconButton } from "./CabButton";
import GameDemo, { demoAspect } from "./GameDemo";
import { withAlpha, C } from "./theme";

export default function CocktailCarousel({
  cocktails,
  scoringOpen,
  startIndex = 0,
  onFreePlay,
  onHighScoreRun,
}: {
  cocktails: PopupCocktail[];
  /** False once the pop-up has closed — High Score Runs stop with it. */
  scoringOpen: boolean;
  /** Slide to open on, e.g. the game a guest just signed in to play. */
  startIndex?: number;
  onFreePlay: (id: string) => void;
  onHighScoreRun: (id: string) => void;
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

  const slideCount = cocktails.length;

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 overflow-hidden" ref={emblaRef}>
        <div className="flex h-full touch-pan-y">
          {cocktails.map((c, i) => (
            <Slide key={c.id} active={selected === i}>
              <CocktailSlide
                cocktail={c}
                active={selected === i}
                scoringOpen={scoringOpen}
                onFreePlay={() => onFreePlay(c.id)}
                onHighScoreRun={() => onHighScoreRun(c.id)}
              />
            </Slide>
          ))}
        </div>
      </div>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="mt-3 flex items-center justify-center gap-5">
        <CabArrow direction="left" onClick={() => emblaApi?.scrollPrev()} disabled={!canPrev} />

        <div className="flex items-center gap-2.5">
          {Array.from({ length: slideCount }, (_, i) => (
            <button
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === selected}
              className="w-3 h-3"
              style={{
                background: i === selected ? C.gold : C.plum,
                boxShadow: `0 0 0 2px ${C.ink}`,
              }}
            />
          ))}
        </div>

        <CabArrow direction="right" onClick={() => emblaApi?.scrollNext()} disabled={!canNext} />
      </div>
    </div>
  );
}

/**
 * One slide. Sits at 82% width so the next one always shows at the edge, and
 * the inactive ones sink back a little so the centre reads as the live screen.
 */
function Slide({ children, active }: { children: React.ReactNode; active: boolean }) {
  return (
    <div className="min-w-0 h-full shrink-0 grow-0 basis-[82%] sm:basis-[70%] px-2 sm:px-3">
      <div
        className="h-full transition-all duration-300"
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
  scoringOpen,
  onFreePlay,
  onHighScoreRun,
}: {
  cocktail: PopupCocktail;
  active: boolean;
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
    <div className="h-full" style={{ perspective: "1600px" }}>
      <div
        className="relative h-full transition-transform duration-700"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          transitionTimingFunction: "cubic-bezier(0.3, 0.1, 0.2, 1)",
        }}
      >
        {/* ── Front ─────────────────────────────────────────────────────── */}
        <div
          className="h-full flex flex-col"
          style={{ ...face, transform: "rotateY(0deg)" }}
          aria-hidden={flipped}
        >
          <h3
            className="text-center text-2xl sm:text-3xl font-black uppercase tracking-tight leading-none truncate"
            style={{
              fontFamily: "var(--font-display, system-ui)",
              color: C.gold,
              textShadow: `0 0 14px ${withAlpha(C.gold, 0.5)}, 3px 3px 0 ${C.ink}`,
            }}
          >
            {cocktail.name}
          </h3>

          {/*
            The demo, as big as the screen allows once everything else fits,
            in the shape of that game's own screen so nothing is stretched.
          */}
          <div className="mt-2.5 flex-1 min-h-0 flex justify-center" style={{ containerType: "size" }}>
            <div
              style={{
                width: `min(100cqw, calc(100cqh * ${demoAspect(cocktail.gameKey)}))`,
                height: `min(100cqh, calc(100cqw / ${demoAspect(cocktail.gameKey)}))`,
              }}
            >
              <GameDemo gameKey={cocktail.gameKey} running={active && !flipped} />
            </div>
          </div>

          {game ? (
            <div className="mt-3 w-full max-w-sm mx-auto grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center">
                <CabButton color={C.teal} size="md" className="w-full !px-1 !text-[8px] sm:!text-[10px]" onClick={onFreePlay}>
                  Free Play
                </CabButton>
                <Caption className="mt-2">No high scores</Caption>
              </div>
              <div className="flex flex-col items-center">
                <CabButton
                  color={C.magenta}
                  size="md"
                  className="w-full !px-1 !text-[8px] sm:!text-[10px]"
                  onClick={onHighScoreRun}
                  disabled={!scoringOpen}
                >
                  High Score Run
                </CabButton>
                <Caption className="mt-2">{scoringOpen ? "Win prizes" : "Scores are final"}</Caption>
              </div>
            </div>
          ) : (
            <p
              className="mt-3 text-center text-[10px] tracking-[0.3em] uppercase"
              style={{ color: withAlpha(C.cream, 0.55) }}
            >
              Game coming soon
            </p>
          )}

          <div className="mt-2.5 flex justify-center">
            <CabButton color={C.gold} size="sm" onClick={() => setFlipped(true)}>
              Cocktail Info
            </CabButton>
          </div>
        </div>

        {/* ── Back ──────────────────────────────────────────────────────── */}
        <div
          className="absolute inset-0 p-4"
          style={{
            ...face,
            transform: "rotateY(180deg)",
            background: "#0B0718",
            border: `3px solid ${C.ink}`,
            boxShadow: `inset 0 0 0 2px ${withAlpha(C.gold, 0.45)}`,
          }}
          aria-hidden={!flipped}
        >
          <CocktailInfo cocktail={cocktail} onClose={() => setFlipped(false)} />
        </div>
      </div>
    </div>
  );
}

function Caption({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={`text-center text-[9px] sm:text-[10px] tracking-[0.08em] uppercase leading-none ${className}`}
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
        <CabIconButton icon="close" color={C.magenta} size={40} ariaLabel="Close cocktail info" onClick={onClose} />
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
