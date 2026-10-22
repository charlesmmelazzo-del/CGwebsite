"use client";

// ─── A playing card in the pop-up's own hand ─────────────────────────────────
//
// Cream stock, a pen-drawn border, hand-lettered rank and suit — the same
// handwriting as the rest of the pop-up. Art slot: drop finished card faces
// into CARD_ART (see the design prompt) and they replace the drawn ones.

import { isRed, rankOf, suitOf, SUIT_NAMES, SUIT_SYMBOLS } from "@/lib/holidays/cards";
import { COLORS, handFont, sketchPath } from "./ui";

/**
 * Finished card art, keyed "AS", "10H", … plus "back". Null = draw the cards.
 * e.g. (c) => `/popup/holidays/cards/${c}.png`
 */
export const CARD_ART: ((card: string) => string) | null = null;

const RANK_WORDS: Record<string, string> = { A: "Ace", J: "Jack", Q: "Queen", K: "King" };

export function cardName(card: string) {
  return `${RANK_WORDS[rankOf(card)] ?? rankOf(card)} of ${SUIT_NAMES[suitOf(card)]}`;
}

export default function PlayingCard({
  card,
  width = 64,
  faceDown,
  dim,
  lifted,
  seed = 1,
}: {
  /** null with faceDown shows a back. */
  card: string | null;
  width?: number;
  faceDown?: boolean;
  dim?: boolean;
  lifted?: boolean;
  seed?: number;
}) {
  const w = width;
  const h = Math.round(width * 1.4);
  const back = faceDown || !card;

  if (CARD_ART) {
    // eslint-disable-next-line @next/next/no-img-element -- static card art
    return <img src={CARD_ART(back ? "back" : card!)} alt={back ? "Face-down card" : cardName(card!)} width={w} height={h} className={`${dim ? "opacity-45" : ""}`} />;
  }

  const ink = !back && isRed(card!) ? COLORS.cardRed : COLORS.cardInk;
  return (
    <div
      role="img"
      aria-label={back ? "Face-down card" : cardName(card!)}
      className={`relative shrink-0 transition-transform duration-150 ${lifted ? "-translate-y-3" : ""} ${dim ? "opacity-45" : ""}`}
      style={{ width: w, height: h }}
    >
      <svg width={w} height={h} className="absolute inset-0 overflow-visible" aria-hidden>
        <path d={sketchPath(w, h, seed)} fill={back ? COLORS.paperDark : COLORS.cardFace} stroke={back ? COLORS.inkSoft : COLORS.cardInk} strokeWidth={1.6} strokeLinejoin="round" />
        {back && (
          <>
            <path d={sketchPath(w - 12, h - 12, seed + 4)} transform="translate(6 6)" fill="none" stroke={COLORS.inkFaint} strokeWidth={1.2} />
            <path
              transform={`translate(${w / 2 - w * 0.18} ${h / 2 - w * 0.18}) scale(${(w * 0.36) / 24})`}
              d="M12 2.2l2.6 6.4 6.9.5-5.3 4.4 1.7 6.7L12 16.5l-5.9 3.7 1.7-6.7L2.5 9.1l6.9-.5z"
              fill={COLORS.star}
            />
          </>
        )}
      </svg>
      {!back && (
        <div className={`${handFont.className} absolute inset-0 font-bold`} style={{ color: ink }}>
          <span className="absolute left-[9%] top-[3%] leading-none text-center" style={{ fontSize: w * 0.34 }}>
            {rankOf(card!)}
            <span className="block" style={{ fontSize: w * 0.24 }}>{SUIT_SYMBOLS[suitOf(card!)]}</span>
          </span>
          <span className="absolute inset-0 flex items-center justify-center leading-none" style={{ fontSize: w * 0.62 }}>
            {SUIT_SYMBOLS[suitOf(card!)]}
          </span>
          <span className="absolute right-[9%] bottom-[3%] leading-none text-center rotate-180" style={{ fontSize: w * 0.34 }}>
            {rankOf(card!)}
            <span className="block" style={{ fontSize: w * 0.24 }}>{SUIT_SYMBOLS[suitOf(card!)]}</span>
          </span>
        </div>
      )}
    </div>
  );
}
