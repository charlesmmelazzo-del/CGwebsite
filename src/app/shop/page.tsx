import { getPageHeader } from "@/lib/pageheaders";
import ShopPageClient from "./ShopPageClient";

export default async function ShopPage() {
  const header = await getPageHeader("shop");
  return <ShopPageClient header={header} />;
}
