import type { Metadata } from "next";
import { getMenuData } from "@/lib/menudata";
import { getPageHeader } from "@/lib/pageheaders";
import MenuPageClient from "./MenuPageClient";

export const metadata: Metadata = {
  title: "Cocktail Menu",
  description:
    "Explore the seasonal cocktail menu at Common Good Cocktail House in Glen Ellyn, IL — modern, classic, and upscale drinks crafted in house.",
  alternates: { canonical: "/menu" },
};

export default async function MenuPage() {
  const [{ tabs, items }, header] = await Promise.all([
    getMenuData(),
    getPageHeader("menu"),
  ]);
  return <MenuPageClient initialTabs={tabs} initialItems={items} header={header} />;
}
