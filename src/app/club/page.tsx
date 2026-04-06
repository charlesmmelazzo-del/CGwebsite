import PageThemeWrapper from "@/components/layout/PageThemeWrapper";
import ContentSectionBlock from "@/components/ui/ContentSection";
import type { ContentSection } from "@/types";
import { THEMES } from "@/lib/themes";

const CLUB_SECTIONS: ContentSection[] = [
  {
    id: "1",
    order: 0,
    title: "Common Good Cocktail Club",
    body: "When you subscribe to Common Good Cocktail House you'll unlock exclusive access to our fun and delicious cocktails and our expansive and exclusive spirits cellar.\n\nThink monthly boxes of favorite and classic cocktails and spirits, and priority access to reserve and rare bottles.",
    buttonLabel: "Find Out More & Join",
    buttonUrl: "https://commongoodcocktailhouse.com/cocktailclub",
    buttonNewTab: true,
  },
];

export default function ClubPage() {
  const theme = THEMES.plum;
  return (
    <PageThemeWrapper fixedTheme="plum" showIllustration={false}>
      <div className="min-h-screen py-16" style={{ color: theme.text }}>
        <header className="text-center mb-12 px-6">
          <h1
            className="text-5xl md:text-7xl tracking-widest uppercase mb-2"
            style={{ fontFamily: "var(--font-display)", color: theme.text }}
          >
            Club
          </h1>
          <div className="w-16 h-px mx-auto mt-4" style={{ backgroundColor: theme.muted }} />
        </header>

        <div className="divide-y" style={{ borderColor: `${theme.muted}30` }}>
          {CLUB_SECTIONS.map((section) => (
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
