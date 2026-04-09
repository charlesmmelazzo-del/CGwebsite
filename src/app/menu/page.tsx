import { getMenuData } from "@/lib/menudata";
import { getPageHeader } from "@/lib/pageheaders";
import MenuPageClient from "./MenuPageClient";

export default async function MenuPage() {
  const [{ tabs, items }, header] = await Promise.all([
    getMenuData(),
    getPageHeader("menu"),
  ]);
  return <MenuPageClient initialTabs={tabs} initialItems={items} header={header} />;
}
