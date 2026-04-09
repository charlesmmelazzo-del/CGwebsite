"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
import type { MenuItem, MenuTab } from "@/types";
import Image from "next/image";
import clsx from "clsx";

interface Props {
  items: MenuItem[];
  tabs?: MenuTab[];
  textColor: string;
  mutedColor: string;
}

// ─── Slide data (items + section dividers) ────────────────────────────────────
type Slide =
  | { kind: "item";    item: MenuItem; tabId: string }
  | { kind: "divider"; tabId: string;  label: string };

function buildSlides(items: MenuItem[], tabs: MenuTab[]): {
  slides: Slide[];
  sectionIndices: Record<string, number>;
} {
  const slides: Slide[] = [];
  const sectionIndices: Record<string, number> = {};
  let first = true;

  for (const tab of tabs) {
    const tabItems = items.filter((i) => i.tabId === tab.id);
    if (tabItems.length === 0) continue;

    if (!first) {
      // Divider marks the start of each section after the first
      sectionIndices[tab.id] = slides.length;
      slides.push({ kind: "divider", tabId: tab.id, label: tab.label });
    } else {
      sectionIndices[tab.id] = 0;
      first = false;
    }

    for (const item of tabItems) {
      slides.push({ kind: "item", item, tabId: tab.id });
    }
  }

  return { slides, sectionIndices };
}

function getTabIdForIndex(
  index: number,
  sectionIndices: Record<string, number>,
  tabs: MenuTab[]
): string {
  let current = tabs[0]?.id ?? "";
  for (const tab of tabs) {
    const start = sectionIndices[tab.id];
    if (start !== undefined && index >= start) current = tab.id;
  }
  return current;
}

// ─── Returns true if the item has any back-of-card content ───────────────────
function hasBackContent(item: MenuItem): boolean {
  return !!(item.tagLine || item.ingredients || item.tastingNotes || item.notableNotes);
}

