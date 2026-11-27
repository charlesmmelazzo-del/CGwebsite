import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: { absolute: "Passport · Common Good" },
  description: "Your Common Good Passport.",
  // A members' area: never in search results.
  robots: { index: false, follow: false },
  manifest: "/passport/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Passport", statusBarStyle: "black-translucent" },
  icons: {
    // File 16, Part 10: the passport booklet icon (Passport pages only; the public site keeps its own favicon).
    icon: [{ url: "/passport/icons/icon-192.png?v=book2", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/passport/icons/apple-touch-icon.png?v=book2", sizes: "180x180", type: "image/png" }],
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
