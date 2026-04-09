"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import type { MenuItem, MenuTab } from "@/types";
import clsx from "clsx";

interface Props {
  items: MenuItem[];
  tabs: MenuTab[];
  textColor: string;
  mutedColor: string;
  bgColor: string;
}

function hasBackContent(item: MenuItem): boolean {
  return !!(item.tagLine || item.ingredients || item.tastingNotes || item.notableNotes);
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────
function TabBar({
  tabs,
  activeTabId,
  onTabClick,
  textColor,
}: {
  tabs: MenuTab[];
  activeTabId: string;
  onTabClick: (id: string) => void;
  textColor: string;
}) {
  return (
    <div
      className="shrink-0 tab-bar-scroll flex justify-center gap-0 px-3 py-0.5"
      style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabClick(tab.id)}
          className={clsx(
            "px-3 md:px-4 py-2 text-xs tracking-widest uppercase whitespace-nowrap transition-all duration-200 border-b-2",
            activeTabId === tab.id
              ? "border-[#C97D5A] text-[#C97D5A]"
              : "border-transparent opacity-60 hover:opacity-90"
          )}
          style={{ color: activeTabId === tab.id ? "#C97D5A" : textColor }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({
  id,
  label,
  mutedColor,
}: {
  id: string;
  label: string;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <div
      id={id}
      className="flex items-center gap-3 py-3 px-3"
      style={{ scrollMarginTop: "12px" }}
    >
      <div className="flex-1 h-px" style={{ backgroundColor: `${mutedColor}30` }} />
      <p
        className="tracking-[0.25em] uppercase shrink-0 text-xs"
        style={{ fontFamily: "var(--font-display)", color: mutedColor, opacity: 0.7 }}
      >
        {label}
      </p>
      <div className="flex-1 h-px" style={{ backgroundColor: `${mutedColor}30` }} />
    </div>
  );
}

// ─── Grid Tile ────────────────────────────────────────────────────────────────
function MenuTile({
  item,
  onClick,
  textColor,
  bgColor,
}: {
  item: MenuItem;
  onClick: () => void;
  textColor: string;
  mutedColor: string;
  bgColor: string;
}) {
  const imgSrc = item.carouselImageUrl ?? item.imageUrl;

  return (
    <button
      onClick={onClick}
      className="group relative w-full aspect-square overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C97D5A] focus-visible:ring-inset active:scale-[0.97] active:brightness-90 transition-all duration-150"
      style={{ backgroundColor: bgColor }}
    >
      {imgSrc ? (
        <>
          {/* Square image — fills the entire tile */}
          <Image
            src={imgSrc}
            alt={item.alt ?? item.title}
            fill
            className="object-cover"
            sizes="33vw"
          />

          {/* Hover gradient — desktop only */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 md:group-hover:opacity-100 transition-opacity duration-200" />

          {/* Title/price overlay — fades in on desktop hover */}
          <div className="absolute inset-0 flex flex-col justify-end p-2.5 md:p-3 opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
            <h3
              className="text-xs md:text-sm tracking-wider leading-tight line-clamp-2 drop-shadow-md"
              style={{ fontFamily: "var(--font-display)", color: "#fff" }}
            >
              {item.title}
            </h3>
            {item.price && (
              <p className="text-[10px] md:text-xs mt-0.5 drop-shadow-md" style={{ color: "#C97D5A" }}>
                {item.price}
              </p>
            )}
          </div>
        </>
      ) : (
        /* No-image placeholder */
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span
            className="select-none opacity-20"
            style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: textColor }}
          >
            CG
          </span>
          <span
            className="text-[10px] tracking-wider opacity-30 line-clamp-1 px-2 text-center"
            style={{ fontFamily: "var(--font-display)", color: textColor }}
          >
            {item.title}
          </span>
        </div>
      )}
    </button>
  );
}

// ─── Enlarged Tile Overlay ────────────────────────────────────────────────────
function EnlargedTileOverlay({
  item,
  isFlipped,
  onFlip,
  onClose,
  textColor,
  mutedColor,
  bgColor,
}: {
  item: MenuItem;
  isFlipped: boolean;
  onFlip: () => void;
  onClose: () => void;
  textColor: string;
  mutedColor: string;
  bgColor: string;
}) {
  const canFlip = hasBackContent(item);
  const imgSrc = item.carouselImageUrl ?? item.imageUrl;

  const backLines = [
    item.tagLine,
    item.ingredients,
    item.tastingNotes,
    item.notableNotes,
  ].filter(Boolean) as string[];

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 animate-fade-in" onClick={onClose} />

      {/* Centered card */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
        <div
          className="pointer-events-auto relative w-full"
          style={{ maxWidth: "420px", perspective: "1200px" }}
        >
          {/* ✕ button */}
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            aria-label="Close"
          >
            <X size={14} />
          </button>

          {/* Flip container */}
          <div
            style={{
              transformStyle: "preserve-3d",
              transition: "transform 0.55s cubic-bezier(0.4, 0.2, 0.2, 1)",
              transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
              position: "relative",
            }}
          >
            {/* ── FRONT ── */}
            <div
              onClick={canFlip ? onFlip : undefined}
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                cursor: canFlip ? "pointer" : "default",
                borderRadius: "2px",
                overflow: "hidden",
                border: `1px solid ${textColor}20`,
                backgroundColor: bgColor,
              }}
            >
              {/* Large image */}
              <div className="relative w-full h-[260px] md:h-[320px]">
                {imgSrc ? (
                  <>
                    <Image
                      src={imgSrc}
                      alt={item.alt ?? item.title}
                      fill
                      className="object-cover"
                      sizes="420px"
                    />
                    <div
                      className="absolute inset-x-0 bottom-0 h-16"
                      style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)" }}
                    />
                  </>
                ) : (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ backgroundColor: `${textColor}0f` }}
                  >
                    <span
                      className="select-none opacity-20"
                      style={{ fontFamily: "var(--font-display)", fontSize: "3rem", color: textColor }}
                    >
                      CG
                    </span>
                  </div>
                )}
              </div>

              {/* Front text */}
              <div className="p-5" style={{ backgroundColor: bgColor }}>
                <h2
                  className="text-xl md:text-2xl tracking-wider leading-tight mb-2"
                  style={{ fontFamily: "var(--font-display)", color: item.titleColor ?? textColor }}
                >
                  {item.title}
                </h2>
                {item.price && (
                  <p className="text-sm mb-2" style={{ color: item.priceColor ?? "#C97D5A" }}>
                    {item.price}
                  </p>
                )}
                {item.description && (
                  <p className="text-sm leading-relaxed" style={{ color: item.descriptionColor ?? mutedColor }}>
                    {item.description}
                  </p>
                )}
                {canFlip && (
                  <p className="text-[10px] tracking-widest uppercase mt-4 opacity-40" style={{ color: textColor }}>
                    Tap for details
                  </p>
                )}
              </div>
            </div>

            {/* ── BACK ── */}
            <div
              onClick={onFlip}
              style={{
                position: "absolute",
                inset: 0,
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
                cursor: "pointer",
                borderRadius: "2px",
                overflow: "hidden",
                border: `1px solid ${textColor}20`,
                backgroundColor: bgColor,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Back header */}
              <div className="px-5 pt-5 pb-4 shrink-0" style={{ borderBottom: `1px solid ${textColor}30` }}>
                <p
                  className="text-xl tracking-wider leading-tight"
                  style={{ fontFamily: "var(--font-display)", color: item.titleColor ?? textColor }}
                >
                  {item.title}
                </p>
                {item.price && (
                  <p className="text-sm mt-0.5" style={{ color: item.priceColor ?? "#C97D5A" }}>
                    {item.price}
                  </p>
                )}
              </div>

              {/* Back content */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {backLines.map((line, i) => (
                  <p
                    key={i}
                    className="leading-relaxed"
                    style={{
                      color: mutedColor,
                      fontSize: i === 0 ? "0.875rem" : "0.8125rem",
                      opacity: i === 0 ? 1 : 0.85,
                      fontStyle: i === 0 ? "italic" : "normal",
                    }}
                  >
                    {line}
                  </p>
                ))}
              </div>

              {/* Back footer */}
              <div className="px-5 py-3 shrink-0" style={{ borderTop: `1px solid ${textColor}30` }}>
                <p className="text-[10px] tracking-widest uppercase opacity-30" style={{ color: textColor }}>
                  Tap to flip back
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MenuTileGrid({ items, tabs, textColor, mutedColor, bgColor }: Props) {
  const [enlargedId, setEnlargedId] = useState<string | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id ?? "");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Group items by tab — only tabs that have at least one item
  const sections = useMemo(
    () =>
      tabs
        .filter((tab) => items.some((i) => i.tabId === tab.id))
        .map((tab) => ({
          tab,
          items: items.filter((i) => i.tabId === tab.id).sort((a, b) => a.order - b.order),
        })),
    [tabs, items]
  );

  const enlargedItem = enlargedId ? items.find((i) => i.id === enlargedId) ?? null : null;

  // IntersectionObserver scoped to scroll container — active tab tracks scroll position
  useEffect(() => {
    if (sections.length <= 1) return;
    const root = scrollContainerRef.current;
    const observers: IntersectionObserver[] = [];
    sections.forEach(({ tab }) => {
      const el = document.getElementById(`section-${tab.id}`);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveTabId(tab.id); },
        { root, rootMargin: "-10% 0px -70% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [sections]);

  // Manual scroll — works correctly with the internal overflow-y-auto container
  function scrollToSection(tabId: string) {
    const el = document.getElementById(`section-${tabId}`);
    const container = scrollContainerRef.current;
    if (el && container) {
      const containerTop = container.getBoundingClientRect().top;
      const elTop = el.getBoundingClientRect().top;
      const offset = elTop - containerTop + container.scrollTop;
      container.scrollTo({ top: offset - 8, behavior: "smooth" });
    }
    setActiveTabId(tabId);
  }

  function enlargeTile(itemId: string) {
    setEnlargedId(itemId);
    setIsFlipped(false);
  }

  function closeTile() {
    setEnlargedId(null);
    setIsFlipped(false);
  }

  function flipTile() {
    if (!enlargedItem || !hasBackContent(enlargedItem)) return;
    setIsFlipped((prev) => !prev);
  }

  if (!sections.length) {
    return (
      <div className="flex-1 flex items-center justify-center opacity-40 text-sm tracking-widest uppercase" style={{ color: textColor }}>
        No items yet
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar — pinned at top, never scrolls */}
      {sections.length > 1 && (
        <TabBar
          tabs={sections.map((s) => s.tab)}
          activeTabId={activeTabId}
          onTabClick={scrollToSection}
          textColor={textColor}
        />
      )}

      {/* Scrollable grid */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-0 pb-8">
          {sections.map(({ tab, items: tabItems }) => (
            <div key={tab.id}>
              <SectionHeader
                id={`section-${tab.id}`}
                label={tab.label}
                textColor={textColor}
                mutedColor={mutedColor}
              />
              <div className="grid grid-cols-3 gap-[3px] mb-8">
                {tabItems.map((item) => (
                  <MenuTile
                    key={item.id}
                    item={item}
                    onClick={() => enlargeTile(item.id)}
                    textColor={textColor}
                    mutedColor={mutedColor}
                    bgColor={bgColor}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Enlarged overlay */}
      {enlargedItem && (
        <EnlargedTileOverlay
          item={enlargedItem}
          isFlipped={isFlipped}
          onFlip={flipTile}
          onClose={closeTile}
          textColor={textColor}
          mutedColor={mutedColor}
          bgColor={bgColor}
        />
      )}
    </div>
  );
}
