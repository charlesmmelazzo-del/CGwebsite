"use client";

import { useState } from "react";
import PageThemeWrapper from "@/components/layout/PageThemeWrapper";
import MenuCarousel from "@/components/ui/MenuCarousel";
import type { MenuTab, MenuItem } from "@/types";
import { THEMES } from "@/lib/themes";
import clsx from "clsx";

// Sample menu data — admin manages via admin panel
const MENU_TABS: MenuTab[] = [
  { id: "seasonal", label: "Seasonal Cocktails", order: 0, active: true },
  { id: "classics", label: "Classics", order: 1, active: true },
  { id: "nonalc", label: "Non-Alcoholic", order: 2, active: true },
  { id: "beer", label: "Beer & Wine", order: 3, active: true },
];

const MENU_ITEMS: MenuItem[] = [
  {
    id: "1", tabId: "seasonal", order: 0, active: true,
    title: "Hugo Ascending",
    description: "Lemongrass Infused Elderflower Liqueur, Gen-P, Bitter Bianco, Cap Corse Blanc, Cava\n[Floral, Peaks of Flavor, Yellow]",
  },
  {
    id: "2", tabId: "seasonal", order: 1, active: true,
    title: "The Riggs",
    description: "Coconut Roasted Strawberry & Asparagus Infused Aperitivo, Lemon Verbena & Chamomile Aperitif Blend, Cava\n[Bubbly, Fruity, A Little Unhinged]",
  },
  {
    id: "3", tabId: "seasonal", order: 2, active: true,
    title: "An Argument From Lightness",
    description: "Finnish Pink Gin, Lemongrass Shochu, Yuzu, Lychee, Honey, Lemon, Cava\n[Sunshine, Rainbows, Bubbles]",
  },
  {
    id: "4", tabId: "seasonal", order: 3, active: true,
    title: "Cuke Nukem 3D",
    description: "Herbed Blanco Tequila, Serrano Juice, Cucumber Juice, Lime, Cane\n[1st-Person Drinking Game]",
  },
  {
    id: "5", tabId: "classics", order: 0, active: true,
    title: "Old Fashioned",
    description: "Bourbon, Demerara, Angostura Bitters",
  },
  {
    id: "6", tabId: "classics", order: 1, active: true,
    title: "Negroni",
    description: "Gin, Sweet Vermouth, Campari",
  },
  {
    id: "7", tabId: "nonalc", order: 0, active: true,
    title: "Garden Party",
    description: "Cucumber, Mint, Lime, Elderflower, Soda",
  },
  {
    id: "8", tabId: "beer", order: 0, active: true,
    title: "Ask Your Bartender",
    description: "Rotating selection of local and craft beers and wines.",
  },
];

export default function MenuPage() {
  const [activeTabId, setActiveTabId] = useState(MENU_TABS[0].id);
  const theme = THEMES.terracotta;
  const activeTabs = MENU_TABS.filter((t) => t.active).sort((a, b) => a.order - b.order);
  const activeItems = MENU_ITEMS.filter((i) => i.tabId === activeTabId);

  return (
    <PageThemeWrapper fixedTheme="terracotta" showIllustration>
      <div className="min-h-screen py-16" style={{ color: theme.text }}>
        <header className="text-center mb-8 px-6">
          <h1
            className="text-5xl md:text-7xl tracking-widest uppercase mb-2"
            style={{ fontFamily: "var(--font-display)", color: theme.text }}
          >
            Our Menu
          </h1>
          <p className="text-sm tracking-widest uppercase opacity-60 mt-1">
            Refreshing Seasonal Cocktails
          </p>
          <div className="w-16 h-px mx-auto mt-4" style={{ backgroundColor: theme.muted }} />
        </header>

        {/* Tab bar */}
        <div className="flex flex-wrap justify-center gap-1 px-4 mb-10 overflow-x-auto">
          {activeTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={clsx(
                "px-4 py-2 text-xs tracking-widest uppercase whitespace-nowrap transition-all duration-200",
                activeTabId === tab.id
                  ? "border-b-2 border-[#C97D5A] text-[#C97D5A]"
                  : "opacity-60 hover:opacity-90"
              )}
              style={{ color: activeTabId === tab.id ? "#C97D5A" : theme.text }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Carousel */}
        <div className="animate-fade-in px-4 pb-16">
          <MenuCarousel
            items={activeItems}
            textColor={theme.text}
            mutedColor={theme.muted}
          />
        </div>
      </div>
    </PageThemeWrapper>
  );
}
