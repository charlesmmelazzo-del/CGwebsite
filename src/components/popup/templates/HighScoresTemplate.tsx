"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import GameShell from "../games/GameShell";
import StartScreen from "../StartScreen";
import CocktailCarousel from "../cabinet/CocktailCarousel";
import { C } from "../cabinet/theme";
import type { PopupCocktail, PopupTemplateProps } from "@/lib/popup/types";

/**
 * HIGH SCORES — a golden-age arcade pop-up.
 *
 * The whole page is dressed as a room full of cabinets: marquee lettering with
 * a heavy keyline and hard offset shadows, a starburst behind the header like
 * a 1981 flyer, and each cocktail presented as an actual cabinet — lit marquee
 * on top, artwork behind glass in a black bezel, control panel underneath.
 *
 * Built mobile-first throughout, because nearly everyone meets this standing at
 * the bar with a phone in one hand and a drink in the other.
 */

// ─── Marquee lettering ───────────────────────────────────────────────────────

/**
 * Eight-direction text shadow standing in for a stroke.
 *
 * `-webkit-text-stroke` centres the stroke on the glyph edge, which eats into
 * thin letterforms; stacking offset shadows keeps the letter shape intact and
 * works everywhere.
 */
function keyline(color: string, w: number): string {
  const offsets = [
    [-w, -w],
    [0, -w],
    [w, -w],
    [-w, 0],
    [w, 0],
    [-w, w],
    [0, w],
    [w, w],
  ];
  return offsets.map(([x, y]) => `${x}px ${y}px 0 ${color}`).join(", ");
}

function marquee(opts: {
  fill: string;
  stroke?: number;
  shadow1?: string;
  shadow2?: string;
}): React.CSSProperties {
  const w = opts.stroke ?? 2;
  const parts = [keyline("#100810", w)];
  // Tight offsets: a marquee shadow sits just behind the letter. Push it much
  // further and it stops reading as depth and starts reading as a second word.
  if (opts.shadow1) parts.push(`${w + 1}px ${w + 1}px 0 ${opts.shadow1}`);
  if (opts.shadow2) parts.push(`${w + 3}px ${w + 3}px 0 ${opts.shadow2}`);
  return { color: opts.fill, textShadow: parts.join(", ") };
}

// ─── Template ────────────────────────────────────────────────────────────────

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

  // Two independent overlays: `openId` is the cocktail's info card, `playingId`
  // is a game running full screen. "Play game" goes straight to the second
  // without passing through the first.
  const [playingId, setPlayingId] = useState<string | null>(null);
  const playing = cocktails.find((c) => c.id === playingId) ?? null;

  // The attract screen, shown on EVERY load rather than once per session. It
  // carries the logo, what the pop-up is, and the prize, so none of that has to
  // sit permanently above the cocktails taking up the screen.
  const [started, setStarted] = useState(false);

  const rankByCocktail = new Map(myVotes.map((v) => [v.cocktailId, v.rank]));
  const myTopPick = myVotes.find((v) => v.rank === 1)?.cocktailId;

  return (
    <div className="min-h-screen bg-[#05030F] text-white relative overflow-hidden">
      <ArcadeBackdrop />

      {/*
        Nothing above the games. The logo and the explanation live on the attract
        screen, so once it's cleared the screen is the cocktails, their demos and
        the arrows to move between them — which is the whole point of moving them.
      */}
      <div className="relative px-1 sm:px-6 py-3 sm:py-6">
        {!isLive && (
          <p
            className="mb-3 text-center text-[10px] tracking-[0.25em] uppercase"
            style={{ color: C.magenta }}
          >
            ★ This pop-up has closed — boards are final ★
          </p>
        )}

        {voteError && (
          <p className="mb-3 text-center text-xs" style={{ color: C.magenta }}>
            {voteError}
          </p>
        )}

        {cocktails.length === 0 ? (
          <p className="text-center text-sm text-white/40 py-16">
            No cocktails on this pop-up yet.
          </p>
        ) : (
          <CocktailCarousel
            cocktails={cocktails}
            results={results}
            viewer={viewer}
            votingOpen={votingOpen}
            voteBlockReason={voteBlockReason}
            voteBusy={voteBusy}
            rankByCocktail={rankByCocktail}
            myTopPick={myTopPick}
            onOpen={(id) => setOpenId(id)}
            onPlay={(id) => setPlayingId(id)}
            onVote={(id) => toggleVote(id)}
          />
        )}
      </div>

      {!started && (
        <StartScreen
          subtitle={menu.subtitle}
          description={menu.description}
          onStart={() => setStarted(true)}
        />
      )}


      {playing?.gameKey && (
        <GameShell
          key={playing.id}
          menuId={menu.id}
          cocktailId={playing.id}
          cocktailName={playing.name}
          gameKey={playing.gameKey}
          viewerId={viewer?.userId ?? null}
          emailVerified={viewer?.emailVerified ?? false}
          scoringOpen={isLive}
          isSandbox={isSandbox}
          accent="#FFD500"
          autoStart
          onExit={() => setPlayingId(null)}
        />
      )}

      {open && <CocktailDetail cocktail={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

// ─── Backdrop ────────────────────────────────────────────────────────────────

/** Deep field, a faint grid, and scanlines over the lot. */
function ArcadeBackdrop() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 0%, #1B1040 0%, #0A0620 45%, #05030F 100%)",
        }}
      />
      {/* Perspective floor grid, as on every space-shooter cabinet side art */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 h-1/3 z-0 opacity-25"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(60,224,224,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(60,224,224,0.35) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "linear-gradient(to bottom, transparent, black)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, black)",
          transform: "perspective(220px) rotateX(58deg)",
          transformOrigin: "bottom",
        }}
      />
      {/* Scanlines across the whole page */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.22]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.85) 3px, rgba(0,0,0,0.85) 4px)",
        }}
      />
    </>
  );
}


