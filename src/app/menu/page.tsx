import { getMenuData } from "@/lib/menudata";
import MenuPageClient from "./MenuPageClient";

export default async function MenuPage() {
  const { tabs, items } = await getMenuData();
  return <MenuPageClient initialTabs={tabs} initialItems={items} />;
}
