"use client";

import { useState } from "react";
import PageThemeWrapper from "@/components/layout/PageThemeWrapper";
import ContentSectionBlock from "@/components/ui/ContentSection";
import type { ContentSection } from "@/types";
import { THEMES } from "@/lib/themes";
import clsx from "clsx";

const SHOP_TABS = [
  { id: "bottles", label: "Bottles & Merch" },
  { id: "cocktails", label: "Cocktails To Go" },
  { id: "memberships", label: "Memberships" },
  { id: "giftcards", label: "Gift Cards" },
] as const;

type TabId = (typeof SHOP_TABS)[number]["id"];

const SHOP_CONTENT: Record<TabId, ContentSection[]> = {
  bottles: [
    {
      id: "b1",
      order: 0,
      title: "Bottles & Merch",
      body: "Bring the Common Good experience home. Shop our curated selection of spirits, mixers, and merchandise.",
      buttonLabel: "Shop Now",
      buttonUrl: "https://commongoodcocktailhouse.com/shop",
      buttonNewTab: true,
    },
  ],
  cocktails: [
    {
      id: "c1",
      order: 0,
      title: "Cocktails To Go",
      body: "You can order online to bring the Common Good experience anywhere you want! To go cocktails, spirits, mixers, and more are available for pickup and delivery.",
      buttonLabel: "Shop To Go Cocktails",
      buttonUrl: "https://commongoodcocktailhouse.com/shop",
      buttonNewTab: true,
    },
  ],
  memberships: [
    {
      id: "m1",
      order: 0,
      title: "Memberships & Spirits",
      body: "Unlock exclusive access with a Common Good membership. Priority access to reserve and rare bottles, exclusive spirits cellar, and more.",
      buttonLabel: "Memberships & Spirits",
      buttonUrl: "https://commongoodcocktailhouse.com/shop",
      buttonNewTab: true,
    },
  ],
  giftcards: [
    {
      id: "g1",
      order: 0,
      title: "Gift Cards",
      body: "Give the gift of Common Good. Perfect for any occasion.",
      buttonLabel: "Buy a Gift Card",
      buttonUrl: "https://commongoodcocktailhouse.com/shop",
      buttonNewTab: true,
    },
  ],
};

export default function ShopPage() {
  const [activeTab, setActiveTab] = useState<TabId>("bottles");
  const theme = THEMES.teal;

  return (
    <PageThemeWrapper fixedTheme="teal" showIllustration>
      <div className="min-h-screen py-16" style={{ color: theme.text }}>
        <header className="text-center mb-8 px-6">
          <h1
            className="text-5xl md:text-7xl tracking-widest uppercase mb-2"
            style={{ fontFamily: "var(--font-display)", color: theme.text }}
          >
            Shop
          </h1>
          <div className="w-16 h-px mx-auto mt-4" style={{ backgroundColor: theme.muted }} />
        </header>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-1 px-4 mb-8">
          {SHOP_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "px-4 py-2 text-xs tracking-widest uppercase transition-all duration-200",
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
          {SHOP_CONTENT[activeTab].map((section) => (
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
