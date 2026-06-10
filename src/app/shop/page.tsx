import type { Metadata } from "next";
import { getPageHeader } from "@/lib/pageheaders";
import { getShopTabs } from "@/lib/pagedata";
import ShopPageClient from "./ShopPageClient";

export const metadata: Metadata = {
  title: "Shop & Gift Cards",
  description:
    "Bring Common Good home — bottles, merch, cocktails to go, memberships, and gift cards from our Glen Ellyn, IL cocktail house.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage() {
  const [header, shopTabs] = await Promise.all([
    getPageHeader("shop"),
    getShopTabs(),
  ]);
  return <ShopPageClient header={header} shopTabs={shopTabs} />;
}
