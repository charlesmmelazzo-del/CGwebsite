"use client";

import { useState } from "react";
import PageThemeWrapper from "@/components/layout/PageThemeWrapper";
import MenuCarousel from "@/components/ui/MenuCarousel";
import type { MenuTab, MenuItem } from "@/types";
import type { PageHeaderData } from "@/types";
import { THEMES } from "@/lib/themes";
import clsx from "clsx";

interface Props {
  initialTabs: MenuTab[];
  initialItems: MenuItem[];
  header: PageHeaderData;
}

export default function CoffeePageClient({ initialTabs, initialItems, header }: Props) {
  const theme = THEMES.olive;
  const activeTabs = initialTabs.filter((t) => t.active).sort((a, b) => a.order - b.order);
  const [activeTabId, setActiveTabId] = useState(activeTabs[0]?.id ?? "");
  const activeItems = initialItems.filter((i) => i.tabId === activeTabId && i.active);

  return (
    <PageThemeWrapper fixedTheme="olive" showIllustration={false} bgImageUrl={header.bgImageUrl}>
      <div className="min-h-screen py-16" style={{ color: theme.text }}>
        <header className="text-center mb-8 px-6">
          {header.title && (
            <h1
              className="tracking-widest uppercase mb-2"
              style={{
                fontFamily: "var(--font-display)",
                color: theme.text,
                fontSize: `clamp(1.75rem, 7vw, ${header.titleSize}px)`,
              }}
            >
              {header.title}
            </h1>
          )}
          {header.subtitle && (
            <p
              className="leading-relaxed max-w-xl mx-auto mt-3 opacity-70"
              style={{ fontSize: `${header.subtitleSize ?? 14}px` }}
            >
              {header.subtitle}
            </p>
          )}
          <div className="w-16 h-px mx-auto mt-6" style={{ backgroundColor: theme.muted }} />
        </header>

        {/* Tab bar */}
        {activeTabs.length > 0 && (
          <div className="tab-bar-scroll flex justify-center gap-0 px-4 mb-10">
            {activeTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={clsx(
                  "px-3 md:px-4 py-2 text-xs tracking-widest uppercase whitespace-nowrap transition-all duration-200",
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
