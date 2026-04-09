"use client";

import PageThemeWrapper from "@/components/layout/PageThemeWrapper";
import MenuCarousel from "@/components/ui/MenuCarousel";
import type { MenuTab, MenuItem, PageHeaderData } from "@/types";
import { THEMES } from "@/lib/themes";

interface Props {
  initialTabs: MenuTab[];
  initialItems: MenuItem[];
  header: PageHeaderData;
}

export default function MenuPageClient({ initialTabs, initialItems, header }: Props) {
  const theme = THEMES.terracotta;

  const activeTabs = initialTabs
    .filter((t) => t.active)
    .sort((a, b) => a.order - b.order);

  // One flat list: all items from all tabs, ordered by tab then item.order
  const allItems = activeTabs.flatMap((tab) =>
    initialItems
      .filter((item) => item.tabId === tab.id && item.active)
      .sort((a, b) => a.order - b.order)
  );

  return (
    <PageThemeWrapper fixedTheme="terracotta" showIllustration bgImageUrl={header.bgImageUrl}>
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
              className="tracking-widest uppercase opacity-60 mt-1"
              style={{ fontSize: `${header.subtitleSize ?? 13}px` }}
            >
              {header.subtitle}
            </p>
          )}
          <div className="w-16 h-px mx-auto mt-4" style={{ backgroundColor: theme.muted }} />
        </header>

        <div className="pb-16">
          <MenuCarousel
            items={allItems}
            tabs={activeTabs}
            textColor={theme.text}
            mutedColor={theme.muted}
          />
        </div>
      </div>
    </PageThemeWrapper>
  );
}
