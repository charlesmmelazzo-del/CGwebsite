// ─── Cabinet frame ───────────────────────────────────────────────────────────
//
// Puts the pop-up inside an upright cabinet: a lit marquee across the top and
// art panels down both sides.
//
// The look is airbrushed cabinet art — soft sprayed colour and rounded plastic,
// never a hard rectangle or a two-stop gradient. See cabinet/theme.ts, which
// owns both rules; nothing here should hand-roll a colour or a corner.
//
// The side panels are desktop-only on purpose. A real cabinet's side art is
// never in your eyeline while you play, and on a phone those columns would eat
// a third of the width the cocktails need.

import type { ReactNode } from "react";
import { BartenderArt, BottleRow, GUEST_SWAPS, SpriteArt } from "./CabinetArt";
import { GUEST, ROLLING_BOTTLE, BOTTLE_COLORS, TIN, TIN_COLORS } from "./CabinetArt";
import { airbrush, lamp, shade, withAlpha, C, R } from "./cabinet/theme";

export default function CabinetFrame({
  title,
  subtitle,
  description,
  notice,
  children,
}: {
  /** The pop-up's name — the marquee logo. */
  title: string;
  subtitle?: string;
  description?: string;
  /** Shown under the banner when the pop-up has closed. */
  notice?: ReactNode;
  /** The screen. */
  children: ReactNode;
}) {
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {/* ── Marquee ─────────────────────────────────────────────────────── */}
      <header
        className="relative overflow-hidden"
        style={{
          borderRadius: R.cabinet,
          background: airbrush(),
          boxShadow: `inset 0 0 0 3px ${withAlpha(C.gold, 0.35)}, inset 0 0 60px ${withAlpha(C.magenta, 0.25)}, 0 10px 0 ${withAlpha("#000000", 0.5)}`,
        }}
      >
        <Sunburst />

        <div className="relative px-4 pt-7 pb-32 sm:px-10 sm:pt-9 sm:pb-14">
          <div className="flex items-center justify-center gap-3 sm:gap-7">
            <MarqueeArt />

            <div className="min-w-0 flex-1 text-center">
              <p
                className="text-[9px] sm:text-[11px] tracking-[0.45em] uppercase"
                style={{ color: C.teal }}
              >
                Common Good Presents
              </p>

              {/* The logo carries the header — as big as the box allows. */}
              <h1
                style={{
                  fontFamily: "var(--font-display, system-ui)",
                  color: C.gold,
                  // Screened marquee lettering: a warm glow, a hard keyline,
                  // then two offset shadows in the poster's own colours.
                  textShadow: [
                    `0 0 18px ${withAlpha(C.gold, 0.55)}`,
                    `2px 2px 0 ${C.ink}`,
                    `5px 6px 0 ${C.magenta}`,
                    `8px 10px 0 ${shade(C.plum, 0.15)}`,
                  ].join(", "),
                  WebkitTextStroke: `2px ${C.ink}`,
                }}
                className="mt-3 text-[3.1rem] leading-[0.86] sm:text-[6.5rem] font-black tracking-[-0.02em] uppercase"
              >
                {title}
              </h1>

              {subtitle && (
                <p
                  className="mt-3 text-[10px] sm:text-xs tracking-[0.4em] uppercase"
                  style={{ color: C.cream }}
                >
                  {subtitle}
                </p>
              )}
            </div>

            <MarqueeArt flip />
          </div>

          {/* ── Banner ──────────────────────────────────────────────────── */}
          <div
            className="relative mx-auto mt-7 max-w-2xl px-5 py-3 sm:px-8 sm:py-3.5"
            style={{
              borderRadius: R.chip,
              background: lamp(C.plum),
              boxShadow: `inset 0 0 0 2px ${withAlpha(C.gold, 0.55)}, 0 5px 0 ${withAlpha("#000000", 0.45)}`,
            }}
          >
            <p
              className="text-center text-[10px] sm:text-[12px] leading-relaxed tracking-[0.1em] uppercase font-bold"
              style={{ color: C.cream }}
            >
              Explore the cocktails, order one to receive tickets to play its
              corresponding game, vote for your favorites
            </p>
          </div>

          {description && (
            <p
              className="relative mx-auto mt-4 max-w-lg text-center text-xs sm:text-sm leading-relaxed"
              style={{ color: withAlpha(C.cream, 0.75) }}
            >
              {description}
            </p>
          )}

          {notice && <div className="relative mt-4 text-center">{notice}</div>}

          <PrizeBadge />
        </div>

        {/* Tube lighting along the bottom edge of the marquee */}
        <div
          aria-hidden
          className="h-[4px] w-full"
          style={{
            background: `linear-gradient(90deg, ${C.gold}, ${C.sunset}, ${C.magenta}, ${C.plum}, ${C.teal})`,
            filter: "blur(0.4px)",
          }}
        />
      </header>

      {/* ── Body: side art either side of the screen ────────────────────── */}
      <div className="flex mt-4 gap-3">
        <SideArt />
        <div className="min-w-0 flex-1">{children}</div>
        <SideArt flip />
      </div>
    </div>
  );
}

