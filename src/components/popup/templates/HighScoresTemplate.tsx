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

  const rankByCocktail = new Map(myVotes.map((v) => [v.cocktailId, v.rank]));
  const myTopPick = myVotes.find((v) => v.rank === 1)?.cocktailId;

  return (
    <div className="min-h-screen bg-[#05030F] text-white relative overflow-hidden">
      <ArcadeBackdrop />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        {/* ── Marquee ──────────────────────────────────────────────────── */}
        <header className="relative text-center mb-10 sm:mb-16">
          <Starburst />

          <p className="relative text-[9px] sm:text-[10px] tracking-[0.45em] uppercase text-[#3CE0E0]">
            Common Good Presents
          </p>

          <h1
            style={{
              ...marquee({ fill: "#FFD500", stroke: 3, shadow1: "#E42B20", shadow2: "#8828C8" }),
              fontFamily: "var(--font-display, system-ui)",
            }}
            className="relative mt-4 text-[2.6rem] leading-[0.95] sm:text-7xl font-black tracking-tight uppercase"
          >
            {menu.title || "High Scores"}
          </h1>

          {menu.subtitle && (
            <p
              style={marquee({ fill: "#FFFFFF", stroke: 2 })}
              className="relative mt-5 text-[10px] sm:text-xs tracking-[0.35em] uppercase"
            >
              {menu.subtitle}
            </p>
          )}

          {menu.description && (
            <p className="relative mt-5 max-w-md mx-auto text-xs sm:text-sm text-white/65 leading-relaxed">
              {menu.description}
            </p>
          )}

          {/* Prize plate, styled like a coin-door instruction strip */}
          <div className="relative mt-7 inline-block">
            <div
              className="border-[3px] border-[#100810] px-5 py-2.5"
              style={{ background: "#FFD500", boxShadow: "5px 6px 0 #8828C8" }}
            >
              <p className="text-[9px] sm:text-[11px] tracking-[0.2em] uppercase text-[#100810] font-black">
                High score wins a $15 gift card
              </p>
            </div>
          </div>

          {!isLive && (
            <p className="relative mt-5 text-[10px] tracking-[0.25em] uppercase text-[#E42B20]">
              ★ This pop-up has closed — boards are final ★
            </p>
          )}
        </header>

        {/* ── Voting status ────────────────────────────────────────────── */}
        <p className="relative text-center text-[11px] text-white/55 leading-relaxed mb-7 tracking-wide">
          {votingOpen
            ? myVotes.length === 0
              ? "Play the games. Then vote for the drink you liked best."
              : myVotes.length === 1
                ? "Vote locked in — tap another cabinet to rank a second favorite."
                : `You've ranked ${myVotes.length} favorites.`
            : voteBlockReason
              ? VOTE_BLOCK_MESSAGE[voteBlockReason]
              : "Voting is closed."}
        </p>
        {voteError && <p className="mb-4 text-center text-xs text-[#FF9CB0]">{voteError}</p>}

        {/* ── Cabinets ─────────────────────────────────────────────────── */}
        {cocktails.length === 0 ? (
          <p className="text-center text-sm text-white/40 py-16">
            No cocktails on this pop-up yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
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
          <div className="mt-14 sm:mt-20 max-w-xl mx-auto">
            <h2
              style={marquee({ fill: "#3CE0E0", stroke: 2, shadow1: "#0A4A6A" })}
              className="text-center text-xl sm:text-2xl font-black tracking-[0.2em] uppercase mb-5"
            >
              Cocktail Standings
            </h2>
            <div className="border-[3px] border-[#100810] bg-black/70 p-4" style={{ boxShadow: "5px 6px 0 #1B1030" }}>
              <Leaderboard results={results} accent="#FFD500" myTopPick={myTopPick} />
            </div>
            {!viewer && (
              <p className="mt-5 text-center text-xs text-white/40">
                <Link href="/popup/signup" className="text-[#FFD500] underline hover:opacity-80">
                  Create an account
                </Link>{" "}
                to vote and get on the high score boards.
              </p>
            )}
          </div>
        )}
      </div>

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

/** Radiating light behind the title, straight off a 1981 flyer. */
function Starburst() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[130%] aspect-square opacity-[0.30]"
      style={{
        background:
          "repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,213,0,0.55) 0deg 5deg, rgba(0,0,0,0) 5deg 11deg)",
        maskImage: "radial-gradient(circle at 50% 50%, black 5%, transparent 62%)",
        WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 5%, transparent 62%)",
      }}
    />
  );
}

// ─── Cabinet card ────────────────────────────────────────────────────────────

