import type { Metadata } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { getSiteConfig, getSiteSettings, getFontCSS } from "@/lib/siteconfig";

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
  title: "Common Good Cocktail House | Glen Ellyn, IL",
  description:
    "Modern, classic, upscale and seasonal cocktails in the heart of Glen Ellyn, Illinois. A space to celebrate life, from special occasions to day-to-day.",
  keywords: ["cocktail bar", "Glen Ellyn", "Illinois", "cocktail house", "bar"],
  openGraph: {
    title: "Common Good Cocktail House",
    description: "Modern cocktails in Glen Ellyn, IL",
    type: "website",
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

  return (
    <html lang="en">
      <head>
        {fontCss && <style id="cg-font-loader" dangerouslySetInnerHTML={{ __html: fontCss }} />}
      </head>
      <body className={`${korinthFallback.variable} ${futuraFallback.variable} antialiased`}>
        <Header config={header} />
        {/*
          Inline style tag injects responsive padding that matches the live header height.
          This keeps it in sync even when the admin changes the header height slider.
        */}
        <style>{`
          #cg-main { padding-top: ${mobilePad}px; }
          @media (min-width: 768px) { #cg-main { padding-top: ${desktopPad}px; } }
        `}</style>
        <main id="cg-main">{children}</main>
        <Footer config={footer} settings={settings} logoUrl={header.logoUrl} />
      </body>
    </html>
  );
}
