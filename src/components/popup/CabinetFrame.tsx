// ─── Cabinet frame ───────────────────────────────────────────────────────────
//
// Puts the pop-up inside an upright cabinet: lit marquee across the top, art
// panels down both sides, and a control panel underneath. The proportions come
// from an early-80s upright — a deep marquee, narrow side panels, and a metal
// control deck with the instruction card sitting on it.
//
// Everything is drawn: borders and bezels in CSS, characters as SVG from the
// game's own sprites (see CabinetArt.tsx). No image assets.
//
// The side panels are desktop-only on purpose. A real cabinet's side art is
// never in your eyeline while you play, and on a phone those columns would eat
// a third of the width the cocktails need.

import { BartenderArt, BottleRow, SpriteArt } from "./CabinetArt";
import { GUEST, ROLLING_BOTTLE, BOTTLE_COLORS, TIN, TIN_COLORS } from "./CabinetArt";
import { BARTENDER_COLORS } from "./games/sprites";

const TRIM = "#100810";

export default function CabinetFrame({
  title,
  children,
  panel,
}: {
  /** Title block, sat inside the lit marquee. */
  title: React.ReactNode;
  /** The screen — whatever the pop-up is actually showing. */
  children: React.ReactNode;
  /** Instruction card and the like, on the control deck. */
  panel?: React.ReactNode;
}) {
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {/* ── Marquee ─────────────────────────────────────────────────────── */}
      <div
        className="relative border-[4px] sm:border-[5px]"
        style={{ borderColor: TRIM, boxShadow: "0 8px 0 rgba(0,0,0,0.55)" }}
      >
        {/* Backlit bezel */}
        <div
          className="relative overflow-hidden px-3 py-6 sm:px-8 sm:py-9"
          style={{ background: "linear-gradient(180deg, #2A1458 0%, #150A33 60%, #0C0620 100%)" }}
        >
          <Starburst />

          <div className="relative flex items-center justify-center gap-2 sm:gap-8">
            <MarqueeArt />
            <div className="min-w-0 flex-1 text-center">{title}</div>
            <MarqueeArt flip />
          </div>

          <BottleRow count={7} px={3} className="relative mt-5 justify-center opacity-90" />
        </div>

        {/* Tube lighting along the bottom edge of the marquee */}
        <div
          aria-hidden
          className="h-[3px] w-full"
          style={{ background: "linear-gradient(90deg,#FFD500,#FF7B00,#E42B20,#8828C8,#3CE0E0)" }}
        />
      </div>

      {/* ── Body: side art either side of the screen ────────────────────── */}
      <div
        className="flex border-x-[4px] sm:border-x-[5px]"
        style={{ borderColor: TRIM, background: "#05030F" }}
      >
        <SideArt />
        <div className="min-w-0 flex-1 px-3 py-8 sm:px-6 sm:py-12">{children}</div>
        <SideArt flip />
      </div>

      {/* ── Control panel ───────────────────────────────────────────────── */}
      <div
        className="border-[4px] sm:border-[5px]"
        style={{ borderColor: TRIM, boxShadow: "0 8px 0 rgba(0,0,0,0.55)" }}
      >
        <div
          className="px-3 py-4 sm:px-6 sm:py-5"
          style={{
            background:
              "linear-gradient(180deg, #C8C8D0 0%, #9A9AA6 45%, #7A7A88 55%, #5A5A66 100%)",
          }}
        >
          <div className="flex items-center justify-center gap-4 sm:gap-7">
            <Buttons />
            <div className="min-w-0 flex-1 flex justify-center">{panel}</div>
            <Buttons flip />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Characters flanking the title. Hidden on the narrowest screens. */
function MarqueeArt({ flip = false }: { flip?: boolean }) {
  return (
    <div
      aria-hidden
      className="hidden sm:flex shrink-0 items-end gap-2"
      style={{ transform: flip ? "scaleX(-1)" : undefined }}
    >
      <BartenderArt px={3} mood={flip ? "ok" : "happy"} />
      <SpriteArt sprite={GUEST} colors={BARTENDER_COLORS} px={3} className="mb-1" />
    </div>
  );
}

/**
 * Side art. A real cabinet's is one bold silhouette running the height of the
 * panel, so this is a colour field with characters down it rather than a
 * scatter of little pictures.
 */
function SideArt({ flip = false }: { flip?: boolean }) {
  return (
    <div
      aria-hidden
      className="hidden lg:flex w-16 shrink-0 flex-col items-center gap-8 py-10"
      style={{
        background:
          "linear-gradient(180deg, #E42B20 0%, #FF7B00 22%, #8828C8 55%, #2038EC 80%, #0C0620 100%)",
        transform: flip ? "scaleX(-1)" : undefined,
      }}
    >
      <SpriteArt sprite={TIN} colors={TIN_COLORS} px={3} />
      <BartenderArt px={2} mood="ok" holdingTin={false} />
      <SpriteArt sprite={ROLLING_BOTTLE} colors={BOTTLE_COLORS} px={3} />
      <SpriteArt sprite={GUEST} colors={BARTENDER_COLORS} px={2} />
      <SpriteArt sprite={TIN} colors={TIN_COLORS} px={2} />
    </div>
  );
}

/** Two buttons on the deck. Decoration — the games are played on the screen. */
function Buttons({ flip = false }: { flip?: boolean }) {
  return (
    <div
      aria-hidden
      className="hidden sm:flex shrink-0 items-center gap-2.5"
      style={{ transform: flip ? "scaleX(-1)" : undefined }}
    >
      {["#E42B20", "#FFD500"].map((c) => (
        <span
          key={c}
          className="block w-6 h-6 rounded-full border-2"
          style={{
            background: `radial-gradient(circle at 35% 30%, #FFFFFF 0%, ${c} 45%, ${c} 100%)`,
            borderColor: TRIM,
            boxShadow: "0 2px 0 rgba(0,0,0,0.45)",
          }}
        />
      ))}
    </div>
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
