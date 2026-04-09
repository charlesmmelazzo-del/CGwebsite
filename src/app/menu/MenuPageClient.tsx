"use client";

import PageThemeWrapper from "@/components/layout/PageThemeWrapper";
import MenuTileGrid from "@/components/ui/MenuTileGrid";
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

        {/* Grid — fills remaining height, scrolls internally */}
        <div className="flex-1 min-h-0">
          <MenuTileGrid
            items={activeItems}
            tabs={activeTabs}
            textColor={theme.text}
            mutedColor={theme.muted}
            bgColor={theme.bg}
          />
        </div>
      </div>
    </PageThemeWrapper>
  );
}
