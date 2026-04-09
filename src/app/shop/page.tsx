import { getPageHeader } from "@/lib/pageheaders";
import { getShopTabs } from "@/lib/pagedata";
import ShopPageClient from "./ShopPageClient";

export default async function ShopPage() {
  const [header, shopTabs] = await Promise.all([
    getPageHeader("shop"),
    getShopTabs(),
  ]);
  return <ShopPageClient header={header} shopTabs={shopTabs} />;
}
