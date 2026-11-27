"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import Image from "next/image";
import PageThemeWrapper from "@/components/layout/PageThemeWrapper";
import type { PageHeaderData } from "@/types";
import { resolveTheme } from "@/lib/themes";
import type { ThemeName } from "@/lib/themes";
import clsx from "clsx";
import type { CoffeeMenu } from "@/lib/coffeedata";
import MenuPdfView from "@/components/ui/MenuPdfView";
import { priceLine, formatPrice, type ComposedTab } from "@/lib/coffee/live";

interface Props {
  menus: CoffeeMenu[];
  /** Coffee 01: each tab built from Toast's Coffee Shop menu (same order and ids as menus). */
  live?: ComposedTab[];
  header: PageHeaderData;
}

const ACCENT = "#C97D5A";

export default function CoffeePageClient({ menus, live = [], header }: Props) {
  const themeName: ThemeName = header.theme ?? "olive";
  const theme = resolveTheme(header);
  const [activeId, setActiveId] = useState(menus[0]?.id ?? "");
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const activeMenu = menus.find((m) => m.id === activeId);
  const activeLive = live.find((t) => t.id === activeId);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow keys move between tabs (and select them), Home / End jump to the ends: the WAI-ARIA tabs pattern.
  function onTabKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const last = menus.length - 1;
    const next = e.key === "ArrowRight" ? (i === last ? 0 : i + 1)
      : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1)
      : e.key === "Home" ? 0 : e.key === "End" ? last : -1;
    if (next < 0) return;
    e.preventDefault();
    setActiveId(menus[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    <PageThemeWrapper fixedTheme={themeName} customBg={header.customBg} customText={header.customText} customMuted={header.customMuted} showIllustration={false} bgImageUrl={header.bgImageUrl}>
      <div className="min-h-screen" style={{ color: theme.text }}>
        {/* Page title */}
        <header className="text-center pt-16 pb-6 px-6">
          {header.title && (
            <h1
              className="tracking-widest uppercase mb-2"
              style={{
                fontFamily: "var(--font-display)",
                color: theme.text,
                fontSize: `clamp(1.75rem, 7vw, ${header.titleSize}px)`,
              }}
            >
              {header.title}
            </h1>
          )}
          {header.subtitle && (
            <p
              className="leading-relaxed max-w-xl mx-auto mt-3 opacity-70"
              style={{ fontSize: `${header.subtitleSize ?? 14}px` }}
            >
              {header.subtitle}
            </p>
          )}
          <div className="w-16 h-px mx-auto mt-6" style={{ backgroundColor: theme.muted }} />
        </header>

        {/* Tabs — only show when there are multiple menus */}
        {menus.length > 1 && (
          <div
            role="tablist"
            aria-label="Coffee menus"
            className="flex gap-0 px-3 mb-6 tab-bar-scroll [&>*:first-child]:ml-auto [&>*:last-child]:mr-auto"
            style={{
              background: "rgba(0,0,0,0.15)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            {menus.map((menu, i) => (
              <button
                key={menu.id}
                ref={(el) => { tabRefs.current[i] = el; }}
                id={`coffee-tab-${menu.id}`}
                role="tab"
                type="button"
                aria-selected={activeId === menu.id}
                aria-controls="coffee-tabpanel"
                tabIndex={activeId === menu.id ? 0 : -1}
                onKeyDown={(e) => onTabKey(e, i)}
                onClick={() => setActiveId(menu.id)}
                className={clsx(
                  "px-3 sm:px-4 py-3 text-xs tracking-widest uppercase whitespace-nowrap transition-all duration-200 border-b-2 shrink-0",
                  activeId === menu.id
                    ? "border-[#C97D5A] text-[#C97D5A]"
                    : "border-transparent opacity-60 hover:opacity-90"
                )}
                style={{ color: activeId === menu.id ? "#C97D5A" : theme.text }}
              >
                {menu.label}
              </button>
            ))}
          </div>
        )}

        {/* The menu: live from Toast, else the tab's PDF or image */}
        <div
          id="coffee-tabpanel"
          role={menus.length > 1 ? "tabpanel" : undefined}
          aria-labelledby={menus.length > 1 && activeMenu ? `coffee-tab-${activeMenu.id}` : undefined}
          className={clsx("px-4 pb-16 mx-auto", activeLive?.showing === "live" || activeMenu?.pdfPages?.length ? "max-w-5xl" : "max-w-3xl")}
        >
          {activeLive?.showing === "live" ? (
            <LiveMenu key={activeLive.id} tab={activeLive} textColor={theme.text} mutedColor={theme.muted} />
          ) : activeLive?.showing === "empty" ? (
            <EmptyMenu textColor={theme.text} mutedColor={theme.muted} />
          ) : menus.length === 0 ? (
            <div
              className="w-full aspect-[8.5/11] rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: "rgba(255,255,255,0.05)",
                border: `1px dashed ${theme.muted}40`,
              }}
            >
              <p className="text-sm opacity-50 tracking-wider" style={{ color: theme.text }}>
                Coffee menu coming soon
              </p>
            </div>
          ) : activeMenu?.pdfPages?.length ? (
            <>
              <div className="hidden md:block">
                <MenuPdfView key={activeMenu.id} tab={activeMenu} textColor={theme.text} mutedColor={theme.muted} layout="spread" />
              </div>
              <div className="md:hidden -mx-4">
                <MenuPdfView key={activeMenu.id} tab={activeMenu} textColor={theme.text} mutedColor={theme.muted} layout="stack" />
              </div>
            </>
          ) : activeMenu?.imageUrl ? (
            <button
              onClick={() => setLightboxOpen(true)}
              className="w-full block relative group cursor-zoom-in"
              aria-label={`View ${activeMenu.label} full screen`}
            >
              <Image
                src={activeMenu.imageUrl}
                alt={activeMenu.alt || `${activeMenu.label} menu`}
                width={850}
                height={1100}
                className="w-full h-auto rounded-lg shadow-lg"
                sizes="(max-width: 768px) 100vw, 750px"
                priority
              />
              {/* Tap-to-zoom hint */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center pointer-events-none">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs tracking-widest uppercase bg-black/50 px-3 py-1.5 rounded-full">
                  Tap to zoom
                </span>
              </div>
            </button>
          ) : (
            <div
              className="w-full aspect-[8.5/11] rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: "rgba(255,255,255,0.05)",
                border: `1px dashed ${theme.muted}40`,
              }}
            >
              <p className="text-sm opacity-40" style={{ color: theme.text }}>
                Menu image coming soon
              </p>
            </div>
          )}
        </div>

        {/* Full-screen lightbox with native pinch-to-zoom */}
        {lightboxOpen && activeMenu?.imageUrl && (
          <Lightbox
            imageUrl={activeMenu.imageUrl}
            alt={activeMenu.alt || `${activeMenu.label} menu`}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </div>
    </PageThemeWrapper>
  );
}

