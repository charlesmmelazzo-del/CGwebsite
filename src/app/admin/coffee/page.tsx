import { MenuAdminPanel } from "@/app/admin/menu/page";
import type { MenuTab, MenuItem } from "@/types";

const COFFEE_TABS: MenuTab[] = [
  { id: "drip", label: "Drip Coffee", order: 0, active: true },
  { id: "espresso", label: "Espresso Drinks", order: 1, active: true },
  { id: "tea", label: "Tea", order: 2, active: true },
  { id: "treats", label: "Treats", order: 3, active: true },
];

const COFFEE_ITEMS: MenuItem[] = [
  { id: "c1", tabId: "drip", order: 0, active: true, title: "Drip Coffee", description: "Pouring @metriccoffee" },
  { id: "c2", tabId: "espresso", order: 0, active: true, title: "Iced Oat Milk Latte", description: "Rotating specialty lattes" },
  { id: "c3", tabId: "tea", order: 0, active: true, title: "Seasonal Tea", description: "Ask your barista" },
  { id: "c4", tabId: "treats", order: 0, active: true, title: "Bang Bang Pie Treats", description: "Biscuits, quiche, tomato pot pies from @bangbangpie" },
];

export default function AdminCoffeePage() {
  return <MenuAdminPanel pageLabel="Coffee Menu" initialTabs={COFFEE_TABS} initialItems={COFFEE_ITEMS} />;
}
