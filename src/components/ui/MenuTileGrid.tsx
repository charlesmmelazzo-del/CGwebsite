"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { Heart } from "lucide-react";
import type { MenuItem, MenuTab } from "@/types";
import clsx from "clsx";
import EnlargedTileOverlay from "./EnlargedTileOverlay";

interface Props {
  items: MenuItem[];
  tabs: MenuTab[];
  textColor: string;
  mutedColor: string;
  bgColor: string;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
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
  mutedColor,
  bgColor,
  isFavorited,
  onToggleFavorite,
}: {
  item: MenuItem;
  onClick: () => void;
  textColor: string;
  mutedColor: string;
  bgColor: string;
  isFavorited: boolean;
  onToggleFavorite: () => void;
}) {
  const imgSrc = item.carouselImageUrl ?? item.imageUrl;

  return (
    <button
      onClick={onClick}
      className="group relative w-full overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C97D5A] focus-visible:ring-inset active:scale-[0.97] active:brightness-90 transition-all duration-150"
      style={{ backgroundColor: bgColor }}
    >
      {/* Image area */}
      <div className="relative w-full aspect-square overflow-hidden">
        {imgSrc ? (
          <>
            <Image
              src={imgSrc}
              alt={item.alt ?? item.title}
              fill
              className="object-cover"
              sizes="33vw"
            />
            {/* Hover gradient — desktop only */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 md:group-hover:opacity-100 transition-opacity duration-200" />
          </>
        ) : (
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
        {/* Heart icon — desktop hover only */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-8 h-8 rounded-full bg-black/40 items-center justify-center hidden md:flex"
          aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart
            size={16}
            fill={isFavorited ? "#C97D5A" : "none"}
            stroke={isFavorited ? "#C97D5A" : "#fff"}
            className="drop-shadow-md"
          />
        </button>
      </div>

      {/* Caption — desktop only */}
      <div className="hidden md:block px-2 py-1.5" style={{ backgroundColor: bgColor }}>
        <h3
          className="text-[11px] tracking-wider leading-tight line-clamp-1"
          style={{ fontFamily: "var(--font-display)", color: item.titleColor ?? textColor }}
        >
          {item.title}
        </h3>
        {item.description && (
          <p className="text-[9px] leading-snug line-clamp-1 mt-0.5 opacity-60" style={{ color: mutedColor }}>
            {item.description}
          </p>
        )}
      </div>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MenuTileGrid({ items, tabs, textColor, mutedColor, bgColor, favorites, onToggleFavorite }: Props) {
  const [enlargedId, setEnlargedId] = useState<string | null>(null);
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

  const enlargedItem = enlargedId ? (items.find((i) => i.id === enlargedId) ?? null) : null;

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
                mutedColor={mutedColor}
              />
              <div className="grid grid-cols-3 gap-[3px] mb-8">
                {tabItems.map((item) => (
                  <MenuTile
                    key={item.id}
                    item={item}
                    onClick={() => setEnlargedId(item.id)}
                    textColor={textColor}
                    mutedColor={mutedColor}
                    bgColor={bgColor}
                    isFavorited={favorites.includes(item.id)}
                    onToggleFavorite={() => onToggleFavorite(item.id)}
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
          onClose={() => setEnlargedId(null)}
          textColor={textColor}
          mutedColor={mutedColor}
          bgColor={bgColor}
        />
      )}
    </div>
  );
}
