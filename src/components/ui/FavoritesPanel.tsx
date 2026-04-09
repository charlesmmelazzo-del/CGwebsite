"use client";

import { useState } from "react";
import Image from "next/image";
import { X, Heart, Trash2 } from "lucide-react";
import type { MenuItem } from "@/types";
import EnlargedTileOverlay from "./EnlargedTileOverlay";

interface Props {
  allItems: MenuItem[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onClearAll: () => void;
  onClose: () => void;
  textColor: string;
  mutedColor: string;
  bgColor: string;
}

export default function FavoritesPanel({
  allItems,
  favorites,
  onToggleFavorite,
  onClearAll,
  onClose,
  textColor,
  mutedColor,
  bgColor,
}: Props) {
  const [enlargedItem, setEnlargedItem] = useState<MenuItem | null>(null);
  const favoritedItems = allItems.filter((item) => favorites.includes(item.id));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/60"
        onClick={onClose}
        style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
      />

      {/* Panel */}
      <div
        className="fixed inset-0 z-[60] flex flex-col"
        style={{ backgroundColor: bgColor }}
      >
        {/* Header */}
        <div
          className="shrink-0 flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${textColor}15` }}
        >
          <div className="flex items-center gap-2">
            <Heart size={18} fill="#C97D5A" stroke="#C97D5A" />
            <h2
              className="text-lg tracking-wider"
              style={{ fontFamily: "var(--font-display)", color: textColor }}
            >
              Your Favorites ({favoritedItems.length})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-70 transition-opacity"
            style={{ backgroundColor: `${textColor}15`, color: textColor }}
            aria-label="Close favorites"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        {favoritedItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            <span className="text-5xl">💔</span>
            <p
              className="text-sm tracking-widest uppercase opacity-50 text-center"
              style={{ color: textColor }}
            >
              No favorites yet
            </p>
            <p className="text-xs opacity-40 text-center" style={{ color: mutedColor }}>
              Heart items while browsing to save them here.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {favoritedItems.map((item) => {
              const imgSrc = item.carouselImageUrl ?? item.imageUrl;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-3 active:opacity-70 transition-opacity cursor-pointer"
                  style={{ borderBottom: `1px solid ${textColor}10` }}
                  onClick={() => setEnlargedItem(item)}
                >
                  {/* Thumbnail */}
                  <div
                    className="relative shrink-0 w-[60px] h-[60px] rounded-md overflow-hidden"
                    style={{ backgroundColor: `${textColor}10` }}
                  >
                    {imgSrc ? (
                      <Image
                        src={imgSrc}
                        alt={item.alt ?? item.title}
                        fill
                        className="object-cover rounded-md"
                        sizes="60px"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span
                          className="opacity-20 text-lg"
                          style={{ fontFamily: "var(--font-display)", color: textColor }}
                        >
                          CG
                        </span>
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
                      <p
                        className="text-[11px] mt-0.5 line-clamp-1 leading-snug opacity-80"
                        style={{ color: mutedColor }}
                      >
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(item.id);
                    }}
                    className="shrink-0 w-8 h-8 flex items-center justify-center hover:opacity-70 transition-opacity"
                    aria-label="Remove from favorites"
                  >
                    <Trash2 size={16} style={{ color: mutedColor }} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {favoritedItems.length > 0 && (
          <div
            className="shrink-0 px-5 py-4"
            style={{ borderTop: `1px solid ${textColor}15` }}
          >
            <button
              onClick={onClearAll}
              className="w-full py-2.5 rounded-full text-xs tracking-widest uppercase transition-opacity hover:opacity-70"
              style={{
                border: `1px solid ${textColor}30`,
                color: textColor,
              }}
            >
              Clear All Favorites
            </button>
          </div>
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
    </>
  );
}