// ─── Cabinet card ────────────────────────────────────────────────────────────



// ─── Detail overlay ──────────────────────────────────────────────────────────

function CocktailDetail({
  cocktail,
  onClose,
}: {
  cocktail: PopupCocktail;
  onClose: () => void;
}) {
  return (
    // Fully opaque, not 97%: at 97% the ranking modal showed through it and the
    // two overlays read as one broken screen.
    //
    // Overlay stack for this template, all of which must clear PopupBar (z-40):
    //   detail card z-50  <  ranking modal z-60  <  running game z-70
    <div className="fixed inset-0 z-50 bg-[#05030F] overflow-y-auto overscroll-contain">
      <div className="min-h-full max-w-lg mx-auto px-4 py-4 pb-20">
        <div className="sticky top-0 z-10 -mx-4 px-4 py-2.5 bg-[#05030F]/95 backdrop-blur flex justify-between items-center border-b-2 border-[#100810]">
          <p className="text-[10px] tracking-[0.28em] uppercase text-[#FFD500] truncate font-bold">
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

        {/* Artwork behind glass */}
        {cocktail.imageUrl && (
          <div className="mt-3 border-[3px] border-[#100810] bg-[#0A0A12] p-2.5">
            <div className="relative w-full aspect-[4/3] overflow-hidden">
              <Image
                src={cocktail.imageUrl}
                alt={cocktail.name}
                fill
                unoptimized
                className="object-cover"
              />
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.3) 3px, rgba(0,0,0,0.3) 4px)",
                }}
              />
            </div>
          </div>
        )}

        <h2
          style={{
            ...marquee({ fill: "#FFD500", stroke: 2, shadow1: "#E42B20" }),
            fontFamily: "var(--font-display, system-ui)",
          }}
          className="mt-6 text-4xl font-black tracking-tight uppercase leading-none"
        >
          {cocktail.name}
        </h2>
        {cocktail.tagline && (
          <p className="mt-2.5 text-[10px] tracking-[0.28em] uppercase text-[#3CE0E0]">
            {cocktail.tagline}
          </p>
        )}

        {cocktail.ingredients && (
          <DetailSection title="Ingredients">
            <p className="text-sm text-white/85 leading-relaxed">{cocktail.ingredients}</p>
          </DetailSection>
        )}

        {cocktail.description && (
          <DetailSection title="Tasting Notes">
            <p className="text-sm text-white/70 leading-relaxed">{cocktail.description}</p>
          </DetailSection>
        )}

        {cocktail.story && (
          <DetailSection title="The Story">
            {cocktail.story.split(/\n\s*\n/).map((para, i) => (
              <p key={i} className="text-sm text-white/60 leading-relaxed mb-3">
                {para}
              </p>
            ))}
          </DetailSection>
        )}


      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="text-[9px] tracking-[0.32em] uppercase text-[#FF7B00] mb-2 font-bold">
        {title}
      </h3>
      {children}
    </section>
  );
}
