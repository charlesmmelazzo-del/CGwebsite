"use client";

import { useState } from "react";
import PageThemeWrapper from "@/components/layout/PageThemeWrapper";
import MenuCarousel from "@/components/ui/MenuCarousel";
import type { MenuTab, MenuItem } from "@/types";
import { THEMES } from "@/lib/themes";
import clsx from "clsx";

interface Props {
  initialTabs: MenuTab[];
  initialItems: MenuItem[];
}

export default function MenuPageClient({ initialTabs, initialItems }: Props) {
  const theme = THEMES.terracotta;
  const activeTabs = initialTabs.filter((t) => t.active).sort((a, b) => a.order - b.order);
  const [activeTabId, setActiveTabId] = useState(activeTabs[0]?.id ?? "");
  const activeItems = initialItems.filter((i) => i.tabId === activeTabId && i.active);

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
        {activeTabs.length > 0 && (
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
        )}

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
