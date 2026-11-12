import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageThemeWrapper from "@/components/layout/PageThemeWrapper";
import { resolveTheme } from "@/lib/themes";
import type { ThemeName } from "@/lib/themes";
import { getPageHeader } from "@/lib/pageheaders";
import { getSiteSettings } from "@/lib/siteconfig";
import { reserveEnabled } from "@/lib/reserve/enabled";
import { getReserveContent } from "@/lib/reserve/content";
import { getConfig, BibleError, UNAVAILABLE_MESSAGE } from "@/lib/reserve/bible";
import type { BibleConfig } from "@/lib/reserve/types";
import ReservePageClient from "./ReservePageClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reserve",
  description: "Reserve the Upper Room at Common Good Cocktail House in Glen Ellyn for your group.",
  alternates: { canonical: "/reserve" },
};

export default async function ReservePage() {
  if (!reserveEnabled()) notFound();

  const [header, content, settings, config] = await Promise.all([
    getPageHeader("reserve"),
    getReserveContent(),
    getSiteSettings(),
    getConfig().catch((e: unknown): BibleConfig | string => (e instanceof BibleError ? e.message : UNAVAILABLE_MESSAGE)),
  ]);

  const themeName: ThemeName = header.theme ?? "green";
  const theme = resolveTheme(header);

  return (
    <PageThemeWrapper
      fixedTheme={themeName}
      customBg={header.customBg}
      customText={header.customText}
      customMuted={header.customMuted}
      showIllustration={false}
      bgImageUrl={header.bgImageUrl}
    >
      <ReservePageClient
        content={content}
        config={typeof config === "string" ? null : config}
        unavailable={typeof config === "string" ? config : ""}
        phone={settings.phone}
        theme={{ bg: theme.bg, text: theme.text, muted: theme.muted }}
        titleSize={header.titleSize}
      />
    </PageThemeWrapper>
  );
}
