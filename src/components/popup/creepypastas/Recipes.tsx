"use client";

import { useRef, useState, type CSSProperties } from "react";
import type { PopupCocktail } from "@/lib/popup/types";
import { Choice, readFont, voiceFont } from "./ui";

/** The recipe PDF the owner uploaded for a cocktail in the admin. */
export function recipePdf(c: PopupCocktail): string | null {
  const url = c.meta?.recipePdfUrl;
  return typeof url === "string" && url ? url : null;
}

/**
 * The Halloween cocktails as cards to swipe between: picture, name, tagline,
 * ingredients — all from the admin. "Give me the recipe" takes whichever card
 * is showing back to the bartender, who writes it out. The website only
 * shares recipes; it never takes an order.
 */
export default function Recipes({
  cocktails,
  startAt = 0,
  onPick,
  onBack,
}: {
  cocktails: PopupCocktail[];
  /** Open on this card (coming back for "another recipe"). */
  startAt?: number;
  onPick: (c: PopupCocktail, index: number) => void;
  onBack: () => void;
}) {
  const track = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(Math.min(startAt, Math.max(0, cocktails.length - 1)));

  const cardAt = (i: number) => track.current?.children[i] as HTMLElement | undefined;

  const go = (i: number) => cardAt(i)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });

  // Land on the starting card without an animated scroll.
  const placed = useRef(false);
  const place = (el: HTMLDivElement | null) => {
    track.current = el;
    if (!el || placed.current) return;
    placed.current = true;
    const card = el.children[index] as HTMLElement | undefined;
    if (card) el.scrollLeft = card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2;
  };

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const middle = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    Array.from(el.children).forEach((c, i) => {
      const card = c as HTMLElement;
      const d = Math.abs(card.offsetLeft + card.offsetWidth / 2 - middle);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setIndex(best);
  };

  const current = cocktails[index];

  return (
    <div className="h-full flex flex-col">
      <p className={`${voiceFont.className} shrink-0 pt-4 pb-3 text-center text-[15px] text-white/60`}>
        {cocktails.length > 1 ? "Swipe to browse our Halloween cocktails" : "Our Halloween cocktail"}
      </p>

      {cocktails.length === 0 ? (
        <p className={`${readFont.className} flex-1 px-6 text-white/70 text-center`}>
          The recipes are still being written up. Ask your bartender in the meantime.
        </p>
      ) : (
        <div
          ref={place}
          onScroll={onScroll}
          className="flex-1 min-h-0 flex gap-4 overflow-x-auto snap-x snap-mandatory px-[8vw] pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="region"
          aria-roledescription="carousel"
          aria-label="Halloween cocktails"
        >
          {cocktails.map((c, i) => (
            <section
              key={c.id}
              aria-label={`${i + 1} of ${cocktails.length}: ${c.name}`}
              aria-current={i === index ? "true" : undefined}
              className="creepy-in snap-center shrink-0 w-[84vw] max-w-[400px] border-[3px] border-white rounded-[10px] px-5 py-5 flex flex-col items-center text-center overflow-y-auto"
              style={{ "--i": i } as CSSProperties}
            >
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- pixel art, served as-is
                <img
                  src={c.imageUrl}
                  alt=""
                  className="w-[62%] max-w-[220px] aspect-square object-contain shrink-0"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : (
                <div aria-hidden className="w-[62%] max-w-[220px] aspect-square shrink-0 border-2 border-dashed border-white/25 rounded" />
              )}
              <h2 className={`${voiceFont.className} mt-4 text-[clamp(22px,6.4vw,28px)] leading-tight`}>
                {c.name || "Untitled cocktail"}
              </h2>
              {c.tagline && (
                <p className={`${readFont.className} mt-1 italic text-[16px] text-white/70`}>{c.tagline}</p>
              )}
              {c.ingredients?.trim() && (
                <div className={`${readFont.className} mt-4 text-[16px] leading-relaxed text-white/90`}>
                  <h3 className={`${voiceFont.className} text-[12px] tracking-[0.2em] uppercase text-white/50 mb-1`}>
                    Ingredients
                  </h3>
                  <p className="whitespace-pre-line">{c.ingredients}</p>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {cocktails.length > 1 && (
        <div className="shrink-0 flex items-center justify-center gap-4 pt-2">
          <button
            type="button"
            onClick={() => go(Math.max(0, index - 1))}
            disabled={index === 0}
            aria-label="Previous cocktail"
            className={`${voiceFont.className} min-w-[44px] min-h-[44px] text-[20px] disabled:opacity-25`}
          >
            ◀
          </button>
          <p className={`${voiceFont.className} text-[14px] text-white/60`} aria-live="polite">
            {index + 1} / {cocktails.length}
          </p>
          <button
            type="button"
            onClick={() => go(Math.min(cocktails.length - 1, index + 1))}
            disabled={index >= cocktails.length - 1}
            aria-label="Next cocktail"
            className={`${voiceFont.className} min-w-[44px] min-h-[44px] text-[20px] disabled:opacity-25`}
          >
            ▶
          </button>
        </div>
      )}

      <div className="shrink-0 px-4 pt-2 pb-4 grid grid-cols-2 gap-2">
        {current && (
          <div className="col-span-2">
            <Choice onClick={() => onPick(current, index)}>Give me the recipe</Choice>
          </div>
        )}
        <div className="col-span-2">
          <Choice quiet small onClick={onBack}>
            Back to the bar
          </Choice>
        </div>
      </div>
    </div>
  );
}