/** Each cabinet gets its own marquee colour, like a row in an arcade. */
const CABINET_HUES: { marquee: string; shadow: string; ink: string }[] = [
  { marquee: "#E42B20", shadow: "#7A0F0A", ink: "#FFD500" },
  { marquee: "#3CE0E0", shadow: "#0A5A6A", ink: "#100810" },
  { marquee: "#FFD500", shadow: "#8A6A00", ink: "#100810" },
  { marquee: "#8828C8", shadow: "#3A0A5A", ink: "#FFD500" },
  { marquee: "#00B83C", shadow: "#00551C", ink: "#100810" },
  { marquee: "#FF7B00", shadow: "#8A3F00", ink: "#100810" },
];

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
      className="group block w-full text-left active:translate-y-[2px] transition-transform"
      style={{ filter: "drop-shadow(5px 7px 0 rgba(0,0,0,0.75))" }}
    >
      {/* Lit marquee */}
      <div
        className="border-[3px] border-b-0 border-[#100810] px-3 py-2 relative overflow-hidden"
        style={{ background: hue.marquee }}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.26), rgba(0,0,0,0.22))" }}
        />
        <p
          className="relative text-[11px] tracking-[0.18em] uppercase font-black truncate text-center"
          style={{ color: hue.ink, textShadow: `1px 1px 0 ${hue.shadow}` }}
        >
          {cocktail.name}
        </p>
      </div>

      {/* Bezel + screen */}
      <div className="border-[3px] border-[#100810] bg-[#0A0A12] p-2.5">
        <div className="relative aspect-[4/3] bg-black overflow-hidden border-2 border-[#000]">
          {cocktail.imageUrl ? (
            <Image
              src={cocktail.imageUrl}
              alt={cocktail.name}
              fill
              unoptimized
              className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <p
                style={marquee({ fill: hue.marquee, stroke: 1 })}
                className="text-[11px] tracking-[0.3em] uppercase font-black animate-pulse"
              >
                Insert Coin
              </p>
            </div>
          )}

          {/* Curved glass + scanlines over the artwork */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.35) 3px, rgba(0,0,0,0.35) 4px)",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(115% 115% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.6) 100%)",
            }}
          />

          {rank !== undefined && (
            <span
              className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center text-[12px] font-black tabular-nums border-2 border-[#100810]"
              style={{ background: "#FFD500", color: "#100810" }}
              title={`Your #${rank} pick`}
            >
              {rank}
            </span>
          )}
        </div>
      </div>

      {/* Control panel */}
      <div className="border-[3px] border-t-0 border-[#100810] bg-[#15151F] px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          {/* Joystick and two buttons */}
          <span className="flex items-center gap-1.5 shrink-0" aria-hidden>
            <span className="w-2.5 h-2.5 rounded-full bg-[#E42B20] border border-black/70" />
            <span className="w-2 h-2 rounded-full bg-[#3CE0E0] border border-black/70" />
            <span className="w-2 h-2 rounded-full bg-[#FFD500] border border-black/70" />
          </span>
          <span
            className="text-[8px] tracking-[0.18em] uppercase truncate"
            style={{ color: game ? hue.marquee : "rgba(255,255,255,0.28)" }}
          >
            {game ? game.title : "Game coming soon"}
          </span>
        </div>
        {cocktail.tagline && (
          <p className="mt-1.5 text-[10px] text-white/45 leading-snug line-clamp-2">
            {cocktail.tagline}
          </p>
        )}
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

        {/* Vote */}
        <button
          onClick={onVote}
          disabled={voteBusy || (!votingOpen && !picked)}
          className={`mt-7 w-full py-4 border-[3px] border-[#100810] text-[11px] tracking-[0.25em] uppercase font-black transition-transform active:translate-y-[2px] disabled:opacity-40 ${
            picked ? "text-[#100810]" : "text-white/80"
          }`}
          style={{
            background: picked ? "#FFD500" : "#1B1030",
            boxShadow: picked ? "4px 5px 0 #8A6A00" : "4px 5px 0 #100810",
          }}
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
        <div className="mt-10">
          <h3
            style={marquee({ fill: "#3CE0E0", stroke: 2, shadow1: "#0A4A6A" })}
            className="text-center text-lg font-black tracking-[0.2em] uppercase mb-4"
          >
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
            <div className="border-[3px] border-dashed border-white/20 p-10 text-center">
              <p
                style={marquee({ fill: "#FFFFFF", stroke: 1 })}
                className="text-[11px] tracking-[0.3em] uppercase font-black"
              >
                Coming Soon
              </p>
              <p className="mt-3 text-xs text-white/35 leading-relaxed">
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
