import PageThemeWrapper from "@/components/layout/PageThemeWrapper";
import ContentSectionBlock from "@/components/ui/ContentSection";
import type { ContentSection } from "@/types";
import { THEMES } from "@/lib/themes";

// Seeded content — admin will manage these
const ABOUT_SECTIONS: ContentSection[] = [
  {
    id: "1",
    order: 0,
    title: "Our Story",
    body: "Common Good Cocktail House is an extension of our living room, where you experience genuine, heartfelt hospitality. We want to share things we love with you, and we want to facilitate connection and community at our table.\n\nEveryone is welcome through our doors to discover, taste, and have a good time.",
  },
  {
    id: "2",
    order: 1,
    title: "What We Do",
    body: "We make modern, classic, upscale, seasonal and sometimes whimsical cocktails using fun techniques in a beautiful but low-key, friendly environment.\n\nWe want to make the best cocktails you've ever tasted. But, most of all, we want to create a space to celebrate life, from special occasions to day-to-day.",
  },
];

export default function AboutPage() {
  const theme = THEMES.blue;
  return (
    <PageThemeWrapper fixedTheme="blue" showIllustration={false}>
      <div className="min-h-screen py-16" style={{ color: theme.text }}>
        <header className="text-center mb-12 px-6">
          <h1
            className="text-5xl md:text-7xl tracking-widest uppercase mb-2"
            style={{ fontFamily: "var(--font-display)", color: theme.text }}
          >
            About
          </h1>
          <div className="w-16 h-px mx-auto mt-4" style={{ backgroundColor: theme.muted }} />
        </header>

        <div className="divide-y" style={{ borderColor: `${theme.muted}30` }}>
          {ABOUT_SECTIONS.map((section) => (
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
