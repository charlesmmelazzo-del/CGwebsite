import { getCoffeeData } from "@/lib/coffeedata";
import { getPageHeader } from "@/lib/pageheaders";
import CoffeePageClient from "./CoffeePageClient";

export default async function CoffeePage() {
  const [{ tabs, items }, header] = await Promise.all([
    getCoffeeData(),
    getPageHeader("coffee"),
  ]);
  return <CoffeePageClient initialTabs={tabs} initialItems={items} header={header} />;
}
