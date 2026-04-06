"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { MenuItem } from "@/types";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  items: MenuItem[];
  textColor: string;
  mutedColor: string;
}

export default function MenuCarousel({ items, textColor, mutedColor }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "center" });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedItem, setExpandedItem] = useState<MenuItem | null>(null);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
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
              <div
                className="rounded-sm overflow-hidden border cursor-pointer group transition-transform duration-200 hover:scale-[1.02]"
                style={{ borderColor: `${textColor}20` }}
                onClick={() => item.imageUrl && setExpandedItem(item)}
              >
                {item.imageUrl ? (
                  <div className="relative h-48">
                    <Image
                      src={item.imageUrl}
                      alt={item.title}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                  </div>
                ) : (
                  <div
                    className="h-32 flex items-center justify-center"
                    style={{ backgroundColor: `${textColor}10` }}
                  >
                    <span className="text-4xl opacity-20" style={{ fontFamily: "var(--font-display)" }}>
                      CG
                    </span>
                  </div>
                )}
                <div className="p-4">
                  <h3
                    className="text-lg tracking-wider mb-1"
                    style={{ fontFamily: "var(--font-display)", color: textColor }}
                  >
                    {item.title}
                  </h3>
                  {item.price && (
                    <p className="text-xs mb-2" style={{ color: "#C97D5A" }}>
                      {item.price}
                    </p>
                  )}
                  {item.description && (
                    <p className="text-xs leading-relaxed" style={{ color: mutedColor }}>
                      {item.description}
                    </p>
                  )}
                  {item.imageUrl && (
                    <p className="text-[10px] tracking-widest uppercase mt-3 opacity-40">
                      Tap to expand
                    </p>
                  )}
                </div>
              </div>
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
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => emblaApi?.scrollNext()}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:text-[#C97D5A]"
            style={{ color: textColor, backgroundColor: `${textColor}10` }}
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
              className={`rounded-full transition-all duration-300 ${
                i === selectedIndex ? "w-4 h-1.5" : "w-1.5 h-1.5 opacity-30"
              }`}
              style={{ backgroundColor: i === selectedIndex ? "#C97D5A" : textColor }}
            />
          ))}
        </div>
      )}

      {/* Expanded image */}
      {expandedItem?.imageUrl && (
        <div className="iframe-modal-overlay" onClick={() => setExpandedItem(null)}>
          <div className="relative max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setExpandedItem(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white"
            >
              <X size={24} />
            </button>
            <Image
              src={expandedItem.imageUrl}
              alt={expandedItem.title}
              width={800}
              height={1000}
              className="w-full rounded-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
