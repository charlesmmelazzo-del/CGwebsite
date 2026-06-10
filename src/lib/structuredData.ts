import { SITE_URL } from "@/lib/constants";
import type { SiteSettings } from "@/types";

// JSON-LD for the business. This is what powers Google's local pack / Maps
// knowledge panel for searches like "cocktail bar Glen Ellyn" — the single
// highest-leverage SEO item for a physical venue.
//
// Address and opening hours are fixed (single location); phone and social
// links are pulled from live settings so admin edits stay in sync.
export function buildBusinessJsonLd(settings: SiteSettings) {
  const sameAs = (settings.socialLinks ?? [])
    .map((s) => s.url)
    .filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "BarOrPub",
    "@id": `${SITE_URL}/#business`,
    name: "Common Good Cocktail House",
    description:
      "Modern, classic, upscale and seasonal cocktails in the heart of Glen Ellyn, Illinois.",
    url: SITE_URL,
    telephone: settings.phone,
    email: settings.email,
    image: `${SITE_URL}/opengraph-image`,
    priceRange: "$$",
    servesCuisine: ["Cocktails", "Coffee"],
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.address || "560 Crescent Blvd.",
      addressLocality: "Glen Ellyn",
      addressRegion: "IL",
      postalCode: "60137",
      addressCountry: "US",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        opens: "07:00",
        closes: "12:00",
        name: "Coffee",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday"],
        opens: "17:00",
        closes: "23:00",
        name: "Cocktails",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Friday", "Saturday"],
        opens: "12:00",
        closes: "01:00",
        name: "Cocktails",
      },
    ],
    ...(sameAs.length ? { sameAs } : {}),
  };
}
