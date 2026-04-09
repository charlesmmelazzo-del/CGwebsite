"use client";

import { useState } from "react";
import PageThemeWrapper from "@/components/layout/PageThemeWrapper";
import ContentSectionBlock from "@/components/ui/ContentSection";
import type { ContentSection, PageHeaderData } from "@/types";
import type { ShopTab } from "@/lib/pagedata";
import { THEMES } from "@/lib/themes";
import type { ThemeName } from "@/lib/themes";
import clsx from "clsx";

interface Props {
  header: PageHeaderData;
  shopTabs: ShopTab[];
}

export default function ShopPageClient({ header, shopTabs }: Props) {
  const themeName: ThemeName = header.theme ?? "teal";
  const theme = THEMES[themeName];
  const tabs = shopTabs.length > 0 ? shopTabs : [];
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "");

  const activeTabData = tabs.find((t) => t.id === activeTab);
  const content: ContentSection[] = activeTabData
    ? [{
        id: activeTab,
        order: 0,
        title: activeTabData.label,
        body: activeTabData.body,
        buttonLabel: activeTabData.buttonLabel,
        buttonUrl: activeTabData.buttonUrl,
        buttonNewTab: activeTabData.buttonNewTab,
      }]
    : [];

  return (
    <PageThemeWrapper fixedTheme={themeName} showIllustration bgImageUrl={header.bgImageUrl}>
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
