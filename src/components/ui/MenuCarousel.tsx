"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { MenuItem } from "@/types";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  items: MenuItem[];
  textColor: string;
  mutedColor: string;
}

// Returns true if the item has any back-of-card content worth showing
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

  // Back-of-card fields rendered in order, labels intentionally omitted
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
    <div
      className="relative w-full"
      style={{ height: "360px", perspective: "1200px" }}
    >
      {/* Inner — both faces live here */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transition: "transform 0.55s cubic-bezier(0.4, 0.2, 0.2, 1)",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* ── FRONT ─────────────────────────────────────────────────── */}
        <div
          role="button"
          tabIndex={canFlip ? 0 : -1}
          aria-pressed={isFlipped}
          aria-label={canFlip ? `Show details for ${item.title}` : item.title}
          onKeyDown={handleKeyDown}
          onClick={canFlip ? onFlip : undefined}
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            cursor: canFlip ? "pointer" : "default",
            borderRadius: "2px",
            overflow: "hidden",
            border: `1px solid ${textColor}20`,
          }}
        >
          {/* Photo or text placeholder */}
          {imgSrc ? (
            <div className="relative w-full h-[220px]">
              <Image
                src={imgSrc}
                alt={item.alt ?? item.title}
                fill
                className="object-cover"
                sizes="320px"
              />
              {/* Subtle bottom gradient so name reads over photo */}
              <div
                className="absolute inset-x-0 bottom-0 h-16"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)" }}
              />
            </div>
          ) : (
            <div
              className="w-full h-[220px] flex items-center justify-center"
              style={{ backgroundColor: `${textColor}12` }}
            >
              <span
                className="text-4xl opacity-20 select-none"
                style={{ fontFamily: "var(--font-display)", color: textColor }}
              >
                CG
              </span>
            </div>
          )}

          {/* Name / price / description */}
          <div className="p-4">
            <h3
              className="text-base tracking-wider mb-1 leading-tight"
              style={{
                fontFamily: "var(--font-display)",
                color: item.titleColor ?? textColor,
              }}
            >
              {item.title}
            </h3>
            {item.price && (
              <p className="text-xs mb-1.5" style={{ color: item.priceColor ?? "#C97D5A" }}>
                {item.price}
              </p>
            )}
            {item.description && (
              <p
                className="text-xs leading-relaxed line-clamp-2"
                style={{ color: item.descriptionColor ?? mutedColor }}
              >
                {item.description}
              </p>
            )}
            {canFlip && (
              <p
                className="text-[10px] tracking-widest uppercase mt-3 opacity-40"
                style={{ color: textColor }}
              >
                Tap for details
              </p>
            )}
          </div>
        </div>

        {/* ── BACK ──────────────────────────────────────────────────── */}
        <div
          role="button"
          tabIndex={isFlipped ? 0 : -1}
          aria-pressed={isFlipped}
          aria-label={`Hide details for ${item.title}`}
          onKeyDown={handleKeyDown}
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
            backgroundColor: `${textColor}08`,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Back header: item name */}
          <div
            className="px-5 pt-5 pb-3 shrink-0"
            style={{ borderBottom: `1px solid ${textColor}15` }}
          >
            <p
              className="text-base tracking-wider leading-tight"
              style={{ fontFamily: "var(--font-display)", color: item.titleColor ?? textColor }}
            >
              {item.title}
            </p>
            {item.price && (
              <p className="text-xs mt-0.5" style={{ color: item.priceColor ?? "#C97D5A" }}>
                {item.price}
              </p>
            )}
          </div>

          {/* Back body: text fields, no labels */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {backLines.map((line, i) => (
              <p
                key={i}
                className="text-sm leading-relaxed"
                style={{
                  color: mutedColor,
                  // First line (tagLine) gets slightly larger treatment
                  fontSize: i === 0 ? "0.875rem" : "0.8125rem",
                  opacity: i === 0 ? 1 : 0.85,
                  fontStyle: i === 0 ? "italic" : "normal",
                }}
              >
                {line}
              </p>
            ))}
          </div>

          {/* Tap to flip back hint */}
          <div className="px-5 py-3 shrink-0" style={{ borderTop: `1px solid ${textColor}15` }}>
            <p
              className="text-[10px] tracking-widest uppercase opacity-30"
              style={{ color: textColor }}
            >
              Tap to close
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main carousel ────────────────────────────────────────────────────────────
export default function MenuCarousel({ items, textColor, mutedColor }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "center" });
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Only one card can be flipped at a time; track by item id
  const [flippedId, setFlippedId] = useState<string | null>(null);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    // Reset any flipped card when the carousel advances
    setFlippedId(null);
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  const active = items.filter((i) => i.active);

  if (!active.length) {
    return (
      <div className="py-16 text-center opacity-40 text-sm tracking-widest uppercase">
        No items yet
      </div>
    );
  }

  function handleFlip(id: string) {
    setFlippedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="relative">
      {/* Carousel */}
      <div className="embla" ref={emblaRef}>
        <div className="embla__container">
          {active.map((item) => (
            <div
              key={item.id}
              className="embla__slide px-3"
              style={{ flex: "0 0 min(320px, 85vw)" }}
            >
              <FlipCard
                item={item}
                isFlipped={flippedId === item.id}
                onFlip={() => handleFlip(item.id)}
                textColor={textColor}
                mutedColor={mutedColor}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Nav arrows */}
      {active.length > 1 && (
        <>
          <button
            onClick={() => emblaApi?.scrollPrev()}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:text-[#C97D5A]"
            style={{ color: textColor, backgroundColor: `${textColor}10` }}
            aria-label="Previous cocktail"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => emblaApi?.scrollNext()}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:text-[#C97D5A]"
            style={{ color: textColor, backgroundColor: `${textColor}10` }}
            aria-label="Next cocktail"
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}

      {/* Dots */}
      {active.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-5">
          {active.map((_, i) => (
            <button
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              aria-label={`Go to cocktail ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                i === selectedIndex ? "w-4 h-1.5" : "w-1.5 h-1.5 opacity-30"
              }`}
              style={{ backgroundColor: i === selectedIndex ? "#C97D5A" : textColor }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
