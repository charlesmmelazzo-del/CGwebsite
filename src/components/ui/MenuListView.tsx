"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Heart, Layers } from "lucide-react";
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
  onOpenFavorites: () => void;
  onToggleSwipeView: () => void;
}

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
            "px-3 py-2 text-xs tracking-widest uppercase whitespace-nowrap transition-all duration-200 border-b-2",
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

function SectionDivider({ label, mutedColor }: { label: string; mutedColor: string }) {
  return (
    <div className="flex items-center gap-3 py-2 px-4">
      <div className="flex-1 h-px" style={{ backgroundColor: `${mutedColor}30` }} />
      <p
        className="tracking-[0.25em] uppercase shrink-0 text-[10px]"
        style={{ fontFamily: "var(--font-display)", color: mutedColor, opacity: 0.7 }}
      >
        {label}
      </p>
      <div className="flex-1 h-px" style={{ backgroundColor: `${mutedColor}30` }} />
    </div>
  );
}

function ListItem({
  item,
  isFavorited,
  onToggleFavorite,
  onTap,
  textColor,
  mutedColor,
  bgColor,
}: {
  item: MenuItem;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onTap: () => void;
  textColor: string;
  mutedColor: string;
  bgColor: string;
}) {
  const imgSrc = item.carouselImageUrl ?? item.imageUrl;
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 active:opacity-70 transition-opacity cursor-pointer"
      style={{ borderBottom: `1px solid ${textColor}10`, backgroundColor: bgColor }}
      onClick={onTap}
    >
      {/* Thumbnail */}
      <div className="relative shrink-0 w-[60px] h-[60px] rounded-md overflow-hidden" style={{ backgroundColor: `${textColor}10` }}>
        {imgSrc ? (
          <Image src={imgSrc} alt={item.alt ?? item.title} fill className="object-cover rounded-md" sizes="60px" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="opacity-20 text-lg" style={{ fontFamily: "var(--font-display)", color: textColor }}>CG</span>
          </div>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <h3
          className="text-sm tracking-wider leading-tight line-clamp-1"
          style={{ fontFamily: "var(--font-display)", color: item.titleColor ?? textColor }}
        >
          {item.title}
        </h3>
        {item.price && (
          <p className="text-xs mt-0.5" style={{ color: item.priceColor ?? "#C97D5A" }}>
            {item.price}
          </p>
        )}
        {item.description && (
          <p className="text-[11px] mt-0.5 line-clamp-2 leading-snug" style={{ color: mutedColor, opacity: 0.8 }}>
            {item.description}
          </p>
        )}
      </div>

      {/* Heart */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
        className="shrink-0 w-8 h-8 flex items-center justify-center"
        aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
      >
        <Heart
          size={18}
          fill={isFavorited ? "#C97D5A" : "none"}
          stroke={isFavorited ? "#C97D5A" : mutedColor}
        />
      </button>
    </div>
  );
}

export default function MenuListView({
  items,
  tabs,
  textColor,
  mutedColor,
  bgColor,
  favorites,
  onToggleFavorite,
  onOpenFavorites,
  onToggleSwipeView,
}: Props) {
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id ?? "");
  const [enlargedItem, setEnlargedItem] = useState<MenuItem | null>(null);

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

  // Filter sections by active tab — if we want to show only the active tab
  const visibleSections = sections.filter((s) => s.tab.id === activeTabId);

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabClick={setActiveTabId}
        textColor={textColor}
      />

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto">
        {visibleSections.map(({ tab, items: tabItems }) => (
          <div key={tab.id}>
            <SectionDivider label={tab.label} mutedColor={mutedColor} />
            {tabItems.map((item) => (
              <ListItem
                key={item.id}
                item={item}
                isFavorited={favorites.includes(item.id)}
                onToggleFavorite={() => onToggleFavorite(item.id)}
                onTap={() => setEnlargedItem(item)}
                textColor={textColor}
                mutedColor={mutedColor}
                bgColor={bgColor}
              />
            ))}
          </div>
        ))}
        {visibleSections.length === 0 && (
          <div
            className="flex items-center justify-center h-32 text-xs tracking-widest uppercase opacity-40"
            style={{ color: textColor }}
          >
            No items
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div
        className="shrink-0 flex items-center justify-between px-5 py-3"
        style={{ borderTop: `1px solid ${textColor}15`, backgroundColor: bgColor }}
      >
        <button
          onClick={onToggleSwipeView}
          className="flex items-center gap-2 text-xs tracking-widest uppercase opacity-70 hover:opacity-100 transition-opacity"
          style={{ color: textColor }}
        >
          <Layers size={15} />
          Swipe Mode
        </button>
        {favorites.length > 0 && (
          <button
            onClick={onOpenFavorites}
            className="flex items-center gap-1.5 text-xs tracking-widest uppercase"
            style={{ color: "#C97D5A" }}
          >
            <Heart size={13} fill="#C97D5A" />
            {favorites.length} {favorites.length === 1 ? "Favorite" : "Favorites"}
          </button>
        )}
      </div>

      {/* Enlarged overlay */}
      {enlargedItem && (
        <EnlargedTileOverlay
          item={enlargedItem}
          onClose={() => setEnlargedItem(null)}
          textColor={textColor}
          mutedColor={mutedColor}
          bgColor={bgColor}
        />
      )}
    </div>
  );
}
