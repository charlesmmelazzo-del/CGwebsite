"use client";

import { useRef, useState } from "react";
import type { PopupCocktail } from "@/lib/popup/types";
import { Choice, readFont, SpeechBubble, voiceFont } from "./ui";

/** The recipe PDF the owner uploaded for a cocktail in the admin. */
export function recipePdf(c: PopupCocktail): string | null {
  const url = c.meta?.recipePdfUrl;
  return typeof url === "string" && url ? url : null;
}

/**
 * The four Halloween cocktails as cards to swipe between: name, description,
 * ingredients from the admin, and the recipe PDF to keep. The website only
 * shares recipes — it never takes an order.
 */
export default function Recipes({
  cocktails,
  line,
  onDownload,
  onBack,
}: {
  cocktails: PopupCocktail[];
  /** What the bartender says over the cards. */
  line: string;
  onDownload: (c: PopupCocktail) => void;
  onBack: () => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState<string | null>(null);

  const go = (i: number) => {
    const el = track.current?.children[i] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const card = el.children[0] as HTMLElement | undefined;
    if (!card) return;
    setIndex(Math.round(el.scrollLeft / (card.offsetWidth + 16)));
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-4 pb-5">
        <SpeechBubble>{saved ?? line}</SpeechBubble>
      </div>

      {cocktails.length === 0 ? (
        <p className={`${readFont.className} flex-1 px-6 text-white/70`}>
          The recipes are still being written up. Ask your bartender in the meantime.
        </p>
      ) : (
        <>
          <div
            ref={track}
            onScroll={onScroll}
            className="flex-1 min-h-0 flex gap-4 overflow-x-auto snap-x snap-mandatory px-[8vw] pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="region"
            aria-roledescription="carousel"
            aria-label="Cocktail recipes"
          >
            {cocktails.map((c, i) => {
              const pdf = recipePdf(c);
              return (
                <section
                  key={c.id}
                  aria-label={`${i + 1} of ${cocktails.length}: ${c.name}`}
                  className="snap-center shrink-0 w-[84vw] max-w-[400px] border-[3px] border-white rounded-[14px] px-5 py-5 flex flex-col overflow-y-auto"
                >
                  <h2 className={`${voiceFont.className} text-[24px] leading-tight`}>{c.name || "Untitled cocktail"}</h2>
                  {c.tagline && <p className={`${readFont.className} italic text-white/60 mt-1`}>{c.tagline}</p>}

                  <div className={`${readFont.className} mt-4 text-[16px] leading-relaxed text-white/90 space-y-4 flex-1`}>
                    {c.description?.trim() ? (
                      <p className="whitespace-pre-line">{c.description}</p>
                    ) : (
                      <p className="text-white/50 italic">Description coming soon.</p>
                    )}
                    {c.ingredients?.trim() && (
                      <div>
                        <h3 className={`${voiceFont.className} text-[13px] tracking-[0.18em] uppercase text-white/55 mb-1`}>
                          Ingredients
                        </h3>
                        <p className="whitespace-pre-line">{c.ingredients}</p>
                      </div>
                    )}
                  </div>

                  {pdf ? (
                    <a
                      href={pdf}
                      target="_blank"
                      rel="noreferrer"
                      download
                      onClick={() => {
                        onDownload(c);
                        setSaved(`Your ${c.name} recipe is on its way. On a phone it opens as a PDF: use Share to save it.`);
                      }}
                      className={`${voiceFont.className} mt-5 min-h-[48px] flex items-center justify-center rounded-[6px] bg-white text-black text-[17px]
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black`}
                    >
                      Download the recipe (PDF)
                    </a>
                  ) : (
                    <p className={`${voiceFont.className} mt-5 text-[14px] text-white/45 text-center`}>
                      Printable recipe coming soon
                    </p>
                  )}
                </section>
              );
            })}
          </div>

          {cocktails.length > 1 && (
            <div className="flex items-center justify-center gap-4 py-3">
              <button
                type="button"
                onClick={() => go(Math.max(0, index - 1))}
                disabled={index === 0}
                aria-label="Previous recipe"
                className={`${voiceFont.className} min-w-[44px] min-h-[44px] text-[20px] disabled:opacity-25`}
              >
                ◀
              </button>
              <p className={`${voiceFont.className} text-[14px] text-white/60`} aria-live="polite">
                {Math.min(index, cocktails.length - 1) + 1} / {cocktails.length}
              </p>
              <button
                type="button"
                onClick={() => go(Math.min(cocktails.length - 1, index + 1))}
                disabled={index >= cocktails.length - 1}
                aria-label="Next recipe"
                className={`${voiceFont.className} min-w-[44px] min-h-[44px] text-[20px] disabled:opacity-25`}
              >
                ▶
              </button>
            </div>
          )}
        </>
      )}

      <div className="px-4 pb-4">
        <Choice quiet onClick={onBack}>
          Back to the bar
        </Choice>
      </div>
    </div>
  );
}
