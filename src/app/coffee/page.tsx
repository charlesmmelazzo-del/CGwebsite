import { getCoffeeMenus } from "@/lib/coffeedata";
import { getPageHeader } from "@/lib/pageheaders";
import CoffeePageClient from "./CoffeePageClient";

export default async function CoffeePage() {
  const [menus, header] = await Promise.all([
    getCoffeeMenus(),
    getPageHeader("coffee"),
  ]);
  return <CoffeePageClient menus={menus} header={header} />;
}
