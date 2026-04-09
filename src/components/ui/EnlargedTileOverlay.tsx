"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import type { MenuItem } from "@/types";

interface Props {
  item: MenuItem;
  onClose: () => void;
  textColor: string;
  mutedColor: string;
  bgColor: string;
}

function hasBackContent(item: MenuItem): boolean {
  return !!(item.tagLine || item.ingredients || item.tastingNotes || item.notableNotes);
}

export default function EnlargedTileOverlay({ item, onClose, textColor, mutedColor, bgColor }: Props) {
  const [isFlipped, setIsFlipped] = useState(false);
  const canFlip = hasBackContent(item);
  const imgSrc = item.carouselImageUrl ?? item.imageUrl;
  const backLines = [item.tagLine, item.ingredients, item.tastingNotes, item.notableNotes].filter(Boolean) as string[];

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 animate-fade-in" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
        <div className="pointer-events-auto relative w-full" style={{ maxWidth: "420px", perspective: "1200px" }}>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            aria-label="Close"
          >
            <X size={14} />
          </button>
          <div
            style={{
              transformStyle: "preserve-3d",
              transition: "transform 0.55s cubic-bezier(0.4, 0.2, 0.2, 1)",
              transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
              position: "relative",
            }}
          >
            {/* Front */}
            <div
              onClick={canFlip ? () => setIsFlipped(true) : undefined}
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
              <div className="relative w-full h-[260px] md:h-[320px]">
                {imgSrc ? (
                  <>
                    <Image src={imgSrc} alt={item.alt ?? item.title} fill className="object-cover" sizes="420px" />
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

            {/* Back */}
            <div
              onClick={() => setIsFlipped(false)}
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
