"use client";

import PageThemeWrapper from "@/components/layout/PageThemeWrapper";
import MenuCarousel from "@/components/ui/MenuCarousel";
import type { MenuTab, MenuItem, PageHeaderData } from "@/types";
import { THEMES } from "@/lib/themes";
import type { ThemeName } from "@/lib/themes";

interface Props {
  initialTabs: MenuTab[];
  initialItems: MenuItem[];
  header: PageHeaderData;
}

export default function CoffeePageClient({ initialTabs, initialItems, header }: Props) {
  const themeName: ThemeName = header.theme ?? "olive";
  const theme = THEMES[themeName];

  const activeTabs = initialTabs
    .filter((t) => t.active)
    .sort((a, b) => a.order - b.order);

  const allItems = activeTabs.flatMap((tab) =>
    initialItems
      .filter((item) => item.tabId === tab.id && item.active)
      .sort((a, b) => a.order - b.order)
  );

  return (
    <PageThemeWrapper fixedTheme={themeName} showIllustration={false} bgImageUrl={header.bgImageUrl}>
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
