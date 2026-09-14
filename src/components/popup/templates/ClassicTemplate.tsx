"use client";

import Image from "next/image";
import type { PopupTemplateProps } from "@/lib/popup/types";

/**
 * The baseline pop-up experience: a card grid of the menu.
 *
 * Deliberately plain. It exists so the platform works end to end and so there
 * is always something safe to fall back to — the distinctive pop-up designs
 * (trivia, mini games) get their own templates alongside this one.
 */
export default function ClassicTemplate({
  menu,
  cocktails,
}: PopupTemplateProps) {
  const showIngredients = menu.config?.showIngredients !== false;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      <header className="text-center mb-10 sm:mb-14">
        {menu.coverImageUrl && (
          <div className="relative w-full h-44 sm:h-64 mb-8 rounded-xl overflow-hidden">
            <Image
              src={menu.coverImageUrl}
              alt=""
              fill
              unoptimized
              className="object-cover"
              priority
            />
          </div>
        )}
        <h1
          style={{ fontFamily: "var(--font-display, serif)" }}
          className="text-3xl sm:text-5xl text-white tracking-wide"
        >
          {menu.title}
        </h1>
        {menu.subtitle && (
          <p className="mt-3 text-[11px] sm:text-xs tracking-[0.25em] uppercase text-white/50">
            {menu.subtitle}
          </p>
        )}
        {menu.description && (
          <p className="mt-5 max-w-xl mx-auto text-sm text-white/60 leading-relaxed">
            {menu.description}
          </p>
        )}
      </header>

      {/* ── Cocktails ────────────────────────────────────────────────────── */}
      {cocktails.length === 0 ? (
        <p className="text-center text-sm text-white/40 py-16">
          This pop-up doesn&apos;t have any cocktails on it yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cocktails.map((c) => (
            <article
              key={c.id}
              className="flex flex-col rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden"
            >
              {c.imageUrl && (
                <div className="relative w-full aspect-[4/3]">
                  <Image src={c.imageUrl} alt={c.name} fill unoptimized className="object-cover" />
                </div>
              )}

              <div className="flex-1 p-5">
                <h3
                  style={{ fontFamily: "var(--font-display, serif)" }}
                  className="text-xl text-white"
                >
                  {c.name}
                </h3>
                {c.tagline && (
                  <p className="mt-1 text-[10px] tracking-[0.2em] uppercase text-white/40">
                    {c.tagline}
                  </p>
                )}
                {c.description && (
                  <p className="mt-3 text-sm text-white/60 leading-relaxed">{c.description}</p>
                )}
                {showIngredients && c.ingredients && (
                  <p className="mt-3 text-xs text-white/40 leading-relaxed italic">
                    {c.ingredients}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
