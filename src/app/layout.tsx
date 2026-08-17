import type { Metadata } from "next";
import { headers } from "next/headers";
import { Cormorant_Garamond, Jost } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ZoneWatcher from "@/components/layout/ZoneWatcher";
import { getSiteConfig, getSiteSettings, getFontCSS } from "@/lib/siteconfig";
import { SITE_URL } from "@/lib/constants";
import { buildBusinessJsonLd } from "@/lib/structuredData";

const korinthFallback = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-korinth-fallback",
  display: "swap",
});

const futuraFallback = Jost({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500"],
  variable: "--font-futura-fallback",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Common Good Cocktail House | Glen Ellyn, IL",
    // Per-page titles render as e.g. "Menu | Common Good Cocktail House"
    template: "%s | Common Good Cocktail House",
  },
  description:
    "Modern, classic, upscale and seasonal cocktails in the heart of Glen Ellyn, Illinois. A space to celebrate life, from special occasions to day-to-day.",
  keywords: ["cocktail bar", "Glen Ellyn", "Illinois", "cocktail house", "bar"],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Common Good Cocktail House",
    description: "Modern cocktails in Glen Ellyn, IL",
    url: SITE_URL,
    siteName: "Common Good Cocktail House",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Common Good Cocktail House",
    description: "Modern cocktails in Glen Ellyn, IL",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch live config on every request — changes in admin appear immediately.
  // Falls back to hardcoded defaults if Supabase env vars are missing.
  const [{ header, footer }, settings, fontCss] = await Promise.all([
    getSiteConfig(),
    getSiteSettings(),
    getFontCSS(),
  ]);

  const desktopPad = header.headerHeight       ?? 72;
  const mobilePad  = header.mobileHeaderHeight ?? 52;

  // The Pop Up Zone renders in its own standalone shell (see src/app/popup/layout.tsx):
  // its templates take over the whole viewport, so the site header and footer
  // are suppressed there.
  //
  // The chrome is always RENDERED and hidden with CSS rather than conditionally
  // rendered, because the App Router keeps this root layout mounted across
  // client-side navigations — it would not re-run when a guest clicks from the
  // footer into /popup (or back out again), leaving the wrong chrome on screen.
  // The data-zone attribute below is correct on first paint (so there's no
  // flash), and ZoneWatcher keeps it in sync on every soft navigation after.
  const standalone = (headers().get("x-pathname") ?? "").startsWith("/popup");

  return (
    <html lang="en">
      <head>
        {fontCss && <style id="cg-font-loader" dangerouslySetInnerHTML={{ __html: fontCss }} />}
        {/* LocalBusiness structured data → Google local pack / Maps visibility */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBusinessJsonLd(settings)) }}
        />
      </head>
      <body
        data-zone={standalone ? "popup" : undefined}
        className={`${korinthFallback.variable} ${futuraFallback.variable} antialiased`}
      >
        <ZoneWatcher />
        <Header config={header} settings={settings} />
        {/*
          Inline style tag injects responsive padding that matches the live header height.
          This keeps it in sync even when the admin changes the header height slider.
        */}
        <style>{`
          #cg-main { padding-top: ${mobilePad}px; --header-h: ${mobilePad}px; }
          @media (min-width: 768px) { #cg-main { padding-top: ${desktopPad}px; --header-h: ${desktopPad}px; } }
        `}</style>
        <main id="cg-main">{children}</main>
        <Footer config={footer} settings={settings} logoUrl={header.logoUrl} />
      </body>
    </html>
  );
}
