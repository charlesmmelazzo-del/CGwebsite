import type { Metadata } from "next";
import { getCoffeeMenus } from "@/lib/coffeedata";
import { getPageHeader } from "@/lib/pageheaders";
import { getCoffeeFeed } from "@/lib/coffee/feed";
import { composeTabs } from "@/lib/coffee/live";
import CoffeePageClient from "./CoffeePageClient";

export const metadata: Metadata = {
  title: "Coffee",
  description:
    "Specialty coffee by day at Common Good in Glen Ellyn, IL — open mornings for espresso, pour-overs, and house drinks before the bar opens.",
  alternates: { canonical: "/coffee" },
};

export default async function CoffeePage() {
  // The tabs and their settings are read on every request (admin changes show at once); the Toast menu itself is
  // read from the Bible at most every 10 minutes, keeping the last good copy (src/lib/coffee/feed.ts).
  const [menus, header, { feed }] = await Promise.all([
    getCoffeeMenus(),
    getPageHeader("coffee"),
    getCoffeeFeed(),
  ]);
  const { tabs } = composeTabs(
    menus.map((m) => ({ id: m.id, label: m.label, live: m.live, hasPdf: !!(m.pdfPages?.length || m.imageUrl) })),
    feed,
  );
  // The tab settings themselves stay on the server; the page gets only what guests see.
  const pageMenus = menus.map((m) => ({ ...m, live: undefined }));
  return <CoffeePageClient menus={pageMenus} live={tabs} header={header} />;
}