// ─── Flip Card ────────────────────────────────────────────────────────────────
function FlipCard({
  item,
  isFlipped,
  onFlip,
  textColor,
  mutedColor,
}: {
  item: MenuItem;
  isFlipped: boolean;
  onFlip: () => void;
  textColor: string;
  mutedColor: string;
}) {
  const canFlip = hasBackContent(item);
  const imgSrc = item.carouselImageUrl ?? item.imageUrl;

  const backLines = [
    item.tagLine,
    item.ingredients,
    item.tastingNotes,
    item.notableNotes,
  ].filter(Boolean) as string[];

  function handleKeyDown(e: React.KeyboardEvent) {
    if (canFlip && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onFlip();
    }
  }

  return (
    <div className="relative w-full menu-card" style={{ perspective: "1200px" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transition: "transform 0.55s cubic-bezier(0.4, 0.2, 0.2, 1)",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* ── FRONT ── */}
        <div
          role="button"
          tabIndex={canFlip ? 0 : -1}
          aria-pressed={isFlipped}
          aria-label={canFlip ? `Show details for ${item.title}` : item.title}
          onKeyDown={handleKeyDown}
          onClick={canFlip ? onFlip : undefined}
          style={{
            position: "absolute", inset: 0,
            backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
            cursor: canFlip ? "pointer" : "default",
            borderRadius: "2px", overflow: "hidden",
            border: `1px solid ${textColor}20`,
          }}
        >
          {imgSrc ? (
            <div className="relative w-full h-[180px] md:h-[220px]">
              <Image src={imgSrc} alt={item.alt ?? item.title} fill className="object-cover" sizes="320px" />
              <div className="absolute inset-x-0 bottom-0 h-16" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)" }} />
            </div>
          ) : (
            <div className="w-full h-[180px] md:h-[220px] flex items-center justify-center" style={{ backgroundColor: `${textColor}12` }}>
              <span className="text-4xl opacity-20 select-none" style={{ fontFamily: "var(--font-display)", color: textColor }}>CG</span>
            </div>
          )}
          <div className="p-4">
            <h3 className="text-base tracking-wider mb-1 leading-tight" style={{ fontFamily: "var(--font-display)", color: item.titleColor ?? textColor }}>
              {item.title}
            </h3>
            {item.price && <p className="text-xs mb-1.5" style={{ color: item.priceColor ?? "#C97D5A" }}>{item.price}</p>}
            {item.description && <p className="text-xs leading-relaxed line-clamp-2" style={{ color: item.descriptionColor ?? mutedColor }}>{item.description}</p>}
            {canFlip && <p className="text-[10px] tracking-widest uppercase mt-3 opacity-40" style={{ color: textColor }}>Tap for details</p>}
          </div>
        </div>

        {/* ── BACK ── */}
        <div
          role="button"
          tabIndex={isFlipped ? 0 : -1}
          aria-pressed={isFlipped}
          aria-label={`Hide details for ${item.title}`}
          onKeyDown={handleKeyDown}
          onClick={onFlip}
          style={{
            position: "absolute", inset: 0,
            backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            cursor: "pointer", borderRadius: "2px", overflow: "hidden",
            border: `1px solid ${textColor}20`,
            backgroundColor: `${textColor}08`,
            display: "flex", flexDirection: "column",
          }}
        >
          <div className="px-5 pt-5 pb-3 shrink-0" style={{ borderBottom: `1px solid ${textColor}15` }}>
            <p className="text-base tracking-wider leading-tight" style={{ fontFamily: "var(--font-display)", color: item.titleColor ?? textColor }}>{item.title}</p>
            {item.price && <p className="text-xs mt-0.5" style={{ color: item.priceColor ?? "#C97D5A" }}>{item.price}</p>}
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {backLines.map((line, i) => (
              <p key={i} className="leading-relaxed" style={{
                color: mutedColor,
                fontSize: i === 0 ? "0.875rem" : "0.8125rem",
                opacity: i === 0 ? 1 : 0.85,
                fontStyle: i === 0 ? "italic" : "normal",
              }}>{line}</p>
            ))}
          </div>
          <div className="px-5 py-3 shrink-0" style={{ borderTop: `1px solid ${textColor}15` }}>
            <p className="text-[10px] tracking-widest uppercase opacity-30" style={{ color: textColor }}>Tap to close</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section Divider Card ─────────────────────────────────────────────────────
function DividerCard({ label, textColor, mutedColor }: { label: string; textColor: string; mutedColor: string }) {
  return (
    <div
      className="w-full menu-card flex items-center justify-center"
      style={{ border: `1px solid ${textColor}15`, borderRadius: "2px" }}
    >
      <div className="text-center px-6">
        <div className="w-8 h-px mx-auto mb-5" style={{ backgroundColor: mutedColor, opacity: 0.4 }} />
        <p
          className="tracking-widest uppercase"
          style={{ fontFamily: "var(--font-display)", color: mutedColor, fontSize: "0.75rem", letterSpacing: "0.25em", opacity: 0.7 }}
        >
          {label}
        </p>
        <div className="w-8 h-px mx-auto mt-5" style={{ backgroundColor: mutedColor, opacity: 0.4 }} />
      </div>
    </div>
  );
}

// ─── Main carousel ────────────────────────────────────────────────────────────
export default function MenuCarousel({ items, tabs = [], textColor, mutedColor }: Props) {
  const { slides, sectionIndices } = buildSlides(items, tabs);
  const loop = slides.length >= 5;
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop, align: "center", skipSnaps: false },
    [WheelGesturesPlugin()]
  );
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id ?? "");
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Update active tab + index based on scroll position
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const idx = emblaApi.selectedScrollSnap();
    setActiveTabId(getTabIdForIndex(idx, sectionIndices, tabs));
    setFlippedId(null);
  }, [emblaApi, sectionIndices, tabs]);

  // Sync custom progress bar on scroll
  const onScroll = useCallback(() => {
    if (!emblaApi || !progressRef.current) return;
    const progress = Math.max(0, Math.min(1, emblaApi.scrollProgress()));
    progressRef.current.style.transform = `scaleX(${progress})`;
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    emblaApi.on("scroll", onScroll);
    emblaApi.on("reInit", onScroll);
    onScroll(); // init
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("scroll", onScroll);
      emblaApi.off("reInit", onScroll);
    };
  }, [emblaApi, onSelect, onScroll]);

  if (!slides.length) {
    return (
      <div className="py-16 text-center opacity-40 text-sm tracking-widest uppercase">
        No items yet
      </div>
    );
  }

  function scrollToSection(tabId: string) {
    const idx = sectionIndices[tabId];
    if (idx !== undefined) emblaApi?.scrollTo(idx);
  }

  function handleFlip(id: string) {
    setFlippedId((prev) => (prev === id ? null : id));
  }

  // Tab bar — only show when there are 2+ tabs with items
  const visibleTabs = tabs.filter((t) => sectionIndices[t.id] !== undefined);

  return (
    <div className="pb-4 md:pb-0">
      {/* ── Tab bar ── */}
      {visibleTabs.length > 1 && (
        <div className="tab-bar-scroll flex justify-center gap-0 px-4 mb-6">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => scrollToSection(tab.id)}
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
      )}

      {/* ── Embla ── */}
      <div className="relative px-4">
        <div className="embla" ref={emblaRef}>
          <div className="embla__container">
            {slides.map((slide, i) => (
              <div key={i} className="embla__slide px-3" style={{ flex: "0 0 min(320px, 85vw)" }}>
                {slide.kind === "divider" ? (
                  <DividerCard label={slide.label} textColor={textColor} mutedColor={mutedColor} />
                ) : (
                  <FlipCard
                    item={slide.item}
                    isFlipped={flippedId === slide.item.id}
                    onFlip={() => handleFlip(slide.item.id)}
                    textColor={textColor}
                    mutedColor={mutedColor}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Progress bar ── */}
      {slides.length > 1 && (
        <div className="px-6 mt-5">
          <div className="relative h-[2px] rounded-full overflow-hidden" style={{ backgroundColor: `${textColor}18` }}>
            <div
              ref={progressRef}
              className="absolute inset-0 origin-left"
              style={{ backgroundColor: textColor, opacity: 0.45, transform: "scaleX(0)", transition: "transform 0.15s ease-out" }}
            />
          </div>
        </div>
      )}

      {/* ── Section dots (one per visible tab) ── */}
      {visibleTabs.length > 1 && (
        <div className="flex justify-center gap-3 mt-5">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => scrollToSection(tab.id)}
              aria-label={`Go to ${tab.label}`}
              className="flex flex-col items-center gap-1 group"
            >
              <div
                className="rounded-full transition-all duration-300"
                style={{
                  width: activeTabId === tab.id ? "16px" : "6px",
                  height: "6px",
                  backgroundColor: activeTabId === tab.id ? "#C97D5A" : textColor,
                  opacity: activeTabId === tab.id ? 1 : 0.3,
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
