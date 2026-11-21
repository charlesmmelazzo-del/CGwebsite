import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: { absolute: "Passport · Common Good" },
  description: "Your Common Good Passport.",
  // A members' area: never in search results.
  robots: { index: false, follow: false },
  manifest: "/passport/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Passport", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/passport/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/passport/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#13170F",
  viewportFit: "cover",
};

/**
 * Passport runs in its own shell, like the Pop Up Zone: the site header and
 * footer are hidden for /passport (data-zone="passport", set by the root
 * layout and ZoneWatcher).
 */
export default function PassportLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-[#13170F] text-[#EDE6D3]">{children}</div>;
}