/* ─── Live menu (Coffee 01) ─────────────────────────────────────────────── */

/**
 * Like the printed menu: two columns on desktop, one on phones; each section a small-caps heading with an optional
 * note line, each item its name left and price right (two decimals, no $), an italic description and an optional note.
 */
function LiveMenu({ tab, textColor, mutedColor }: { tab: ComposedTab; textColor: string; mutedColor: string }) {
  return (
    <div className="md:columns-2 md:gap-16 pt-2">
      {tab.sections.map((s) => (
        <section key={s.id} className="break-inside-avoid mb-10" aria-labelledby={`coffee-sec-${s.id}`}>
          <h2
            id={`coffee-sec-${s.id}`}
            className="text-center text-[15px] md:text-base uppercase tracking-[0.24em] leading-snug"
            style={{ fontFamily: "var(--font-display)", color: textColor }}
          >
            {s.heading}
          </h2>
          {s.note && s.note.split(/\n+/).map((line, i) => (
            <p key={i} className="text-center text-xs italic tracking-wide mt-1" style={{ color: mutedColor }}>
              {line}
            </p>
          ))}
          <div className="w-10 h-px mx-auto mt-3 mb-4" style={{ backgroundColor: `${mutedColor}80` }} />
          <ul className="space-y-3">
            {s.items.map((it) => (
              <li key={it.id}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[15px] tracking-wide" style={{ fontFamily: "var(--font-display)", color: textColor }}>
                    {it.name}
                  </span>
                  <span aria-hidden className="flex-1 border-b border-dotted translate-y-[-3px] min-w-4" style={{ borderColor: `${mutedColor}66` }} />
                  <Price prices={it.prices} mutedColor={mutedColor} />
                </div>
                {it.description && (
                  <p className="text-[13px] italic leading-snug mt-0.5 pr-14" style={{ color: mutedColor }}>{it.description}</p>
                )}
                {it.note && (
                  <p className="text-[12px] leading-snug mt-0.5 pr-14 opacity-90" style={{ color: mutedColor }}>{it.note}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Price({ prices, mutedColor }: { prices: ComposedTab["sections"][number]["items"][number]["prices"]; mutedColor: string }) {
  return (
    <span className="shrink-0 text-[15px] tabular-nums whitespace-nowrap" style={{ color: ACCENT }} aria-label={priceLine(prices)}>
      {prices.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-1 opacity-60" style={{ color: mutedColor }}>/</span>}
          {p.label && <span className="text-[11px] tracking-wider mr-1" style={{ color: mutedColor }}>{p.label}</span>}
          {formatPrice(p.price)}
        </span>
      ))}
    </span>
  );
}

function EmptyMenu({ textColor, mutedColor }: { textColor: string; mutedColor: string }) {
  return (
    <div
      className="w-full max-w-xl mx-auto rounded-lg flex items-center justify-center py-20 px-6"
      style={{ backgroundColor: "rgba(255,255,255,0.04)", border: `1px dashed ${mutedColor}66` }}
    >
      <p className="text-sm tracking-wider text-center opacity-70" style={{ color: textColor }}>
        This menu is being updated. Ask us at the counter, or check back soon.
      </p>
    </div>
  );
}

/* ─── Lightbox ─────────────────────────────────────────────────────────── */

function Lightbox({
  imageUrl,
  alt,
  onClose,
}: {
  imageUrl: string;
  alt: string;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onClick={onClose}
    >
      {/* Top bar — X button always visible */}
      <div
        className="shrink-0 flex items-center justify-end px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable + zoomable area — native pinch-to-zoom on iOS/Android */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto overscroll-contain"
        style={{
          touchAction: "pinch-zoom pan-x pan-y",
          WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-h-full flex items-center justify-center p-4">
          {/*
            Using a regular <img> here intentionally:
            - next/image constrains dimensions which fights pinch-zoom
            - The image is already loaded from the page view (no extra request)
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={alt}
            style={{
              width: "100%",
              maxWidth: "1200px",
              height: "auto",
              touchAction: "pinch-zoom",
            }}
          />
        </div>
      </div>

      {/* Bottom close bar — always visible, easy to tap after zooming */}
      <div
        className="shrink-0 flex items-center justify-center py-4"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full text-white text-xs tracking-widest uppercase transition-colors"
          style={{ backgroundColor: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
          Close
        </button>
      </div>
    </div>
  );
}
