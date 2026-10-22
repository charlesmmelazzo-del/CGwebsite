"use client";

import type { PopupCocktail } from "@/lib/popup/types";
import { ingredientNames } from "../creepypastas/ingredients";
import { BackLink, HandBox, HandLink, handFont, readFont, ScriptTitle, Squiggle, Write } from "./ui";

/** The recipe PDF the owner uploaded for a cocktail in the admin. */
function recipePdf(c: PopupCocktail): string | null {
  const url = c.meta?.recipePdfUrl;
  return typeof url === "string" && url ? url : null;
}

/**
 * The holiday cocktails, one card each: picture, name, tagline, ingredients,
 * and the recipe PDF the owner uploads per cocktail in the admin — the same
 * recipe download as Cocktail Creepypastas.
 */
export default function Recipes({ cocktails, onBack, onDownload }: { cocktails: PopupCocktail[]; onBack: () => void; onDownload: (c: PopupCocktail) => void }) {
  return (
    <div className="h-full overflow-y-auto px-4 pb-10">
      <div className="pt-2">
        <BackLink onClick={onBack} />
      </div>
      <ScriptTitle size="clamp(40px, 11vw, 56px)">Holiday cocktails</ScriptTitle>
      <Squiggle i={2} />
      <Write i={2} as="p" className={`${readFont.className} mt-2 text-center text-[18px] text-[#F5EFE2]/75`}>
        Take a recipe home and mix one for the family.
      </Write>

      {cocktails.length === 0 && (
        <Write i={3} as="p" className={`${readFont.className} mt-8 text-center text-[19px]`}>
          The recipes are still being written up. Ask your bartender in the meantime.
        </Write>
      )}

      <ul className="mt-5 space-y-4">
        {cocktails.map((c, n) => {
          const pdf = recipePdf(c);
          const ingredients = ingredientNames(c.ingredients);
          return (
            <li key={c.id}>
              <HandBox i={3 + n} className="px-4 py-4 text-center">
                {c.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded art
                  <img src={c.imageUrl} alt="" className="mx-auto w-[70%] max-w-[260px] aspect-square object-contain" />
                )}
                <h2 className={`${handFont.className} mt-2 text-[34px] font-bold leading-tight`}>{c.name || "Untitled cocktail"}</h2>
                {c.tagline && <p className={`${readFont.className} text-[18px] text-[#F5EFE2]/75`}>{c.tagline}</p>}
                {ingredients.length > 0 && (
                  <p className={`${readFont.className} mt-2 text-[17px] text-[#F5EFE2]/90`}>{ingredients.join(" · ")}</p>
                )}
                {pdf ? (
                  <div className="mt-3 mx-auto max-w-[280px]">
                    <HandLink primary i={4 + n} href={pdf} download onClick={() => onDownload(c)}>
                      Download the recipe
                    </HandLink>
                  </div>
                ) : (
                  <p className={`${readFont.className} mt-3 text-[15px] text-[#F5EFE2]/55`}>Recipe card coming soon.</p>
                )}
              </HandBox>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
