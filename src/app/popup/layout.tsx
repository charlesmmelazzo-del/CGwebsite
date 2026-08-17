import type { Metadata } from "next";
import PopupBar from "@/components/popup/PopupBar";
import { getViewer } from "@/lib/popup/auth";

export const metadata: Metadata = {
  title: "Pop Up Zone",
  description:
    "Common Good's Pop Up Zone — see the current pop-up cocktail menu and vote for your favorites.",
  // A members' corner reached from the footer, not something to surface in
  // search results. Flip to `index: true` if that changes.
  robots: { index: false, follow: false },
};

/**
 * The Pop Up Zone runs in its own shell.
 *
 * The main site header and footer are suppressed for /popup/* (see the root
 * layout) because pop-up templates need the full viewport and their own visual
 * language — a trivia board or a mini game can't sit inside the normal chrome.
 */
export default async function PopupLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();

  return (
    <div className="min-h-screen bg-[#0E1109] text-white">
      <PopupBar viewer={viewer} />
      {children}
    </div>
  );
}
