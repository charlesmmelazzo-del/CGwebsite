import type { Metadata } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import FontLoader from "@/components/FontLoader";

/**
 * Fallback for KorinthSerial (headings / display).
 * Once you drop KorinthSerial .woff2 files into /public/fonts/,
 * the @font-face rule in globals.css takes priority automatically.
 */
const korinthFallback = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-korinth-fallback",
  display: "swap",
});

/**
 * Fallback for Futura (body / nav / UI).
 * Jost is a geometric sans-serif built on the same skeleton as Futura —
 * spacing, proportions, and rhythm are nearly identical.
 * Replace with real Futura woff2 files in /public/fonts/ when ready.
 */
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${korinthFallback.variable} ${futuraFallback.variable} antialiased`}
      >
        <FontLoader />
        <Header />
        <main className="pt-[58px] md:pt-[78px]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
