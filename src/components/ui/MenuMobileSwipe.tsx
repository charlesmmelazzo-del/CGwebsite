"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import Image from "next/image";
import { Heart, List, Undo2, ArrowRight } from "lucide-react";
import { motion, useMotionValue, useTransform, animate, type PanInfo } from "framer-motion";
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
  onToggleListView: () => void;
}

const RIGHT_REACTIONS = [
  { emoji: "🔥", text: "YES" },
  { emoji: "👍", text: "CHEERS" },
  { emoji: "😍", text: "LOVE IT" },
  { emoji: "🍸", text: "POUR IT" },
  { emoji: "⭐", text: "NICE" },
];

const LEFT_REACTIONS = [
  { emoji: "👋", text: "NEXT" },
  { emoji: "🤔", text: "MAYBE LATER" },
  { emoji: "😌", text: "SAVING ROOM" },
];

function hasBackContent(item: MenuItem): boolean {
  return !!(item.tagLine || item.ingredients || item.tastingNotes || item.notableNotes);
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

interface SwipeCardProps {
  item: MenuItem;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onSwipe: (dir: "left" | "right") => void;
  onTap: () => void;
}

function SwipeCard({ item, isFavorited, onToggleFavorite, onSwipe, onTap }: SwipeCardProps) {
  const imgSrc = item.carouselImageUrl ?? item.imageUrl;
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-12, 0, 12]);
  const rightOpacity = useTransform(x, [20, 110], [0, 1], { clamp: true });
  const leftOpacity = useTransform(x, [-110, -20], [1, 0], { clamp: true });
  const dragRef = useRef(false);

  const [rightReaction] = useState(
    () => RIGHT_REACTIONS[Math.floor(Math.random() * RIGHT_REACTIONS.length)]
  );
  const [leftReaction] = useState(
    () => LEFT_REACTIONS[Math.floor(Math.random() * LEFT_REACTIONS.length)]
  );

  function handleDrag(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (Math.abs(info.offset.x) > 6) dragRef.current = true;
  }

  function handleDragEnd(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const threshold = 90;
    if (Math.abs(info.offset.x) > threshold) {
      const dir = info.offset.x > 0 ? "right" : "left";
      animate(x, dir === "right" ? 500 : -500, { duration: 0.35, ease: "easeOut" }).then(() => {
        onSwipe(dir);
      });
    } else {
      animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
    }
    setTimeout(() => { dragRef.current = false; }, 0);
  }

  function handleClick() {
    if (!dragRef.current) onTap();
  }

  return (
    <motion.div
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.85}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      className="absolute inset-0 rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing"
    >
      {imgSrc ? (
        <Image
          src={imgSrc}
          alt={item.alt ?? item.title}
          fill
          className="object-cover pointer-events-none"
          sizes="100vw"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "#2a2a2a" }}>
          <span className="select-none opacity-20 text-6xl" style={{ fontFamily: "var(--font-display)", color: "#fff" }}>
            CG
          </span>
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

      {/* Right reaction stamp */}
      <motion.div style={{ opacity: rightOpacity }} className="absolute top-8 left-6 z-20 pointer-events-none">
        <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border-2 border-green-400" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <span className="text-2xl">{rightReaction.emoji}</span>
          <span className="text-xs font-bold tracking-widest text-green-400">{rightReaction.text}</span>
        </div>
      </motion.div>

      {/* Left reaction stamp */}
      <motion.div style={{ opacity: leftOpacity }} className="absolute top-8 right-6 z-20 pointer-events-none">
        <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border-2 border-amber-400" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <span className="text-2xl">{leftReaction.emoji}</span>
          <span className="text-xs font-bold tracking-widest text-amber-400">{leftReaction.text}</span>
        </div>
      </motion.div>

      {/* Info panel */}
      <div className="absolute inset-x-0 bottom-0 p-5 pointer-events-none">
        <div className="flex items-end justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl tracking-wider leading-tight text-white" style={{ fontFamily: "var(--font-display)" }}>
              {item.title}
            </h2>
            {item.price && <p className="text-sm mt-1" style={{ color: "#C97D5A" }}>{item.price}</p>}
            {item.description && (
              <p className="text-sm mt-1 leading-relaxed line-clamp-2" style={{ color: "rgba(255,255,255,0.75)" }}>
                {item.description}
              </p>
            )}
            {hasBackContent(item) && (
              <p className="text-[10px] tracking-widest uppercase mt-2 opacity-50 text-white">Tap card for details</p>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            className="pointer-events-auto shrink-0 w-11 h-11 rounded-full bg-black/40 flex items-center justify-center mb-1"
            aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart size={22} fill={isFavorited ? "#C97D5A" : "none"} stroke={isFavorited ? "#C97D5A" : "#fff"} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function MenuMobileSwipe({
  items,
  tabs,
  textColor,
  mutedColor,
  bgColor,
  favorites,
  onToggleFavorite,
  onOpenFavorites,
  onToggleListView,
}: Props) {
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id ?? "");
  const [globalIndex, setGlobalIndex] = useState(0);
  const [enlargedItem, setEnlargedItem] = useState<MenuItem | null>(null);
  const [enlargedStartFlipped, setEnlargedStartFlipped] = useState(false);

  // Flat list of ALL items across all tabs in tab order
  const allItems = useMemo(() => {
    return tabs.flatMap((tab) =>
      items.filter((i) => i.tabId === tab.id).sort((a, b) => a.order - b.order)
    );
  }, [items, tabs]);

  // Where each section starts in the flat list
  const sectionBreakpoints = useMemo(() => {
    const breakpoints: { tabId: string; startIndex: number; count: number }[] = [];
    let offset = 0;
    for (const tab of tabs) {
      const count = items.filter((i) => i.tabId === tab.id).length;
      if (count > 0) {
        breakpoints.push({ tabId: tab.id, startIndex: offset, count });
        offset += count;
      }
    }
    return breakpoints;
  }, [items, tabs]);

  function getTabForIndex(index: number): string {
    for (let i = sectionBreakpoints.length - 1; i >= 0; i--) {
      if (index >= sectionBreakpoints[i].startIndex) return sectionBreakpoints[i].tabId;
    }
    return tabs[0]?.id ?? "";
  }

  function getSectionProgress(index: number): { current: number; total: number; label: string } {
    for (const bp of sectionBreakpoints) {
      if (index >= bp.startIndex && index < bp.startIndex + bp.count) {
        const tab = tabs.find((t) => t.id === bp.tabId);
        return { current: index - bp.startIndex + 1, total: bp.count, label: tab?.label ?? "" };
      }
    }
    return { current: 0, total: 0, label: "" };
  }

  // Wrap around for infinite looping
  const wrappedIndex = allItems.length > 0 ? globalIndex % allItems.length : 0;
  const currentItem = allItems[wrappedIndex] ?? null;
  const isFavorited = currentItem ? favorites.includes(currentItem.id) : false;
  const progress = getSectionProgress(wrappedIndex);

  // Preview cards — next 2 in the flat list, wrapping
  const nextItems = [1, 2]
    .map((offset) => allItems[(wrappedIndex + offset) % allItems.length])
    .filter(Boolean) as MenuItem[];

  // Keep tab bar in sync as user swipes into new sections
  useEffect(() => {
    if (allItems.length > 0) setActiveTabId(getTabForIndex(wrappedIndex));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrappedIndex, allItems.length]);

  function handleTabClick(tabId: string) {
    const bp = sectionBreakpoints.find((b) => b.tabId === tabId);
    if (bp) setGlobalIndex(bp.startIndex);
    setActiveTabId(tabId);
  }

  function handleSwipe(_d: "left" | "right") {
    void _d;
    setGlobalIndex((prev) => prev + 1);
  }

  function handleNext() {
    setGlobalIndex((prev) => prev + 1);
  }

  function handlePrev() {
    setGlobalIndex((prev) => Math.max(0, prev - 1));
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <TabBar tabs={tabs} activeTabId={activeTabId} onTabClick={handleTabClick} textColor={textColor} />

      {/* Card area — tighter padding to maximise card height */}
      <div className="flex-1 relative px-4 py-2">
        {/* Stacked preview cards behind the active card */}
        {nextItems.slice(0, 2).map((nextItem, i) => (
          <div
            key={nextItem.id}
            className="absolute inset-x-4 inset-y-2 rounded-2xl overflow-hidden pointer-events-none"
            style={{
              transform: `scale(${1 - (i + 1) * 0.04}) translateY(${(i + 1) * -10}px)`,
              opacity: 1 - (i + 1) * 0.15,
              zIndex: -(i + 1),
            }}
          >
            {(nextItem.carouselImageUrl ?? nextItem.imageUrl) ? (
              <Image
                src={(nextItem.carouselImageUrl ?? nextItem.imageUrl) as string}
                alt={nextItem.alt ?? nextItem.title}
                fill
                className="object-cover"
                sizes="100vw"
              />
            ) : (
              <div className="absolute inset-0" style={{ backgroundColor: "#2a2a2a" }} />
            )}
          </div>
        ))}

        {/* Active swipe card */}
        {currentItem && (
          <SwipeCard
            key={`${currentItem.id}-${wrappedIndex}`}
            item={currentItem}
            isFavorited={isFavorited}
            onToggleFavorite={() => onToggleFavorite(currentItem.id)}
            onSwipe={handleSwipe}
            onTap={() => {
                setEnlargedStartFlipped(hasBackContent(currentItem));
                setEnlargedItem(currentItem);
              }}
          />
        )}
      </div>

      {/* Counter row */}
      <div className="shrink-0 py-0.5 text-center flex items-center justify-center gap-3">
        {progress.total > 0 && (
          <p className="text-[11px] tracking-widest uppercase opacity-50" style={{ color: textColor }}>
            {progress.current} of {progress.total} — {progress.label}
          </p>
        )}
        {favorites.length > 0 && (
          <button
            onClick={onOpenFavorites}
            className="flex items-center gap-1 text-[11px] tracking-widest uppercase opacity-60 hover:opacity-90 transition-opacity"
            style={{ color: "#C97D5A" }}
          >
            <Heart size={10} fill="#C97D5A" />
            {favorites.length}
          </button>
        )}
      </div>

      {/* Action bar */}
      <div className="shrink-0 flex items-center justify-center gap-4 py-2 pb-3">
        <button
          onClick={onToggleListView}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
          style={{ border: `1px solid ${textColor}30`, color: textColor }}
          aria-label="List view"
        >
          <List size={18} />
        </button>
        <button
          onClick={handlePrev}
          disabled={globalIndex === 0}
          className="w-12 h-12 rounded-full flex items-center justify-center transition-opacity disabled:opacity-30"
          style={{ border: "1px solid rgba(251,191,36,0.4)" }}
          aria-label="Previous"
        >
          <Undo2 size={20} className="text-amber-400" />
        </button>
        <button
          onClick={() => currentItem && onToggleFavorite(currentItem.id)}
          disabled={!currentItem}
          className="w-14 h-14 rounded-full flex items-center justify-center transition-opacity disabled:opacity-30"
          style={{ border: "1px solid rgba(201,125,90,0.4)" }}
          aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart size={26} fill={isFavorited ? "#C97D5A" : "none"} stroke={isFavorited ? "#C97D5A" : textColor} />
        </button>
        <button
          onClick={handleNext}
          disabled={allItems.length === 0}
          className="w-12 h-12 rounded-full flex items-center justify-center transition-opacity disabled:opacity-30"
          style={{ border: "1px solid rgba(74,222,128,0.4)" }}
          aria-label="Next"
        >
          <ArrowRight size={20} className="text-green-400" />
        </button>
      </div>

      {/* Enlarged overlay */}
      {enlargedItem && (
        <EnlargedTileOverlay
          item={enlargedItem}
          onClose={() => setEnlargedItem(null)}
          textColor={textColor}
          mutedColor={mutedColor}
          bgColor={bgColor}
          startFlipped={enlargedStartFlipped}
        />
      )}
    </div>
  );
}
