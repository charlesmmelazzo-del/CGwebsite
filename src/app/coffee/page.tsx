import type { Metadata } from "next";
import { getCoffeeMenus } from "@/lib/coffeedata";
import { getPageHeader } from "@/lib/pageheaders";
import CoffeePageClient from "./CoffeePageClient";

export const metadata: Metadata = {
  title: "Coffee",
  description:
    "Specialty coffee by day at Common Good in Glen Ellyn, IL — open mornings for espresso, pour-overs, and house drinks before the bar opens.",
  alternates: { canonical: "/coffee" },
};

export default async function CoffeePage() {
  const [menus, header] = await Promise.all([
    getCoffeeMenus(),
    getPageHeader("coffee"),
  ]);
  return <CoffeePageClient menus={menus} header={header} />;
}
