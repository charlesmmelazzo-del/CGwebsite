"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import PageThemeWrapper from "@/components/layout/PageThemeWrapper";
import MenuTileGrid from "@/components/ui/MenuTileGrid";
import MenuMobileSwipe from "@/components/ui/MenuMobileSwipe";
import MenuListView from "@/components/ui/MenuListView";
import FavoritesPanel from "@/components/ui/FavoritesPanel";
import { getFavorites, toggleFavorite, setFavorites } from "@/lib/favorites";
import type { MenuTab, MenuItem, PageHeaderData } from "@/types";
import { THEMES } from "@/lib/themes";
import type { ThemeName } from "@/lib/themes";

interface Props {
  initialTabs: MenuTab[];
  initialItems: MenuItem[];
  header: PageHeaderData;
}

export default function MenuPageClient({ initialTabs, initialItems, header }: Props) {
  const themeName: ThemeName = header.theme ?? "terracotta";
  const theme = THEMES[themeName];

  const activeTabs = initialTabs
    .filter((t) => t.active)
    .sort((a, b) => a.order - b.order);

  const activeItems = initialItems.filter((item) => item.active);

  const [favorites, setFavoritesState] = useState<string[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<"swipe" | "list">("swipe");

  useEffect(() => {
    setFavoritesState(getFavorites());
  }, []);

  function handleToggleFavorite(id: string) {
    setFavoritesState(toggleFavorite(id));
  }

  function handleClearFavorites() {
    setFavorites([]);
    setFavoritesState([]);
  }

  return (
    <PageThemeWrapper fixedTheme={themeName} showIllustration bgImageUrl={header.bgImageUrl}>
      {/*
        h-screen + overflow-hidden = viewport-locked layout.
        pt-[52px]/pt-[72px] clears the fixed nav bar.
        The grid inside fills the remaining height and scrolls internally.
      */}
      <div
        className="h-screen overflow-hidden flex flex-col pt-[52px] md:pt-[72px]"
        style={{ color: theme.text }}
      >
        {/* Compact page header — shrinks to its content, never scrolls */}
        <header className="shrink-0 text-center px-6 pt-5 pb-3">
          {header.title && (
            <h1
              className="tracking-widest uppercase mb-1"
              style={{
                fontFamily: "var(--font-display)",
                color: theme.text,
                fontSize: `clamp(1.5rem, 5vw, ${header.titleSize}px)`,
              }}
            >
              {header.title}
            </h1>
          )}
          {header.subtitle && (
            <p
              className="tracking-widest uppercase opacity-60 mt-0.5"
              style={{ fontSize: `${header.subtitleSize ?? 13}px` }}
            >
              {header.subtitle}
            </p>
          )}
          <div className="w-12 h-px mx-auto mt-3" style={{ backgroundColor: theme.muted }} />
        </header>

        {/* Content area — fills remaining height */}
        <div className="flex-1 min-h-0">
          {/* Desktop grid — hidden on mobile */}
          <div className="hidden md:block h-full">
            <MenuTileGrid
              items={activeItems}
              tabs={activeTabs}
              textColor={theme.text}
              mutedColor={theme.muted}
              bgColor={theme.bg}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
            />
          </div>

          {/* Mobile swipe/list — hidden on desktop */}
          <div className="md:hidden h-full">
            {mobileViewMode === "swipe" ? (
              <MenuMobileSwipe
                items={activeItems}
                tabs={activeTabs}
                textColor={theme.text}
                mutedColor={theme.muted}
                bgColor={theme.bg}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                onOpenFavorites={() => setShowFavorites(true)}
                onToggleListView={() => setMobileViewMode("list")}
              />
            ) : (
              <MenuListView
                items={activeItems}
                tabs={activeTabs}
                textColor={theme.text}
                mutedColor={theme.muted}
                bgColor={theme.bg}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                onOpenFavorites={() => setShowFavorites(true)}
                onToggleSwipeView={() => setMobileViewMode("swipe")}
              />
            )}
          </div>
        </div>
      </div>

      {/* Desktop floating favorites button */}
      {favorites.length > 0 && (
        <button
          onClick={() => setShowFavorites(true)}
          className="fixed bottom-6 right-6 z-40 hidden md:flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg transition-transform hover:scale-105"
          style={{ backgroundColor: "#C97D5A", color: "#fff" }}
        >
          <Heart size={16} fill="#fff" />
          <span className="text-sm tracking-wider">
            {favorites.length} {favorites.length === 1 ? "Favorite" : "Favorites"}
          </span>
        </button>
      )}

      {/* Favorites panel */}
      {showFavorites && (
        <FavoritesPanel
          allItems={activeItems}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
          onClearAll={handleClearFavorites}
          onClose={() => setShowFavorites(false)}
          textColor={theme.text}
          mutedColor={theme.muted}
          bgColor={theme.bg}
        />
      )}
    </PageThemeWrapper>
  );
}
