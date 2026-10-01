import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cocktail Competition",
  // Ticket-holders, contestants and partners arrive by link; nothing here
  // belongs in search results.
  robots: { index: false, follow: false },
};

/**
 * Competitions run in their own full-screen shell — the site header and
 * footer are hidden for /compete/* (see the root layout and globals.css).
 */
export default function CompeteLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-[#12110e] min-h-screen">{children}</div>;
}
