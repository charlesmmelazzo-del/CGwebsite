"use client";

// ─── Christmas recipes ───────────────────────────────────────────────────────
// The same recipe download as Home for the Holidays and Cocktail
// Creepypastas: each cocktail's PDF is uploaded in the pop-up admin and
// stored as meta.recipePdfUrl.

import { COPY } from "@/lib/givingTree/copy";
import type { PopupCocktail } from "@/lib/popup/types";

function recipePdf(c: PopupCocktail): string | null {
  const url = c.meta?.recipePdfUrl;
  return typeof url === "string" && url ? url : null;
}

export default function Recipes({ cocktails, onBack, onDownload }: { cocktails: PopupCocktail[]; onBack: () => void; onDownload: (c: PopupCocktail) => void }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[var(--gt-sheet-max)] mx-auto px-3 py-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="gt-display text-[var(--gt-size-xl)]">{COPY.recipesTitle}</h1>
          <button type="button" className="gt-btn gt-btn-small" onClick={onBack}>
            {COPY.back}
          </button>
        </div>
        <p className="gt-muted">{COPY.recipesIntro}</p>
        {cocktails.length === 0 && <p>{COPY.recipesEmpty}</p>}
        <ul className="space-y-3">
          {cocktails.map((c) => {
            const pdf = recipePdf(c);
            return (
              <li key={c.id} className="gt-card p-4 space-y-2 text-center">
                {c.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded art
                  <img src={c.imageUrl} alt="" className="mx-auto w-2/3 max-w-[240px] aspect-square object-contain" />
                )}
                <h2 className="gt-display text-[var(--gt-size-l)]">{c.name}</h2>
                {c.tagline && <p className="gt-small gt-muted">{c.tagline}</p>}
                {pdf ? (
                  <a className="gt-btn gt-btn-primary w-full" href={pdf} download onClick={() => onDownload(c)}>
                    {COPY.recipeDownload}
                  </a>
                ) : (
                  <p className="gt-small gt-muted">{COPY.recipeSoon}</p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
