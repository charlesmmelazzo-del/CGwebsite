import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageThemeWrapper from "@/components/layout/PageThemeWrapper";
import { resolveTheme } from "@/lib/themes";
import type { ThemeName } from "@/lib/themes";
import { getPageHeader } from "@/lib/pageheaders";
import { getSiteSettings } from "@/lib/siteconfig";
import { reserveEnabled } from "@/lib/reserve/enabled";
import { getReserveContent } from "@/lib/reserve/content";
import { getConfig, getReservation, BibleError, UNAVAILABLE_MESSAGE } from "@/lib/reserve/bible";
import { isToken } from "@/lib/reserve/format";
import type { GuestReservation } from "@/lib/reserve/types";
import GuestPageClient from "./GuestPageClient";

export const dynamic = "force-dynamic";

// A private page: never indexed, and the token must not leak through Referer.
export const metadata: Metadata = {
  title: "Your reservation",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const NOT_FOUND = "We couldn't find that reservation. Check the link in your email, or call us.";

export default async function GuestReservationPage({ params }: { params: { token: string } }) {
  if (!reserveEnabled()) notFound();

  const [header, content, settings] = await Promise.all([getPageHeader("reserve"), getReserveContent(), getSiteSettings()]);
  const themeName: ThemeName = header.theme ?? "green";
  const theme = resolveTheme(header);

  let reservation: GuestReservation | null = null;
  let problem = "";
  if (!isToken(params.token)) {
    problem = NOT_FOUND;
  } else {
    try {
      reservation = await getReservation(params.token);
    } catch (e) {
      problem = e instanceof BibleError && e.status === 404 ? NOT_FOUND : e instanceof BibleError ? e.message : UNAVAILABLE_MESSAGE;
    }
  }

  // The overall party range lets the guest try sizes outside their current space.
  const partyMax = reservation && !reservation.closed ? await getConfig().then((c) => c.party.max ?? 0).catch(() => 0) : 0;

  return (
    <PageThemeWrapper
      fixedTheme={themeName}
      customBg={header.customBg}
      customText={header.customText}
      customMuted={header.customMuted}
      showIllustration={false}
      bgImageUrl={header.bgImageUrl}
    >
      <GuestPageClient
        token={reservation ? params.token : ""}
        initial={reservation}
        problem={problem}
        faq={content.faq}
        phone={settings.phone}
        partyMax={partyMax}
        theme={{ bg: theme.bg, text: theme.text, muted: theme.muted }}
      />
    </PageThemeWrapper>
  );
}