/**
 * The gift-card notice, as a lit roundel in the corner of the marquee — the
 * spot a cabinet used for its "FREE PLAY" or licensing sticker.
 */
function PrizeBadge() {
  return (
    <div
      className="absolute right-3 bottom-4 sm:right-6 sm:bottom-4 w-[124px] h-[124px] sm:w-[140px] sm:h-[140px] flex items-center justify-center text-center"
      style={{
        borderRadius: "999px",
        background: lamp(C.gold),
        boxShadow: [
          `inset 0 0 0 3px ${shade(C.gold, 0.45)}`,
          `inset 0 0 22px ${withAlpha("#FFFFFF", 0.45)}`,
          `0 0 26px ${withAlpha(C.gold, 0.5)}`,
          `0 6px 0 ${shade(C.gold, 0.55)}`,
        ].join(", "),
        // Sat slightly off-square, like a sticker applied by hand.
        transform: "rotate(-7deg)",
      }}
    >
      <p
        className="px-4 text-[8.5px] sm:text-[9.5px] leading-[1.35] tracking-[0.06em] uppercase font-black"
        style={{ color: C.ink }}
      >
        High score in each game at the end of the pop up wins a $15 gift card!
      </p>
    </div>
  );
}

/** Characters flanking the logo. Hidden on the narrowest screens. */
function MarqueeArt({ flip = false }: { flip?: boolean }) {
  return (
    <div
      aria-hidden
      className="hidden sm:flex shrink-0 items-end gap-2"
      style={{ transform: flip ? "scaleX(-1)" : undefined }}
    >
      <BartenderArt px={3} mood={flip ? "ok" : "happy"} />
      <SpriteArt sprite={GUEST} colors={GUEST_SWAPS[flip ? 1 : 0]} px={3} className="mb-1" />
    </div>
  );
}

/**
 * Side art. A real cabinet's is one bold sprayed field running the height of
 * the panel, so this is a colour wash with characters down it rather than a
 * scatter of little pictures.
 */
function SideArt({ flip = false }: { flip?: boolean }) {
  return (
    <div
      aria-hidden
      className="hidden lg:flex w-16 shrink-0 flex-col items-center gap-9 py-10 overflow-hidden"
      style={{
        borderRadius: R.panel,
        background: airbrush({ clouds: [C.sunset, C.magenta, C.teal], intensity: 0.6 }),
        boxShadow: `inset 0 0 0 2px ${withAlpha(C.gold, 0.28)}`,
        transform: flip ? "scaleX(-1)" : undefined,
      }}
    >
      {/* Repeated so a long pop-up doesn't leave most of the panel bare. The
          run is short enough that the repeat isn't obvious at a glance. */}
      {[0, 1, 2].map((n) => (
        <div key={n} className="flex flex-col items-center gap-9">
          <SpriteArt sprite={TIN} colors={TIN_COLORS} px={3} />
          <BartenderArt px={2} mood="ok" holdingTin={false} />
          <SpriteArt sprite={ROLLING_BOTTLE} colors={BOTTLE_COLORS} px={3} />
          <SpriteArt sprite={GUEST} colors={GUEST_SWAPS[n % GUEST_SWAPS.length]} px={2} />
        </div>
      ))}
    </div>
  );
}

/**
 * Radiating light behind the logo. Softened at both ends so the rays fade in
 * rather than starting as hard wedges — sprayed, not printed.
 */
function Sunburst() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 w-[150%] aspect-square opacity-[0.22]"
        style={{
          background: `repeating-conic-gradient(from 0deg at 50% 50%, ${withAlpha(C.gold, 0.7)} 0deg 5deg, transparent 5deg 12deg)`,
          maskImage:
            "radial-gradient(circle at 50% 50%, transparent 6%, black 22%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(circle at 50% 50%, transparent 6%, black 22%, transparent 70%)",
          filter: "blur(1.2px)",
        }}
      />
      {/* Bottle line along the very bottom, behind the badge. */}
      <BottleRow count={9} px={3} className="absolute left-5 bottom-4 opacity-70" />
    </>
  );
}
