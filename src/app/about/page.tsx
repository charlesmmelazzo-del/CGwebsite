import PageThemeWrapper from "@/components/layout/PageThemeWrapper";
import ContentSectionBlock from "@/components/ui/ContentSection";
import { THEMES } from "@/lib/themes";
import type { ThemeName } from "@/lib/themes";
import { getPageHeader } from "@/lib/pageheaders";
import { getAboutSections } from "@/lib/pagedata";

export default async function AboutPage() {
  const [sections, header] = await Promise.all([
    getAboutSections(),
    getPageHeader("about"),
  ]);

  const themeName: ThemeName = header.theme ?? "blue";
  const theme = THEMES[themeName];

  return (
    <PageThemeWrapper fixedTheme={themeName} showIllustration={false} bgImageUrl={header.bgImageUrl}>
      <div className="min-h-screen py-16" style={{ color: theme.text }}>
        <header className="text-center mb-12 px-6">
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

        <div className="divide-y" style={{ borderColor: `${theme.muted}30` }}>
          {sections.map((section) => (
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
