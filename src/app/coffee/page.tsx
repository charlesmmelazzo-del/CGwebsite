"use client";

import { useState } from "react";
import PageThemeWrapper from "@/components/layout/PageThemeWrapper";
import MenuCarousel from "@/components/ui/MenuCarousel";
import type { MenuTab, MenuItem } from "@/types";
import { THEMES } from "@/lib/themes";
import clsx from "clsx";

const COFFEE_TABS: MenuTab[] = [
  { id: "drip", label: "Drip Coffee", order: 0, active: true },
  { id: "espresso", label: "Espresso Drinks", order: 1, active: true },
  { id: "tea", label: "Tea", order: 2, active: true },
  { id: "treats", label: "Treats", order: 3, active: true },
];

const COFFEE_ITEMS: MenuItem[] = [
  {
    id: "c1", tabId: "drip", order: 0, active: true,
    title: "Drip Coffee",
    description: "Pouring @metriccoffee — hot coffee, iced coffee, and more.",
  },
  {
    id: "c2", tabId: "espresso", order: 0, active: true,
    title: "Iced Oat Milk Latte",
    description: "Rotating specialty lattes from @metriccoffee.",
  },
  {
    id: "c3", tabId: "tea", order: 0, active: true,
    title: "Seasonal Tea Selection",
    description: "Ask your barista for today's selection.",
  },
  {
    id: "c4", tabId: "treats", order: 0, active: true,
    title: "Bang Bang Pie Treats",
    description: "Biscuits, quiche, tomato pot pies from @bangbangpie. Chicago to the Western Burbs.",
  },
];

export default function CoffeePage() {
  const [activeTabId, setActiveTabId] = useState(COFFEE_TABS[0].id);
  const theme = THEMES.olive;
  const activeTabs = COFFEE_TABS.filter((t) => t.active).sort((a, b) => a.order - b.order);
  const activeItems = COFFEE_ITEMS.filter((i) => i.tabId === activeTabId);

  return (
    <PageThemeWrapper fixedTheme="olive" showIllustration={false}>
      <div className="min-h-screen py-16" style={{ color: theme.text }}>
        <header className="text-center mb-8 px-6">
          <h1
            className="text-5xl md:text-7xl tracking-widest uppercase mb-2"
            style={{ fontFamily: "var(--font-display)", color: theme.text }}
          >
            Coffee House
          </h1>
          <p
            className="text-sm md:text-base leading-relaxed max-w-xl mx-auto mt-3 opacity-70"
          >
            Whether you&apos;re grabbing something on the way to the Metra or need a nice place
            to work, read a book, or meet up with a friend — we&apos;ve got you.
          </p>
          <div className="w-16 h-px mx-auto mt-6" style={{ backgroundColor: theme.muted }} />
        </header>

        {/* Tab bar */}
        <div className="flex flex-wrap justify-center gap-1 px-4 mb-10">
          {activeTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={clsx(
                "px-4 py-2 text-xs tracking-widest uppercase transition-all duration-200",
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
