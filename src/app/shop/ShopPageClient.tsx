"use client";

import { useState } from "react";
import PageThemeWrapper from "@/components/layout/PageThemeWrapper";
import ContentSectionBlock from "@/components/ui/ContentSection";
import type { ContentSection, PageHeaderData } from "@/types";
import { THEMES } from "@/lib/themes";
import clsx from "clsx";

const SHOP_CONTENT: Record<string, ContentSection[]> = {
  bottles: [
    {
      id: "b1", order: 0,
      title: "Bottles & Merch",
      body: "Bring the Common Good experience home. Shop our curated selection of spirits, mixers, and merchandise.",
      buttonLabel: "Shop Now",
      buttonUrl: "https://commongoodcocktailhouse.com/shop",
      buttonNewTab: true,
    },
  ],
  cocktails: [
    {
      id: "c1", order: 0,
      title: "Cocktails To Go",
      body: "You can order online to bring the Common Good experience anywhere you want! To go cocktails, spirits, mixers, and more are available for pickup and delivery.",
      buttonLabel: "Shop To Go Cocktails",
      buttonUrl: "https://commongoodcocktailhouse.com/shop",
      buttonNewTab: true,
    },
  ],
  memberships: [
    {
      id: "m1", order: 0,
      title: "Memberships & Spirits",
      body: "Unlock exclusive access with a Common Good membership. Priority access to reserve and rare bottles, exclusive spirits cellar, and more.",
      buttonLabel: "Memberships & Spirits",
      buttonUrl: "https://commongoodcocktailhouse.com/shop",
      buttonNewTab: true,
    },
  ],
  giftcards: [
    {
      id: "g1", order: 0,
      title: "Gift Cards",
      body: "Give the gift of Common Good. Perfect for any occasion.",
      buttonLabel: "Buy a Gift Card",
      buttonUrl: "https://commongoodcocktailhouse.com/shop",
      buttonNewTab: true,
    },
  ],
};

interface Props {
  header: PageHeaderData;
}

export default function ShopPageClient({ header }: Props) {
  const theme = THEMES.teal;
  // Use tabs from header (editable), fall back to hardcoded defaults
  const tabs = header.tabs ?? [
    { id: "bottles",     label: "Bottles & Merch" },
    { id: "cocktails",   label: "Cocktails To Go" },
    { id: "memberships", label: "Memberships" },
    { id: "giftcards",   label: "Gift Cards" },
  ];
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "bottles");
  const content = SHOP_CONTENT[activeTab] ?? [];

  return (
    <PageThemeWrapper fixedTheme="teal" showIllustration bgImageUrl={header.bgImageUrl}>
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
            <p className="mt-2 opacity-70" style={{ fontSize: `${header.subtitleSize ?? 14}px` }}>
              {header.subtitle}
            </p>
          )}
          <div className="w-16 h-px mx-auto mt-4" style={{ backgroundColor: theme.muted }} />
        </header>

        {/* Tabs */}
        <div className="tab-bar-scroll flex justify-center gap-0 px-4 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "px-3 md:px-4 py-2 text-xs tracking-widest uppercase whitespace-nowrap transition-all duration-200",
                activeTab === tab.id
                  ? "border-b-2 border-[#C97D5A] text-[#C97D5A]"
                  : "opacity-60 hover:opacity-90"
              )}
              style={{ color: activeTab === tab.id ? "#C97D5A" : theme.text }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="animate-fade-in">
          {content.map((section) => (
            <ContentSectionBlock
              key={section.id}
              section={section}
              textColor={theme.text}
              mutedColor={theme.muted}
            />
          ))}
        </div>
      </div>
    </PageThemeWrapper>
  );
}
