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
import { lamp, shade, withAlpha, C, R } from "./cabinet/theme";
import NotchedFrame, { MarqueeWord, SpeedStripes } from "./cabinet/art/Frame";
import { BartenderShaking, BartenderStirring } from "./cabinet/art/figures";
import {
  BarSpoon,
  Bottle,
  Cherries,
  CitrusWheel,
  INK,
  Jigger,
  Lemon,
  Martini,
  Shaker,
} from "./cabinet/art/props";

export default function CabinetFrame({
  title,
  subtitle,
  notice,
  children,
}: {
  /** The pop-up's name — the marquee logo. */
  title: string;
  subtitle?: string;
  /** Shown under the banner when the pop-up has closed. */
  notice?: ReactNode;
  /** The screen. */
  children: ReactNode;
}) {
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {/* ── Marquee ─────────────────────────────────────────────────────── */}
      {/*
        Printed marquee art, not a lit plastic panel: black ground, parallel
        yellow/red/blue strokes with cut corners, speed stripes running off
        both edges, and drawn figures either side of two-tone lettering.
      */}
      <NotchedFrame style={{ boxShadow: `0 10px 0 ${withAlpha("#000000", 0.5)}` }}>
        <div className="relative overflow-hidden">
          {/* Stripes sit behind everything and run off both edges. */}
          <SpeedStripes className="absolute left-0 top-[22%] w-[26%] opacity-95" />
          <SpeedStripes className="absolute right-0 top-[22%] w-[26%] opacity-95" />

          <div className="relative flex items-center justify-center gap-1 sm:gap-3 px-2 py-3">
            {/* ── Left: the shaker and his bottles ── */}
            <div className="hidden md:flex shrink-0 items-end">
              <BartenderShaking size={158} />
              <div className="flex items-end -ml-3">
                <Bottle size={56} body={INK.amber} label={INK.cream} device={INK.green} />
                <Jigger size={38} className="ml-1" />
                <CitrusWheel size={30} className="ml-1" />
                <CitrusWheel size={28} peel={INK.orange} flesh="#FFB74D" className="ml-0.5" />
              </div>
            </div>

            {/* ── Logo ── */}
            <div className="min-w-0 flex-1 text-center py-2">
              <MarqueeWord
                fill={INK.yellow}
                keyline={INK.red}
                className="text-[3rem] sm:text-[4.6rem]"
              >
                {title.split(" ")[0] || title}
              </MarqueeWord>
              {title.split(" ").length > 1 && (
                <MarqueeWord
                  fill={INK.blue}
                  keyline={INK.yellow}
                  className="text-[3rem] sm:text-[4.6rem] mt-1"
                >
                  {title.split(" ").slice(1).join(" ")}
                </MarqueeWord>
              )}

              {subtitle && (
                <p
                  className="mt-3 text-[9px] sm:text-[11px] tracking-[0.4em] uppercase"
                  style={{ color: INK.cream }}
                >
                  {subtitle}
                </p>
              )}
              {notice && <div className="mt-2">{notice}</div>}
            </div>

            {/* ── Right: the stirrer and her bottles ── */}
            <div className="hidden md:flex shrink-0 items-end">
              <div className="flex items-end mr-1">
                <Cherries size={34} />
                <Bottle size={56} body={INK.green} label={INK.cream} device={INK.red} className="ml-1" />
                <Bottle size={52} body={INK.brown} label={INK.cream} device={INK.red} className="ml-0.5" />
                <Lemon size={30} className="ml-1" />
              </div>
              <BartenderStirring size={158} />
            </div>
          </div>

          {/* The two roundels keep their corners of the panel. */}
          <div className="flex items-center justify-between gap-3 px-2 pb-1">
            <Roundel
              color={C.plum}
              ink={C.cream}
              rotate={6}
              text="Explore the cocktails, order one to receive tickets to play its corresponding game, vote for your favorites"
            />
            {/* Pixel accents along the bottom, as on the reference bezel. */}
            <div className="hidden sm:flex items-end gap-3 opacity-90">
              <Shaker size={26} tilt={-12} />
              <Martini size={26} />
              <Shaker size={22} tilt={10} />
              <Martini size={24} />
              <BarSpoon size={26} />
            </div>
            <Roundel
              color={C.gold}
              ink={C.ink}
              rotate={-7}
              text="High score in each game at the end of the pop up wins a $15 gift card!"
            />
          </div>
        </div>
      </NotchedFrame>

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
 * A lit plate, the shape a cabinet used for its "FREE PLAY" or licensing
 * sticker. Sat slightly off-square, as if applied by hand.
 *
 * Hidden below `sm` — two of these either side of the logo leave a phone no
 * room for the logo itself, and the same information is on the page below.
 */
function Roundel({
  text,
  color,
  ink,
  rotate,
}: {
  text: string;
  color: string;
  ink: string;
  rotate: number;
}) {
  return (
    <div
      className="hidden sm:flex shrink-0 w-[132px] h-[132px] lg:w-[150px] lg:h-[150px] items-center justify-center text-center"
      style={{
        borderRadius: "999px",
        background: lamp(color),
        boxShadow: [
          `inset 0 0 0 3px ${shade(color, 0.45)}`,
          `inset 0 0 22px ${withAlpha("#FFFFFF", 0.4)}`,
          `0 0 26px ${withAlpha(color, 0.45)}`,
          `0 6px 0 ${shade(color, 0.55)}`,
        ].join(", "),
        transform: `rotate(${rotate}deg)`,
      }}
    >
      <p
        className="px-4 text-[8.5px] lg:text-[9.5px] leading-[1.35] tracking-[0.05em] uppercase font-black"
        style={{ color: ink }}
      >
        {text}
      </p>
    </div>
  );
}

/**
 * Side art. On a real cabinet this was the same printed artwork as the
 * marquee, so it gets the same treatment: black ground, speed stripes, and
 * drawn props down the panel rather than a colour wash.
 */
function SideArt({ flip = false }: { flip?: boolean }) {
  return (
    <div
      aria-hidden
      className="hidden lg:flex w-20 shrink-0 flex-col items-center gap-7 py-8 overflow-hidden"
      style={{
        borderRadius: R.panel,
        background: INK.black,
        boxShadow: `inset 0 0 0 3px ${INK.yellow}, inset 0 0 0 6px ${INK.black}, inset 0 0 0 9px ${INK.red}`,
        transform: flip ? "scaleX(-1)" : undefined,
      }}
    >
      <SpeedStripes className="w-full" height={5} />
      <Shaker size={44} tilt={-8} />
      <Cherries size={36} />
      <Bottle size={44} body={INK.green} device={INK.red} />
      <CitrusWheel size={32} />
      <Jigger size={34} />
      <Lemon size={30} />
      <Bottle size={44} body={INK.amber} device={INK.green} />
      <CitrusWheel size={32} peel={INK.orange} flesh="#FFB74D" />
      <Martini size={38} />
      <BarSpoon size={40} />
      <SpeedStripes className="w-full mt-auto" height={5} />
    </div>
  );
}

